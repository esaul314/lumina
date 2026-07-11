// @ts-check

const fs = require('fs');
const { normalizeKeywordEntries } = require('../utils/keywordSpecs.js');

function cloneCollectionEntries(collections = {}) {
  return Object.fromEntries(
    Object.entries(collections).map(([category, photos]) => [
      category,
      Array.isArray(photos)
        ? photos
            .filter((photo) => photo?.url)
            .map((photo) => ({ ...photo, category: photo.category ?? category }))
        : []
    ])
  );
}

function cloneCategoryEntries(category, photos) {
  return cloneCollectionEntries({ [category]: photos })[category];
}

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

function dedupeCollections(collections) {
  const seenUrls = new Set();
  let duplicatesRemoved = false;

  return {
    collections: Object.fromEntries(
      Object.entries(collections).map(([category, photos]) => {
        const uniquePhotos = photos.filter((photo) => {
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

function normalizePersistedSnapshot(rawData, { defaultCollections, defaultState, buildFeedConfigsFromKeywords }) {
  const rawFeeds = cloneCollectionEntries(rawData?.feeds);
  const mergedCollections = Object.fromEntries(
    [...new Set([...Object.keys(defaultCollections), ...Object.keys(rawFeeds)])].map((category) => [
      category,
      ensureUsableCategory(category, rawFeeds[category], defaultCollections)
    ])
  );

  const { collections: dedupedCollections, duplicatesRemoved } = dedupeCollections(mergedCollections);
  const collections = Object.fromEntries(
    Object.entries(dedupedCollections).map(([category, photos]) => [
      category,
      ensureUsableCategory(category, photos, defaultCollections)
    ])
  );
  const searchKeywords = normalizeKeywordsMap(rawData?.searchKeywords, defaultState.searchKeywords ?? {});
  const rawFeedConfigs = rawData?.feedConfigs ?? {};
  const feedConfigs = Object.keys(rawFeedConfigs).length > 0
    ? { ...rawFeedConfigs }
    : buildFeedConfigsFromKeywords(searchKeywords);
  const manualLocation = rawData?.locationSettings?.manualLocation ?? defaultState.manualLocation ?? {};

  return {
    collections,
    persistedState: {
      searchKeywords,
      feedConfigs,
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
    duplicatesRemoved
  };
}

function buildPersistedSnapshot(collections, state = {}, timestamp = Date.now()) {
  const {
    searchKeywords,
    feedConfigs,
    autoLocation,
    manualLocation,
    visionConfig,
    scaleMode,
    splitPortrait,
    splitCropPercent,
    excludedKeywords
  } = state;
  const payload = {
    lastUpdated: timestamp,
    feeds: cloneCollectionEntries(collections)
  };

  if (searchKeywords) {
    payload.searchKeywords = searchKeywords;
  }

  if (feedConfigs) {
    payload.feedConfigs = feedConfigs;
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
    return normalizePersistedSnapshot(rawData, {
      defaultCollections,
      defaultState,
      buildFeedConfigsFromKeywords
    });
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

function saveCollectionsSnapshot({ jsonPath, collections, state }) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(buildPersistedSnapshot(collections, state), null, 2),
    'utf8'
  );
}

module.exports = {
  buildPersistedSnapshot,
  loadCollectionsSnapshot,
  normalizePersistedSnapshot,
  saveCollectionsSnapshot
};
