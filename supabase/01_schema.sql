-- ============================================================================
-- יחלוקו (Yachloku) — Database schema
-- Postgres schema for Supabase, including RLS policies.
-- Run against a fresh Supabase project (SQL Editor, or `supabase db push`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type event_status as enum ('active', 'settled', 'archived');
create type expense_category as enum (
  'food', 'accommodation', 'transport', 'shopping',
  'entertainment', 'drinks', 'groceries', 'other'
);
create type split_type as enum ('equal', 'custom', 'percentage');

-- ----------------------------------------------------------------------------
-- profiles — mirrors auth.users for data we can safely expose to other
-- participants (display name, avatar). Created automatically on signup.
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- generic updated_at trigger helper
-- ----------------------------------------------------------------------------
create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- invite code generator — 6 uppercase alphanumeric chars, collision-checked
-- ----------------------------------------------------------------------------
create function generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I ambiguity
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from events where invite_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$;

-- ----------------------------------------------------------------------------
-- events — a trip / group event
-- ----------------------------------------------------------------------------
create table events (
  id                        uuid primary key default gen_random_uuid(),
  title                     text not null check (char_length(title) between 1 and 120),
  description               text,
  icon                      text default '🧳',
  currency                  text not null default 'ILS',
  status                    event_status not null default 'active',
  manager_user_id           uuid references auth.users(id),
  previous_manager_user_id  uuid references auth.users(id),
  manager_changed_at        timestamptz,
  invite_code               text not null unique default generate_invite_code(),
  -- participants: [{ id, name, email, user_id }]
  participants              jsonb not null default '[]'::jsonb,
  -- photos: [{ id, url, caption, uploaded_by, uploaded_at }]
  photos                    jsonb not null default '[]'::jsonb,
  created_by                uuid not null references auth.users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index events_invite_code_idx on events (invite_code);
create index events_created_by_idx on events (created_by);
create index events_manager_user_id_idx on events (manager_user_id);
create index events_participants_gin_idx on events using gin (participants);

create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- expenses
-- ----------------------------------------------------------------------------
create table expenses (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  description   text not null check (char_length(description) between 1 and 200),
  amount        numeric(12,2) not null check (amount > 0),
  currency      text not null default 'ILS',
  category      expense_category not null default 'other',
  -- paid_by: [{ participant_id, amount }]
  paid_by       jsonb not null default '[]'::jsonb,
  split_type    split_type not null default 'equal',
  -- split_between: [{ participant_id, amount, percentage }]
  split_between jsonb not null default '[]'::jsonb,
  date          date not null default current_date,
  receipt_url   text,
  notes         text,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index expenses_event_id_idx on expenses (event_id);
create index expenses_date_idx on expenses (event_id, date desc);
create index expenses_category_idx on expenses (event_id, category);

create trigger expenses_set_updated_at
  before update on expenses
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- payments — manual settlement transfers between participants
-- ----------------------------------------------------------------------------
create table payments (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references events(id) on delete cascade,
  from_participant_id  text not null,
  to_participant_id    text not null,
  amount               numeric(12,2) not null check (amount > 0),
  currency             text not null default 'ILS',
  date                 date not null default current_date,
  notes                text,
  created_by           uuid not null references auth.users(id),
  created_at           timestamptz not null default now()
);

create index payments_event_id_idx on payments (event_id);

-- ----------------------------------------------------------------------------
-- settlement_confirmations — mutual "debt closed" acknowledgement
-- ----------------------------------------------------------------------------
create table settlement_confirmations (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references events(id) on delete cascade,
  from_participant_id  text not null,
  to_participant_id    text not null,
  confirmed            boolean not null default false,
  confirmed_at         timestamptz,
  created_at           timestamptz not null default now(),
  unique (event_id, from_participant_id, to_participant_id)
);

create index settlement_confirmations_event_id_idx on settlement_confirmations (event_id);

-- ----------------------------------------------------------------------------
-- chat_messages — private 1:1 chat between two participants of an event
-- ----------------------------------------------------------------------------
create table chat_messages (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references events(id) on delete cascade,
  from_participant_id  text not null,
  to_participant_id    text not null,
  from_user_id         uuid not null references auth.users(id),
  to_user_id           uuid references auth.users(id),
  content              text,
  media_url            text,
  location             jsonb,
  reply_to_id          uuid references chat_messages(id) on delete set null,
  read                 boolean not null default false,
  edited_at            timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  check (content is not null or media_url is not null or location is not null)
);

create index chat_messages_event_id_idx on chat_messages (event_id, created_at desc);
create index chat_messages_thread_idx
  on chat_messages (event_id, from_participant_id, to_participant_id, created_at desc);
create index chat_messages_unread_idx on chat_messages (to_user_id, read) where read = false;

-- ----------------------------------------------------------------------------
-- group_messages — group chat visible to all participants of an event
-- ----------------------------------------------------------------------------
create table group_messages (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references events(id) on delete cascade,
  from_participant_id  text not null,
  from_user_id         uuid not null references auth.users(id),
  content              text,
  media_url            text,
  location             jsonb,
  reply_to_id          uuid references group_messages(id) on delete set null,
  edited_at            timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  check (content is not null or media_url is not null or location is not null)
);

create index group_messages_event_id_idx on group_messages (event_id, created_at desc);

-- ----------------------------------------------------------------------------
-- push_subscriptions — Web Push (VAPID) registrations
-- ----------------------------------------------------------------------------
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: is the given user a participant / owner / manager of the event?
-- security definer so it can read `events` regardless of the caller's RLS,
-- avoiding recursive-policy issues when used inside other tables' policies.
-- ----------------------------------------------------------------------------
create function is_event_member(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from events e
    where e.id = p_event_id
      and (
        e.created_by = p_user_id
        or e.manager_user_id = p_user_id
        or exists (
          select 1 from jsonb_array_elements(e.participants) as p
          where (p ->> 'user_id')::uuid = p_user_id
        )
      )
  );
$$;

-- Looking up an event by invite code (to join it) has to work for users who
-- aren't members yet, so it can't go through a normal RLS-gated select. This
-- function runs with elevated privileges but only ever returns the single
-- row matching the exact code — it does not expose the rest of the table.
create function find_event_by_invite_code(p_invite_code text)
returns events
language sql
stable
security definer set search_path = public
as $$
  select * from events where invite_code = upper(trim(p_invite_code)) limit 1;
$$;

grant execute on function find_event_by_invite_code(text) to authenticated;

alter table profiles enable row level security;
alter table events enable row level security;
alter table expenses enable row level security;
alter table payments enable row level security;
alter table settlement_confirmations enable row level security;
alter table chat_messages enable row level security;
alter table group_messages enable row level security;
alter table push_subscriptions enable row level security;

-- profiles: readable by any authenticated user (needed to show names/avatars
-- of other participants), writable only by the owner.
create policy "profiles are readable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "users manage their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- events: members (creator, manager, or a participant with a linked user_id)
-- can read/update; any authenticated user may create; only the creator or
-- current manager may delete.
-- Note: these check the row's own columns directly rather than calling
-- is_event_member(id, ...), which re-queries this same table by id — doing
-- that here breaks INSERT ... RETURNING, since PostgREST's implicit RLS
-- check on the newly-inserted row can fail to see it via a fresh self-query
-- within the same statement.
create policy "members can view events"
  on events for select
  to authenticated
  using (
    created_by = auth.uid()
    or manager_user_id = auth.uid()
    or exists (
      select 1 from jsonb_array_elements(participants) as p
      where (p ->> 'user_id')::uuid = auth.uid()
    )
  );

create policy "authenticated users can create events"
  on events for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "members can update events"
  on events for update
  to authenticated
  using (
    created_by = auth.uid()
    or manager_user_id = auth.uid()
    or exists (
      select 1 from jsonb_array_elements(participants) as p
      where (p ->> 'user_id')::uuid = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    or manager_user_id = auth.uid()
    or exists (
      select 1 from jsonb_array_elements(participants) as p
      where (p ->> 'user_id')::uuid = auth.uid()
    )
  );

create policy "creator or manager can delete events"
  on events for delete
  to authenticated
  using (created_by = auth.uid() or manager_user_id = auth.uid());

-- expenses / payments / settlement_confirmations / chat / group messages:
-- gated entirely on event membership.
create policy "members can view expenses"
  on expenses for select to authenticated
  using (is_event_member(event_id, auth.uid()));
create policy "members can insert expenses"
  on expenses for insert to authenticated
  with check (is_event_member(event_id, auth.uid()) and created_by = auth.uid());
create policy "members can update expenses"
  on expenses for update to authenticated
  using (is_event_member(event_id, auth.uid()))
  with check (is_event_member(event_id, auth.uid()));
create policy "members can delete expenses"
  on expenses for delete to authenticated
  using (is_event_member(event_id, auth.uid()));

create policy "members can view payments"
  on payments for select to authenticated
  using (is_event_member(event_id, auth.uid()));
create policy "members can insert payments"
  on payments for insert to authenticated
  with check (is_event_member(event_id, auth.uid()) and created_by = auth.uid());
create policy "members can update payments"
  on payments for update to authenticated
  using (is_event_member(event_id, auth.uid()))
  with check (is_event_member(event_id, auth.uid()));
create policy "members can delete payments"
  on payments for delete to authenticated
  using (is_event_member(event_id, auth.uid()));

create policy "members can view settlement confirmations"
  on settlement_confirmations for select to authenticated
  using (is_event_member(event_id, auth.uid()));
create policy "members can insert settlement confirmations"
  on settlement_confirmations for insert to authenticated
  with check (is_event_member(event_id, auth.uid()));
create policy "members can update settlement confirmations"
  on settlement_confirmations for update to authenticated
  using (is_event_member(event_id, auth.uid()))
  with check (is_event_member(event_id, auth.uid()));

create policy "members can view group messages"
  on group_messages for select to authenticated
  using (is_event_member(event_id, auth.uid()));
create policy "members can send group messages"
  on group_messages for insert to authenticated
  with check (is_event_member(event_id, auth.uid()) and from_user_id = auth.uid());
create policy "authors can edit their group messages"
  on group_messages for update to authenticated
  using (from_user_id = auth.uid())
  with check (from_user_id = auth.uid());

-- chat_messages: only the two participants of the thread may see it.
create policy "thread participants can view chat messages"
  on chat_messages for select to authenticated
  using (
    is_event_member(event_id, auth.uid())
    and (from_user_id = auth.uid() or to_user_id = auth.uid())
  );
create policy "members can send chat messages"
  on chat_messages for insert to authenticated
  with check (is_event_member(event_id, auth.uid()) and from_user_id = auth.uid());
create policy "thread participants can update chat messages"
  on chat_messages for update to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid())
  with check (from_user_id = auth.uid() or to_user_id = auth.uid());

-- push_subscriptions: strictly private to the owning user.
create policy "users manage their own push subscriptions"
  on push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- Realtime
-- ============================================================================
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table group_messages;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table payments;
alter publication supabase_realtime add table settlement_confirmations;

-- ============================================================================
-- Storage buckets (receipts, event photos, chat media, avatars)
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('receipts', 'receipts', false),
  ('event-photos', 'event-photos', true),
  ('chat-media', 'chat-media', false),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "authenticated users can upload receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');
create policy "authenticated users can view receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts');

create policy "authenticated users can upload event photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos');
create policy "anyone can view event photos"
  on storage.objects for select
  using (bucket_id = 'event-photos');

create policy "authenticated users can upload chat media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media');
create policy "authenticated users can view chat media"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-media');

create policy "users manage their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
