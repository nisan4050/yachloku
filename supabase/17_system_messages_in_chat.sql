-- Auto-updating system messages inside private chat threads (e.g. "you owe X to Y").
-- Simpler than a separate system_messages table: lives directly in chat_messages so it
-- renders inline with the rest of the thread via the existing query/subscription.
alter table chat_messages add column if not exists is_system boolean default false;
-- Stable key identifying WHAT this system message represents (e.g. 'settlement:p1:p2'),
-- so we can find-and-update the same row instead of spamming a new one on every change.
alter table chat_messages add column if not exists system_key text;

create unique index if not exists chat_messages_system_key_idx
  on chat_messages (event_id, system_key)
  where system_key is not null and deleted_at is null;

-- System messages are written by the server logic (any participant's client, acting on
-- behalf of the pair) rather than a single author, so relax content ownership: anyone who
-- is a member of the event may insert/update a system-flagged row for that event.
drop policy if exists "members can send chat messages" on chat_messages;
create policy "members can send chat messages"
  on chat_messages for insert to authenticated
  with check (
    is_event_member(event_id, auth.uid())
    and (is_system = true or from_user_id = auth.uid())
  );
