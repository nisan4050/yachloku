import { supabase } from '@/api/supabaseClient';

export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  return data;
}
