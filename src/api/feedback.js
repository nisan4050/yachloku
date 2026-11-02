import { serverFetch } from '@/api/server';
import { uploadWithProgress } from '@/lib/storageUpload';
import { buildStoragePath } from '@/lib/utils';

export async function submitFeedback({ userId, message, file }) {
  let attachmentUrl = null;
  if (file) attachmentUrl = await uploadWithProgress('feedback', buildStoragePath(userId, file), file);
  await serverFetch('/feedback', { method: 'POST', body: { message, attachmentUrl } });
  return attachmentUrl;
}
