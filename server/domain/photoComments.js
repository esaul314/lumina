// @ts-check
const { getGooglePhotoMediaItemId } = require('../services/googlePhotosCache.js');

const MAX_COMMENT_LENGTH = 2000;
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** One identity across pools; no speculative public-URL canonicalization.
 * @param {{url?: unknown} | null | undefined} photo
 * @returns {string | null}
 */
function photoCommentKey(photo) {
  if (typeof photo?.url !== 'string' || !photo.url || photo.url.length > 8192) return null;
  try {
    const id = getGooglePhotoMediaItemId(photo.url);
    return id ? `google:${id}` : `url:${photo.url}`;
  } catch {
    return null;
  }
}

/** @param {unknown} value @returns {string | null} Empty string deliberately clears. */
function normalizePhotoComment(value) {
  return typeof value === 'string' && value.length <= MAX_COMMENT_LENGTH ? value.trim() : null;
}

/** Fail closed on corrupt/unknown private metadata; never silently erase it.
 * @param {unknown} value
 * @returns {{version: 1, entries: Record<string, string>}}
 */
function readPhotoComments(value) {
  if (value === undefined) return { version: 1, entries: {} };
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.entries)
    || !Object.entries(value.entries).every(([key, text]) => (
      /^(google|url):[\s\S]+$/.test(key) && typeof text === 'string'
      && text.length > 0 && normalizePhotoComment(text) === text
    ))) throw new Error('Private photo comments are unreadable or use an unsupported version.');
  return { version: 1, entries: Object.fromEntries(Object.entries(value.entries).map(([key, text]) => [key, String(text)])) };
}

/** Data-last immutable update; a clear is removal, not a tombstone.
 * @param {string} key @param {string} comment
 * @param {{version: 1, entries: Record<string, string>}} document
 * @returns {{version: 1, entries: Record<string, string>}}
 */
const withPhotoComment = (key, comment, document) => ({
  version: 1,
  entries: Object.fromEntries([
    ...Object.entries(document.entries).filter(([entryKey]) => entryKey !== key),
    ...(comment ? [[key, comment]] : [])
  ])
});

module.exports = { MAX_COMMENT_LENGTH, photoCommentKey, normalizePhotoComment, readPhotoComments, withPhotoComment };
