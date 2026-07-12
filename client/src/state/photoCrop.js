export const DEFAULT_CONTAIN_CROP_PERCENT = 0;
export const DEFAULT_COVER_CROP_PERCENT = 100;
export const MAX_PHOTO_CROP_PERCENT = 200;

export function getDefaultPhotoCropPercent(scaleMode) {
  return scaleMode === 'contain'
    ? DEFAULT_CONTAIN_CROP_PERCENT
    : DEFAULT_COVER_CROP_PERCENT;
}

export function getPhotoCropBlend(cropPercent) {
  return cropPercent / DEFAULT_COVER_CROP_PERCENT;
}
