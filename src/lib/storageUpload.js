import { getToken } from '@/api/server';

/**
 * Uploads a file to the API with a real progress percentage (fetch has no upload progress, so XHR).
 * @param {string} bucket  receipts | event-photos | chat-media | feedback | avatars
 * @param {string} path    `<ownerId>/<uuid>.<ext>` from buildStoragePath
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<string>} public URL of the uploaded file
 */
export function uploadWithProgress(bucket, path, file, onProgress = () => {}) {
  const url = `${import.meta.env.VITE_API_URL}/uploads/${bucket}?path=${encodeURIComponent(path)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error body */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.url) resolve(body.url);
      else reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.send(file);
  });
}
