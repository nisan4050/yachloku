import { syncSettlementMessages } from '@/api/messages';

const settlementKey = (fromId, toId) => `settlement:${fromId}:${toId}`;

function formatAmount(amount, currency, lang) {
  return amount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency });
}

/**
 * Keeps each pending settlement reflected as a single auto-updating system
 * message inside the relevant private chat thread — "you owe X to Y" with
 * the current amount. Called whenever balances are recomputed so the message
 * always matches the live balance. The server applies the diff atomically.
 */
export async function syncSettlementSystemMessages({ event, settlements, participantsById, lang }) {
  try {
    const messages = [];
    for (const s of settlements) {
      const from = participantsById[s.from];
      const to = participantsById[s.to];
      if (!from?.user_id || !to?.user_id || s.amount <= 0.01) continue;

      const amountLabel = formatAmount(s.amount, event.currency, lang);
      const content =
        lang === 'he'
          ? `🔔 עדכון אוטומטי: אתה חייב ל${to.name} ${amountLabel}\nלפירוט ההוצאות ← לשונית "איזון חשבון"`
          : `🔔 Auto-update: You owe ${to.name} ${amountLabel}\nSee the "Balances" tab for a breakdown`;
      messages.push({ key: settlementKey(s.from, s.to), fromParticipantId: s.from, toParticipantId: s.to, content });
    }
    await syncSettlementMessages(event.id, messages);
  } catch (err) {
    console.error('syncSettlementSystemMessages failed', err);
  }
}
