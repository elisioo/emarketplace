-- Run once in Supabase SQL Editor after the original marketplace schema.
-- Existing data is preserved. Existing accounts choose their role on next login.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in ('buyer', 'seller')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using (id = auth.uid());

-- Role is captured at signup, then stored independently of editable user metadata.
create or replace function public.create_marketplace_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role)
  values (new.id, case when new.raw_user_meta_data->>'role' in ('buyer','seller') then new.raw_user_meta_data->>'role' else null end)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_marketplace_profile() from public;
drop trigger if exists create_marketplace_profile on auth.users;
create trigger create_marketplace_profile after insert on auth.users
for each row execute function public.create_marketplace_profile();

-- Old accounts have no assigned role, avoiding accidental reassignment.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

create or replace function public.choose_account_role(desired_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if desired_role is null or desired_role not in ('buyer','seller') then raise exception 'Invalid account type'; end if;
  insert into public.profiles (id, role) values (auth.uid(), desired_role)
  on conflict (id) do update set role = excluded.role where profiles.role is null;
  if not found then raise exception 'Account type has already been chosen'; end if;
end;
$$;
revoke all on function public.choose_account_role(text) from public;
grant execute on function public.choose_account_role(text) to authenticated;

alter table public.listings add column if not exists seller_id uuid references auth.users(id) on delete set null;
alter table public.messages add column if not exists buyer_id uuid references auth.users(id) on delete set null;
create index if not exists listings_seller_id_idx on public.listings(seller_id);
create index if not exists messages_buyer_id_idx on public.messages(buyer_id);

-- Replace permissive policies: a remaining permissive policy could bypass role checks.
do $$ declare policy record; begin
  for policy in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('listings', 'messages') loop
    execute format('drop policy %I on %I.%I', policy.policyname, policy.schemaname, policy.tablename);
  end loop;
end $$;

alter table public.listings enable row level security;
alter table public.messages enable row level security;
revoke all on public.listings, public.messages from anon, authenticated;
grant select, insert on public.listings to authenticated;
grant insert on public.messages to authenticated;

create policy "Members browse listings" on public.listings for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role is not null));
create policy "Sellers create own listings" on public.listings for insert to authenticated
with check (
  seller_id = auth.uid()
  and seller_email = (auth.jwt()->>'email')
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'seller')
  and length(btrim(title)) > 0 and length(btrim(description)) > 0 and price >= 0 and length(btrim(category)) > 0
);
create policy "Members send own messages" on public.messages for insert to authenticated
with check (
  buyer_id = auth.uid() and buyer_email = (auth.jwt()->>'email')
  and exists (select 1 from public.profiles where id = auth.uid() and role is not null)
  and exists (select 1 from public.listings l where l.id = listing_id and l.seller_email = messages.seller_email)
  and length(btrim(message)) between 1 and 1500
);

drop policy if exists "Anyone can upload listing images" on storage.objects;
drop policy if exists "Sellers upload listing images" on storage.objects;
create policy "Sellers upload listing images" on storage.objects for insert to authenticated
with check (bucket_id = 'listing-images' and exists (select 1 from public.profiles where id = auth.uid() and role = 'seller'));
commit;
