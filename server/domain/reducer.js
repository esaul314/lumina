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
  updatePhotoInLibraries
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

function unchangedResult(state) {
  return createResult(state, [], []);
}

function stateSyncResult(nextState, effects = []) {
  return createResult(nextState, emitStateSync(), effects);
}

function photoUpdateResult(nextState, effects = []) {
  return createResult(nextState, emitPhotoUpdate(), effects);
}

function effectOnlyResult(state, effects = []) {
  return createResult(state, [], effects);
}

function resolveMutationOutput(output, nextState) {
  if (Array.isArray(output)) {
    return output;
  }

  if (typeof output === 'function') {
    return output(nextState);
  }

  return output;
}

function reduceStateMutation(state, {
  apply,
  events = emitStateSync(),
  effects = [],
  persist = false
}) {
  const nextState = cloneState(state);
  const changed = apply(nextState);

  if (!changed) {
    return unchangedResult(state);
  }

  const resolvedEffects = resolveMutationOutput(effects, nextState) || [];

  return createResult(
    nextState,
    resolveMutationOutput(events, nextState) || [],
    persist ? withPersist(resolvedEffects) : resolvedEffects
  );
}

function stateSyncEventsFor(photoChanged) {
  return photoChanged ? emitPhotoUpdate() : emitStateSync();
}

function withPersist(effects = []) {
  return [{ type: 'persist' }, ...effects];
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
  const {
    collections,
    externalCollections,
    changed,
    changedInCollections,
    changedInExternalCollections
  } = updatePhotoInLibraries(state.library.collections, state.library.externalCollections, url, updater);

  if (!changed) {
    return {
      state,
      changed: false,
      changedInCollections: false,
      changedInExternalCollections: false
    };
  }

  return {
    state: {
      ...state,
      library: {
        collections,
        externalCollections,
        photosList: state.library.photosList
          .map((photo) => (photo.url === url ? updater({ ...photo }) : { ...photo }))
          .filter(Boolean)
      }
    },
    changed: true,
    changedInCollections,
    changedInExternalCollections
  };
}

function buildDefinedMetadataPatch(entries) {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value !== undefined)
  );
}

function buildPhotoPersistenceEffects({ url, metadata, updateResult }) {
  const metadataPatch = buildDefinedMetadataPatch(metadata);

  return [
    ...(updateResult.changedInCollections ? [{ type: 'persist' }] : []),
    ...(updateResult.changedInExternalCollections && Object.keys(metadataPatch).length > 0
      ? [{ type: 'persist-external-photo-metadata', payload: { url, metadata: metadataPatch } }]
      : [])
  ];
}

function keepUpdatedPhotoState(state) {
  return { state, photoChanged: false };
}

function recomputeUpdatedPhotoState(state, { now, rng, direction = 'next', forceReselect = false }) {
  return ensureActivePhoto(recomputeFeed(state, rng), { now, rng, direction, forceReselect });
}

function preserveUpdatedPhotoState(state, { url }) {
  const focusedPhoto = findPhotoInFeed(state.library.photosList, url)
    || getPhotoByUrl(state.library.collections, url, state.library.externalCollections);

  if (!focusedPhoto) {
    return keepUpdatedPhotoState(state);
  }

  const preserved = updateActivePhotoUrl(state, focusedPhoto, state.playback.lastDirection);
  return {
    state: preserved.state,
    photoChanged: preserved.changed
  };
}

function reducePhotoLibraryCommand(state, {
  url,
  updater,
  metadata,
  afterUpdate = keepUpdatedPhotoState,
  eventsFor = ({ photoChanged }) => stateSyncEventsFor(photoChanged),
  env = {}
}) {
  const updated = withUpdatedPhoto(cloneState(state), url, updater);

  if (!updated.changed) {
    return unchangedResult(state);
  }

  const finalized = afterUpdate(updated.state, {
    ...env,
    url,
    updateResult: updated
  });

  return createResult(
    finalized.state,
    eventsFor(finalized),
    buildPhotoPersistenceEffects({
      url,
      metadata,
      updateResult: updated
    })
  );
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

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function shallowEqualObjects(left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => left[key] === right[key]);
}

