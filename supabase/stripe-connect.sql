-- Apply after required-auth-and-roles.sql. Run this migration once in Supabase SQL Editor.
begin;
create table if not exists public.seller_accounts (
  seller_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.seller_accounts enable row level security;
revoke all on public.seller_accounts from anon, authenticated;
grant select on public.seller_accounts to authenticated;
grant all on public.seller_accounts to service_role;
drop policy if exists "Read own Stripe account" on public.seller_accounts;
create policy "Read own Stripe account" on public.seller_accounts for select to authenticated using (seller_id=auth.uid());

alter table public.listings add column if not exists status text not null default 'available';
alter table public.listings add column if not exists reserved_order_id uuid;
alter table public.listings add column if not exists sold_at timestamptz;
alter table public.listings add column if not exists payments_enabled boolean not null default false;
-- Payment fields can only be changed by the server, not through listing creation.
revoke insert on public.listings from authenticated;
grant insert (id,title,description,price,category,seller_email,seller_id,image_url,location) on public.listings to authenticated;
grant select,update on public.listings to service_role;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  listing_title text not null,
  buyer_id uuid not null references auth.users(id),
  seller_id uuid not null references auth.users(id),
  buyer_email text not null,
  stripe_account_id text not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  amount_cents bigint not null check (amount_cents >= 50),
  fee_cents bigint not null check (fee_cents >= 0 and fee_cents <= amount_cents),
  currency text not null default 'usd' check (currency='usd'),
  status text not null default 'pending' check (status in ('pending','paid','expired')),
  checkout_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (buyer_id <> seller_id)
);
create unique index if not exists one_paid_order_per_listing on public.orders(listing_id) where status='paid';
create index if not exists orders_buyer_idx on public.orders(buyer_id,created_at desc);
create index if not exists orders_seller_idx on public.orders(seller_id,created_at desc);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
drop policy if exists "Participants read orders" on public.orders;
create policy "Participants read orders" on public.orders for select to authenticated using (buyer_id=auth.uid() or seller_id=auth.uid());

-- Publish readiness on listings without exposing private connected-account details.
create or replace function public.sync_seller_payment_readiness()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.listings set payments_enabled=(new.charges_enabled and new.payouts_enabled and new.details_submitted) where seller_id=new.seller_id;
  return new;
end;
$$;
revoke all on function public.sync_seller_payment_readiness() from public;
drop trigger if exists sync_seller_payment_readiness on public.seller_accounts;
create trigger sync_seller_payment_readiness after insert or update on public.seller_accounts for each row execute function public.sync_seller_payment_readiness();
create or replace function public.initialize_listing_payments()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.payments_enabled := exists(select 1 from public.seller_accounts where seller_id=new.seller_id and charges_enabled and payouts_enabled and details_submitted);
  new.status := 'available'; new.reserved_order_id := null; new.sold_at := null;
  return new;
end;
$$;
revoke all on function public.initialize_listing_payments() from public;
drop trigger if exists initialize_listing_payments on public.listings;
create trigger initialize_listing_payments before insert on public.listings for each row execute function public.initialize_listing_payments();
update public.listings l set payments_enabled=exists(select 1 from public.seller_accounts a where a.seller_id=l.seller_id and a.charges_enabled and a.payouts_enabled and a.details_submitted);

-- These transaction functions are server-only: never callable with the public key.
create or replace function public.reserve_checkout(p_listing_id uuid,p_buyer_id uuid,p_buyer_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.listings%rowtype; a public.seller_accounts%rowtype; o public.orders%rowtype; cents bigint;
begin
  select * into l from public.listings where id=p_listing_id for update;
  if not found then raise exception 'Listing unavailable' using errcode='P0002'; end if;
  if l.seller_id is null or l.seller_id=p_buyer_id then raise exception 'This listing cannot be purchased by this account' using errcode='22023'; end if;
  if l.status='sold' then raise exception 'This listing is sold' using errcode='P0001'; end if;
  if l.status='reserved' then
    select * into o from public.orders where id=l.reserved_order_id;
    if o.buyer_id=p_buyer_id and o.status='pending' then return to_jsonb(o); end if;
    raise exception 'Another buyer is checking out this listing' using errcode='P0001';
  end if;
  select * into a from public.seller_accounts where seller_id=l.seller_id;
  if not found or not a.charges_enabled or not a.payouts_enabled or not a.details_submitted then raise exception 'The seller has not completed payment setup' using errcode='22023'; end if;
  cents := round(l.price*100);
  if cents < 50 or cents > 99999999 then raise exception 'Price is outside card payment limits' using errcode='22023'; end if;
  insert into public.orders(listing_id,listing_title,buyer_id,seller_id,buyer_email,stripe_account_id,amount_cents,fee_cents,checkout_expires_at)
  values(l.id,l.title,p_buyer_id,l.seller_id,p_buyer_email,a.stripe_account_id,cents,round(cents*0.10),now()+interval '35 minutes') returning * into o;
  update public.listings set status='reserved', reserved_order_id=o.id where id=l.id;
  return to_jsonb(o);
end;
$$;
revoke all on function public.reserve_checkout(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_checkout(uuid,uuid,text) to service_role;

create or replace function public.expire_checkout(p_order_id uuid,p_session_id text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.status<>'pending' then return; end if;
  if o.stripe_session_id is not null and o.stripe_session_id is distinct from p_session_id then raise exception 'Checkout mismatch'; end if;
  update public.orders set status='expired' where id=o.id;
  update public.listings set status='available',reserved_order_id=null where id=o.listing_id and status='reserved' and reserved_order_id=o.id;
end;
$$;
revoke all on function public.expire_checkout(uuid,text) from public, anon, authenticated;
grant execute on function public.expire_checkout(uuid,text) to service_role;

create or replace function public.confirm_checkout(p_order_id uuid,p_session_id text,p_account_id text,p_amount bigint,p_currency text,p_payment_intent text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; l public.listings%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then return; end if;
  if o.stripe_account_id is distinct from p_account_id or o.amount_cents is distinct from p_amount or o.currency is distinct from p_currency
    or (o.stripe_session_id is not null and o.stripe_session_id is distinct from p_session_id) then raise exception 'Payment does not match the order'; end if;
  if o.status='paid' then return; end if;
  select * into l from public.listings where id=o.listing_id for update;
  if o.status<>'pending' or l.status<>'reserved' or l.reserved_order_id is distinct from o.id then raise exception 'Order reservation conflict'; end if;
  update public.orders set status='paid',stripe_session_id=p_session_id,stripe_payment_intent_id=p_payment_intent,paid_at=now() where id=o.id;
  update public.listings set status='sold',sold_at=now(),reserved_order_id=null where id=o.listing_id;
end;
$$;
revoke all on function public.confirm_checkout(uuid,text,text,bigint,text,text) from public, anon, authenticated;
grant execute on function public.confirm_checkout(uuid,text,text,bigint,text,text) to service_role;
commit;
