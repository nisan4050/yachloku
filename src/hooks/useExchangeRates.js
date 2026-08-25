import { useQuery } from '@tanstack/react-query';
import { fetchExchangeRates, convertToBase } from '@/lib/exchangeRates';

export function useExchangeRates(baseCurrency, enabled) {
  return useQuery({
    queryKey: ['exchange-rates', baseCurrency],
    queryFn: () => fetchExchangeRates(baseCurrency),
    enabled: Boolean(baseCurrency) && enabled,
    staleTime: 60 * 60 * 1000, // an hour is plenty for this use case
  });
}

/**
 * Returns expenses with amount, paid_by[].amount and split_between[].amount
 * all converted into the event's base currency — the settlement engine reads
 * those sub-amounts directly, so the top-level amount alone isn't enough.
 */
export function convertExpensesToBase(expenses, rates) {
  if (!rates) return expenses;
  return expenses.map((e) => {
    if (!e.currency || e.currency === rates.base) return e;
    return {
      ...e,
      amount: convertToBase(e.amount, e.currency, rates),
      original_amount: e.amount,
      original_currency: e.currency,
      paid_by: (e.paid_by ?? []).map((p) => ({ ...p, amount: convertToBase(p.amount, e.currency, rates) })),
      split_between: (e.split_between ?? []).map((s) => ({ ...s, amount: convertToBase(s.amount, e.currency, rates) })),
    };
  });
}
