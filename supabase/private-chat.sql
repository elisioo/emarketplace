-- Apply after required-auth-and-roles.sql. Preserves existing marketplace data.
begin;
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  listing_title text not null,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  buyer_email text not null,
  seller_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);
alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.messages add column if not exists sender_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists read_at timestamptz;
create index if not exists messages_conversation_time_idx on public.messages(conversation_id, created_at desc, id desc);
create index if not exists messages_unread_recipient_idx on public.messages(recipient_id) where read_at is null;
create index if not exists conversations_buyer_idx on public.conversations(buyer_id, updated_at desc);
create index if not exists conversations_seller_idx on public.conversations(seller_id, updated_at desc);

-- Only import messages already linked to verified account IDs; never claim by email.
insert into public.conversations(listing_id, listing_title, buyer_id, seller_id, buyer_email, seller_email)
select distinct on (l.id, m.buyer_id) l.id, l.title, m.buyer_id, l.seller_id, b.email, s.email
from public.messages m join public.listings l on l.id = m.listing_id
join auth.users b on b.id = m.buyer_id join auth.users s on s.id = l.seller_id
where m.conversation_id is null and m.buyer_id <> l.seller_id
order by l.id, m.buyer_id, m.created_at
on conflict (listing_id, buyer_id) do nothing;
update public.messages m set conversation_id = c.id, sender_id = c.buyer_id, recipient_id = c.seller_id
from public.conversations c where m.conversation_id is null and m.listing_id = c.listing_id and m.buyer_id = c.buyer_id;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon, authenticated;
grant select on public.conversations, public.messages to authenticated;
drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations" on public.conversations for select to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id);
-- Writes go only through validated RPC functions below.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='messages' loop
    execute format('drop policy %I on public.messages', p.policyname);
  end loop;
end $$;
create policy "Participants read messages" on public.messages for select to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

create or replace function public.send_chat_message(p_message_id uuid, p_message text, p_conversation_id uuid default null, p_listing_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_seller_email text;
  v_listing public.listings%rowtype;
  v_conversation public.conversations%rowtype;
  v_existing public.messages%rowtype;
  v_recipient uuid;
  v_recipient_email text;
  v_duplicate boolean := false;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id=v_uid and role is not null) then
    raise exception 'Account authentication required' using errcode='42501';
  end if;
  if p_message_id is null or p_message is null or length(btrim(p_message)) not between 1 and 1500 then
    raise exception 'Enter a message between 1 and 1500 characters' using errcode='22023';
  end if;
  select email into v_email from auth.users where id=v_uid;
  if p_conversation_id is not null then
    select * into v_conversation from public.conversations where id=p_conversation_id and (buyer_id=v_uid or seller_id=v_uid);
    if not found then raise exception 'Conversation unavailable' using errcode='42501'; end if;
  else
    select * into v_listing from public.listings where id=p_listing_id;
    if not found then raise exception 'Listing unavailable' using errcode='P0002'; end if;
    if v_listing.seller_id is null then raise exception 'Seller account is not linked to this listing' using errcode='22023'; end if;
    if v_listing.seller_id=v_uid then raise exception 'You cannot message your own listing' using errcode='22023'; end if;
    select email into v_seller_email from auth.users where id=v_listing.seller_id;
    if v_seller_email is null then raise exception 'Seller unavailable' using errcode='P0002'; end if;
    insert into public.conversations(listing_id, listing_title, buyer_id, seller_id, buyer_email, seller_email)
    values(v_listing.id, v_listing.title, v_uid, v_listing.seller_id, v_email, v_seller_email)
    on conflict (listing_id,buyer_id) do nothing;
    select * into v_conversation from public.conversations where listing_id=p_listing_id and buyer_id=v_uid;
  end if;
  v_recipient := case when v_uid=v_conversation.buyer_id then v_conversation.seller_id else v_conversation.buyer_id end;
  select email into v_recipient_email from auth.users where id=v_recipient;
  -- Preserve retries without sending duplicate chat messages.
  insert into public.messages(id, listing_id, buyer_id, buyer_email, seller_email, message, conversation_id, sender_id, recipient_id)
  values(p_message_id, v_conversation.listing_id, v_conversation.buyer_id, v_conversation.buyer_email, v_conversation.seller_email,
    btrim(p_message), v_conversation.id, v_uid, v_recipient)
  on conflict (id) do nothing;
  if not found then
    select * into v_existing from public.messages where id=p_message_id;
    if v_existing.sender_id is distinct from v_uid or v_existing.conversation_id is distinct from v_conversation.id or v_existing.message is distinct from btrim(p_message) then
      raise exception 'Message identifier conflict' using errcode='22023';
    end if;
    v_duplicate := true;
  else
    update public.conversations set updated_at=now() where id=v_conversation.id;
  end if;
  return jsonb_build_object('messageId',p_message_id,'conversationId',v_conversation.id,'listingTitle',v_conversation.listing_title,
    'recipientEmail',v_recipient_email,'senderEmail',v_email,'duplicate',v_duplicate);
end;
$$;
revoke all on function public.send_chat_message(uuid,text,uuid,uuid) from public;
grant execute on function public.send_chat_message(uuid,text,uuid,uuid) to authenticated;

create or replace function public.mark_chat_read(p_message_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.messages set read_at=now() where recipient_id=auth.uid() and id=any(p_message_ids) and read_at is null;
$$;
revoke all on function public.mark_chat_read(uuid[]) from public;
grant execute on function public.mark_chat_read(uuid[]) to authenticated;

create or replace function public.get_chat_inbox()
returns table(id uuid, listing_id uuid, listing_title text, buyer_id uuid, seller_id uuid, buyer_email text, seller_email text,
  updated_at timestamptz, last_message text, last_sender_id uuid, last_message_at timestamptz, unread_count bigint)
language sql stable security invoker set search_path = '' as $$
  select c.id,c.listing_id,c.listing_title,c.buyer_id,c.seller_id,c.buyer_email,c.seller_email,c.updated_at,
    m.message,m.sender_id,m.created_at,
    (select count(*) from public.messages u where u.conversation_id=c.id and u.recipient_id=auth.uid() and u.read_at is null)
  from public.conversations c
  left join lateral (select message,sender_id,created_at from public.messages where conversation_id=c.id order by created_at desc,id desc limit 1) m on true
  where c.buyer_id=auth.uid() or c.seller_id=auth.uid()
  order by coalesce(m.created_at,c.updated_at) desc;
$$;
revoke all on function public.get_chat_inbox() from public;
grant execute on function public.get_chat_inbox() to authenticated;

-- Enable private Postgres Changes events; row-level security still applies.
do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversations') then
      alter publication supabase_realtime add table public.conversations;
    end if;
  end if;
end $$;
commit;
