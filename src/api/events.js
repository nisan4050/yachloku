import { supabase } from '@/api/supabaseClient';

export async function listMyEvents() {
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getEvent(eventId) {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (error) throw error;
  return data;
}

export async function createEvent({ title, description, icon, currency, userId, participantName }) {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title,
      description,
      icon,
      currency,
      created_by: userId,
      manager_user_id: userId,
      participants: [{ id: crypto.randomUUID(), name: participantName, email: null, user_id: userId }],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findEventByInviteCode(inviteCode) {
  const { data, error } = await supabase.rpc('find_event_by_invite_code', {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  return data;
}

export async function joinEvent(inviteCode, { name, email }) {
  const { data, error } = await supabase.rpc('join_event_by_invite_code', {
    p_invite_code: inviteCode,
    p_name: name,
    p_email: email ?? null,
  });
  if (error) throw error;
  return data;
}

export async function updateEvent(eventId, patch) {
  const { data, error } = await supabase.from('events').update(patch).eq('id', eventId).select().single();
  if (error) throw error;
  return data;
}

export async function transferManager(eventId, currentManagerId, newManagerId) {
  const { data, error } = await supabase
    .from('events')
    .update({
      manager_user_id: newManagerId,
      previous_manager_user_id: currentManagerId,
      manager_changed_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(eventId) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}
