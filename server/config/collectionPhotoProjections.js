// @ts-check

const { curry } = require('../utils/fn.js');

/** @typedef {Record<string, unknown> & {url?: unknown}} PhotoRecord */
/** @typedef {PhotoRecord | null | undefined} PhotoValue */

/**
 * Updaters are supplied by the effect shell and should return a fresh record
 * when changing a photo; unmatched and absent values pass through unchanged.
 *
 * @typedef {(photo: PhotoRecord) => PhotoRecord} PhotoUpdater
 */

/**
 * The overloads document the supported staged and direct forms of `curry`.
 *
 * @typedef {
 *   ((url: string) => (updater: PhotoUpdater) => (photo: PhotoValue) => PhotoValue)
 *   & ((url: string, updater: PhotoUpdater) => (photo: PhotoValue) => PhotoValue)
 *   & ((url: string, updater: PhotoUpdater, photo: PhotoValue) => PhotoValue)
 * } CurriedPhotoByUrl
 */

/**
 * The photo list stays data-last so a URL and updater can be partially applied
 * before mapping over a list.
 *
 * @typedef {
 *   ((url: string) => (updater: PhotoUpdater) => (photos?: PhotoValue[] | null) => PhotoValue[])
 *   & ((url: string, updater: PhotoUpdater) => (photos?: PhotoValue[] | null) => PhotoValue[])
 *   & ((url: string, updater: PhotoUpdater, photos?: PhotoValue[] | null) => PhotoValue[])
 * } CurriedPhotoListUpdater
 */

/**
 * Apply a pure updater only to the photo whose URL matches.
 *
 * @type {CurriedPhotoByUrl}
 */
const updatePhotoByUrl = curry(
  /**
   * @param {string} url
   * @param {PhotoUpdater} updater
   * @param {PhotoValue} photo
   * @returns {PhotoValue}
   */
  (url, updater, photo) => photo && photo.url === url ? updater(photo) : photo
);

/**
 * Map a URL-specific updater over a list without mutating the list or its
 * unmatched entries. A missing list has the empty-list identity.
 *
 * @type {CurriedPhotoListUpdater}
 */
const updatePhotosList = curry(
  /**
   * @param {string} url
   * @param {PhotoUpdater} updater
   * @param {PhotoValue[] | null | undefined} photos
   * @returns {PhotoValue[]}
   */
  (url, updater, photos) => photos
    ? photos.map(updatePhotoByUrl(url, updater))
    : []
);

module.exports = { updatePhotoByUrl, updatePhotosList };
