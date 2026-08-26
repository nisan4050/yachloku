// Sends a real push notification (Web Push for browsers/PWA, FCM for the
// native Android app) for a row just inserted into the `notifications` table.
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
//   npx supabase secrets set FCM_PROJECT_ID=<Firebase project_id>
//   npx supabase secrets set FCM_CLIENT_EMAIL=<service account client_email>
//   npx supabase secrets set FCM_PRIVATE_KEY=<service account private_key, with real newlines>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID') ?? '';
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL') ?? '';
const FCM_PRIVATE_KEY = Deno.env.get('FCM_PRIVATE_KEY') ?? '';

webpush.setVapidDetails('mailto:nisan4050@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// --- FCM (native Android push) — self-signed JWT -> OAuth2 access token,
// no external SDK needed since Deno's Web Crypto covers RS256 signing. ---

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = '';
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importFcmPrivateKey(pem: string) {
  const body = pem
    .replace(/\\n/g, '\n') // secrets are often stored as a single line with literal \n escapes
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }

  const key = await importFcmPrivateKey(FCM_PRIVATE_KEY);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: FCM_CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    )
  );
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`FCM token exchange failed: ${await res.text()}`);
  const data = await res.json();
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function sendFcm(token: string, title: string, body: string, url: string, tag: string) {
  const accessToken = await getFcmAccessToken();
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { url },
          // Same-trip notifications collapse into one instead of piling up
          // in the tray, and re-alert (sound/heads-up) when they do.
          android: { notification: { tag, notification_priority: 'PRIORITY_HIGH' } },
        },
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`FCM send failed: ${text}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
}

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

  // Mirrors NotificationBell's notificationPath() on the client — same
  // `data` shape, so a push and the in-app bell land in the same spot.
  let url = '/home';
  if (notification.event_id) {
    const params = new URLSearchParams();
    const d = notification.data ?? {};
    if (d.tab) params.set('tab', d.tab);
    if (d.msg) params.set('msg', d.msg);
    if (d.poll) params.set('poll', d.poll);
    if (d.expense) params.set('expense', d.expense);
    if (d.with) params.set('with', d.with);
    const qs = params.toString();
    url = `/events/${notification.event_id}${qs ? `?${qs}` : ''}`;
  }
  const tag = notification.event_id ? `event-${notification.event_id}` : 'general';

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', notification.user_id);

  const webResults = await Promise.allSettled(
    (subscriptions ?? []).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: notification.title, body: notification.body ?? '', url, tag })
      )
    )
  );

  await Promise.all(
    webResults.map((r, i) => {
      const statusCode = r.status === 'rejected' ? r.reason?.statusCode : null;
      if (statusCode === 404 || statusCode === 410) {
        return supabase.from('push_subscriptions').delete().eq('id', subscriptions[i].id);
      }
      return Promise.resolve();
    })
  );

  let fcmSent = 0;
  if (FCM_PROJECT_ID && FCM_CLIENT_EMAIL && FCM_PRIVATE_KEY) {
    const { data: fcmTokens } = await supabase
      .from('fcm_tokens')
      .select('*')
      .eq('user_id', notification.user_id);

    const fcmResults = await Promise.allSettled(
      (fcmTokens ?? []).map((row) =>
        sendFcm(row.token, notification.title, notification.body ?? '', url, tag)
      )
    );
    fcmSent = fcmResults.filter((r) => r.status === 'fulfilled').length;

    await Promise.all(
      fcmResults.map((r, i) => {
        const status = r.status === 'rejected' ? r.reason?.status : null;
        // 404 = unregistered token, 400 with INVALID_ARGUMENT usually means a stale/bad token too.
        if (status === 404 || status === 400) {
          return supabase.from('fcm_tokens').delete().eq('id', fcmTokens[i].id);
        }
        return Promise.resolve();
      })
    );
  }

  return new Response(
    JSON.stringify({ webPushSent: webResults.length, fcmSent }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
