import { serverFetch } from '@/api/server';

export function listPolls(eventId) {
  return serverFetch(`/events/${eventId}/polls`);
}

export function createPoll({ eventId, question, options }) {
  return serverFetch(`/events/${eventId}/polls`, { method: 'POST', body: { question, options } });
}

export function castVote({ pollId, optionId }) {
  return serverFetch(`/polls/${pollId}/vote`, { method: 'POST', body: { optionId } });
}

export function closePoll(pollId) {
  return serverFetch(`/polls/${pollId}/close`, { method: 'POST' });
}

export function deletePoll(pollId) {
  return serverFetch(`/polls/${pollId}`, { method: 'DELETE' });
}

export function updatePoll({ pollId, question, options }) {
  return serverFetch(`/polls/${pollId}`, { method: 'PATCH', body: { question, options } });
}
