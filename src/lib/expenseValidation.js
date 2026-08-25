// Real-time validation for expense form fields.
export function validateAmount(value) {
  const num = Number(value);
  if (!value) return { valid: false, error: 'סכום חובה' };
  if (isNaN(num)) return { valid: false, error: 'סכום לא חוקי' };
  if (num <= 0) return { valid: false, error: 'סכום חייב להיות חיובי' };
  if (num > 1_000_000) return { valid: false, error: 'סכום גבוה מדי' };
  return { valid: true };
}

export function validateDescription(value) {
  if (!value || !value.trim()) return { valid: false, error: 'תיאור חובה' };
  if (value.length > 200) return { valid: false, error: 'תיאור קצר מדי (עד 200 תווים)' };
  return { valid: true };
}

export function detectDuplicate(currentExpense, recentExpenses, threshold = 5) {
  // Check if same amount + description within last N minutes
  if (!recentExpenses.length) return null;
  const now = new Date();
  const cutoff = new Date(now.getTime() - threshold * 60000);

  return recentExpenses.find(
    (e) =>
      new Date(e.created_at) > cutoff &&
      Math.abs(e.amount - currentExpense.amount) < 0.01 &&
      e.description.toLowerCase() === currentExpense.description.toLowerCase()
  );
}

export function hasChanged(current, initial) {
  const keys = Object.keys({ ...current, ...initial });
  return keys.some((key) => {
    const curr = current[key];
    const init = initial[key];
    // Deep compare arrays
    if (Array.isArray(curr) && Array.isArray(init)) {
      return JSON.stringify(curr) !== JSON.stringify(init);
    }
    return curr !== init;
  });
}
