import { supabase } from '@/api/supabaseClient';

const settlementKey = (fromId, toId) => `settlement:${fromId}:${toId}`;

function formatAmount(amount, currency, lang) {
  return amount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency });
}

/**
 * Keeps each pending settlement reflected as a single auto-updating system
 * message inside the relevant private chat thread — "you owe X to Y" with
 * the current amount. Called whenever balances are recomputed (expenses
 * added/edited/deleted, settlement confirmed/unconfirmed) so the message
 * always matches the live balance instead of going stale.
 */
export async function syncSettlementSystemMessages({ event, settlements, participantsById, lang }) {
  try {
    const activeKeys = new Set();

    for (const s of settlements) {
      const from = participantsById[s.from];
      const to = participantsById[s.to];
      if (!from?.user_id || !to?.user_id || s.amount <= 0.01) continue;

      const key = settlementKey(s.from, s.to);
      activeKeys.add(key);
      const amountLabel = formatAmount(s.amount, event.currency, lang);
      const content =
        lang === 'he'
          ? `🔔 עדכון אוטומטי: אתה חייב ל${to.name} ${amountLabel}\nלפירוט ההוצאות ← לשונית "איזון חשבון"`
          : `🔔 Auto-update: You owe ${to.name} ${amountLabel}\nSee the "Balances" tab for a breakdown`;

      const { data: existing } = await supabase
        .from('chat_messages')
        .select('id, content')
        .eq('event_id', event.id)
        .eq('system_key', key)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        if (existing.content !== content) {
          await supabase.from('chat_messages').update({ content, edited_at: new Date().toISOString() }).eq('id', existing.id);
        }
      } else {
        await supabase.from('chat_messages').insert({
          event_id: event.id,
          from_participant_id: s.from,
          to_participant_id: s.to,
          from_user_id: from.user_id,
          to_user_id: to.user_id,
          content,
          is_system: true,
          system_key: key,
        });
      }
    }

    // Clean up system messages for settlements that no longer exist (paid off, or netted away).
    const { data: staleMessages } = await supabase
      .from('chat_messages')
      .select('id, system_key')
      .eq('event_id', event.id)
      .like('system_key', 'settlement:%')
      .is('deleted_at', null);

    const toRemove = (staleMessages ?? []).filter((m) => !activeKeys.has(m.system_key));
    if (toRemove.length > 0) {
      await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString(), content: null })
        .in('id', toRemove.map((m) => m.id));
    }
  } catch (err) {
    console.error('syncSettlementSystemMessages failed', err);
  }
}
