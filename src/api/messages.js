import { serverFetch } from '@/api/server';

// Group chat
export const listGroupMessages = (eventId) => serverFetch(`/events/${eventId}/group-messages`);
export const sendGroupMessage = (eventId, message) => serverFetch(`/events/${eventId}/group-messages`, { method: 'POST', body: message });
export const markGroupRead = (eventId) => serverFetch(`/events/${eventId}/group-messages/read`, { method: 'POST' });

// Private chat
export const listPrivateMessages = (eventId, withParticipantId) =>
  serverFetch(`/events/${eventId}/private-messages?with=${encodeURIComponent(withParticipantId)}`);
export const sendPrivateMessage = (eventId, message) => serverFetch(`/events/${eventId}/private-messages`, { method: 'POST', body: message });
export const markPrivateRead = (eventId, fromParticipantId) =>
  serverFetch(`/events/${eventId}/private-messages/read`, { method: 'POST', body: { fromParticipantId } });
export const getPrivateUnread = (eventId) => serverFetch(`/events/${eventId}/private-unread`);

// Shared by both chats; `kind` is 'group' or 'private'.
const base = (kind) => (kind === 'group' ? 'group-messages' : 'private-messages');
export const editMessage = (kind, id, content) => serverFetch(`/${base(kind)}/${id}`, { method: 'PATCH', body: { content } });
export const deleteMessage = (kind, id) => serverFetch(`/${base(kind)}/${id}`, { method: 'DELETE' });
export const togglePin = (kind, id) => serverFetch(`/${base(kind)}/${id}/pin`, { method: 'POST' });
export const toggleReaction = (kind, id, emoji) => serverFetch(`/${base(kind)}/${id}/react`, { method: 'POST', body: { emoji } });

export const sendTyping = (eventId, body) => serverFetch(`/events/${eventId}/typing`, { method: 'POST', body }).catch(() => {});
export const getMediaCount = (eventId) => serverFetch(`/events/${eventId}/media-count`);
export const syncSettlementMessages = (eventId, messages) =>
  serverFetch(`/events/${eventId}/settlement-messages/sync`, { method: 'POST', body: { messages } });
