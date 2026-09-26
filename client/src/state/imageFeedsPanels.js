// @ts-check

/**
 * The top-level Image Feeds workspace is deliberately a small, closed
 * vocabulary. Pool Lifecycle remains a nested disclosure inside categories.
 */
export const IMAGE_FEEDS_PANEL_IDS = Object.freeze({
  CATEGORIES: 'categories',
  RATING: 'rating',
  SOURCES: 'sources',
  GOOGLE: 'google'
});

export const IMAGE_FEEDS_PANEL_ORDER = Object.freeze([
  IMAGE_FEEDS_PANEL_IDS.CATEGORIES,
  IMAGE_FEEDS_PANEL_IDS.RATING,
  IMAGE_FEEDS_PANEL_IDS.SOURCES,
  IMAGE_FEEDS_PANEL_IDS.GOOGLE
]);

export const IMAGE_FEEDS_PANEL_STORAGE_KEY = 'lumina.image-feeds.panels';

/** @typedef {'categories'|'rating'|'sources'|'google'} ImageFeedsPanelId */
/** @typedef {'earlier'|'later'} ImageFeedsPanelDirection */
/** @typedef {Record<ImageFeedsPanelId, boolean>} ImageFeedsPanelOpenState */
/**
 * @typedef {{open: ImageFeedsPanelOpenState, focused: ImageFeedsPanelId|null, order: ImageFeedsPanelId[]}}
 * ImageFeedsPanelState
 */
/**
 * @typedef {{open?: Partial<ImageFeedsPanelOpenState>, order?: unknown}}
 * ImageFeedsPanelPreferences
 */
/** @typedef {{getItem?: (key: string) => string|null}} ImageFeedsPanelStorageReader */
/** @typedef {{setItem?: (key: string, value: string) => void}} ImageFeedsPanelStorageWriter */

/**
 * @param {unknown} panelId
 * @returns {panelId is ImageFeedsPanelId}
 */
export const isImageFeedsPanelId = (panelId) => IMAGE_FEEDS_PANEL_ORDER.includes(panelId);

/**
 * @param {unknown} order
 * @returns {ImageFeedsPanelId[]}
 */
export const normalizeImageFeedsPanelOrder = (order) => {
  const requested = Array.isArray(order) ? order : [];
  const validUnique = requested.filter(
    (panelId, index) => isImageFeedsPanelId(panelId) && requested.indexOf(panelId) === index
  );
  return [...validUnique, ...IMAGE_FEEDS_PANEL_ORDER.filter((panelId) => !validUnique.includes(panelId))];
};

/**
 * @param {ImageFeedsPanelPreferences|undefined} [preferences]
 * @returns {ImageFeedsPanelState}
 */
export const createImageFeedsPanelState = (preferences = {}) => {
  const requestedOpen = preferences?.open || {};
  return {
    open: IMAGE_FEEDS_PANEL_ORDER.reduce((open, panelId) => ({
      ...open,
      [panelId]: typeof requestedOpen[panelId] === 'boolean' ? requestedOpen[panelId] : true
    }), /** @type {ImageFeedsPanelOpenState} */ ({})),
    focused: null,
    order: normalizeImageFeedsPanelOrder(preferences?.order)
  };
};

/**
 * @param {ImageFeedsPanelState} panelState
 * @param {ImageFeedsPanelId} panelId
 * @returns {ImageFeedsPanelState}
 */
export const toggleImageFeedsPanel = (panelState, panelId) => {
  if (!isImageFeedsPanelId(panelId) || panelState.focused === panelId) return panelState;
  return {
    ...panelState,
    open: {
      ...panelState.open,
      [panelId]: !panelState.open[panelId]
    }
  };
};

/**
 * Enter focused editing for one panel. Focused panels are always open.
 *
 * @param {ImageFeedsPanelState} panelState
 * @param {ImageFeedsPanelId} panelId
 * @returns {ImageFeedsPanelState}
 */
export const enterImageFeedsPanelFocus = (panelState, panelId) => {
  if (!isImageFeedsPanelId(panelId)) return panelState;
  return {
    ...panelState,
    open: { ...panelState.open, [panelId]: true },
    focused: panelId
  };
};

