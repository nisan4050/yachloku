import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Builds a storage-safe object key for an uploaded file.
 * Keys must stay ASCII-only, so the original filename (which may
 * contain Hebrew, spaces, or punctuation) is dropped — only its extension
 * is kept — and replaced with a random id.
 */
export function buildStoragePath(folder, file) {
  const extMatch = /\.([a-zA-Z0-9]{1,8})$/.exec(file.name);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
  return `${folder}/${crypto.randomUUID()}${ext}`;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
