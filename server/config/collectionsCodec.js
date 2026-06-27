// @ts-check

const fs = require('fs');

function cloneCollectionEntries(collections) {
  return Object.fromEntries(
    Object.entries(collections || {}).map(([category, photos]) => [
      category,
      Array.isArray(photos)
        ? photos
            .filter((photo) => photo && photo.url)
            .map((photo) => ({ ...photo, category: photo.category || category }))
        : []
    ])
  );
}

function normalizeKeywordsMap(rawKeywords, fallbackKeywords) {
  return {
    ...fallbackKeywords,
    ...Object.fromEntries(
      Object.entries(rawKeywords || {}).map(([category, value]) => [category, Array.isArray(value) ? [...value] : value])
    )
  };
}

function ensureUsableCategory(category, photos, fallbackCollections) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return cloneCollectionEntries({ [category]: fallbackCollections[category] || [] })[category];
  }

  const visiblePhotos = photos.filter((photo) => photo && photo.url && photo.rating !== 1 && !photo.isBroken);
  if (visiblePhotos.length === 0 && fallbackCollections[category]) {
    return cloneCollectionEntries({ [category]: fallbackCollections[category] || [] })[category];
  }

  return cloneCollectionEntries({ [category]: photos })[category];
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
  const rawFeeds = cloneCollectionEntries(rawData?.feeds || {});
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
  const searchKeywords = normalizeKeywordsMap(rawData?.searchKeywords, defaultState.searchKeywords || {});
  const feedConfigs = rawData?.feedConfigs && Object.keys(rawData.feedConfigs).length > 0
    ? { ...rawData.feedConfigs }
    : buildFeedConfigsFromKeywords(searchKeywords);

  return {
    collections,
    persistedState: {
      searchKeywords,
      feedConfigs,
      autoLocation: rawData?.locationSettings?.autoLocation ?? defaultState.autoLocation,
      manualLocation: rawData?.locationSettings?.manualLocation
        ? { ...rawData.locationSettings.manualLocation }
        : { ...(defaultState.manualLocation || {}) },
      visionConfig: rawData?.visionConfig ? { ...rawData.visionConfig } : defaultState.visionConfig,
      scaleMode: rawData?.scaleMode || defaultState.scaleMode,
      splitPortrait: rawData?.splitPortrait ?? defaultState.splitPortrait,
      splitCropPercent: rawData?.splitCropPercent ?? defaultState.splitCropPercent,
      excludedKeywords: Array.isArray(rawData?.excludedKeywords)
        ? rawData.excludedKeywords.map((keyword) => String(keyword).trim()).filter(Boolean)
        : [...(defaultState.excludedKeywords || [])]
    },
    duplicatesRemoved
  };
}

function buildPersistedSnapshot(collections, state, timestamp = Date.now()) {
  const payload = {
    lastUpdated: timestamp,
    feeds: cloneCollectionEntries(collections)
  };

  if (state?.searchKeywords) {
    payload.searchKeywords = state.searchKeywords;
  }

  if (state?.feedConfigs) {
    payload.feedConfigs = state.feedConfigs;
  }

  payload.locationSettings = {
    autoLocation: Boolean(state?.autoLocation),
    manualLocation: state?.manualLocation ? { ...state.manualLocation } : undefined
  };

  if (state?.visionConfig) {
    payload.visionConfig = state.visionConfig;
  }

  if (state?.scaleMode) {
    payload.scaleMode = state.scaleMode;
  }

  if (state?.splitPortrait !== undefined) {
    payload.splitPortrait = state.splitPortrait;
  }

  if (state?.splitCropPercent !== undefined) {
    payload.splitCropPercent = state.splitCropPercent;
  }

  if (Array.isArray(state?.excludedKeywords)) {
    payload.excludedKeywords = state.excludedKeywords;
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
