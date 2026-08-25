-- ============================================================================
-- Schema additions for the UX upgrade batch: group polls + granular
-- notification preferences.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notification_prefs on profiles — per-user, granular push/toast settings.
-- ----------------------------------------------------------------------------
alter table profiles
  add column if not exists notification_prefs jsonb not null default '{
    "chat": true,
    "expenses": true,
    "balance_changes": true,
    "daily_digest": false
  }'::jsonb;

-- ----------------------------------------------------------------------------
-- polls / poll_votes — lightweight group polls inside the event group chat.
-- ----------------------------------------------------------------------------
create table polls (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  question     text not null check (char_length(question) between 1 and 200),
  options      jsonb not null, -- [{ id, label }]
  created_by   uuid not null references auth.users(id),
  closed       boolean not null default false,
  created_at   timestamptz not null default now()
);

create table poll_votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references polls(id) on delete cascade,
  option_id   text not null,
  user_id     uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (poll_id, user_id)
);

create index polls_event_id_idx on polls (event_id, created_at desc);
create index poll_votes_poll_id_idx on poll_votes (poll_id);

alter table polls enable row level security;
alter table poll_votes enable row level security;

create policy "members can view polls"
  on polls for select to authenticated
  using (is_event_member(event_id, auth.uid()));
create policy "members can create polls"
  on polls for insert to authenticated
  with check (is_event_member(event_id, auth.uid()) and created_by = auth.uid());
create policy "creator can close their poll"
  on polls for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "members can view poll votes"
  on poll_votes for select to authenticated
  using (exists (select 1 from polls p where p.id = poll_id and is_event_member(p.event_id, auth.uid())));
create policy "members can cast their own vote"
  on poll_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from polls p where p.id = poll_id and is_event_member(p.event_id, auth.uid()))
  );
create policy "members can change their own vote"
  on poll_votes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "members can remove their own vote"
  on poll_votes for delete to authenticated
  using (user_id = auth.uid());

alter publication supabase_realtime add table polls;
alter publication supabase_realtime add table poll_votes;
