// @ts-check

/**
 * @typedef {import('./types').CollectionsState} CollectionsState
 * @typedef {import('./types').DomainState} DomainState
 * @typedef {import('./types').CurrentFrame} CurrentFrame
 * @typedef {import('./types').Photo} Photo
 */

/**
 * The legacy flat state is the compatibility shape owned by the current
 * runtime. Its source-specific records remain open while the domain snapshot
 * projection owns the stable fields needed by the reducer.
 *
 * @typedef {Record<string, unknown> & {
 *   currentCategory: string | string[],
 *   theme: string,
 *   scaleMode: 'cover' | 'contain',
 *   splitPortrait: boolean,
 *   splitCropPercent: number,
 *   widgets: Record<string, boolean>,
 *   inactivityTimeout: number,
 *   slideshowInterval: number,
 *   alignTimeOfDay: boolean,
 *   alignWeather: boolean,
 *   allowOpenAiFallback: boolean,
 *   nightPercentage: number,
 *   searchKeywords: Record<string, unknown>,
 *   feedConfigs: Record<string, unknown>,
 *   poolPolicies: Record<string, unknown>,
 *   excludedKeywords: string[],
 *   autoLocation: boolean,
 *   manualLocation: Record<string, unknown>,
 *   visionConfig?: Record<string, unknown>,
 *   screensaverActive: boolean,
 *   hasUseApiToken: boolean,
 *   hasTumblrApiKey?: boolean,
 *   photosList: Photo[],
 *   activePhoto?: Photo | null,
 *   activeSecondPhoto?: Photo | null,
 *   splitSeed?: number,
 *   lastDirection?: 'next' | 'prev'
 * }} LegacyState
 */

/**
 * Runtime-only values supplied while rebuilding a domain snapshot.
 *
 * @typedef {object} RuntimeOverrides
 * @property {boolean} [browserRunning]
 * @property {boolean} [manualOverride]
 * @property {Record<string, unknown>} [weather]
 * @property {CollectionsState} [externalCollections]
 */

/**
 * Public snapshot shape shared by REST, Socket.IO, and the legacy runtime.
 *
 * @typedef {DomainState['config'] & DomainState['runtime'] & {
 *   currentCategory: string,
 *   photosList: Photo[],
 *   activePhoto: Photo | null,
 *   activeSecondPhoto: Photo | null,
 *   currentFrame: CurrentFrame,
 *   config: DomainState['config'],
 *   runtime: DomainState['runtime'],
 *   library: DomainState['library'],
 *   playback: DomainState['playback']
 * }} Snapshot
 */

const { deriveCurrentFrame, normalizeCategorySelection } = require('./selectors.js');
const { normalizeKeywordEntries } = require('../utils/keywordSpecs.js');

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

function cloneSearchKeywords(searchKeywords = {}) {
  return Object.fromEntries(
    Object.entries(searchKeywords).map(([category, keywords]) => [
      category,
      normalizeKeywordEntries(keywords)
    ])
  );
}

/**
 * Decode the mutable legacy state into an immutable domain-state projection.
 *
 * @param {LegacyState} legacyState
 * @param {CollectionsState} collections
 * @param {RuntimeOverrides} [runtimeOverrides={}]
 * @returns {DomainState}
 */
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
      searchKeywords: cloneSearchKeywords(legacyState.searchKeywords),
      feedConfigs: { ...(legacyState.feedConfigs || {}) },
      poolPolicies: { ...(legacyState.poolPolicies || {}) },
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

/**
 * Project a domain state into the public snapshot without mutating it.
 *
 * @param {DomainState} domainState
 * @returns {Snapshot}
 */
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

/**
 * Synchronize the mutable collection compatibility store in place.
 *
 * @param {CollectionsState} targetCollections
 * @param {CollectionsState} nextCollections
 * @returns {void}
 */
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

/**
 * Apply a pure snapshot projection to the legacy runtime shell.
 *
 * @param {LegacyState} legacyState
 * @param {CollectionsState} collections
 * @param {DomainState} domainState
 * @returns {Snapshot}
 */
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

/**
 * Rebuild and apply the canonical snapshot while preserving the legacy API.
 *
 * @param {LegacyState} legacyState
 * @param {CollectionsState} collections
 * @param {RuntimeOverrides} [runtimeOverrides={}]
 * @returns {Snapshot}
 */
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
