import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
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

          const [{ data: expenses }, { data: payments }] = await Promise.all([
            supabase.from('expenses').select('*').eq('event_id', event.id),
            supabase.from('payments').select('*').eq('event_id', event.id),
          ]);

          const { balances } = getEventBalances(event.participants, expenses ?? [], payments ?? []);
          return {
            eventId: event.id,
            eventTitle: event.title,
            currency: event.currency,
            balance: balances[me.id] ?? 0,
          };
        })
      );

      const withBalance = perEvent.filter((e) => e && Math.abs(e.balance) > 0.005);
      const totalsByCurrency = withBalance.reduce((acc, e) => {
        acc[e.currency] = (acc[e.currency] ?? 0) + e.balance;
        return acc;
      }, {});

      return { perEvent: withBalance, totalsByCurrency };
    },
    enabled: Boolean(userId) && activeEvents.length > 0,
    staleTime: 30_000,
  });
}