/**
 * Leave focused editing without restoring focus mode from persistence.
 *
 * @param {ImageFeedsPanelState} panelState
 * @returns {ImageFeedsPanelState}
 */
export const exitImageFeedsPanelFocus = (panelState) => panelState.focused === null
  ? panelState
  : { ...panelState, focused: null };

/** @param {ImageFeedsPanelState} panelState @param {ImageFeedsPanelId} panelId @param {ImageFeedsPanelDirection} direction @returns {ImageFeedsPanelState} */
export const moveImageFeedsPanel = (panelState, panelId, direction) => {
  if (!isImageFeedsPanelId(panelId) || !['earlier', 'later'].includes(direction)) return panelState;
  const currentIndex = panelState.order.indexOf(panelId);
  const nextIndex = direction === 'earlier' ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= panelState.order.length) return panelState;
  const nextOrder = [...panelState.order];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
  return { ...panelState, order: nextOrder };
};

/** @param {ImageFeedsPanelState} panelState @param {ImageFeedsPanelId} panelId @returns {ImageFeedsPanelState} */
export const moveImageFeedsPanelEarlier = (panelState, panelId) => moveImageFeedsPanel(panelState, panelId, 'earlier');

/** @param {ImageFeedsPanelState} panelState @param {ImageFeedsPanelId} panelId @returns {ImageFeedsPanelState} */
export const moveImageFeedsPanelLater = (panelState, panelId) => moveImageFeedsPanel(panelState, panelId, 'later');

/**
 * Persist only stable preferences. Focus is intentionally transient.
 *
 * @param {ImageFeedsPanelState} panelState
 * @returns {string}
 */
export const encodeImageFeedsPanelPreferences = (panelState) => JSON.stringify({
  open: IMAGE_FEEDS_PANEL_ORDER.reduce((open, panelId) => ({
    ...open,
    [panelId]: Boolean(panelState.open?.[panelId])
  }), {}),
  order: normalizeImageFeedsPanelOrder(panelState.order)
});

/**
 * Decode malformed, partial, and legacy values into the current preference
 * shape. Legacy `maximized`/`focused` values are deliberately ignored.
 *
 * @param {unknown} rawValue
 * @returns {ImageFeedsPanelPreferences}
 */
export const decodeImageFeedsPanelPreferences = (rawValue) => {
  try {
    const value = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const record = /** @type {Record<string, unknown>} */ (value);
    const open = record.open && typeof record.open === 'object' && !Array.isArray(record.open)
      ? IMAGE_FEEDS_PANEL_ORDER.reduce((result, panelId) => {
        const candidate = /** @type {Record<string, unknown>} */ (record.open)[panelId];
        return typeof candidate === 'boolean' ? { ...result, [panelId]: candidate } : result;
      }, {})
      : undefined;
    return {
      ...(open && Object.keys(open).length > 0 ? { open } : {}),
      ...(Array.isArray(record.order) ? { order: record.order } : {})
    };
  } catch {
    return {};
  }
};

/**
 * Browser-storage adapter. Keeping storage injected makes this boundary easy
 * to test and keeps storage failures from affecting the workspace UI.
 *
 * @param {ImageFeedsPanelStorageReader|null|undefined} storage
 * @param {string} [storageKey]
 * @returns {ImageFeedsPanelPreferences}
 */
export const readImageFeedsPanelPreferences = (storage, storageKey = IMAGE_FEEDS_PANEL_STORAGE_KEY) => {
  try {
    return decodeImageFeedsPanelPreferences(storage?.getItem?.(storageKey));
  } catch {
    return {};
  }
};

/**
 * @param {ImageFeedsPanelStorageWriter|null|undefined} storage
 * @param {ImageFeedsPanelState} panelState
 * @param {string} [storageKey]
 * @returns {boolean}
 */
export const writeImageFeedsPanelPreferences = (storage, panelState, storageKey = IMAGE_FEEDS_PANEL_STORAGE_KEY) => {
  try {
    storage?.setItem?.(storageKey, encodeImageFeedsPanelPreferences(panelState));
    return true;
  } catch {
    return false;
  }
};
