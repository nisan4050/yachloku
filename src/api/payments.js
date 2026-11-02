import { serverFetch } from '@/api/server';

export function listPayments(eventId) {
  return serverFetch(`/events/${eventId}/payments`);
}

export function createPayment(payment) {
  return serverFetch(`/events/${payment.event_id}/payments`, { method: 'POST', body: payment });
}

export function listSettlementConfirmations(eventId) {
  return serverFetch(`/events/${eventId}/confirmations`);
}

export function unconfirmSettlement(eventId, fromParticipantId, toParticipantId) {
  const query = new URLSearchParams({ from: fromParticipantId, to: toParticipantId });
  return serverFetch(`/events/${eventId}/confirmations?${query}`, { method: 'DELETE' });
}

export function deletePayment(paymentId) {
  return serverFetch(`/payments/${paymentId}`, { method: 'DELETE' });
}

export function confirmSettlement(eventId, fromParticipantId, toParticipantId) {
  return serverFetch(`/events/${eventId}/confirmations`, {
    method: 'PUT',
    body: { fromParticipantId, toParticipantId },
  });
}
