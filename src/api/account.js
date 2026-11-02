import { serverFetch } from '@/api/server';

export function deleteAccount() {
  return serverFetch('/me', { method: 'DELETE' });
}
