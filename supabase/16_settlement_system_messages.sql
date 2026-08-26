-- System messages in chat for settlements, trip reminders, etc.
-- These auto-update when underlying data changes (soft updates via trigger)
create table if not exists system_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  -- For private chats: from_user_id is the initiating participant's user_id
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'settlement_owed', 'settlement_received', 'trip_reminder'
  payload jsonb not null, -- { settlement_id?, amount?, currency?, message? }
  created_at timestamp default now(),
  updated_at timestamp default now(),

  check (type in ('settlement_owed', 'settlement_received', 'trip_reminder'))
);

create index if not exists system_messages_event_idx on system_messages(event_id);
create index if not exists system_messages_users_idx on system_messages(from_user_id, to_user_id, event_id);
create index if not exists system_messages_type_idx on system_messages(type);
