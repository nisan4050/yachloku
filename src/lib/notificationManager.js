import { Capacitor } from '@capacitor/core';
import { serverFetch } from '@/api/server';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const isNative = () => Capacitor.isNativePlatform();

export function isPushSupported() {
  if (isNative()) return true;
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

// --- Native (Android/iOS via Capacitor + Firebase Cloud Messaging) ---

async function subscribeNativePush(_userId) {
  const { PushNotifications } = await import('@capacitor/push-notifications');

  let status = (await PushNotifications.checkPermissions()).receive;
  if (status === 'prompt' || status === 'prompt-with-rationale') {
    status = (await PushNotifications.requestPermissions()).receive;
  }
  if (status !== 'granted') return null;

  return new Promise((resolve, reject) => {
    PushNotifications.addListener('registration', async (token) => {
      serverFetch('/push/fcm', { method: 'POST', body: { token: token.value } })
        .then(() => resolve(token.value))
        .catch(reject);
    });
    PushNotifications.addListener('registrationError', (err) => {
      reject(new Error(err.error ?? 'Push registration failed'));
    });
    PushNotifications.register();
  });
}

async function unsubscribeNativePush(_userId) {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.removeAllListeners();
  await serverFetch('/push/fcm', { method: 'DELETE' });
}

// --- Web (browser/PWA via the Web Push API) ---

async function subscribeWebPush(_userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const { endpoint, keys } = subscription.toJSON();
  await serverFetch('/push/web', { method: 'POST', body: { endpoint, p256dh: keys.p256dh, auth: keys.auth } });
  return subscription;
}

async function unsubscribeWebPush(_userId) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await serverFetch(`/push/web?endpoint=${encodeURIComponent(subscription.endpoint)}`, { method: 'DELETE' });
  await subscription.unsubscribe();
}

// --- Public API — picks the right path for the current platform ---

export async function subscribeToPush(userId) {
  if (!isPushSupported()) return null;
  return isNative() ? subscribeNativePush(userId) : subscribeWebPush(userId);
}

export async function unsubscribeFromPush(userId) {
  if (!isPushSupported()) return;
  return isNative() ? unsubscribeNativePush(userId) : unsubscribeWebPush(userId);
}
