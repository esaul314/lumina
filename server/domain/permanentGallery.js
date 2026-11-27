// @ts-check
const { matchesExcludedKeywords } = require('./selectors.js');

/** @param {unknown} value @param {number} fallback @returns {number|null} */
const pageInteger = (value, fallback) => value === undefined ? fallback
  : typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value) : null;

/** Validate at the HTTP boundary; response work is always bounded. @param {Record<string, unknown>} query */
const galleryPageRequest = (query) => {
  const page = pageInteger(query.page, 1), pageSize = pageInteger(query.pageSize, 24);
  return page !== null && pageSize !== null && pageSize <= 60 ? { page, pageSize } : null;
};

/**
 * First permanent occurrence owns display metadata; URLs remain exact identities.
 * Scan existing owners, never build a second library or apply playback retention.
 * @param {{collections: Record<string, unknown>, googlePhotos?: unknown[], excludedKeywords?: unknown, page: number, pageSize: number}} input
 */
const projectPermanentGallery = ({ collections, googlePhotos = [], excludedKeywords, page, pageSize }) => {
  const seen = new Set();
  const rows = Object.entries(collections).concat([['Google Photos', googlePhotos]])
    .flatMap(([pool, photos]) => Array.isArray(photos) ? photos
      .filter(photo => photo?.loved === true && typeof photo.url === 'string' && photo.url.trim())
      .filter(photo => seen.has(photo.url) ? false : (seen.add(photo.url), true))
      .map(photo => ({ photo, pool })) : []);
  const total = rows.length, pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);
  return {
    page: currentPage, pageSize, total, pages,
    photos: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(({ photo, pool }) => ({
      url: photo.url, title: typeof photo.title === 'string' ? photo.title : 'Untitled image', pool,
      exclusions: [photo.rating === 1 && 'Banned rating', photo.isBroken && 'Marked broken',
        matchesExcludedKeywords(excludedKeywords, photo) && 'Excluded keyword'].filter(Boolean)
    }))
  };
};

module.exports = { galleryPageRequest, projectPermanentGallery };
