import { supabase } from '@/api/supabaseClient';
import { buildStoragePath } from '@/lib/utils';

export async function listExpenses(eventId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('event_id', eventId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createExpense(expense) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw error;
  return data;
}

export async function updateExpense(expenseId, patch) {
  const { data, error } = await supabase.from('expenses').update(patch).eq('id', expenseId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(expenseId) {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

export async function uploadReceipt(eventId, file) {
  const path = buildStoragePath(eventId, file);
  const { error } = await supabase.storage.from('receipts').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('receipts').getPublicUrl(path);
  return data.publicUrl;
}
