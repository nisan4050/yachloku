// Queues "add expense" actions in IndexedDB while offline, so a user on a
// flight or in a place with no signal can still log a purchase — it syncs
// automatically the moment connectivity returns.
import { get, set } from 'idb-keyval';

const QUEUE_KEY = 'yachloku:offline-expense-queue';

export async function getQueue() {
  return (await get(QUEUE_KEY)) ?? [];
}

export async function enqueueExpense(expense) {
  const queue = await getQueue();
  const entry = { id: crypto.randomUUID(), expense, queuedAt: new Date().toISOString() };
  await set(QUEUE_KEY, [...queue, entry]);
  return entry;
}

export async function removeFromQueue(entryId) {
  const queue = await getQueue();
  await set(QUEUE_KEY, queue.filter((e) => e.id !== entryId));
}

export async function clearQueue() {
  await set(QUEUE_KEY, []);
}
