-- Fix: chat_messages RLS policy was too restrictive for reactions from thread participants.
-- Changed from "only sender or receiver can update" to "any thread participant can update"
-- (like we did for group_messages), since reactions are edits made by OTHER participants.
drop policy if exists "thread participants can update chat messages" on chat_messages;
create policy "thread participants can update chat messages"
  on chat_messages for update to authenticated
  using (is_event_member(event_id, auth.uid()))
  with check (is_event_member(event_id, auth.uid()));
