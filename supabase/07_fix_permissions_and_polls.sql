-- ============================================================================
-- Fixes RLS gaps found from real usage, plus poll deletion.
-- ============================================================================

-- 1) group_messages: the old "authors can edit their group messages" policy
-- only let the ORIGINAL AUTHOR update a row. That silently broke every
-- update made by someone else on the row — reactions, pins, and read
-- receipts all update a message you didn't write, and a manager deleting
-- someone else's message updates it too. Broaden to any event member;
-- the app UI already gates who is offered edit/delete/pin.
drop policy if exists "authors can edit their group messages" on group_messages;
create policy "event members can update group messages"
  on group_messages for update to authenticated
  using (is_event_member(event_id, auth.uid()))
  with check (is_event_member(event_id, auth.uid()));

-- 2) settlement_confirmations: was open to any event member. Only the
-- debtor (the participant who owes, i.e. from_participant_id) or the
-- event manager should be able to confirm/unconfirm a settlement.
create or replace function public.is_settlement_debtor_or_manager(p_event_id uuid, p_from_participant_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from events e
    where e.id = p_event_id
      and (
        e.manager_user_id = p_user_id
        or exists (
          select 1 from jsonb_array_elements(e.participants) as p
          where p ->> 'id' = p_from_participant_id
            and (p ->> 'user_id')::uuid = p_user_id
        )
      )
  );
$$;

drop policy if exists "members can insert settlement confirmations" on settlement_confirmations;
create policy "debtor or manager can insert settlement confirmations"
  on settlement_confirmations for insert to authenticated
  with check (is_settlement_debtor_or_manager(event_id, from_participant_id, auth.uid()));

drop policy if exists "members can update settlement confirmations" on settlement_confirmations;
create policy "debtor or manager can update settlement confirmations"
  on settlement_confirmations for update to authenticated
  using (is_settlement_debtor_or_manager(event_id, from_participant_id, auth.uid()))
  with check (is_settlement_debtor_or_manager(event_id, from_participant_id, auth.uid()));

create policy "debtor or manager can delete settlement confirmations"
  on settlement_confirmations for delete to authenticated
  using (is_settlement_debtor_or_manager(event_id, from_participant_id, auth.uid()));

-- 3) polls: no delete policy existed at all. Creator or manager may delete
-- (poll_votes cascade automatically via the existing foreign key).
create policy "creator or manager can delete polls"
  on polls for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from events e where e.id = event_id and e.manager_user_id = auth.uid())
  );

-- Also let the manager edit/close any poll, not just its creator.
drop policy if exists "creator can close their poll" on polls;
create policy "creator or manager can update polls"
  on polls for update to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from events e where e.id = event_id and e.manager_user_id = auth.uid())
  )
  with check (
    created_by = auth.uid()
    or exists (select 1 from events e where e.id = event_id and e.manager_user_id = auth.uid())
  );
