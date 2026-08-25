-- ============================================================================
-- Fix: joining an event via invite code was fundamentally broken. Adding
-- yourself as a participant requires an UPDATE on events.participants, but
-- the "members can update events" policy requires you to already BE a
-- member — a chicken-and-egg problem that blocked every join, always.
--
-- Fix: a narrow, purpose-built function that looks up the event by code and
-- appends the caller as a participant, bypassing the ordinary update policy
-- (it can only ever add auth.uid() as a participant of the matched event —
-- nothing broader).
-- ============================================================================

create or replace function join_event_by_invite_code(
  p_invite_code text,
  p_name text,
  p_email text default null
)
returns events
language plpgsql
security definer set search_path = public
as $$
declare
  v_event events;
  v_already boolean;
begin
  select * into v_event from events where invite_code = upper(trim(p_invite_code));
  if v_event.id is null then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;

  v_already := exists (
    select 1 from jsonb_array_elements(v_event.participants) as p
    where (p ->> 'user_id')::uuid = auth.uid()
  );
  if v_already then
    return v_event;
  end if;

  update events
  set participants = participants || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid(),
    'name', p_name,
    'email', p_email,
    'user_id', auth.uid()
  ))
  where id = v_event.id
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function join_event_by_invite_code(text, text, text) to authenticated;
