// Remembers the last-used "who paid" / "split between" pattern per event, so
// the add-expense form starts pre-filled with what the user usually does.
// Always just an initial value — every field stays fully editable per use.

const STORAGE_KEY = 'yachloku:lastSplit';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function getRememberedSplit(eventId) {
  return readAll()[eventId] ?? null;
}

export function rememberSplit(eventId, { payerIds, splitType, includedIds, category }) {
  const all = readAll();
  all[eventId] = { payerIds, splitType, includedIds, category };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
