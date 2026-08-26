export function isImageUrl(url, type) {
  if (type) return type.startsWith('image/');
  return /\.(png|jpe?g|gif|webp|svg|avif|heic|heif)$/i.test(url ?? '');
}

export function isVideoUrl(url, type) {
  if (type) return type.startsWith('video/');
  return /\.(mp4|webm|mov|m4v|3gp|ogv)$/i.test(url ?? '');
}
