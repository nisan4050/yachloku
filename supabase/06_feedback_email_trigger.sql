-- Fires the send-feedback-email Edge Function via pg_net whenever someone
-- submits developer feedback, so it lands in nisan4050@gmail.com without
-- needing the app to stay open. Safe to run before the function is deployed
-- (see supabase/functions/send-feedback-email/index.ts) — pg_net just logs
-- and ignores the failed call until then.

create or replace function public.trigger_send_feedback_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://vzgbfgcefshqmkzhqndx.supabase.co/functions/v1/send-feedback-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET - set at deploy time, never commit>'
    ),
    body := jsonb_build_object('feedback_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists on_feedback_created on developer_feedback;
create trigger on_feedback_created
  after insert on developer_feedback
  for each row execute function public.trigger_send_feedback_email();
