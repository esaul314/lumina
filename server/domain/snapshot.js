// @ts-check

/**
 * @typedef {import('./types').CollectionsState} CollectionsState
 * @typedef {import('./types').DomainState} DomainState
 */

const { deriveCurrentFrame, normalizeCategorySelection } = require('./selectors.js');

function cloneCollections(collections) {
  return Object.fromEntries(
    Object.entries(collections || {}).map(([category, photos]) => [
      category,
      (photos || []).map((photo) => photo ? { ...photo, category: photo.category || category } : photo)
    ])
  );
}

function clonePhotosList(photosList) {
  return (photosList || []).map((photo) => ({ ...photo }));
}

function buildDomainState(legacyState, collections, runtimeOverrides = {}) {
  const nextCollections = cloneCollections(collections);
  const availableCategories = Object.keys(nextCollections);
  const selectedCategories = normalizeCategorySelection(
    legacyState.currentCategory,
    availableCategories,
    availableCategories[0] || 'Scenic Nature'
  );

  return {
    config: {
      theme: legacyState.theme,
      scaleMode: legacyState.scaleMode,
      splitPortrait: Boolean(legacyState.splitPortrait),
      splitCropPercent: legacyState.splitCropPercent ?? 50,
      widgets: { ...(legacyState.widgets || {}) },
      inactivityTimeout: legacyState.inactivityTimeout,
      slideshowInterval: legacyState.slideshowInterval,
      alignTimeOfDay: Boolean(legacyState.alignTimeOfDay),
      alignWeather: Boolean(legacyState.alignWeather),
      allowOpenAiFallback: Boolean(legacyState.allowOpenAiFallback),
      nightPercentage: legacyState.nightPercentage ?? 50,
      searchKeywords: { ...(legacyState.searchKeywords || {}) },
      feedConfigs: { ...(legacyState.feedConfigs || {}) },
      excludedKeywords: [...(legacyState.excludedKeywords || [])],
      autoLocation: Boolean(legacyState.autoLocation),
      manualLocation: { ...(legacyState.manualLocation || {}) },
      visionConfig: legacyState.visionConfig ? { ...legacyState.visionConfig } : undefined
    },
    runtime: {
      screensaverActive: Boolean(legacyState.screensaverActive),
      hasUseApiToken: Boolean(legacyState.hasUseApiToken),
      hasTumblrApiKey: Boolean(legacyState.hasTumblrApiKey),
      browserRunning: Boolean(runtimeOverrides.browserRunning),
      manualOverride: Boolean(runtimeOverrides.manualOverride),
      newsSentiment: { ...(legacyState.newsSentiment || {}) },
      physicalWeather: { ...(legacyState.physicalWeather || {}) },
      weather: runtimeOverrides.weather ? { ...runtimeOverrides.weather } : null
    },
    library: {
      collections: nextCollections,
      externalCollections: cloneCollections(runtimeOverrides.externalCollections || {}),
      photosList: clonePhotosList(legacyState.photosList)
    },
    playback: {
      selectedCategories,
      activePhotoUrl: legacyState.activePhoto?.url || null,
      splitSeed: legacyState.splitSeed || 0,
      lastDirection: legacyState.lastDirection || 'next'
    }
  };
}

function buildSnapshot(domainState) {
  const currentFrame = deriveCurrentFrame(domainState);
  return {
    ...domainState.config,
    ...domainState.runtime,
    currentCategory: domainState.playback.selectedCategories.join(','),
    photosList: domainState.library.photosList.map((photo) => ({ ...photo })),
    activePhoto: currentFrame.primary,
    activeSecondPhoto: currentFrame.secondary,
    currentFrame,
    config: domainState.config,
    runtime: domainState.runtime,
    library: domainState.library,
    playback: domainState.playback
  };
}

function replaceCollections(targetCollections, nextCollections) {
  Object.keys(targetCollections).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(nextCollections, key)) {
      delete targetCollections[key];
    }
  });

  Object.entries(nextCollections).forEach(([category, photos]) => {
    targetCollections[category] = photos.map((photo) => ({ ...photo, category: photo.category || category }));
  });
}

function applyDomainState(legacyState, collections, domainState) {
  replaceCollections(collections, domainState.library.collections);

  const snapshot = buildSnapshot(domainState);
  const {
    activePhoto,
    activeSecondPhoto,
    currentFrame,
    config,
    runtime,
    library,
    playback,
    ...rest
  } = snapshot;

  Object.assign(legacyState, rest);
  legacyState.config = config;
  legacyState.runtime = runtime;
  legacyState.library = library;
  legacyState.playback = playback;
  legacyState.currentFrame = currentFrame;
  legacyState.splitSeed = domainState.playback.splitSeed;
  legacyState.lastDirection = domainState.playback.lastDirection;
  legacyState.activePhoto = activePhoto;
  legacyState.activeSecondPhoto = activeSecondPhoto;

  return snapshot;
}

function syncLegacySnapshot(legacyState, collections, runtimeOverrides = {}) {
  return applyDomainState(legacyState, collections, buildDomainState(legacyState, collections, runtimeOverrides));
}

module.exports = {
  applyDomainState,
  buildDomainState,
  buildSnapshot,
  replaceCollections,
  syncLegacySnapshot
};
