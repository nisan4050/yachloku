-- Bring chat_messages (private 1:1 chat) up to feature parity with
-- group_messages: reactions, file metadata, pinning. Also proactively fix
-- the same soft-delete/CHECK-constraint bug that broke group message
-- deletion (see 08_fix_message_delete_constraint.sql) before it bites here.
alter table chat_messages add column if not exists reactions jsonb default '{}'::jsonb;
alter table chat_messages add column if not exists media_meta jsonb;
alter table chat_messages add column if not exists pinned_at timestamptz;

create index if not exists chat_messages_pinned_idx on chat_messages (event_id) where pinned_at is not null;

alter table chat_messages drop constraint if exists chat_messages_check;
alter table chat_messages add constraint chat_messages_check
  check (deleted_at is not null or content is not null or media_url is not null or location is not null);
