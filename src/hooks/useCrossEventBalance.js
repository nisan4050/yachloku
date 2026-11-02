import { useQuery } from '@tanstack/react-query';
import { listExpenses } from '@/api/expenses';
import { listPayments } from '@/api/payments';
import { getEventBalances } from '@/hooks/useExpenses';

/**
 * Aggregates the current user's net balance across every active event they
 * belong to — "how much am I owed / do I owe, overall". Runs one query per
 * event's expenses+payments, which is fine at personal-app scale (a handful
 * of active trips), and is cached like any other query.
 */
export function useCrossEventBalance(events, userId) {
  const activeEvents = (events ?? []).filter((e) => e.status === 'active');

  return useQuery({
    queryKey: ['cross-event-balance', userId, activeEvents.map((e) => e.id).sort().join(',')],
    queryFn: async () => {
      const perEvent = await Promise.all(
        activeEvents.map(async (event) => {
          const me = event.participants.find((p) => p.user_id === userId);
          if (!me) return null;

          const [expenses, payments] = await Promise.all([listExpenses(event.id), listPayments(event.id)]);

          const { balances, settlements } = getEventBalances(event.participants, expenses ?? [], payments ?? []);
          const participantsById = Object.fromEntries(event.participants.map((p) => [p.id, p]));
          const owedByPeople = settlements
            .filter((s) => s.to === me.id)
            .map((s) => ({ name: participantsById[s.from]?.name ?? '?', amount: s.amount }));

          return {
            eventId: event.id,
            eventTitle: event.title,
            currency: event.currency,
            balance: balances[me.id] ?? 0,
            owedByPeople,
          };
        })
      );

      const withBalance = perEvent.filter((e) => e && Math.abs(e.balance) > 0.005);

      // Two separate totals per currency — a debt in one trip is never offset
      // against being owed money in a different trip, since they're unrelated.
      const owedByMeTotals = {};
      const owedToMeTotals = {};
      for (const e of withBalance) {
        if (e.balance < 0) owedByMeTotals[e.currency] = (owedByMeTotals[e.currency] ?? 0) + Math.abs(e.balance);
        else owedToMeTotals[e.currency] = (owedToMeTotals[e.currency] ?? 0) + e.balance;
      }

      return { perEvent: withBalance, owedByMeTotals, owedToMeTotals };
    },
    enabled: Boolean(userId) && activeEvents.length > 0,
    staleTime: 30_000,
  });
}
