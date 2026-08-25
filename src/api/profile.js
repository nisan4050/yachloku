import { supabase } from '@/api/supabaseClient';

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateNotificationPrefs(userId, prefs) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ notification_prefs: prefs })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePhone(userId, phone) {
  const { data, error } = await supabase.from('profiles').update({ phone }).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

export async function getProfilesByIds(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const { data, error } = await supabase.from('profiles').select('id, phone').in('id', userIds);
  if (error) throw error;
  return data;
}
