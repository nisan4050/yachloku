import { serverFetch } from '@/api/server';

export function getProfile() {
  return serverFetch('/me/profile');
}

export function updateNotificationPrefs(_userId, prefs) {
  return serverFetch('/me/profile', { method: 'PATCH', body: { notification_prefs: prefs } });
}

export function updatePhone(_userId, phone) {
  return serverFetch('/me/profile', { method: 'PATCH', body: { phone } });
}

export async function getProfilesByIds(userIds) {
  if (!userIds || userIds.length === 0) return [];
  return serverFetch(`/profiles?ids=${userIds.join(',')}`);
}
