-- fcm_tokens — Firebase Cloud Messaging device tokens, for native push
-- notifications from the Capacitor Android app (the WebView doesn't support
-- the Web Push API that push_subscriptions is for; native push needs a
-- separate token per installed device, sent via FCM instead of VAPID).

create table fcm_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null,
  created_at  timestamptz not null default now()
);

create unique index fcm_tokens_user_token_key on fcm_tokens(user_id, token);

alter table fcm_tokens enable row level security;

create policy "users manage their own fcm tokens"
  on fcm_tokens for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
