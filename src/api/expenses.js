import { supabase } from '@/api/supabaseClient';
import { serverFetch } from '@/api/server';
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

export async function uploadReceipt(eventId, file) {
  const path = buildStoragePath(eventId, file);
  const { error } = await supabase.storage.from('receipts').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('receipts').getPublicUrl(path);
  return data.publicUrl;
}
