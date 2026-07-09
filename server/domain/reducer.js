// @ts-check

/**
 * @typedef {import('./types').Command} Command
 * @typedef {import('./types').DomainState} DomainState
 * @typedef {import('./types').Effect} Effect
 * @typedef {import('./types').Event} Event
 * @typedef {import('./types').Photo} Photo
 * @typedef {import('./types').ReducerResult} ReducerResult
 */

const {
  buildBalancedFeed,
  findPhotoInFeed,
  getActivePhoto,
  getPhotoByUrl,
  normalizeCategorySelection,
  selectSequentialPhoto,
  selectSmartPhoto,
  updatePhotoInCollections
} = require('./selectors.js');

function cloneState(state) {
  return {
    config: {
      ...state.config,
      widgets: { ...state.config.widgets },
      searchKeywords: { ...state.config.searchKeywords },
      feedConfigs: { ...state.config.feedConfigs },
      excludedKeywords: [...state.config.excludedKeywords],
      manualLocation: { ...state.config.manualLocation },
      visionConfig: state.config.visionConfig ? { ...state.config.visionConfig } : undefined
    },
    runtime: {
      ...state.runtime,
      newsSentiment: { ...state.runtime.newsSentiment },
      physicalWeather: { ...state.runtime.physicalWeather },
      weather: state.runtime.weather ? { ...state.runtime.weather } : null
    },
    library: {
      collections: Object.fromEntries(
        Object.entries(state.library.collections).map(([category, photos]) => [
          category,
          photos.map((photo) => ({ ...photo }))
        ])
      ),
      externalCollections: Object.fromEntries(
        Object.entries(state.library.externalCollections || {}).map(([category, photos]) => [
          category,
          photos.map((photo) => ({ ...photo }))
        ])
      ),
      photosList: state.library.photosList.map((photo) => ({ ...photo }))
    },
    playback: {
      ...state.playback,
      selectedCategories: [...state.playback.selectedCategories]
    }
  };
}

function createResult(nextState, events = [], effects = []) {
  return { nextState, events, effects };
}

function emitStateSync(events = []) {
  return [...events, { type: 'state-sync' }];
}

function emitPhotoUpdate(events = []) {
  return [...events, { type: 'photo-update' }, { type: 'state-sync' }];
}

function recomputeFeed(state, rng) {
  return {
    ...state,
    library: {
      ...state.library,
      photosList: buildBalancedFeed({
        selectedCategories: state.playback.selectedCategories,
        collections: state.library.collections,
        externalCollections: state.library.externalCollections,
        excludedKeywords: state.config.excludedKeywords,
        rng
      })
    }
  };
}

function updateActivePhotoUrl(state, photo, direction) {
  const nextActivePhotoUrl = photo?.url || null;
  const changed = state.playback.activePhotoUrl !== nextActivePhotoUrl;

  return {
    state: {
      ...state,
      playback: {
        ...state.playback,
        activePhotoUrl: nextActivePhotoUrl,
        splitSeed: changed ? state.playback.splitSeed + 1 : state.playback.splitSeed,
        lastDirection: direction || state.playback.lastDirection
      }
    },
    changed
  };
}

function ensureActivePhoto(state, { now, rng, direction = 'next', forceReselect = false }) {
  const currentPhoto = getActivePhoto(state);
  const visibleCurrentPhoto = currentPhoto && findPhotoInFeed(state.library.photosList, currentPhoto.url);

  if (!forceReselect && visibleCurrentPhoto) {
    return { state, photoChanged: false };
  }

  const nextPhoto = selectSmartPhoto({ state, direction, now, rng });
  const nextState = updateActivePhotoUrl(state, nextPhoto, direction);
  return {
    state: nextState.state,
    photoChanged: nextState.changed
  };
}

