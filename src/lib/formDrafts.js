// Auto-save form drafts to localStorage, with recovery on reload or if user abandons the form.
const DRAFTS_KEY = 'yachloku:form-drafts';

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function saveDraft(formKey, data) {
  const all = getAll();
  all[formKey] = { ...data, savedAt: new Date().toISOString() };
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
}

export function getDraft(formKey) {
  return getAll()[formKey] ?? null;
}

export function clearDraft(formKey) {
  const all = getAll();
  delete all[formKey];
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
}

export function clearAllDrafts() {
  localStorage.removeItem(DRAFTS_KEY);
}

export function hasDraft(formKey) {
  return Boolean(getDraft(formKey));
}
