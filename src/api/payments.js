import { supabase } from '@/api/supabaseClient';

export async function listPayments(eventId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('event_id', eventId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPayment(payment) {
  const { data, error } = await supabase.from('payments').insert(payment).select().single();
  if (error) throw error;
  return data;
}

export async function listSettlementConfirmations(eventId) {
  const { data, error } = await supabase.from('settlement_confirmations').select('*').eq('event_id', eventId);
  if (error) throw error;
  return data;
}

export async function unconfirmSettlement(eventId, fromParticipantId, toParticipantId) {
  const { error } = await supabase
    .from('settlement_confirmations')
    .delete()
    .match({ event_id: eventId, from_participant_id: fromParticipantId, to_participant_id: toParticipantId });
  if (error) throw error;
}

export async function deletePayment(paymentId) {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) throw error;
}

export async function confirmSettlement(eventId, fromParticipantId, toParticipantId) {
  const { data, error } = await supabase
    .from('settlement_confirmations')
    .upsert(
      {
        event_id: eventId,
        from_participant_id: fromParticipantId,
        to_participant_id: toParticipantId,
        confirmed: true,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,from_participant_id,to_participant_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
