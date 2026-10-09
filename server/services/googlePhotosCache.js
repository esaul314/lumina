// @ts-check

const DEFAULT_RENDER_WIDTH = 2560;
const DEFAULT_RENDER_HEIGHT = 1440;
const GOOGLE_PHOTO_PROXY_PREFIX = '/api/google-photos/media/';

/**
 * Google Photos Picker records are open: fields owned by Lumina and Google
 * can evolve independently, while the cache boundary names the fields it uses.
 *
 * @typedef {Record<string, unknown> & {
 *   id?: string;
 *   url?: string;
 *   baseUrl?: string;
 *   googleBaseUrl?: string;
 *   googlePickerSessionId?: string;
 *   googleBaseUrlFetchedAt?: number;
 *   addedAt?: string;
 *   createTime?: string;
 *   mimeType?: string;
 *   width?: string | number;
 *   height?: string | number;
 *   mediaFile?: PickerMediaFile;
 *   mediaFileMetadata?: PickerMediaMetadata;
 *   rating?: unknown;
 *   cropPercent?: unknown;
 *   cropPositionY?: unknown;
 *   preventPairing?: unknown;
 *   loved?: unknown;
 * }} GooglePhotoMediaItem
 */

/** @typedef {Record<string, unknown> & {width?: string | number; height?: string | number}} PickerMediaMetadata */

/**
 * @typedef {Record<string, unknown> & {
 *   baseUrl?: string;
 *   mimeType?: string;
 *   mediaFileMetadata?: PickerMediaMetadata;
 * }} PickerMediaFile
 */

/** @typedef {{width?: number; height?: number; crop?: boolean}} RenderOptions */

/**
 * Build the same-origin proxy URL used to render cached Picker media.
 *
 * @param {string} mediaItemId
 * @param {RenderOptions} [options={}]
 * @returns {string}
 */
function buildGooglePhotoProxyUrl(mediaItemId, { width = DEFAULT_RENDER_WIDTH, height = DEFAULT_RENDER_HEIGHT, crop = false } = {}) {
  const params = new URLSearchParams({
    w: String(width),
    h: String(height)
  });

  if (crop) {
    params.set('c', '1');
  }

  return `${GOOGLE_PHOTO_PROXY_PREFIX}${encodeURIComponent(mediaItemId)}?${params.toString()}`;
}

/**
 * Decode a media id only from Lumina's Google Photos proxy URL vocabulary.
 *
 * @param {unknown} value
 * @returns {string}
 */
function getGooglePhotoMediaItemId(value) {
  const text = String(value || '').trim();
  if (!text.startsWith(GOOGLE_PHOTO_PROXY_PREFIX)) {
    return '';
  }

  const [encodedId] = text.slice(GOOGLE_PHOTO_PROXY_PREFIX.length).split('?');
  return encodedId ? decodeURIComponent(encodedId) : '';
}

/**
 * Read the nested Picker media file shape while tolerating legacy flat rows.
 *
 * @param {GooglePhotoMediaItem | null | undefined} item
 * @returns {PickerMediaFile}
 */
function getPickerMediaFile(item) {
  return item?.mediaFile && typeof item.mediaFile === 'object' ? item.mediaFile : item || {};
}

/** @param {GooglePhotoMediaItem | null | undefined} item @returns {string} */
function getPickerItemBaseUrl(item) {
  return String(getPickerMediaFile(item).baseUrl || '').trim();
}

/** @param {GooglePhotoMediaItem | null | undefined} item @returns {string} */
function getPickerItemMimeType(item) {
  return String(getPickerMediaFile(item).mimeType || item?.mimeType || '').trim();
}

/**
 * Project valid Picker dimensions, using the established render defaults for
 * missing or malformed values.
 *
 * @param {GooglePhotoMediaItem | null | undefined} item
 * @returns {{width: number; height: number}}
 */
function getPickerItemDimensions(item) {
  const metadata = getPickerMediaFile(item).mediaFileMetadata || item?.mediaFileMetadata || {};
  const width = Number.parseInt(/** @type {string} */ (metadata.width), 10);
  const height = Number.parseInt(/** @type {string} */ (metadata.height), 10);

  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_RENDER_WIDTH,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_RENDER_HEIGHT
  };
}

/**
 * Recover the base URL from an older cache record when possible.
 *
 * @param {string | null | undefined} url
 * @returns {string}
 */
function extractLegacyBaseUrl(url) {
  const value = String(url || '').trim();
  if (!value || value.startsWith(GOOGLE_PHOTO_PROXY_PREFIX) || value.startsWith('undefined=')) {
    return '';
  }

  const [baseUrl] = value.split('=');
  return baseUrl || '';
}

/**
 * Build a durable cache row from a Picker item while retaining user-owned
 * metadata and the original acquisition time on refresh.
 *
 * @param {GooglePhotoMediaItem & {id: string}} item
 * @param {string} sessionId
 * @param {GooglePhotoMediaItem} [existing={}]
 * @param {Date | string | number} [addedAt=Date.now()]
 * @returns {GooglePhotoMediaItem & {id: string; url: string; source: string}}
 */
