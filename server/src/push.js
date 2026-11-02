import webpush from 'web-push';
import { JWT } from 'google-auth-library';
import { wrap } from './lib.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:nisan4050@gmail.com', FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY } = process.env;

const webPushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (webPushEnabled) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const fcmEnabled = Boolean(FCM_PROJECT_ID && FCM_CLIENT_EMAIL && FCM_PRIVATE_KEY);
const fcmAuth = fcmEnabled
  ? new JWT({ email: FCM_CLIENT_EMAIL, key: FCM_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/firebase.messaging'] })
  : null;

function notificationUrl(n) {
  if (!n.event_id) return '/home';
  const params = new URLSearchParams();
  for (const key of ['tab', 'msg', 'poll', 'expense', 'with']) if (n.data?.[key]) params.set(key, n.data[key]);
  const query = params.toString();
  return `/events/${n.event_id}${query ? `?${query}` : ''}`;
}

export function createPushDelivery(pool) {
  return async function deliverPush(n) {
    const url = notificationUrl(n);
    const tag = n.event_id ? `event-${n.event_id}` : 'general';

    if (webPushEnabled) {
      const { rows } = await pool.query('select * from push_subscriptions where user_id = $1', [n.user_id]);
      await Promise.allSettled(
        rows.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title: n.title, body: n.body ?? '', url, tag })
            );
          } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) await pool.query('delete from push_subscriptions where id = $1', [sub.id]);
            else console.error('web push failed', err.statusCode ?? err.message);
          }
        })
      );
    }

    if (fcmEnabled) {
      const { rows } = await pool.query('select * from fcm_tokens where user_id = $1', [n.user_id]);
      if (rows.length === 0) return;
      const { token: accessToken } = await fcmAuth.getAccessToken();
      await Promise.allSettled(
        rows.map(async (row) => {
          const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: row.token,
                notification: { title: n.title, body: n.body ?? '' },
                data: { url },
                android: { notification: { tag, notification_priority: 'PRIORITY_HIGH' } },
              },
            }),
          });
          if (res.status === 404 || res.status === 400) await pool.query('delete from fcm_tokens where id = $1', [row.id]);
          else if (!res.ok) console.error('fcm failed', res.status);
        })
      );
    }
  };
}

export function registerPushRoutes(app, pool, requireAuth) {
  app.post('/push/web', requireAuth, wrap(async (req, res) => {
    const { endpoint, p256dh, auth } = req.body ?? {};
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'endpoint, p256dh and auth are required' });
    await pool.query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)
       on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`,
      [req.userId, endpoint, p256dh, auth]
    );
    res.status(204).end();
  }));

  app.delete('/push/web', requireAuth, wrap(async (req, res) => {
    await pool.query('delete from push_subscriptions where user_id = $1 and endpoint = $2', [req.userId, String(req.query.endpoint ?? '')]);
    res.status(204).end();
  }));

  app.post('/push/fcm', requireAuth, wrap(async (req, res) => {
    const { token } = req.body ?? {};
    if (!token) return res.status(400).json({ error: 'token is required' });
    await pool.query('insert into fcm_tokens (user_id, token) values ($1, $2) on conflict (user_id, token) do nothing', [req.userId, token]);
    res.status(204).end();
  }));

  app.delete('/push/fcm', requireAuth, wrap(async (req, res) => {
    await pool.query('delete from fcm_tokens where user_id = $1', [req.userId]);
    res.status(204).end();
  }));
}
