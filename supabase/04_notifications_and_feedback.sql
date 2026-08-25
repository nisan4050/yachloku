-- ============================================================================
-- In-app notifications log + developer feedback storage
-- ============================================================================

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_id    uuid references events(id) on delete cascade,
  type        text not null, -- 'chat' | 'expense' | 'settlement' | 'join' | 'poll' | 'mention'
  title       text not null,
  body        text,
  data        jsonb default '{}'::jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id) where read = false;

alter table notifications enable row level security;

create policy "users can view their own notifications"
  on notifications for select to authenticated
  using (user_id = auth.uid());

create policy "event members can create notifications for other members"
  on notifications for insert to authenticated
  with check (event_id is null or is_event_member(event_id, auth.uid()));

create policy "users can update their own notifications"
  on notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter publication supabase_realtime add table notifications;

-- ----------------------------------------------------------------------------
-- developer_feedback — bug reports / feedback with an optional attachment
-- ----------------------------------------------------------------------------
create table if not exists developer_feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  message      text not null check (char_length(message) between 1 and 4000),
  attachment_url text,
  created_at   timestamptz not null default now()
);

alter table developer_feedback enable row level security;

create policy "users can submit feedback"
  on developer_feedback for insert to authenticated
  with check (user_id = auth.uid());

create policy "users can view their own feedback"
  on developer_feedback for select to authenticated
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('feedback', 'feedback', false)
on conflict (id) do nothing;

create policy "authenticated users can upload feedback attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback');
create policy "authenticated users can view feedback attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'feedback');
