// @ts-check

/**
 * Convert an arbitrary image input into a CSS background-image value.
 *
 * Empty and missing values intentionally map to the CSS identity `none`;
 * URL encoding and quoting stay inside this pure presentation boundary.
 *
 * @param {unknown} url
 * @returns {string}
 */
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
