-- Real Web Push delivery: fires the send-push Edge Function via pg_net
-- whenever a row is inserted into `notifications`, so users get a push
-- even when the app is closed. Requires the Edge Function to be deployed
-- (see supabase/functions/send-push/index.ts for the deploy commands) —
-- until then this trigger just calls a URL that doesn't exist yet and
-- pg_net logs (and ignores) the failure, so it's safe to run early.

create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_send_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://vzgbfgcefshqmkzhqndx.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'd14EVqCXn2xzukhVoazpOowrfzme3JvR'
    ),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists on_notification_created on notifications;
create trigger on_notification_created
  after insert on notifications
  for each row execute function public.trigger_send_push();
