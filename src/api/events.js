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

export function findEventByInviteCode(inviteCode) {
  return serverFetch(`/events/by-code/${encodeURIComponent(inviteCode)}`);
}

export function joinEvent(inviteCode, { name, email }) {
  return serverFetch('/events/join', { method: 'POST', body: { inviteCode, name, email: email ?? null } });
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
