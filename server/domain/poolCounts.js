// @ts-check

/** @typedef {{url?: unknown, rating?: unknown, isBroken?: unknown}} PoolPhoto */

/**
 * @param {PoolPhoto|null|undefined} photo
 * @returns {boolean}
 */
const isUsablePoolPhoto = (photo) => (
  Boolean(photo?.url) && photo.rating !== 1 && !photo.isBroken
);

/**
 * Count photos that can enter playback from a pool, independent of the user's
 * current keyword and weather preferences.
 *
 * @param {unknown} photos
 * @returns {number}
 */
const countUsablePhotos = (photos) => Array.isArray(photos)
  ? photos.filter(isUsablePoolPhoto).length
  : 0;

module.exports = {
  countUsablePhotos
};
