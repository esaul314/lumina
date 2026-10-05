// @ts-check

const fs = require('fs');
const { normalizeKeywordEntries } = require('../utils/keywordSpecs.js');
const { isDisallowedUnsplashPhoto } = require('../utils/photoPolicy.js');
const { normalizePhotoTimestamp } = require('../domain/photoTimestamps.js');
const { normalizePoolPolicy } = require('../domain/poolRetention.js');

/** Persisted photo metadata stays open to source-specific fields. */
/** @typedef {Record<string, unknown>} PersistedPhoto */

/** @typedef {Record<string, unknown>} CollectionEntries */
/** @typedef {Record<string, PersistedPhoto[]>} CollectionSnapshot */
/** @typedef {Record<string, unknown>} KeywordMap */
/** @typedef {Record<string, unknown>} FeedConfigMap */

/**
 * Defaults are supplied by the running application; persisted metadata remains
 * open because older snapshots may carry fields newer versions do not know.
 *
 * @typedef {object} PersistedStateDefaults
 * @property {KeywordMap} [searchKeywords]
 * @property {Record<string, Record<string, unknown>>} [poolPolicies]
 * @property {unknown} [autoLocation]
 * @property {Record<string, unknown>} [manualLocation]
 * @property {Record<string, unknown>} [visionConfig]
 * @property {unknown} [scaleMode]
 * @property {unknown} [splitPortrait]
 * @property {unknown} [splitCropPercent]
 * @property {unknown[]} [excludedKeywords]
 */

/**
 * @typedef {PersistedStateDefaults & {
 *   feedConfigs?: FeedConfigMap,
 *   lastFeedUpdated?: number
 * }} PersistedStateInput
 */

/**
 * Open compatibility shape decoded from the persisted JSON document.
 *
 * @typedef {Record<string, unknown> & {
 *   feeds?: CollectionEntries,
 *   searchKeywords?: KeywordMap,
 *   feedConfigs?: FeedConfigMap,
 *   poolPolicies?: Record<string, Record<string, unknown>>,
 *   locationSettings?: Record<string, unknown> & {
 *     autoLocation?: unknown,
 *     manualLocation?: Record<string, unknown>
 *   },
 *   visionConfig?: Record<string, unknown>,
 *   scaleMode?: unknown,
 *   splitPortrait?: unknown,
 *   splitCropPercent?: unknown,
 *   excludedKeywords?: unknown[]
 * }} PersistedSnapshotInput
 */

/**
 * @typedef {object} PersistedState
 * @property {KeywordMap} searchKeywords
 * @property {FeedConfigMap} feedConfigs
 * @property {Record<string, Record<string, unknown>>} poolPolicies
 * @property {unknown} autoLocation
 * @property {Record<string, unknown>} manualLocation
 * @property {Record<string, unknown> | undefined} visionConfig
 * @property {unknown} scaleMode
 * @property {unknown} splitPortrait
 * @property {unknown} splitCropPercent
 * @property {unknown[]} excludedKeywords
 */

/** @typedef {{collections: CollectionSnapshot, persistedState: PersistedState, duplicatesRemoved: boolean}} NormalizedPersistedSnapshot */

/**
 * @typedef {object} PersistedSnapshot
 * @property {number} lastUpdated
 * @property {number} lastFeedUpdated
 * @property {CollectionSnapshot} feeds
 * @property {KeywordMap} [searchKeywords]
 * @property {FeedConfigMap} [feedConfigs]
 * @property {Record<string, Record<string, unknown>>} [poolPolicies]
 * @property {{autoLocation: boolean, manualLocation: Record<string, unknown> | undefined}} locationSettings
 * @property {Record<string, unknown>} [visionConfig]
 * @property {unknown} [scaleMode]
 * @property {unknown} [splitPortrait]
 * @property {unknown} [splitCropPercent]
 * @property {unknown[]} [excludedKeywords]
 */

/** @typedef {(searchKeywords: KeywordMap) => FeedConfigMap} FeedConfigBuilder */

/**
 * Clone and normalize persisted collection rows without mutating their source.
 *
 * @param {CollectionEntries} [collections={}]
 * @returns {CollectionSnapshot}
 */
function cloneCollectionEntries(collections = {}) {
  return Object.fromEntries(
    Object.entries(collections).map(([category, photos]) => [
      category,
      Array.isArray(photos)
        ? photos
            .filter((photo) => photo?.url && !isDisallowedUnsplashPhoto(photo))
            .map((photo) => normalizePhotoTimestamp({
              ...photo,
              category: photo.category ?? category
            }))
        : []
    ])
  );
}

/**
 * @param {string} category
 * @param {unknown} photos
 * @returns {PersistedPhoto[]}
 */
function cloneCategoryEntries(category, photos) {
  return cloneCollectionEntries({ [category]: photos })[category];
}

