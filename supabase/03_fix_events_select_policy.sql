-- ============================================================================
-- Fix: creating an event failed with "new row violates row-level security
-- policy for table events" even though the insert's WITH CHECK passed.
--
-- Root cause: the "members can view events" / "members can update events"
-- policies used is_event_member(id, auth.uid()), which re-queries the events
-- table by id. When PostgREST does INSERT ... RETURNING (or Prefer:
-- return=representation), that self-referential re-query can fail to see
-- the row just inserted in the same statement, so the RETURNING clause's
-- implicit RLS check fails and Postgres reports it as an RLS violation.
--
-- Fix: for policies on the events table itself, check the row's own columns
-- directly instead of re-querying the table.
-- ============================================================================

drop policy if exists "members can view events" on events;
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

drop policy if exists "members can update events" on events;
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
