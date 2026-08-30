// @ts-check

/** @typedef {'contain'|'cover'} PhotoScaleMode */
/** @typedef {number} PhotoCropPercent */

export const DEFAULT_CONTAIN_CROP_PERCENT = 0;
export const DEFAULT_COVER_CROP_PERCENT = 100;
export const MAX_PHOTO_CROP_PERCENT = 200;

/**
 * Resolve the crop baseline for the selected display mode. Unknown or absent
 * mode values intentionally retain the historical cover fallback.
 *
 * @param {PhotoScaleMode|null|undefined} scaleMode
 * @returns {PhotoCropPercent}
 */
export function getDefaultPhotoCropPercent(scaleMode) {
  return scaleMode === 'contain'
    ? DEFAULT_CONTAIN_CROP_PERCENT
    : DEFAULT_COVER_CROP_PERCENT;
}

/**
 * Convert the UI crop percentage into the interpolation weight used by the
 * preview projections.
 *
 * @param {PhotoCropPercent} cropPercent
 * @returns {number}
 */
export function getPhotoCropBlend(cropPercent) {
  return cropPercent / DEFAULT_COVER_CROP_PERCENT;
}