function withUpdatedPhoto(state, url, updater) {
  const { collections, changed } = updatePhotoInCollections(state.library.collections, url, updater);
  if (!changed) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      library: {
        collections,
        photosList: state.library.photosList
          .map((photo) => (photo.url === url ? updater({ ...photo }) : { ...photo }))
          .filter(Boolean)
      }
    },
    changed: true
  };
}

function trimKeywords(keywords) {
  return (Array.isArray(keywords) ? keywords : [])
    .map((keyword) => String(keyword).trim())
    .filter(Boolean);
}

function normalizeFeedConfigKeywords(keywords) {
  return {
    unsplash: { enabled: true, keywords: [...keywords] },
    wallhaven: { enabled: true, keywords: [...keywords] },
    metmuseum: { enabled: true, keywords: [...keywords] },
    artic: { enabled: false, keywords: [...keywords] }
  };
}

function hasPool(state, name) {
  return Boolean(name && state.library.collections[name]);
}

function mergePoolFeedConfig(existingConfig, source, patch) {
  return {
    ...existingConfig,
    [source]: {
      ...(existingConfig[source] || {}),
      ...patch
    }
  };
}

function assignIfChanged(target, key, value) {
  if (value === undefined || target[key] === value) {
    return false;
  }

  target[key] = value;
  return true;
}

