// Free, no-key exchange rates via the Frankfurter API (European Central Bank
// data), used to let an event mix currencies while balances are always
// computed in the event's base currency.

export async function fetchExchangeRates(baseCurrency) {
  const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  return { base: data.base, date: data.date, rates: { ...data.rates, [data.base]: 1 } };
}

/** Converts an amount from `fromCurrency` into the base currency using rates keyed by base->X. */
export function convertToBase(amount, fromCurrency, rates) {
  if (!fromCurrency || fromCurrency === rates.base) return amount;
  const rate = rates.rates[fromCurrency];
  if (!rate) return amount; // unknown currency — leave as-is rather than silently corrupting totals
  return Math.round((amount / rate + Number.EPSILON) * 100) / 100;
}