function normalizeVisionConfig(config = {}) {
  return {
    apiUrl: String(config.apiUrl || '').trim(),
    apiKey: String(config.apiKey || '').trim(),
    model: String(config.model || '').trim(),
    fallbackUrl: String(config.fallbackUrl || '').trim(),
    fallbackApiKey: String(config.fallbackApiKey || '').trim(),
    fallbackModel: String(config.fallbackModel || '').trim()
  };
}

function markPatchChange(context, flags = {}) {
  context.changed = true;
  context.recomputePhotos ||= Boolean(flags.recomputePhotos);
  context.refreshWeather ||= Boolean(flags.refreshWeather);
  return context;
}

function applyScalarConfigPatch(context, fields) {
  const changed = fields.reduce((didChange, field) => (
    assignIfChanged(context.nextState.config, field, context.patch[field]) || didChange
  ), false);

  return changed ? markPatchChange(context) : context;
}

function applyExcludedKeywordsPatch(context) {
  if (!Array.isArray(context.patch.excludedKeywords)) {
    return context;
  }

  const keywords = trimKeywords(context.patch.excludedKeywords);

  if (arraysEqual(keywords, context.nextState.config.excludedKeywords)) {
    return context;
  }

  context.nextState.config.excludedKeywords = keywords;
  return markPatchChange(context, { recomputePhotos: true });
}

function applyWidgetPatch(context) {
  const widgets = context.patch.widgets;

  if (!widgets || typeof widgets !== 'object' || Array.isArray(widgets)) {
    return context;
  }

  const changed = Object.keys(widgets).reduce((didChange, widgetName) => {
    if (!Object.prototype.hasOwnProperty.call(context.nextState.config.widgets, widgetName)) {
      return didChange;
    }

    const visible = Boolean(widgets[widgetName]);
    return assignIfChanged(context.nextState.config.widgets, widgetName, visible) || didChange;
  }, false);

  return changed ? markPatchChange(context) : context;
}

function applyVisionConfigPatch(context) {
  const visionConfig = context.patch.visionConfig;

  if (!visionConfig || typeof visionConfig !== 'object' || Array.isArray(visionConfig)) {
    return context;
  }

  const normalizedVisionConfig = normalizeVisionConfig(visionConfig);

  if (shallowEqualObjects(normalizedVisionConfig, context.nextState.config.visionConfig || {})) {
    return context;
  }

  context.nextState.config.visionConfig = normalizedVisionConfig;
  return markPatchChange(context);
}

function applyAutoLocationPatch(context) {
  return assignIfChanged(
    context.nextState.config,
    'autoLocation',
    context.patch.autoLocation === undefined ? undefined : Boolean(context.patch.autoLocation)
  )
    ? markPatchChange(context, { refreshWeather: true })
    : context;
}

function applyManualLocationPatch(context) {
  const manualLocation = context.patch.manualLocation;

  if (!manualLocation || typeof manualLocation !== 'object' || Array.isArray(manualLocation)) {
    return context;
  }

  if (shallowEqualObjects(manualLocation, context.nextState.config.manualLocation || {})) {
    return context;
  }

  context.nextState.config.manualLocation = { ...manualLocation };
  return markPatchChange(context, { refreshWeather: true });
}

