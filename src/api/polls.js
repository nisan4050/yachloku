import { supabase } from '@/api/supabaseClient';

export async function listPolls(eventId) {
  const { data, error } = await supabase
    .from('polls')
    .select('*, poll_votes(*)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPoll({ eventId, question, options, userId }) {
  const { data, error } = await supabase
    .from('polls')
    .insert({
      event_id: eventId,
      question,
      options: options.map((label) => ({ id: crypto.randomUUID(), label })),
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function castVote({ pollId, optionId, userId }) {
  const { data, error } = await supabase
    .from('poll_votes')
    .upsert({ poll_id: pollId, option_id: optionId, user_id: userId }, { onConflict: 'poll_id,user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function closePoll(pollId) {
  const { error } = await supabase.from('polls').update({ closed: true }).eq('id', pollId);
  if (error) throw error;
}

export async function deletePoll(pollId) {
  const { error } = await supabase.from('polls').delete().eq('id', pollId);
  if (error) throw error;
}

export async function updatePoll({ pollId, question, options }) {
  const optionIds = options.map((o) => o.id);
  const { error: updateError } = await supabase.from('polls').update({ question, options }).eq('id', pollId);
  if (updateError) throw updateError;
  // Drop votes for any option that no longer exists so results stay consistent.
  const { error: pruneError } = await supabase.from('poll_votes').delete().eq('poll_id', pollId).not('option_id', 'in', `(${optionIds.join(',')})`);
  if (pruneError) throw pruneError;
}
