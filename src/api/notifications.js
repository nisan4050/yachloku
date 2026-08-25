import { supabase } from '@/api/supabaseClient';

export async function listNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
}

/**
 * Notifies every event participant except `excludeUserId`, respecting each
 * recipient's notification_prefs (defaults to on when unset). Best-effort —
 * failures are swallowed so a notification issue never blocks the action
 * that triggered it.
 */
export async function notifyEventMembers({ event, excludeUserId, type, title, body, data }) {
  try {
    const prefKey = { chat: 'chat', expense: 'expenses', settlement: 'balance_changes' }[type];
    const recipients = (event.participants ?? [])
      .filter((p) => p.user_id && p.user_id !== excludeUserId)
      .map((p) => p.user_id);
    if (recipients.length === 0) return;

    let allowed = recipients;
    if (prefKey) {
      const { data: profiles } = await supabase.from('profiles').select('id, notification_prefs').in('id', recipients);
      allowed = (profiles ?? [])
        .filter((p) => p.notification_prefs?.[prefKey] !== false)
        .map((p) => p.id);
    }
    if (allowed.length === 0) return;

    await supabase.from('notifications').insert(
      allowed.map((userId) => ({
        user_id: userId,
        event_id: event.id,
        type,
        title,
        body,
        data: data ?? {},
      }))
    );
  } catch (err) {
    console.error('notifyEventMembers failed', err);
  }
}
