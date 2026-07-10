export function toCssImageUrl(url) {
  const value = String(url ?? '').trim();

  if (!value) {
    return 'none';
  }

  const escapedUrl = encodeURI(value)
    .replace(/%25([0-9A-F]{2})/gi, '%$1')
    .replace(/["\\]/g, '\\$&');
  return `url("${escapedUrl}")`;
}
