import { serverFetch } from '@/api/server';
import { uploadWithProgress } from '@/lib/storageUpload';
import { buildStoragePath } from '@/lib/utils';

export function listExpenses(eventId) {
  return serverFetch(`/events/${eventId}/expenses`);
}

export function createExpense(expense) {
  return serverFetch(`/events/${expense.event_id}/expenses`, { method: 'POST', body: expense });
}

export function updateExpense(expenseId, patch) {
  return serverFetch(`/expenses/${expenseId}`, { method: 'PATCH', body: patch });
}

export function deleteExpense(expenseId) {
  return serverFetch(`/expenses/${expenseId}`, { method: 'DELETE' });
}

export function uploadReceipt(eventId, file) {
  return uploadWithProgress('receipts', buildStoragePath(eventId, file), file);
}