function buildCachedMediaItem(item, sessionId, existing = {}, addedAt = Date.now()) {
  const { width, height } = getPickerItemDimensions(item);
  const googleBaseUrl = getPickerItemBaseUrl(item) || existing.googleBaseUrl || extractLegacyBaseUrl(existing.url);
  const createTime = String(item?.createTime || existing.createTime || '').trim();
  const existingAddedAt = existing.addedAt;
  const normalizedAddedAt = existingAddedAt || new Date(addedAt).toISOString();

  return {
    id: item.id,
    title: 'Google Photos Picker Cast',
    author: 'Lumina Google Cast',
    source: 'google_photos',
    url: buildGooglePhotoProxyUrl(item.id),
    googleBaseUrl,
    googlePickerSessionId: sessionId || existing.googlePickerSessionId,
    googleBaseUrlFetchedAt: googleBaseUrl ? Date.now() : existing.googleBaseUrlFetchedAt,
    addedAt: normalizedAddedAt,
    ...(createTime ? { createTime } : {}),
    mimeType: getPickerItemMimeType(item) || existing.mimeType || 'image/jpeg',
    width,
    height,
    rating: existing.rating !== undefined ? existing.rating : 10,
    cropPercent: existing.cropPercent,
    cropPositionY: existing.cropPositionY,
    preventPairing: existing.preventPairing,
    loved: existing.loved
  };
}

/**
 * Normalize a persisted cache record into Lumina's stable render shape.
 *
 * @param {GooglePhotoMediaItem | null | undefined} item
 * @returns {(GooglePhotoMediaItem & {id: string; url: string}) | null}
 */
function normalizeCachedMediaItem(item) {
  if (!item?.id) {
    return null;
  }

  const width = Number.parseInt(/** @type {string} */ (item.width), 10);
  const height = Number.parseInt(/** @type {string} */ (item.height), 10);
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_RENDER_WIDTH;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_RENDER_HEIGHT;
  const googleBaseUrl = String(item.googleBaseUrl || extractLegacyBaseUrl(item.url) || '').trim();

  return {
    ...item,
    source: 'google_photos',
    url: buildGooglePhotoProxyUrl(item.id),
    googleBaseUrl: googleBaseUrl || undefined,
    width: safeWidth,
    height: safeHeight,
    rating: item.rating !== undefined ? item.rating : 10,
    loved: item.loved === true
  };
}

/**
 * A cache row is usable when the service can resolve media bytes for it.
 *
 * @param {GooglePhotoMediaItem | null | undefined} item
 * @returns {boolean}
 */
function isUsableCachedMediaItem(item) {
  if (!item?.id || !item?.url) {
    return false;
  }

  if (item.id.startsWith('MOCK_')) {
    return true;
  }

  return Boolean(item.googleBaseUrl || item.googlePickerSessionId);
}

/**
 * Keep the first source-local cache row for each stable media item id.
 *
 * @param {GooglePhotoMediaItem[]} [items=[]]
 * @returns {GooglePhotoMediaItem[]}
 */
function dedupeMediaItemsById(items = []) {
  const seenIds = new Set();

  return items.filter((item) => {
    const mediaItemId = String(item?.id || '').trim();
    if (!mediaItemId || seenIds.has(mediaItemId)) {
      return false;
    }

    seenIds.add(mediaItemId);
    return true;
  });
}

const GOOGLE_PHOTOS_USER_METADATA_FIELDS = [
  'rating',
  'cropPercent',
  'cropPositionY',
  'preventPairing',
  'loved'
];

/**
 * Prefer the latest synced representation while retaining existing user edits.
 *
 * @param {GooglePhotoMediaItem} existing
 * @param {GooglePhotoMediaItem} synced
 * @returns {GooglePhotoMediaItem}
 */
function mergeSyncedItemWithExistingMetadata(existing, synced) {
  const merged = { ...existing, ...synced };

  GOOGLE_PHOTOS_USER_METADATA_FIELDS.forEach((field) => {
    if (existing?.[field] !== undefined) {
      merged[field] = existing[field];
    }
  });

  return merged;
}

/**
 * Accumulate Picker rows in stable order: keep unique cached rows not selected
 * in this session, then append selected rows in session order. Latest duplicate
 * input wins; existing user metadata survives an upsert. Pool retention/capping
 * is deliberately composed by the effectful sync shell after this union.
 *
 * @param {GooglePhotoMediaItem[] | null | undefined} syncedItems
 * @param {GooglePhotoMediaItem[]} [cachedItems=[]]
 * @returns {GooglePhotoMediaItem[]}
 */
function mergeSyncedMediaItems(syncedItems, cachedItems = []) {
  const uniqueCachedItems = dedupeMediaItemsById(cachedItems);
  const syncedById = new Map();
  const syncedOrder = [];

  (syncedItems || []).forEach((item) => {
    const mediaItemId = String(item?.id || '').trim();
    if (!mediaItemId) {
      return;
    }

    if (!syncedById.has(mediaItemId)) {
      syncedOrder.push(mediaItemId);
    }
    syncedById.set(mediaItemId, item);
  });

  const merged = uniqueCachedItems
    .filter((item) => !syncedById.has(item.id))
    .map((item) => ({ ...item }));

  syncedOrder.forEach((mediaItemId) => {
    const syncedItem = syncedById.get(mediaItemId);
    const existingItem = uniqueCachedItems.find((item) => item.id === mediaItemId);
    merged.push(existingItem
      ? mergeSyncedItemWithExistingMetadata(existingItem, syncedItem)
      : syncedItem);
  });

  return merged;
}

module.exports = {
  buildCachedMediaItem,
  buildGooglePhotoProxyUrl,
  dedupeMediaItemsById,
  getGooglePhotoMediaItemId,
  getPickerItemMimeType,
  isUsableCachedMediaItem,
  mergeSyncedMediaItems,
  normalizeCachedMediaItem
};
