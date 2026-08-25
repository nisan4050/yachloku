// Sends a real Web Push notification (works even when the app/tab is closed)
// for a row just inserted into the `notifications` table.
//
// Triggered by a Postgres trigger (see supabase/05_push_notifications.sql)
// via pg_net, not by a Supabase Database Webhook — so it needs no
// service_role key. The trigger and this function share a simple secret
// (WEBHOOK_SECRET) instead, checked below.
//
// Deploy:
//   npx supabase functions deploy send-push --no-verify-jwt
//   npx supabase secrets set VAPID_PUBLIC_KEY=<same as VITE_VAPID_PUBLIC_KEY>
//   npx supabase secrets set VAPID_PRIVATE_KEY=<from .env, see VAPID_PRIVATE_KEY>
//   npx supabase secrets set WEBHOOK_SECRET=<from supabase/05_push_notifications.sql>
//   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<Project Settings -> API -> service_role>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

webpush.setVapidDetails('mailto:nisan4050@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const { notification_id } = await req.json();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: notification, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notification_id)
    .single();
  if (notifError || !notification) {
    return new Response(JSON.stringify({ error: notifError?.message ?? 'notification not found' }), { status: 404 });
  }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', notification.user_id);

  const results = await Promise.allSettled(
    (subscriptions ?? []).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: notification.title,
          body: notification.body ?? '',
          url: notification.event_id ? `/events/${notification.event_id}` : '/home',
        })
      )
    )
  );

  // A 404/410 from the push service means the subscription is dead — clean it up.
  await Promise.all(
    results.map((r, i) => {
      const statusCode = r.status === 'rejected' ? r.reason?.statusCode : null;
      if (statusCode === 404 || statusCode === 410) {
        return supabase.from('push_subscriptions').delete().eq('id', subscriptions[i].id);
      }
      return Promise.resolve();
    })
  );

  return new Response(JSON.stringify({ sent: results.length }), { headers: { 'Content-Type': 'application/json' } });
});
