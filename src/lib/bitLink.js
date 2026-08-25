// Helpers for settling a debt via Bit (ביט), Israel's dominant P2P payment
// app. Bit has no public deep-link API for pre-filling a payment request —
// verified by searching for one; only a merchant-only "Bit Pay" business
// portal exists, which doesn't fit peer-to-peer settling. So the reliable
// part is copying the amount + phone number for the user to paste inside
// Bit themselves. The "try to open the app" part is best-effort:
// - Android: uses Chrome's documented intent:// syntax targeting Bit's
//   real Play Store package (com.bnhp.payments.paymentsapp, verified via
//   Play Store search), falling back to that Play Store listing if the
//   app isn't installed or nothing responds in time.
// - iOS: there is no verified way to launch a specific app from a web
//   page without its published custom URL scheme, which Bit hasn't
//   published — so this is skipped there rather than guessing one.

const ANDROID_PACKAGE = 'com.bnhp.payments.paymentsapp';
const IOS_APP_STORE_ID = '1182007739';

export function canAttemptOpenBit() {
  return /Android/i.test(navigator.userAgent);
}

export function copyForBit({ amount, currency, phone }) {
  const amountLabel = amount.toLocaleString('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 });
  const lines = [amountLabel];
  if (phone) lines.push(phone);
  const text = lines.join(' — ');
  navigator.clipboard.writeText(text);
  return text;
}

/** Best-effort: try to bring Bit to the foreground on Android. No-op (does nothing visible) if it doesn't work. */
export function tryOpenBit() {
  if (!canAttemptOpenBit()) return;

  const fallbackUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  const intentUrl = `intent://#Intent;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
  window.location.href = intentUrl;
}

export const BIT_IOS_APP_STORE_URL = `https://apps.apple.com/il/app/bit-%D7%91%D7%99%D7%98/id${IOS_APP_STORE_ID}`;
