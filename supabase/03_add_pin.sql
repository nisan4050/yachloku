-- Pinned messages support for group_messages
alter table group_messages add column if not exists pinned_at timestamptz;
create index if not exists group_messages_pinned_idx on group_messages (event_id) where pinned_at is not null;
