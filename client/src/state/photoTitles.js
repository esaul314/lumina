// @ts-check

const GOOGLE_PHOTOS_PROXY_PREFIX = '/api/google-photos/media/';
const GOOGLE_PHOTOS_SPLIT_TITLE_FALLBACK = 'Google Photos Cast';

/**
 * @param {unknown} createTime
 * @param {string | string[]} [locale]
 * @returns {string}
 */
export function formatGooglePhotoCaptureDate(createTime, locale) {
  if (typeof createTime !== 'string' || !createTime.trim()) {
    return '';
  }

  const date = new Date(createTime);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/**
 * @typedef {{ source?: string, url?: string, createTime?: unknown, title?: string | null } | null | undefined} PhotoTitleInput
 */

/**
 * @param {PhotoTitleInput} photo
 * @returns {boolean}
 */
function isGooglePhoto(photo) {
  return photo?.source === 'google_photos'
    || (typeof photo?.url === 'string' && photo.url.startsWith(GOOGLE_PHOTOS_PROXY_PREFIX));
}

/**
 * @param {PhotoTitleInput} photo
 * @param {string | string[]} [locale]
 * @returns {string}
 */
export function getPhotoSlideTitle(photo, locale) {
  if (!isGooglePhoto(photo)) {
    return photo?.title || '';
  }

  return formatGooglePhotoCaptureDate(photo.createTime, locale) || photo.title || '';
}

/**
 * @param {PhotoTitleInput} primaryPhoto
 * @param {PhotoTitleInput} secondaryPhoto
 * @param {string | string[]} [locale]
 * @returns {{ title: string, title2: string }}
 */
export function projectSplitSlideTitles(primaryPhoto, secondaryPhoto, locale) {
  return {
    title: getPhotoSlideTitle(primaryPhoto, locale) || GOOGLE_PHOTOS_SPLIT_TITLE_FALLBACK,
    title2: getPhotoSlideTitle(secondaryPhoto, locale) || GOOGLE_PHOTOS_SPLIT_TITLE_FALLBACK
  };
}
