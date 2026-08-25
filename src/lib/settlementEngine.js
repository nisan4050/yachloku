// Balance calculation and debt-simplification for a single event.
// All money values are treated as numbers in the event's base currency —
// currency conversion (if any) must happen before calling these functions.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * @param {Array<{id: string}>} participants
 * @param {Array<{paid_by: Array<{participant_id: string, amount: number}>, split_between: Array<{participant_id: string, amount: number}>}>} expenses
 * @param {Array<{from_participant_id: string, to_participant_id: string, amount: number}>} payments
 * @returns {Record<string, number>} participant_id -> net balance (positive = is owed money, negative = owes money)
 */
export function calculateBalances(participants, expenses, payments) {
  const balances = {};
  for (const p of participants) balances[p.id] = 0;

  for (const expense of expenses) {
    for (const paid of expense.paid_by ?? []) {
      balances[paid.participant_id] = (balances[paid.participant_id] ?? 0) + paid.amount;
    }
    for (const share of expense.split_between ?? []) {
      balances[share.participant_id] = (balances[share.participant_id] ?? 0) - share.amount;
    }
  }

  for (const payment of payments) {
    balances[payment.from_participant_id] = (balances[payment.from_participant_id] ?? 0) + payment.amount;
    balances[payment.to_participant_id] = (balances[payment.to_participant_id] ?? 0) - payment.amount;
  }

  for (const id of Object.keys(balances)) balances[id] = round2(balances[id]);
  return balances;
}

/**
 * Debt simplification: minimizes the number of transfers needed to zero out
 * every balance, via a greedy match of the largest creditor against the
 * largest debtor at each step. This is not always the mathematically
 * absolute minimum (that's NP-hard in general) but it's optimal or
 * near-optimal in practice for typical trip-sized groups.
 *
 * @param {Record<string, number>} balances participant_id -> net balance
 * @param {number} [epsilon] amounts smaller than this are treated as settled
 * @returns {Array<{from: string, to: string, amount: number}>}
 */
export function calculateSettlements(balances, epsilon = 0.01) {
  const debtors = [];
  const creditors = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance < -epsilon) debtors.push({ id, amount: -balance });
    else if (balance > epsilon) creditors.push({ id, amount: balance });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = round2(Math.min(debtor.amount, creditor.amount));

    if (amount > epsilon) {
      settlements.push({ from: debtor.id, to: creditor.id, amount });
    }

    debtor.amount = round2(debtor.amount - amount);
    creditor.amount = round2(creditor.amount - amount);

    if (debtor.amount <= epsilon) i += 1;
    if (creditor.amount <= epsilon) j += 1;
  }

  return settlements;
}

/**
 * Splits an expense amount across participants according to its split_type,
 * returning a split_between array ready to store on the expense row.
 *
 * @param {number} amount
 * @param {'equal'|'custom'|'percentage'} splitType
 * @param {Array<{participant_id: string, amount?: number, percentage?: number}>} shares
 *   for 'equal': just the list of participant_ids to split between (amount/percentage ignored)
 *   for 'custom': explicit amount per participant
 *   for 'percentage': explicit percentage per participant (must sum to 100)
 */
export function computeSplitBetween(amount, splitType, shares) {
  if (splitType === 'equal') {
    const n = shares.length;
    if (n === 0) return [];
    const base = Math.floor((amount / n) * 100) / 100;
    const remainder = round2(amount - base * n);
    return shares.map((s, idx) => ({
      participant_id: s.participant_id,
      amount: round2(base + (idx < Math.round(remainder * 100) ? 0.01 : 0)),
    }));
  }

  if (splitType === 'percentage') {
    return shares.map((s) => ({
      participant_id: s.participant_id,
      percentage: s.percentage,
      amount: round2((amount * s.percentage) / 100),
    }));
  }

  // custom
  return shares.map((s) => ({
    participant_id: s.participant_id,
    amount: round2(s.amount),
  }));
}
