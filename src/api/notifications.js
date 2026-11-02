import { serverFetch } from '@/api/server';

export function listNotifications() {
  return serverFetch('/notifications');
}

export function markNotificationRead(id) {
  return serverFetch(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
  return serverFetch('/notifications/read-all', { method: 'POST' });
}

/**
 * Notifies every event participant except the caller, respecting each
 * recipient's notification_prefs. Best-effort: failures are swallowed so a
 * notification issue never blocks the action that triggered it.
 */
export async function notifyEventMembers({ event, type, title, body, data, onlyUserIds }) {
  try {
    await serverFetch(`/events/${event.id}/notify`, {
      method: 'POST',
      body: { type, title, body, data, onlyUserIds },
    });
  } catch (err) {
    console.error('notifyEventMembers failed', err);
  }
}
