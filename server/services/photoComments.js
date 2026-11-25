// @ts-check
const fs = require('node:fs');
const { writeCollectionsFile } = require('../config/collectionsCodec.js');
const { photoCommentKey, normalizePhotoComment, readPhotoComments, withPhotoComment } = require('../domain/photoComments.js');

/** Local-only metadata in the existing collection file, never live photo rows.
 * Synchronous read/merge/rename avoids interleaving with other in-process writers.
 * @param {{jsonPath: string, fsImpl?: typeof fs}} options
 */
function createPhotoCommentStore({ jsonPath, fsImpl = fs }) {
  const readSnapshot = () => {
    const raw = fsImpl.readFileSync(jsonPath, 'utf8');
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new Error('Collection snapshot is not a record.');
    }
    return snapshot;
  };
  /** @param {{url?: unknown} | null | undefined} photo */
  const requireKey = (photo) => {
    const key = photoCommentKey(photo);
    if (!key) throw new Error('Photo identity unavailable.');
    return key;
  };

  return {
    /** @param {{url?: unknown} | null | undefined} photo */
    read(photo) {
      const key = requireKey(photo);
      const comments = readPhotoComments(readSnapshot().privatePhotoComments);
      return { key, comment: comments.entries[key] ?? '' };
    },
    /** @param {{url?: unknown} | null | undefined} photo @param {unknown} value */
    write(photo, value) {
      const key = requireKey(photo);
      const comment = normalizePhotoComment(value);
      if (comment === null) throw new Error('Invalid photo comment.');
      const snapshot = readSnapshot();
      const previous = readPhotoComments(snapshot.privatePhotoComments);
      if ((previous.entries[key] ?? '') === comment) return { key, comment };
      const next = { ...snapshot, privatePhotoComments: withPhotoComment(key, comment, previous) };
      writeCollectionsFile(jsonPath, `${JSON.stringify(next, null, 2)}\n`, fsImpl);
      return { key, comment };
    }
  };
}

module.exports = { createPhotoCommentStore };