/**
 * Overlay normalized persisted keywords on normalized defaults.
 *
 * @param {KeywordMap} [rawKeywords={}]
 * @param {KeywordMap} [fallbackKeywords={}]
 * @returns {KeywordMap}
 */
function normalizeKeywordsMap(rawKeywords = {}, fallbackKeywords = {}) {
  return {
    ...Object.fromEntries(
      Object.entries(fallbackKeywords).map(([category, keywords]) => [category, normalizeKeywordEntries(keywords)])
    ),
    ...Object.fromEntries(
      Object.entries(rawKeywords).map(([category, keywords]) => [category, normalizeKeywordEntries(keywords)])
    )
  };
}

/**
 * Restore a category's usable default photos when its persisted rows cannot be shown.
 *
 * @param {string} category
 * @param {unknown} photos
 * @param {CollectionSnapshot} fallbackCollections
 * @returns {PersistedPhoto[]}
 */
function ensureUsableCategory(category, photos, fallbackCollections) {
  const fallbackPhotos = fallbackCollections[category] ?? [];

  if (!Array.isArray(photos) || photos.length === 0) {
    return cloneCategoryEntries(category, fallbackPhotos);
  }

  const visiblePhotos = photos.filter((photo) => photo?.url && photo.rating !== 1 && !photo.isBroken);
  if (visiblePhotos.length === 0 && fallbackPhotos.length > 0) {
    return cloneCategoryEntries(category, fallbackPhotos);
  }

  return cloneCategoryEntries(category, photos);
}

/**
 * Keep the first exact URL occurrence across pools in collection order.
 *
 * @param {CollectionEntries} collections
 * @returns {{collections: CollectionSnapshot, duplicatesRemoved: boolean}}
 */
function dedupeCollections(collections) {
  const seenUrls = new Set();
  let duplicatesRemoved = false;

  return {
    collections: Object.fromEntries(
      Object.entries(collections).map(([category, photos]) => {
        const uniquePhotos = (Array.isArray(photos) ? photos : []).filter((photo) => {
          if (!photo?.url) {
            return false;
          }
          if (seenUrls.has(photo.url)) {
            duplicatesRemoved = true;
            return false;
          }
          seenUrls.add(photo.url);
          return true;
        });
        return [category, uniquePhotos];
      })
    ),
    duplicatesRemoved
  };
}

/**
 * Project an open persisted document and application defaults into the stable
 * in-memory collections/configuration snapshot without mutating either input.
 *
 * @param {PersistedSnapshotInput | null | undefined} rawData
 * @param {{
 *   defaultCollections: CollectionEntries,
 *   defaultState: PersistedStateDefaults,
 *   buildFeedConfigsFromKeywords: FeedConfigBuilder
 * }} dependencies
 * @returns {NormalizedPersistedSnapshot}
 */
function normalizePersistedSnapshot(rawData, { defaultCollections, defaultState, buildFeedConfigsFromKeywords }) {
  const rawFeeds = cloneCollectionEntries(rawData?.feeds);
  const mergedCollections = Object.fromEntries(
    [...new Set([...Object.keys(defaultCollections), ...Object.keys(rawFeeds)])].map((category) => [
      category,
      ensureUsableCategory(category, rawFeeds[category], defaultCollections)
    ])
  );

  const { collections: dedupedCollections, duplicatesRemoved } = dedupeCollections(mergedCollections);
  const fallbackCollections = Object.fromEntries(
    Object.entries(dedupedCollections).map(([category, photos]) => [
      category,
      ensureUsableCategory(category, photos, defaultCollections)
    ])
  );
  const {
    collections,
    duplicatesRemoved: fallbackDuplicatesRemoved
  } = dedupeCollections(fallbackCollections);
  const searchKeywords = normalizeKeywordsMap(rawData?.searchKeywords, defaultState.searchKeywords ?? {});
  const rawFeedConfigs = rawData?.feedConfigs ?? {};
  const feedConfigs = Object.keys(rawFeedConfigs).length > 0
    ? { ...rawFeedConfigs }
    : buildFeedConfigsFromKeywords(searchKeywords);
  const manualLocation = rawData?.locationSettings?.manualLocation ?? defaultState.manualLocation ?? {};
  const poolPolicies = Object.fromEntries(
    Object.entries(rawData?.poolPolicies ?? defaultState.poolPolicies ?? {})
      .map(([category, policy]) => [category, normalizePoolPolicy(policy)])
  );

  return {
    collections,
    persistedState: {
      searchKeywords,
      feedConfigs,
      poolPolicies,
      autoLocation: rawData?.locationSettings?.autoLocation ?? defaultState.autoLocation,
      manualLocation: { ...manualLocation },
      visionConfig: rawData?.visionConfig ? { ...rawData.visionConfig } : defaultState.visionConfig,
      scaleMode: rawData?.scaleMode || defaultState.scaleMode,
      splitPortrait: rawData?.splitPortrait ?? defaultState.splitPortrait,
      splitCropPercent: rawData?.splitCropPercent ?? defaultState.splitCropPercent,
      excludedKeywords: Array.isArray(rawData?.excludedKeywords)
        ? rawData.excludedKeywords.map((keyword) => String(keyword).trim()).filter(Boolean)
        : [...(defaultState.excludedKeywords ?? [])]
    },
    duplicatesRemoved: duplicatesRemoved || fallbackDuplicatesRemoved
  };
}

