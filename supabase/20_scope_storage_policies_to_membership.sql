-- Security tightening found during a manual audit (not flagged by Supabase's
-- own advisor, which only checks RLS-enabled/disabled — these tables all had
-- RLS ON, just with policies far broader than intended).
--
-- chat-media / receipts: uploaded under `${eventId}/${uuid}.ext` (see
-- buildStoragePath in src/lib/utils.js), but their storage.objects policies
-- only checked `bucket_id = 'chat-media'` etc — ANY authenticated user could
-- read or upload to ANY event's chat attachments or receipts, not just their
-- own trips' members. Scope both to actual event membership via the first
-- path segment.
--
-- feedback: same story but scoped to the uploading user instead of an event
-- (feedback attachments are per-user, path is `${userId}/${uuid}.ext`) — any
-- authenticated user could read anyone else's feedback attachment.
--
-- event-photos / avatars intentionally left as-is: both are public buckets
-- (storage.buckets.public = true), so Supabase serves their objects' public
-- URLs directly without consulting these policies at all — the policies
-- below only govern the dashboard/API access path, not the actual read path
-- for those two. Random-UUID paths are the only thing gating them, which is
-- the accepted tradeoff for shareable gallery photos / profile pictures.

drop policy if exists "authenticated users can view chat media" on storage.objects;
create policy "event members can view chat media"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and is_event_member(((storage.foldername(name))[1])::uuid, auth.uid()));

drop policy if exists "authenticated users can upload chat media" on storage.objects;
create policy "event members can upload chat media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and is_event_member(((storage.foldername(name))[1])::uuid, auth.uid()));

drop policy if exists "authenticated users can view receipts" on storage.objects;
create policy "event members can view receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and is_event_member(((storage.foldername(name))[1])::uuid, auth.uid()));

drop policy if exists "authenticated users can upload receipts" on storage.objects;
create policy "event members can upload receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and is_event_member(((storage.foldername(name))[1])::uuid, auth.uid()));

drop policy if exists "authenticated users can view feedback attachments" on storage.objects;
create policy "users can view their own feedback attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "authenticated users can upload feedback attachments" on storage.objects;
create policy "users can upload their own feedback attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);
