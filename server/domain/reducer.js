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
const {
  keywordEntriesEqual,
  normalizeKeywordEntries
} = require('../utils/keywordSpecs.js');
const {
  normalizeManualLocation,
  normalizeVisionConfig,
  STATE_PATCH_FIELDS
} = require('./statePatch.js');

function cloneState(state) {
  return {
    config: {
      ...state.config,
      widgets: { ...state.config.widgets },
      searchKeywords: Object.fromEntries(
        Object.entries(state.config.searchKeywords).map(([category, keywords]) => [
          category,
          normalizeKeywordEntries(keywords)
        ])
      ),
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

function reduceCommandMutation(state, command, {
  apply,
  events,
  effects,
  ...options
}) {
  return reduceStateMutation(state, {
    ...options,
    ...(events === undefined
      ? {}
      : {
          events: typeof events === 'function'
            ? (nextState) => events(nextState, command)
            : events
        }),
    ...(effects === undefined
      ? {}
      : {
          effects: typeof effects === 'function'
            ? (nextState) => effects(nextState, command)
            : effects
        }),
    apply: (nextState) => apply(nextState, command)
  });
}

function buildEntriesCommandReducer(selectTarget, readEntries, options = {}) {
  return (state, command) => reduceCommandMutation(state, command, {
    ...options,
    apply: (nextState, currentCommand) => {
      const target = selectTarget(nextState);
      const entries = typeof readEntries === 'function'
        ? readEntries(currentCommand, nextState, target)
        : readEntries;

      return Array.isArray(entries) && entries.length > 0
        ? assignFields(target, entries)
        : false;
    }
  });
}

function buildFieldCommandReducer(selectTarget, field, readValue, options = {}) {
  return buildEntriesCommandReducer(
    selectTarget,
    (currentCommand, nextState) => [[field, readValue(currentCommand, nextState)]],
    options
  );
}

function finalizeFeedMutation(nextState, {
  now,
  rng,
  direction = 'next',
  forceReselect = false,
  eventsFor = ({ photoChanged }) => stateSyncEventsFor(photoChanged),
  effects = [],
  persist = false
}) {
  const recomputed = recomputeFeed(nextState, rng);
  const finalized = ensureActivePhoto(recomputed, { now, rng, direction, forceReselect });
  const resolvedEffects = resolveMutationOutput(effects, finalized) || [];

  return createResult(
    finalized.state,
    resolveMutationOutput(eventsFor, finalized) || [],
    persist ? withPersist(resolvedEffects) : resolvedEffects
  );
}

function reduceFeedMutation(state, options, env) {
  const nextState = cloneState(state);
  const changed = options.apply(nextState);

  if (!changed) {
    return unchangedResult(state);
  }

  return finalizeFeedMutation(nextState, {
    ...options,
    ...env
  });
}

function stateSyncEventsFor(photoChanged) {
  return photoChanged ? emitPhotoUpdate() : emitStateSync();
}

function buildEffectResultReducer({
  effectType,
  result = effectOnlyResult,
  buildPayload = () => ({})
}) {
  return (state, command) => {
    const payload = buildPayload(command);

    if (!payload) {
      return unchangedResult(state);
    }

    return result(state, [{
      type: effectType,
      payload
    }]);
  };
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

const readPhotoCommandUrl = (command) => String(command.payload?.url || '');

function buildPhotoCommandReducer({
  buildUpdater,
  buildMetadata = () => ({}),
  resolveAfterUpdate = () => keepUpdatedPhotoState,
  eventsFor
}) {
  return (state, command, env = {}) => {
    const payload = command.payload || {};

    return reducePhotoLibraryCommand(state, {
      url: readPhotoCommandUrl(command),
      updater: (photo) => buildUpdater(payload, photo),
      metadata: buildMetadata(payload),
      afterUpdate: resolveAfterUpdate(payload),
      ...(eventsFor ? { eventsFor } : {}),
      env
    });
  };
}

function resolveReducerValue(value, ...args) {
  return typeof value === 'function' ? value(...args) : value;
}

function buildFeedCommandReducer({
  readPayload,
  apply,
  direction = 'next',
  forceReselect = false,
  eventsFor,
  persist = false
}) {
  return (state, command, env = {}) => {
    const payload = readPayload(command, state);

    if (payload === null) {
      return unchangedResult(state);
    }

    return reduceFeedMutation(state, {
      direction: resolveReducerValue(direction, payload, command, state),
      forceReselect: resolveReducerValue(forceReselect, payload, command, state),
      ...(eventsFor === undefined
        ? {}
        : { eventsFor: resolveReducerValue(eventsFor, payload, command, state) }),
      persist: resolveReducerValue(persist, payload, command, state),
      apply: (nextState) => apply(nextState, payload, command, state)
    }, env);
  };
}

function buildPoolCommandReducer({
  readPayload,
  apply,
  effects,
  persist = false,
  requireExistingPool = true
}) {
  return (state, command) => {
    const payload = readPayload(command, state);

    if (payload === null) {
      return unchangedResult(state);
    }

    const options = {
      persist: resolveReducerValue(persist, payload, command, state),
      ...(effects === undefined
        ? {}
        : { effects: resolveReducerValue(effects, payload, command, state) }),
      apply: requireExistingPool
        ? (nextState, poolName) => apply(nextState, { ...payload, name: poolName }, command, state)
        : (nextState) => apply(nextState, payload, command, state)
    };

    return requireExistingPool
      ? reducePoolMutation(state, payload.name, options)
      : reduceStateMutation(state, options);
  };
}

function prependVisiblePhoto(photosList, photo) {
  if (!photo?.url) {
    return photosList;
  }

  return [
    { ...photo },
    ...photosList.filter((currentPhoto) => currentPhoto.url !== photo.url)
  ];
}

function findSelectablePhoto(state, url, fallbackPhoto = null) {
  return findPhotoInFeed(state.library.photosList, url)
    || getPhotoByUrl(state.library.collections, url, state.library.externalCollections)
    || fallbackPhoto
    || null;
}

function applyPlaybackSelection(state, selectedPhoto, {
  direction,
  prepareState = (nextState) => nextState
}) {
  const nextState = prepareState(cloneState(state), selectedPhoto);
  const updatedState = updateActivePhotoUrl(nextState, selectedPhoto, direction);
  return photoUpdateResult(updatedState.state);
}

function buildPlaybackCommandReducer({
  readPayload,
  selectPhoto,
  resolveDirection,
  prepareState
}) {
  return (state, command, env = {}) => {
    const payload = readPayload(command, state);

    if (payload === null) {
      return unchangedResult(state);
    }

    const selectedPhoto = selectPhoto(state, payload, env);
    if (!selectedPhoto) {
      return unchangedResult(state);
    }

    return applyPlaybackSelection(state, selectedPhoto, {
      direction: resolveDirection(payload, command, state, env),
      prepareState: (nextState) => (
        prepareState
          ? prepareState(nextState, payload, selectedPhoto, command, state, env)
          : nextState
      )
    });
  };
}

const reducePhotoCommand = {
  'rate-photo': buildPhotoCommandReducer({
    buildUpdater: ({ rating }, photo) => ({
      ...photo,
      rating: Number(rating)
    }),
    buildMetadata: ({ rating }) => ({
      rating: Number(rating)
    }),
    resolveAfterUpdate: ({ rating }) => (
      Number(rating) === 1
        ? recomputeUpdatedPhotoState
        : keepUpdatedPhotoState
    )
  }),
  'mark-photo-broken': buildPhotoCommandReducer({
    buildUpdater: (_payload, photo) => ({
      ...photo,
      rating: 1,
      isBroken: true
    }),
    buildMetadata: () => ({
      rating: 1,
      isBroken: true
    }),
    resolveAfterUpdate: () => recomputeUpdatedPhotoState
  }),
  'set-photo-crop': buildPhotoCommandReducer({
    buildUpdater: ({ cropPercent, cropPositionY }, photo) => ({
      ...photo,
      ...(cropPercent !== undefined ? { cropPercent: Number(cropPercent) } : {}),
      ...(cropPositionY !== undefined ? { cropPositionY: Number(cropPositionY) } : {})
    }),
    buildMetadata: ({ cropPercent, cropPositionY }) => ({
      ...(cropPercent !== undefined ? { cropPercent: Number(cropPercent) } : {}),
      ...(cropPositionY !== undefined ? { cropPositionY: Number(cropPositionY) } : {})
    })
  }),
  'set-photo-prevent-pairing': buildPhotoCommandReducer({
    buildUpdater: ({ preventPairing }, photo) => ({
      ...photo,
      preventPairing: Boolean(preventPairing)
    }),
    buildMetadata: ({ preventPairing }) => ({
      preventPairing: Boolean(preventPairing)
    }),
    resolveAfterUpdate: ({ preventPairing, preserveActive }) => (
      Boolean(preventPairing) && Boolean(preserveActive)
        ? preserveUpdatedPhotoState
        : keepUpdatedPhotoState
    )
  }),
  'set-photo-loved': buildPhotoCommandReducer({
    buildUpdater: ({ loved }, photo) => ({
      ...photo,
      loved: Boolean(loved)
    }),
    buildMetadata: ({ loved }) => ({
      loved: Boolean(loved)
    })
  }),
  'report-photo-metadata': buildPhotoCommandReducer({
    buildUpdater: ({ orientation, width, height }, photo) => ({
      ...photo,
      orientation,
      ...(width !== undefined ? { width: Number(width) } : {}),
      ...(height !== undefined ? { height: Number(height) } : {})
    }),
    buildMetadata: ({ orientation, width, height }) => ({
      orientation,
      ...(width !== undefined ? { width: Number(width) } : {}),
      ...(height !== undefined ? { height: Number(height) } : {})
    })
  })
};

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

function normalizePoolName(value) {
  return String(value || '').trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function assignFields(target, entries) {
  return entries.reduce((changed, [key, value]) => (
    assignIfChanged(target, key, value) || changed
  ), false);
}

function addPoolState(nextState, name, keywords) {
  if (hasPool(nextState, name)) {
    return false;
  }

  nextState.library.collections[name] = [];
  nextState.config.searchKeywords[name] = [...keywords];
  nextState.config.feedConfigs[name] = normalizeFeedConfigKeywords(keywords);
  return true;
}

function assignPoolKeywords(nextState, name, keywords) {
  if (keywordEntriesEqual(nextState.config.searchKeywords[name] || [], keywords)) {
    return false;
  }

  nextState.config.searchKeywords[name] = normalizeKeywordEntries(keywords);
  return true;
}

function assignExcludedKeywords(nextState, keywords) {
  if (arraysEqual(nextState.config.excludedKeywords, keywords)) {
    return false;
  }

  nextState.config.excludedKeywords = [...keywords];
  return true;
}

function mergePoolSourceConfig(nextState, name, source, configPatch) {
  const existingPoolConfig = nextState.config.feedConfigs[name] || {};
  const existingSourceConfig = existingPoolConfig[source] || {};
  const mergedPoolConfig = mergePoolFeedConfig(existingPoolConfig, source, configPatch);
  const mergedSourceConfig = mergedPoolConfig[source] || {};

  if (shallowEqualObjects(mergedSourceConfig, existingSourceConfig)) {
    return false;
  }

  nextState.config.feedConfigs[name] = mergedPoolConfig;
  return true;
}

function removePoolState(nextState, name) {
  if (!hasPool(nextState, name)) {
    return false;
  }

  delete nextState.library.collections[name];
  delete nextState.config.searchKeywords[name];
  delete nextState.config.feedConfigs[name];
  nextState.playback.selectedCategories = normalizeCategorySelection(
    nextState.playback.selectedCategories.filter((category) => category !== name),
    Object.keys(nextState.library.collections),
    Object.keys(nextState.library.collections)[0] || 'Scenic Nature'
  );
  return true;
}

function reducePoolMutation(state, name, options = {}) {
  if (!hasPool(state, name)) {
    return unchangedResult(state);
  }

  return reduceStateMutation(state, {
    ...options,
    apply: (nextState) => options.apply(nextState, name)
  });
}

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function valuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && arraysEqual(left, right);
  }

  return left === right;
}

function shallowEqualObjects(left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => valuesEqual(left[key], right[key]));
}

const PATCH_SKIP = Symbol('patch-skip');

function markPatchChange(context, flags = {}) {
  context.changed = true;
  context.recomputePhotos ||= Boolean(flags.recomputePhotos);
  context.refreshWeather ||= Boolean(flags.refreshWeather);
  return context;
}

const hasPatchField = (patch, field) => patch?.[field] !== undefined;

const readPatchField = (field, normalize = (value) => value) => (patch, nextState) => (
  hasPatchField(patch, field)
    ? normalize(patch[field], nextState, patch)
    : PATCH_SKIP
);

const createPatchSpec = ({
  readValue,
  hasChanged,
  applyValue,
  flags = {}
}) => ({
  readValue,
  hasChanged,
  applyValue,
  flags
});

function applyPatchSpec(context, spec) {
  const value = spec.readValue(context.patch, context.nextState);

  if (value === PATCH_SKIP || !spec.hasChanged(context.nextState, value)) {
    return context;
  }

  spec.applyValue(context.nextState, value);
  return markPatchChange(context, spec.flags);
}

const createConfigPatchSpec = (field, {
  readValue = readPatchField(field),
  hasChanged = (nextState, value) => nextState.config[field] !== value,
  applyValue = (nextState, value) => {
    nextState.config[field] = value;
  },
  flags
} = {}) => createPatchSpec({
  readValue,
  hasChanged,
  applyValue,
  flags
});

const readExcludedKeywordsPatch = readPatchField('excludedKeywords', (keywords) => (
  Array.isArray(keywords)
    ? normalizeKeywordEntries(keywords).filter((keyword) => typeof keyword === 'string')
    : PATCH_SKIP
));

const readWidgetPatch = readPatchField('widgets', (widgets, nextState) => {
  if (!isPlainObject(widgets)) {
    return PATCH_SKIP;
  }

  const normalizedEntries = Object.keys(widgets)
    .filter((widgetName) => Object.prototype.hasOwnProperty.call(nextState.config.widgets, widgetName))
    .map((widgetName) => [widgetName, Boolean(widgets[widgetName])]);

  return normalizedEntries.length > 0 ? Object.fromEntries(normalizedEntries) : PATCH_SKIP;
});

const readVisionConfigPatch = readPatchField('visionConfig', (visionConfig) => (
  isPlainObject(visionConfig) ? normalizeVisionConfig(visionConfig) : PATCH_SKIP
));

const readAutoLocationPatch = readPatchField('autoLocation', Boolean);

const readManualLocationPatch = readPatchField('manualLocation', (manualLocation) => (
  isPlainObject(manualLocation) ? normalizeManualLocation(manualLocation) : PATCH_SKIP
));

const PATCH_STATE_SPECS = [
  ...STATE_PATCH_FIELDS.map((field) => createConfigPatchSpec(field)),
  createConfigPatchSpec('excludedKeywords', {
    readValue: readExcludedKeywordsPatch,
    hasChanged: (nextState, keywords) => !arraysEqual(nextState.config.excludedKeywords, keywords),
    applyValue: (nextState, keywords) => {
      nextState.config.excludedKeywords = [...keywords];
    },
    flags: { recomputePhotos: true }
  }),
  createPatchSpec({
    readValue: readWidgetPatch,
    hasChanged: (nextState, widgets) => Object.entries(widgets)
      .some(([widgetName, visible]) => nextState.config.widgets[widgetName] !== visible),
    applyValue: (nextState, widgets) => {
      Object.entries(widgets).forEach(([widgetName, visible]) => {
        nextState.config.widgets[widgetName] = visible;
      });
    }
  }),
  createConfigPatchSpec('visionConfig', {
    readValue: readVisionConfigPatch,
    hasChanged: (nextState, visionConfig) => !shallowEqualObjects(
      visionConfig,
      nextState.config.visionConfig || {}
    ),
    applyValue: (nextState, visionConfig) => {
      nextState.config.visionConfig = { ...visionConfig };
    }
  }),
  createConfigPatchSpec('autoLocation', {
    readValue: readAutoLocationPatch,
    flags: { refreshWeather: true }
  }),
  createConfigPatchSpec('manualLocation', {
    readValue: readManualLocationPatch,
    hasChanged: (nextState, manualLocation) => !shallowEqualObjects(
      manualLocation,
      nextState.config.manualLocation || {}
    ),
    applyValue: (nextState, manualLocation) => {
      nextState.config.manualLocation = { ...manualLocation };
    },
    flags: { refreshWeather: true }
  })
];

function reduceStatePatchCommand(state, patch, env) {
  const context = PATCH_STATE_SPECS.reduce((current, spec) => applyPatchSpec(current, spec), {
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

function buildCategoryJobPayload(command) {
  return {
    categories: Array.isArray(command.payload?.categories) ? [...command.payload.categories] : []
  };
}

function buildEnvSecretEffectPayload(command) {
  const envKey = String(command.payload?.envKey || '').trim();
  const runtimeFlag = String(command.payload?.runtimeFlag || '').trim();
  const value = String(command.payload?.value || '');

  return envKey && runtimeFlag
    ? {
        entries: { [envKey]: value },
        runtimeFlags: { [runtimeFlag]: Boolean(value) }
      }
    : null;
}

const readSelectedCategoriesPayload = (command, state) => ({
  categories: normalizeCategorySelection(
    command.payload?.categories,
    Object.keys(state.library.collections),
    state.playback.selectedCategories[0] || Object.keys(state.library.collections)[0] || 'Scenic Nature'
  )
});

const readExcludedKeywordsPayload = (command) => ({
  keywords: normalizeKeywordEntries(command.payload?.keywords)
    .filter((keyword) => typeof keyword === 'string')
});

const readAddPoolPayload = (command) => {
  const name = normalizePoolName(command.payload?.name);
  const keywords = normalizeKeywordEntries(command.payload?.keywords)
    .filter((keyword) => typeof keyword === 'string');

  return name && keywords.length > 0 ? { name, keywords } : null;
};

const readDeletePoolPayload = (command) => {
  const name = normalizePoolName(command.payload?.name);
  return name ? { name } : null;
};

const readPoolKeywordsPayload = (command) => {
  const name = normalizePoolName(command.payload?.name);
  const keywords = normalizeKeywordEntries(command.payload?.keywords);

  return name && keywords.length > 0 ? { name, keywords } : null;
};

const readPoolFeedConfigPayload = (command) => {
  const name = normalizePoolName(command.payload?.name);
  const source = normalizePoolName(command.payload?.source);
  const config = command.payload?.config;

  return name && source && isPlainObject(config)
    ? { name, source, config }
    : null;
};

const readActivePhotoSelectionPayload = (command) => {
  const url = String(command.payload?.url || '');
  const photo = command.payload?.photo && typeof command.payload.photo === 'object'
    ? /** @type {Photo} */ ({ ...command.payload.photo })
    : null;

  return url ? { url, photo } : null;
};

const readAdvancePlaybackPayload = (command) => ({
  direction: /** @type {'next' | 'prev'} */ (command.payload?.direction || 'next'),
  strategy: command.payload?.strategy === 'sequence' ? 'sequence' : 'smart'
});

const selectConfig = (nextState) => nextState.config;
const selectRuntime = (nextState) => nextState.runtime;

const reduceSimpleCommand = {
  'set-split-portrait': buildFieldCommandReducer(
    selectConfig,
    'splitPortrait',
    (command) => Boolean(command.payload?.enabled),
    { persist: true }
  ),
  'set-split-crop': buildFieldCommandReducer(
    selectConfig,
    'splitCropPercent',
    (command) => Number(command.payload?.percent),
    { persist: true }
  ),
  'set-scale-mode': buildFieldCommandReducer(
    selectConfig,
    'scaleMode',
    (command) => /** @type {'cover' | 'contain'} */ (command.payload?.mode),
    { persist: true }
  ),
  'change-theme': buildFieldCommandReducer(
    selectConfig,
    'theme',
    (command, nextState) => String(command.payload?.theme || nextState.config.theme)
  ),
  'change-interval': buildFieldCommandReducer(
    selectConfig,
    'slideshowInterval',
    (command) => Number(command.payload?.intervalMs)
  ),
  'set-screensaver-active': buildEntriesCommandReducer(
    selectRuntime,
    (currentCommand) => {
      const active = Boolean(currentCommand.payload?.active);

      return [
        ['screensaverActive', active],
        ['manualOverride', active],
        ['browserRunning', active]
      ];
    },
    {
      effects: (_nextState, currentCommand) => [{
        type: currentCommand.payload?.active ? 'launch-kiosk' : 'kill-kiosk'
      }]
    }
  ),
  'save-env-secret': buildEffectResultReducer({
    effectType: 'persist-env-vars',
    result: stateSyncResult,
    buildPayload: buildEnvSecretEffectPayload
  }),
  'trigger-recrawl': buildEffectResultReducer({
    effectType: 'start-recrawl-job',
    buildPayload: buildCategoryJobPayload
  }),
  'trigger-vision-analysis': buildEffectResultReducer({
    effectType: 'start-vision-analysis-job',
    buildPayload: buildCategoryJobPayload
  })
};

const reduceFeedCommand = {
  'select-categories': buildFeedCommandReducer({
    readPayload: readSelectedCategoriesPayload,
    apply: (nextState, { categories }) => {
      nextState.playback.selectedCategories = [...categories];
      return true;
    },
    forceReselect: true,
    eventsFor: emitPhotoUpdate()
  }),
  'update-excluded-keywords': buildFeedCommandReducer({
    readPayload: readExcludedKeywordsPayload,
    apply: (nextState, { keywords }) => assignExcludedKeywords(nextState, keywords),
    persist: true
  }),
  'delete-pool': buildFeedCommandReducer({
    readPayload: readDeletePoolPayload,
    apply: (nextState, { name }) => removePoolState(nextState, name),
    forceReselect: true,
    eventsFor: emitPhotoUpdate(),
    persist: true
  })
};

const reducePoolCommand = {
  'add-pool': buildPoolCommandReducer({
    readPayload: readAddPoolPayload,
    requireExistingPool: false,
    persist: true,
    effects: ({ name }) => [{
      type: 'run-crawler',
      payload: { categories: [name] }
    }],
    apply: (nextState, { name, keywords }) => addPoolState(nextState, name, keywords)
  }),
  'set-pool-keywords': buildPoolCommandReducer({
    readPayload: readPoolKeywordsPayload,
    persist: true,
    apply: (nextState, { name, keywords }) => assignPoolKeywords(nextState, name, keywords)
  }),
  'merge-pool-feed-config': buildPoolCommandReducer({
    readPayload: readPoolFeedConfigPayload,
    persist: true,
    apply: (nextState, { name, source, config }) => mergePoolSourceConfig(nextState, name, source, config)
  })
};

const reducePlaybackCommand = {
  'set-active-photo': buildPlaybackCommandReducer({
    readPayload: readActivePhotoSelectionPayload,
    selectPhoto: (state, { url, photo }) => findSelectablePhoto(state, url, photo),
    resolveDirection: (_payload, _command, state) => state.playback.lastDirection,
    prepareState: (nextState, { url, photo }, selectedPhoto) => {
      if (findPhotoInFeed(nextState.library.photosList, url)) {
        return nextState;
      }

      nextState.library.photosList = prependVisiblePhoto(
        nextState.library.photosList,
        photo || selectedPhoto
      );

      return nextState;
    }
  }),
  'advance-photo': buildPlaybackCommandReducer({
    readPayload: readAdvancePlaybackPayload,
    selectPhoto: (state, { direction, strategy }, { now, rng }) => (
      strategy === 'sequence'
        ? selectSequentialPhoto({ state, direction })
        : selectSmartPhoto({ state, direction, now, rng })
    ),
    resolveDirection: ({ direction }) => direction
  })
};

function reduceDomainCommand(state, command, env = {}) {
  const now = env.now || new Date();
  const rng = env.rng || Math.random;
  const reduceSharedCommand = reduceSimpleCommand[command.type];
  const reduceSharedPhotoCommand = reducePhotoCommand[command.type];
  const reduceSharedFeedCommand = reduceFeedCommand[command.type];
  const reduceSharedPoolCommand = reducePoolCommand[command.type];
  const reduceSharedPlaybackCommand = reducePlaybackCommand[command.type];

  if (reduceSharedCommand) {
    return reduceSharedCommand(state, command);
  }

  if (reduceSharedPhotoCommand) {
    return reduceSharedPhotoCommand(state, command, { now, rng });
  }

  if (reduceSharedFeedCommand) {
    return reduceSharedFeedCommand(state, command, { now, rng });
  }

  if (reduceSharedPoolCommand) {
    return reduceSharedPoolCommand(state, command);
  }

  if (reduceSharedPlaybackCommand) {
    return reduceSharedPlaybackCommand(state, command, { now, rng });
  }

  switch (command.type) {
    case 'patch-state': {
      const patch = command.payload && typeof command.payload === 'object' ? command.payload : {};
      return reduceStatePatchCommand(state, patch, { now, rng });
    }

    default:
      return unchangedResult(state);
  }
}

module.exports = {
  reduceDomainCommand
};