/**
 * Serialize the stable persisted fields from collections and application state.
 *
 * @param {CollectionEntries} collections
 * @param {PersistedStateInput} [state={}]
 * @param {number} [timestamp=Date.now()]
 * @returns {PersistedSnapshot}
 */
function buildPersistedSnapshot(collections, state = {}, timestamp = Date.now()) {
  const {
    searchKeywords,
    feedConfigs,
    poolPolicies,
    lastFeedUpdated = 0,
    autoLocation,
    manualLocation,
    visionConfig,
    scaleMode,
    splitPortrait,
    splitCropPercent,
    excludedKeywords
  } = state;
  const uniqueCollections = dedupeCollections(cloneCollectionEntries(collections)).collections;
  const payload = {
    lastUpdated: timestamp,
    lastFeedUpdated,
    feeds: uniqueCollections
  };

  if (searchKeywords) {
    payload.searchKeywords = searchKeywords;
  }

  if (feedConfigs) {
    payload.feedConfigs = feedConfigs;
  }

  if (poolPolicies) {
    payload.poolPolicies = Object.fromEntries(
      Object.entries(poolPolicies).map(([category, policy]) => [category, normalizePoolPolicy(policy)])
    );
  }

  payload.locationSettings = {
    autoLocation: Boolean(autoLocation),
    manualLocation: manualLocation ? { ...manualLocation } : undefined
  };

  if (visionConfig) {
    payload.visionConfig = visionConfig;
  }

  if (scaleMode) {
    payload.scaleMode = scaleMode;
  }

  if (splitPortrait !== undefined) {
    payload.splitPortrait = splitPortrait;
  }

  if (splitCropPercent !== undefined) {
    payload.splitCropPercent = splitCropPercent;
  }

  if (Array.isArray(excludedKeywords)) {
    payload.excludedKeywords = excludedKeywords;
  }

  return payload;
}

function loadCollectionsSnapshot({ jsonPath, defaultCollections, defaultState, buildFeedConfigsFromKeywords }) {
  if (!fs.existsSync(jsonPath)) {
    const snapshot = normalizePersistedSnapshot({}, {
      defaultCollections,
      defaultState,
      buildFeedConfigsFromKeywords
    });

    fs.writeFileSync(jsonPath, JSON.stringify(buildPersistedSnapshot(snapshot.collections, snapshot.persistedState, 0), null, 2), 'utf8');
    return {
      ...snapshot,
      createdFile: true
    };
  }

  try {
    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const snapshot = normalizePersistedSnapshot(rawData, {
      defaultCollections,
      defaultState,
      buildFeedConfigsFromKeywords
    });
    const {
      collections: persistedFeeds,
      duplicatesRemoved: persistedDuplicatesRemoved
    } = dedupeCollections(rawData?.feeds ?? {});

    if (persistedDuplicatesRemoved) {
      try {
        fs.writeFileSync(jsonPath, JSON.stringify({ ...rawData, feeds: persistedFeeds }, null, 2), 'utf8');
      } catch (error) {
        console.warn('Collections Config: Failed to persist duplicate-feed cleanup:', error.message);
      }
    }

    return snapshot;
  } catch (error) {
    return {
      ...normalizePersistedSnapshot({}, {
        defaultCollections,
        defaultState,
        buildFeedConfigsFromKeywords
      }),
      parseError: error
    };
  }
}

function saveCollectionsSnapshot({ jsonPath, collections, state, lastFeedUpdated }) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const persistedFeedTimestamp = lastFeedUpdated ?? (() => {
    if (!fs.existsSync(jsonPath)) return 0;
    try {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf8')).lastFeedUpdated ?? 0;
    } catch {
      return 0;
    }
  })();

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(buildPersistedSnapshot(collections, stateWithFeedTimestamp(state, persistedFeedTimestamp)), null, 2),
    'utf8'
  );
}

/**
 * @param {PersistedStateInput} [state={}]
 * @param {number} lastFeedUpdated
 * @returns {PersistedStateInput}
 */
function stateWithFeedTimestamp(state = {}, lastFeedUpdated) {
  return { ...state, lastFeedUpdated };
}

module.exports = {
  buildPersistedSnapshot,
  loadCollectionsSnapshot,
  normalizePersistedSnapshot,
  saveCollectionsSnapshot
};
