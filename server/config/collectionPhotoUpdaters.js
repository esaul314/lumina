// @ts-check

/** @typedef {Record<string, unknown> & {url?: unknown}} PhotoRecord */
/** @typedef {(photo: PhotoRecord) => PhotoRecord} PhotoUpdater */
/** @typedef {{rating: number, updater: PhotoUpdater}} PhotoRatingUpdate */

/**
 * Project the legacy rating parser and its data-last immutable updater.
 * `parseInt` coercion is intentionally preserved for existing callers.
 *
 * @param {unknown} rating
 * @returns {PhotoRatingUpdate}
 */
const projectPhotoRatingUpdate = (rating) => {
  const parsedRating = parseInt(/** @type {string} */ (rating), 10);
  return {
    rating: parsedRating,
    updater: (photo) => ({ ...photo, rating: parsedRating })
  };
};

/**
 * Build an immutable partial crop updater. Undefined fields are left untouched;
 * explicit null and other values retain the existing write-through behavior.
 *
 * @param {unknown} cropPercent
 * @param {unknown} cropPositionY
 * @returns {PhotoUpdater}
 */
const projectPhotoCropUpdater = (cropPercent, cropPositionY) => (photo) => ({
  ...photo,
  ...(cropPercent !== undefined && { cropPercent }),
  ...(cropPositionY !== undefined && { cropPositionY })
});

/**
 * Build the existing truthiness-coercing pairing updater.
 *
 * @param {unknown} preventPairing
 * @returns {PhotoUpdater}
 */
const projectPhotoPairingUpdater = (preventPairing) => (photo) => ({
  ...photo,
  preventPairing: !!preventPairing
});

/**
 * Mark a photo as broken using the same rating-1 feed-pruning policy.
 *
 * @type {PhotoUpdater}
 */
const projectBrokenPhoto = (photo) => ({ ...photo, rating: 1, isBroken: true });

module.exports = {
  projectPhotoRatingUpdate,
  projectPhotoCropUpdater,
  projectPhotoPairingUpdater,
  projectBrokenPhoto
};
