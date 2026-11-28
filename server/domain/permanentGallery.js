// @ts-check
const { matchesExcludedKeywords } = require('./selectors.js');

/** @param {unknown} value @param {number} fallback @returns {number|null} */
const pageInteger = (value, fallback) => value === undefined ? fallback
  : typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value) : null;
/** @param {string} value */
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
const sorts = ['stored', 'title', 'title-desc', 'author', 'author-desc', 'pool', 'pool-desc'];

/** Validate bounded lexical queries, never regex or private fields. @param {Record<string, unknown>} query */
const galleryPageRequest = query => {
  const page = pageInteger(query.page, 1), pageSize = pageInteger(query.pageSize, 24);
  const { scope = 'permanent', q = '', sort = 'stored' } = query;
  if (page === null || pageSize === null || pageSize > 60 || typeof scope !== 'string' || scope.length > 1024
    || typeof q !== 'string' || q.length > 200 || normalize(q).length > 200
    || normalize(q).split(' ').length > 12 || typeof sort !== 'string' || !sorts.includes(sort)) return null;
  return { page, pageSize, scope, q: normalize(q), sort };
};

/** Explicit owner keys avoid collisions; zero Google rows do not prove an empty cache.
 * @param {Record<string, unknown>} collections @param {unknown[]} googlePhotos */
const galleryScopes = (collections, googlePhotos) => [
  { id: 'permanent', label: 'Permanent collection', status: 'available' },
  ...Object.entries(collections).map(([name, rows]) => ({
    id: 'local:' + name, label: name + ' · local pool', status: Array.isArray(rows) ? 'available' : 'unavailable'
  })),
  { id: 'google-cache', label: 'Google Photos · retained cache', status: googlePhotos.length ? 'available' : 'unknown' }
];

/** @param {unknown} value @returns {string|null} */
const savedText = value => typeof value === 'string' && value.trim() ? value.trim() : null;
/** @param {string} a @param {string} b */
const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/**
 * Shared scope/query projection; never playback filtering or durable identities.
 * @param {{collections: Record<string, unknown>, googlePhotos?: unknown[], excludedKeywords?: unknown, page: number, pageSize: number, scope?: string, q?: string, sort?: string}} input
 */
const projectPermanentGallery = ({ collections, googlePhotos = [], excludedKeywords, page, pageSize,
  scope = 'permanent', q = '', sort = 'stored' }) => {
  const scopes = galleryScopes(collections, googlePhotos);
  const source = scopes.find(item => item.id === scope);
  const status = source?.status ?? 'unavailable';
  const owners = scope === 'permanent' ? Object.entries(collections).concat([['Google Photos', googlePhotos]])
    : scope === 'google-cache' ? [['Google Photos', googlePhotos]]
      : scope.startsWith('local:') && Object.hasOwn(collections, scope.slice(6)) ? [[scope.slice(6), collections[scope.slice(6)]]] : [];
  const seen = new Set();
  const rows = owners.flatMap(([pool, photos]) => Array.isArray(photos) ? photos
    .filter(photo => photo && typeof photo.url === 'string' && photo.url.trim()
      && (scope !== 'permanent' || photo.loved === true))
    .filter(photo => seen.has(photo.url) ? false : (seen.add(photo.url), true))
    .map(photo => ({
      url: photo.url, title: savedText(photo.title) ?? 'Untitled image', pool: String(pool),
      author: savedText(photo.author), sortTitle: savedText(photo.title),
      exclusions: [photo.rating === 1 && 'Banned rating', photo.isBroken && 'Marked broken',
        matchesExcludedKeywords(excludedKeywords, photo) && 'Excluded keyword'].filter(Boolean)
    })) : []);
  const tokens = normalize(q).split(' ').filter(Boolean);
  const filtered = rows.filter(row => tokens.every(token => normalize([row.sortTitle, row.author, row.pool].filter(Boolean).join(' ')).includes(token)));
  const field = sort.split('-')[0], direction = sort.endsWith('-desc') ? -1 : 1;
  const sorted = sort === 'stored' ? filtered : filtered.slice().sort((a, b) => {
    const left = field === 'title' ? a.sortTitle : field === 'author' ? a.author : a.pool;
    const right = field === 'title' ? b.sortTitle : field === 'author' ? b.author : b.pool;
    return left === null && right !== null ? 1 : right === null && left !== null ? -1
      : direction * lexical(normalize(left ?? ''), normalize(right ?? '')) || lexical(a.url, b.url);
  });
  const total = rows.length, matching = sorted.length, pages = Math.max(1, Math.ceil(matching / pageSize));
  const currentPage = Math.min(page, pages);
  return {
    scope, status, scopes, q, sort, page: currentPage, pageSize, total, matching, pages,
    photos: sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
      .map(({ sortTitle: _sortTitle, ...photo }) => photo)
  };
};

module.exports = { galleryPageRequest, galleryScopes, projectPermanentGallery };
