// @ts-check
// Pure read plan and response boundary; no slideshow command/fallback transport.
/** @param {number} page */
export const permanentGalleryRequest = page => ({
  path: `/api/admin/permanent-gallery?page=${page}&pageSize=24`,
  options: { method: 'GET', cache: 'no-store' }
});

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
/** @param {unknown} value @returns {value is number} */
const positive = value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
/** @param {unknown} photo */
const isGalleryPhoto = photo => isRecord(photo) && typeof photo.url === 'string' && Boolean(photo.url.trim())
  && typeof photo.title === 'string' && typeof photo.pool === 'string'
  && (photo.author === undefined || photo.author === null || typeof photo.author === 'string')
  && Array.isArray(photo.exclusions) && photo.exclusions.every(label => typeof label === 'string');

/** @param {unknown} data */
export const readPermanentGallery = data => {
  if (!isRecord(data) || !positive(data.page) || data.pageSize !== 24 || !positive(data.pages)
    || typeof data.total !== 'number' || !Number.isSafeInteger(data.total) || data.total < 0 || data.page > data.pages
    || data.pages !== Math.max(1, Math.ceil(data.total / data.pageSize))
    || !Array.isArray(data.photos) || data.photos.length > data.pageSize
    || data.photos.length !== Math.min(24, Math.max(0, data.total - (data.page - 1) * 24))
    || new Set(data.photos.map(photo => photo?.url)).size !== data.photos.length
    || !data.photos.every(isGalleryPhoto)) {
    throw new Error('Invalid permanent collection response.');
  }
  return data;
};