function reduceStatePatchCommand(state, patch, env) {
  const context = [
    (current) => applyScalarConfigPatch(current, [
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
    ]),
    applyExcludedKeywordsPatch,
    applyWidgetPatch,
    applyVisionConfigPatch,
    applyAutoLocationPatch,
    applyManualLocationPatch
  ].reduce((current, applyPatch) => applyPatch(current), {
    patch,
    nextState: cloneState(state),
    changed: false,
    refreshWeather: false,
    recomputePhotos: false
  });

  if (!context.changed) {
    return unchangedResult(state);
  }

  const recomputed = context.recomputePhotos
    ? recomputeFeed(context.nextState, env.rng)
    : context.nextState;
  const ensured = context.recomputePhotos
    ? ensureActivePhoto(recomputed, { now: env.now, rng: env.rng, direction: 'next' })
    : { state: recomputed, photoChanged: false };

  return createResult(
    ensured.state,
    stateSyncEventsFor(ensured.photoChanged),
    withPersist(context.refreshWeather ? [{ type: 'refresh-weather' }] : [])
  );
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
      return photoUpdateResult(nextState.state);
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
        stateSyncEventsFor(ensured.photoChanged),
        withPersist()
      );
    }

    case 'patch-state': {
      const patch = command.payload && typeof command.payload === 'object' ? command.payload : {};
      return reduceStatePatchCommand(state, patch, { now, rng });
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
        return unchangedResult(state);
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
      return photoUpdateResult(updatedState.state);
    }

    case 'advance-photo': {
      const direction = /** @type {'next' | 'prev'} */ (command.payload?.direction || 'next');
      const strategy = command.payload?.strategy === 'sequence' ? 'sequence' : 'smart';
      const nextPhoto = strategy === 'sequence'
        ? selectSequentialPhoto({ state, direction })
        : selectSmartPhoto({ state, direction, now, rng });
      if (!nextPhoto) {
        return unchangedResult(state);
      }
      const nextState = updateActivePhotoUrl(cloneState(state), nextPhoto, direction);
      return photoUpdateResult(nextState.state);
    }

    case 'rate-photo': {
      const url = String(command.payload?.url || '');
      const rating = Number(command.payload?.rating);
      return reducePhotoLibraryCommand(state, {
        url,
        updater: (photo) => ({
          ...photo,
          rating
        }),
        metadata: { rating },
        afterUpdate: rating === 1
          ? (nextState) => recomputeUpdatedPhotoState(nextState, { now, rng, direction: 'next' })
          : keepUpdatedPhotoState
      });
    }

    case 'mark-photo-broken': {
      const url = String(command.payload?.url || '');
      return reducePhotoLibraryCommand(state, {
        url,
        updater: (photo) => ({
          ...photo,
          rating: 1,
          isBroken: true
        }),
        metadata: { rating: 1, isBroken: true },
        afterUpdate: (nextState) => recomputeUpdatedPhotoState(nextState, { now, rng, direction: 'next' })
      });
    }

    case 'set-photo-crop': {
      const url = String(command.payload?.url || '');
      const cropPercent = command.payload?.cropPercent;
      const cropPositionY = command.payload?.cropPositionY;
      return reducePhotoLibraryCommand(state, {
        url,
        updater: (photo) => ({
          ...photo,
          ...(cropPercent !== undefined ? { cropPercent: Number(cropPercent) } : {}),
          ...(cropPositionY !== undefined ? { cropPositionY: Number(cropPositionY) } : {})
        }),
        metadata: {
          ...(cropPercent !== undefined ? { cropPercent: Number(cropPercent) } : {}),
          ...(cropPositionY !== undefined ? { cropPositionY: Number(cropPositionY) } : {})
        }
      });
    }

    case 'set-photo-prevent-pairing': {
      const url = String(command.payload?.url || '');
      const preventPairing = Boolean(command.payload?.preventPairing);
      const shouldPreserveActive = preventPairing && Boolean(command.payload?.preserveActive);
      return reducePhotoLibraryCommand(state, {
        url,
        updater: (photo) => ({
          ...photo,
          preventPairing
        }),
        metadata: { preventPairing },
        afterUpdate: shouldPreserveActive ? preserveUpdatedPhotoState : keepUpdatedPhotoState
      });
    }

    case 'report-photo-metadata': {
      const url = String(command.payload?.url || '');
      const orientation = /** @type {'portrait' | 'landscape'} */ (command.payload?.orientation);
      const width = command.payload?.width !== undefined ? Number(command.payload.width) : undefined;
      const height = command.payload?.height !== undefined ? Number(command.payload.height) : undefined;
      return reducePhotoLibraryCommand(state, {
        url,
        updater: (photo) => ({
          ...photo,
          orientation,
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {})
        }),
        metadata: { orientation, width, height }
      });
    }

    case 'set-split-portrait': {
      return reduceStateMutation(state, {
        apply: (nextState) => assignIfChanged(nextState.config, 'splitPortrait', Boolean(command.payload?.enabled)),
        persist: true
      });
    }

    case 'set-split-crop': {
      return reduceStateMutation(state, {
        apply: (nextState) => assignIfChanged(nextState.config, 'splitCropPercent', Number(command.payload?.percent)),
        persist: true
      });
    }

    case 'set-scale-mode': {
      return reduceStateMutation(state, {
        apply: (nextState) => assignIfChanged(
          nextState.config,
          'scaleMode',
          /** @type {'cover' | 'contain'} */ (command.payload?.mode)
        ),
        persist: true
      });
    }

    case 'change-theme': {
      return reduceStateMutation(state, {
        apply: (nextState) => assignIfChanged(nextState.config, 'theme', String(command.payload?.theme || state.config.theme))
      });
    }

    case 'change-interval': {
      return reduceStateMutation(state, {
        apply: (nextState) => assignIfChanged(nextState.config, 'slideshowInterval', Number(command.payload?.intervalMs))
      });
    }

    case 'set-screensaver-active': {
      const active = Boolean(command.payload?.active);
      return reduceStateMutation(state, {
        apply: (nextState) => {
          const changedFlags = [
            assignIfChanged(nextState.runtime, 'screensaverActive', active),
            assignIfChanged(nextState.runtime, 'manualOverride', active),
            assignIfChanged(nextState.runtime, 'browserRunning', active)
          ];
          return changedFlags.some(Boolean);
        },
        effects: [{ type: active ? 'launch-kiosk' : 'kill-kiosk' }]
      });
    }

    case 'add-pool': {
      const name = String(command.payload?.name || '').trim();
      const keywords = trimKeywords(command.payload?.keywords);
      if (!name || keywords.length === 0 || hasPool(state, name)) {
        return unchangedResult(state);
      }

      const nextState = cloneState(state);
      nextState.library.collections[name] = [];
      nextState.config.searchKeywords[name] = keywords;
      nextState.config.feedConfigs[name] = normalizeFeedConfigKeywords(keywords);
      return stateSyncResult(
        nextState,
        withPersist([{ type: 'run-crawler', payload: { categories: [name] } }])
      );
    }

    case 'set-pool-keywords': {
      const name = String(command.payload?.name || '').trim();
      const keywords = trimKeywords(command.payload?.keywords);
      if (!hasPool(state, name) || keywords.length === 0) {
        return unchangedResult(state);
      }

      const nextState = cloneState(state);
      nextState.config.searchKeywords[name] = keywords;
      return stateSyncResult(nextState, withPersist());
    }

    case 'merge-pool-feed-config': {
      const name = String(command.payload?.name || '').trim();
      const source = String(command.payload?.source || '').trim();
      const configPatch = command.payload?.config;
      if (!hasPool(state, name) || !source || !configPatch || typeof configPatch !== 'object' || Array.isArray(configPatch)) {
        return unchangedResult(state);
      }

      const nextState = cloneState(state);
      nextState.config.feedConfigs[name] = mergePoolFeedConfig(
        nextState.config.feedConfigs[name] || {},
        source,
        configPatch
      );
      return stateSyncResult(nextState, withPersist());
    }

    case 'delete-pool': {
      const name = String(command.payload?.name || '').trim();
      if (!hasPool(state, name)) {
        return unchangedResult(state);
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
      return photoUpdateResult(
        ensured.state,
        withPersist()
      );
    }

    case 'save-env-secret': {
      const envKey = String(command.payload?.envKey || '').trim();
      const runtimeFlag = String(command.payload?.runtimeFlag || '').trim();
      const value = String(command.payload?.value || '');

      if (!envKey || !runtimeFlag) {
        return unchangedResult(state);
      }

      return stateSyncResult(state, [{
        type: 'persist-env-vars',
        payload: {
          entries: { [envKey]: value },
          runtimeFlags: { [runtimeFlag]: Boolean(value) }
        }
      }]);
    }

    case 'trigger-recrawl':
      return effectOnlyResult(state, [{
        type: 'start-recrawl-job',
        payload: {
          categories: Array.isArray(command.payload?.categories) ? [...command.payload.categories] : []
        }
      }]);

    case 'trigger-vision-analysis':
      return effectOnlyResult(state, [{
        type: 'start-vision-analysis-job',
        payload: {
          categories: Array.isArray(command.payload?.categories) ? [...command.payload.categories] : []
        }
      }]);

    default:
      return unchangedResult(state);
  }
}

module.exports = {
  reduceDomainCommand
};