function reduceDomainCommand(state, command, env = {}) {
  const now = env.now || new Date();
  const rng = env.rng || Math.random;

  switch (command.type) {
    case 'select-categories': {
      const categories = normalizeCategorySelection(
        command.payload?.categories,
        Object.keys(state.library.collections),
        state.playback.selectedCategories[0] || Object.keys(state.library.collections)[0] || 'Scenic Nature'
      );
      const withCategories = recomputeFeed({
        ...cloneState(state),
        playback: {
          ...state.playback,
          selectedCategories: categories
        }
      }, rng);
      const nextState = ensureActivePhoto(withCategories, { now, rng, direction: 'next', forceReselect: true });
      return createResult(nextState.state, emitPhotoUpdate(), []);
    }

    case 'update-excluded-keywords': {
      const nextState = recomputeFeed({
        ...cloneState(state),
        config: {
          ...state.config,
          excludedKeywords: trimKeywords(command.payload?.keywords)
        }
      }, rng);
      const ensured = ensureActivePhoto(nextState, { now, rng, direction: 'next' });
      return createResult(
        ensured.state,
        ensured.photoChanged ? emitPhotoUpdate() : emitStateSync(),
        [{ type: 'persist' }]
      );
    }

    case 'patch-state': {
      const patch = command.payload && typeof command.payload === 'object' ? command.payload : {};
      const nextState = cloneState(state);
      let changed = false;
      let refreshWeather = false;
      let recomputePhotos = false;

      [
        'theme',
        'inactivityTimeout',
        'slideshowInterval',
        'scaleMode',
        'splitPortrait',
        'splitCropPercent',
        'alignTimeOfDay',
        'alignWeather',
        'nightPercentage',
        'allowOpenAiFallback'
      ].forEach((field) => {
        changed = assignIfChanged(nextState.config, field, patch[field]) || changed;
      });

      if (Array.isArray(patch.excludedKeywords)) {
        const keywords = trimKeywords(patch.excludedKeywords);
        if (JSON.stringify(keywords) !== JSON.stringify(nextState.config.excludedKeywords)) {
          nextState.config.excludedKeywords = keywords;
          changed = true;
          recomputePhotos = true;
        }
      }

      if (patch.widgets && typeof patch.widgets === 'object' && !Array.isArray(patch.widgets)) {
        Object.keys(patch.widgets).forEach((widgetName) => {
          if (!Object.prototype.hasOwnProperty.call(nextState.config.widgets, widgetName)) {
            return;
          }

          const visible = Boolean(patch.widgets[widgetName]);
          if (nextState.config.widgets[widgetName] !== visible) {
            nextState.config.widgets[widgetName] = visible;
            changed = true;
          }
        });
      }

      if (patch.visionConfig && typeof patch.visionConfig === 'object' && !Array.isArray(patch.visionConfig)) {
        nextState.config.visionConfig = {
          apiUrl: String(patch.visionConfig.apiUrl || '').trim(),
          apiKey: String(patch.visionConfig.apiKey || '').trim(),
          model: String(patch.visionConfig.model || '').trim(),
          fallbackUrl: String(patch.visionConfig.fallbackUrl || '').trim(),
          fallbackApiKey: String(patch.visionConfig.fallbackApiKey || '').trim(),
          fallbackModel: String(patch.visionConfig.fallbackModel || '').trim()
        };
        changed = true;
      }

      if (patch.autoLocation !== undefined) {
        const autoLocation = Boolean(patch.autoLocation);
        if (nextState.config.autoLocation !== autoLocation) {
          nextState.config.autoLocation = autoLocation;
          changed = true;
          refreshWeather = true;
        }
      }

      if (patch.manualLocation && typeof patch.manualLocation === 'object' && !Array.isArray(patch.manualLocation)) {
        nextState.config.manualLocation = { ...patch.manualLocation };
        changed = true;
        refreshWeather = true;
      }

      if (!changed) {
        return createResult(state, [], []);
      }

      const recomputed = recomputePhotos ? recomputeFeed(nextState, rng) : nextState;
      const ensured = recomputePhotos
        ? ensureActivePhoto(recomputed, { now, rng, direction: 'next' })
        : { state: recomputed, photoChanged: false };

      return createResult(
        ensured.state,
        ensured.photoChanged ? emitPhotoUpdate() : emitStateSync(),
        [
          { type: 'persist' },
          ...(refreshWeather ? [{ type: 'refresh-weather' }] : [])
        ]
      );
    }

    case 'set-active-photo': {
      const url = String(command.payload?.url || '');
      const payloadPhoto = command.payload?.photo && typeof command.payload.photo === 'object'
        ? /** @type {Photo} */ ({ ...command.payload.photo })
        : null;
      const selectedPhoto = findPhotoInFeed(state.library.photosList, url)
        || getPhotoByUrl(state.library.collections, url, state.library.externalCollections)
        || payloadPhoto;
      if (!selectedPhoto) {
        return createResult(state, [], []);
      }
      const nextState = cloneState(state);
      if (!findPhotoInFeed(nextState.library.photosList, url)) {
        const previewPhoto = payloadPhoto || selectedPhoto;
        nextState.library.photosList = [
          { ...previewPhoto },
          ...nextState.library.photosList.filter((photo) => photo.url !== url)
        ];
      }
      const updatedState = updateActivePhotoUrl(nextState, selectedPhoto, state.playback.lastDirection);
      return createResult(updatedState.state, emitPhotoUpdate(), []);
    }

    case 'advance-photo': {
      const direction = /** @type {'next' | 'prev'} */ (command.payload?.direction || 'next');
      const strategy = command.payload?.strategy === 'sequence' ? 'sequence' : 'smart';
      const nextPhoto = strategy === 'sequence'
        ? selectSequentialPhoto({ state, direction })
        : selectSmartPhoto({ state, direction, now, rng });
      if (!nextPhoto) {
        return createResult(state, [], []);
      }
      const nextState = updateActivePhotoUrl(cloneState(state), nextPhoto, direction);
      return createResult(nextState.state, emitPhotoUpdate(), []);
    }

    case 'rate-photo': {
      const rating = Number(command.payload?.rating);
      const updated = withUpdatedPhoto(cloneState(state), String(command.payload?.url || ''), (photo) => ({
        ...photo,
        rating
      }));
      if (!updated.changed) {
        return createResult(state, [], []);
      }

      const recomputed = rating === 1 ? recomputeFeed(updated.state, rng) : updated.state;
      const ensured = rating === 1
        ? ensureActivePhoto(recomputed, { now, rng, direction: 'next' })
        : { state: recomputed, photoChanged: false };

      return createResult(
        ensured.state,
        rating === 1 && ensured.photoChanged ? emitPhotoUpdate() : emitStateSync(),
        [{ type: 'persist' }]
      );
    }

    case 'mark-photo-broken': {
      const updated = withUpdatedPhoto(cloneState(state), String(command.payload?.url || ''), (photo) => ({
        ...photo,
        rating: 1,
        isBroken: true
      }));
      if (!updated.changed) {
        return createResult(state, [], []);
      }

      const recomputed = recomputeFeed(updated.state, rng);
      const ensured = ensureActivePhoto(recomputed, { now, rng, direction: 'next' });
      return createResult(
        ensured.state,
        ensured.photoChanged ? emitPhotoUpdate() : emitStateSync(),
        [{ type: 'persist' }]
      );
    }

    case 'set-photo-crop': {
      const cropPercent = command.payload?.cropPercent;
      const cropPositionY = command.payload?.cropPositionY;
      const updated = withUpdatedPhoto(cloneState(state), String(command.payload?.url || ''), (photo) => ({
        ...photo,
        ...(cropPercent !== undefined ? { cropPercent: Number(cropPercent) } : {}),
        ...(cropPositionY !== undefined ? { cropPositionY: Number(cropPositionY) } : {})
      }));
      return updated.changed
        ? createResult(updated.state, emitStateSync(), [{ type: 'persist' }])
        : createResult(state, [], []);
    }

    case 'set-photo-prevent-pairing': {
      const url = String(command.payload?.url || '');
      const preventPairing = Boolean(command.payload?.preventPairing);
      const updated = withUpdatedPhoto(cloneState(state), String(command.payload?.url || ''), (photo) => ({
        ...photo,
        preventPairing
      }));
      if (!updated.changed) {
        return createResult(state, [], []);
      }

      const shouldPreserveActive = preventPairing && Boolean(command.payload?.preserveActive);
      if (!shouldPreserveActive) {
        return createResult(updated.state, emitStateSync(), [{ type: 'persist' }]);
      }

      const focusedPhoto = findPhotoInFeed(updated.state.library.photosList, url)
        || getPhotoByUrl(updated.state.library.collections, url);
      const preserved = focusedPhoto
        ? updateActivePhotoUrl(updated.state, focusedPhoto, updated.state.playback.lastDirection)
        : { state: updated.state, changed: false };

      return createResult(
        preserved.state,
        preserved.changed ? emitPhotoUpdate() : emitStateSync(),
        [{ type: 'persist' }]
      );
    }

    case 'report-photo-metadata': {
      const updated = withUpdatedPhoto(cloneState(state), String(command.payload?.url || ''), (photo) => ({
        ...photo,
        orientation: /** @type {'portrait' | 'landscape'} */ (command.payload?.orientation),
        ...(command.payload?.width !== undefined ? { width: Number(command.payload.width) } : {}),
        ...(command.payload?.height !== undefined ? { height: Number(command.payload.height) } : {})
      }));
      return updated.changed
        ? createResult(updated.state, emitStateSync(), [{ type: 'persist' }])
        : createResult(state, [], []);
    }

    case 'set-split-portrait': {
      const nextState = cloneState(state);
      nextState.config.splitPortrait = Boolean(command.payload?.enabled);
      return createResult(nextState, emitStateSync(), [{ type: 'persist' }]);
    }

    case 'set-split-crop': {
      const nextState = cloneState(state);
      nextState.config.splitCropPercent = Number(command.payload?.percent);
      return createResult(nextState, emitStateSync(), [{ type: 'persist' }]);
    }

    case 'set-scale-mode': {
      const nextState = cloneState(state);
      nextState.config.scaleMode = /** @type {'cover' | 'contain'} */ (command.payload?.mode);
      return createResult(nextState, emitStateSync(), [{ type: 'persist' }]);
    }

    case 'change-theme': {
      const nextState = cloneState(state);
      nextState.config.theme = String(command.payload?.theme || state.config.theme);
      return createResult(nextState, emitStateSync(), []);
    }

    case 'change-interval': {
      const nextState = cloneState(state);
      nextState.config.slideshowInterval = Number(command.payload?.intervalMs);
      return createResult(nextState, emitStateSync(), []);
    }

    case 'set-screensaver-active': {
      const nextState = cloneState(state);
      nextState.runtime.screensaverActive = Boolean(command.payload?.active);
      nextState.runtime.manualOverride = Boolean(command.payload?.active);
      nextState.runtime.browserRunning = Boolean(command.payload?.active);
      return createResult(
        nextState,
        emitStateSync(),
        [{ type: command.payload?.active ? 'launch-kiosk' : 'kill-kiosk' }]
      );
    }

    case 'add-pool': {
      const name = String(command.payload?.name || '').trim();
      const keywords = trimKeywords(command.payload?.keywords);
      if (!name || keywords.length === 0 || hasPool(state, name)) {
        return createResult(state, [], []);
      }

      const nextState = cloneState(state);
      nextState.library.collections[name] = [];
      nextState.config.searchKeywords[name] = keywords;
      nextState.config.feedConfigs[name] = normalizeFeedConfigKeywords(keywords);
      return createResult(
        nextState,
        emitStateSync(),
        [{ type: 'persist' }, { type: 'run-crawler', payload: { categories: [name] } }]
      );
    }

    case 'set-pool-keywords': {
      const name = String(command.payload?.name || '').trim();
      const keywords = trimKeywords(command.payload?.keywords);
      if (!hasPool(state, name) || keywords.length === 0) {
        return createResult(state, [], []);
      }

      const nextState = cloneState(state);
      nextState.config.searchKeywords[name] = keywords;
      return createResult(nextState, emitStateSync(), [{ type: 'persist' }]);
    }

    case 'merge-pool-feed-config': {
      const name = String(command.payload?.name || '').trim();
      const source = String(command.payload?.source || '').trim();
      const configPatch = command.payload?.config;
      if (!hasPool(state, name) || !source || !configPatch || typeof configPatch !== 'object' || Array.isArray(configPatch)) {
        return createResult(state, [], []);
      }

      const nextState = cloneState(state);
      nextState.config.feedConfigs[name] = mergePoolFeedConfig(
        nextState.config.feedConfigs[name] || {},
        source,
        configPatch
      );
      return createResult(nextState, emitStateSync(), [{ type: 'persist' }]);
    }

    case 'delete-pool': {
      const name = String(command.payload?.name || '').trim();
      if (!hasPool(state, name)) {
        return createResult(state, [], []);
      }

      const nextState = cloneState(state);
      delete nextState.library.collections[name];
      delete nextState.config.searchKeywords[name];
      delete nextState.config.feedConfigs[name];
      nextState.playback.selectedCategories = normalizeCategorySelection(
        nextState.playback.selectedCategories.filter((category) => category !== name),
        Object.keys(nextState.library.collections),
        Object.keys(nextState.library.collections)[0] || 'Scenic Nature'
      );
      const recomputed = recomputeFeed(nextState, rng);
      const ensured = ensureActivePhoto(recomputed, { now, rng, direction: 'next', forceReselect: true });
      return createResult(
        ensured.state,
        emitPhotoUpdate(),
        [{ type: 'persist' }]
      );
    }

    case 'trigger-recrawl':
      return createResult(state, [], [{
        type: 'start-recrawl-job',
        payload: {
          categories: Array.isArray(command.payload?.categories) ? [...command.payload.categories] : []
        }
      }]);

    default:
      return createResult(state, [], []);
  }
}

module.exports = {
  reduceDomainCommand
};
