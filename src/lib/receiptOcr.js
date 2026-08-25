// Client-side receipt scanning (no server, no API key) via tesseract.js.
// Best-effort: finds the largest currency-looking number in the recognized
// text and treats it as the total. Always presented to the user as a
// pre-fill they can correct, never applied silently.

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = await import('tesseract.js');
    workerPromise = createWorker('eng+heb');
  }
  return workerPromise;
}

/**
 * @param {File} file
 * @returns {Promise<{ amount: number | null, rawText: string }>}
 */
export async function scanReceipt(file) {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(file);

  const amount = extractLikelyTotal(text);
  return { amount, rawText: text };
}

function extractLikelyTotal(text) {
  // Matches numbers like 1,234.56 / 1234.56 / 1234 — with optional currency
  // symbols nearby. We take the largest match, which is usually the total
  // rather than a line-item.
  const matches = [...text.matchAll(/(?:[₪$€]\s*)?(\d{1,3}(?:[,.]\d{3})*(?:\.\d{1,2})?)(?:\s*[₪$€])?/g)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1_000_000);

  if (matches.length === 0) return null;
  return Math.max(...matches);
}
