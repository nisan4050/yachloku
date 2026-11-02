import { supabase } from '@/api/supabaseClient';
import { serverFetch } from '@/api/server';

export function listMyEvents() {
  return serverFetch('/events');
}

export function getEvent(eventId) {
  return serverFetch(`/events/${eventId}`);
}

export function createEvent({ title, description, icon, currency, participantName, extraParticipantNames }) {
  return serverFetch('/events', {
    method: 'POST',
    body: { title, description, icon, currency, participantName, extraParticipantNames },
  });
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

export function updateEvent(eventId, patch) {
  return serverFetch(`/events/${eventId}`, { method: 'PATCH', body: patch });
}

export function transferManager(eventId, _currentManagerId, newManagerId) {
  return serverFetch(`/events/${eventId}/transfer-manager`, { method: 'POST', body: { newManagerId } });
}

export function deleteEvent(eventId) {
  return serverFetch(`/events/${eventId}`, { method: 'DELETE' });
}
