export function isImageUrl(url, type) {
  if (type) return type.startsWith('image/');
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url ?? '');
}
