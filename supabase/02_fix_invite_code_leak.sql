-- ============================================================================
-- Security fix: the original "authenticated users can find events by invite
-- code" policy used `using (true)`, which — because RLS permissive policies
-- are OR'd together — exposed EVERY event (including other users' events and
-- their participant lists) to EVERY authenticated user, not just the one
-- event being looked up by code. Run this against your existing project.
-- ============================================================================

drop policy if exists "authenticated users can find events by invite code" on events;

create or replace function find_event_by_invite_code(p_invite_code text)
returns events
language sql
stable
security definer set search_path = public
as $$
  select * from events where invite_code = upper(trim(p_invite_code)) limit 1;
$$;

grant execute on function find_event_by_invite_code(text) to authenticated;
