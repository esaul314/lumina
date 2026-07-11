// @ts-check

const { saveCuratedCollections } = require('../config/collections.js');
const { persistEnvVars } = require('../config/env.js');
const { reduceDomainCommand } = require('./reducer.js');
const { applyDomainState, buildDomainState, syncLegacySnapshot } = require('./snapshot.js');

/** @typedef {import('./types').Command} Command */
/** @typedef {import('./types').Effect} Effect */
/** @typedef {import('./types').Event} Event */
/** @typedef {import('./types').ReducerResult} ReducerResult */

const callIfFunction = (handler, ...args) => (
  typeof handler === 'function'
    ? handler(...args)
    : undefined
);

const callOptionalPayloadHandler = (handler) => (effect) => (
  callIfFunction(handler, effect.payload || {})
);

const skipInTest = (handler) => (effect) => (
  process.env.NODE_ENV !== 'test'
    ? handler(effect)
    : undefined
);

const normalizeRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
);

const applyRuntimeFlags = (state, runtimeFlags) => {
  Object.entries(runtimeFlags).forEach(([flag, enabled]) => {
    state[flag] = Boolean(enabled);
  });
};

const normalizeEnvVarEffectPayload = (effect) => ({
  entries: normalizeRecord(effect.payload?.entries),
  runtimeFlags: normalizeRecord(effect.payload?.runtimeFlags)
});

const createManualOverrideEffect = (setManualOverride, value, handler) => async () => {
  callIfFunction(setManualOverride, value);
  return callIfFunction(handler);
};

const createWeatherRefreshEffect = (triggerWeatherUpdate) => async () => {
  if (typeof triggerWeatherUpdate !== 'function') {
    return undefined;
  }

  try {
    await triggerWeatherUpdate();
  } catch (error) {
    console.warn('[Domain Dispatch] Weather refresh failed after state update:', error.message);
  }

  return undefined;
};

const createEffectInterpreter = (effectHandlers) => async (effects = []) => {
  const effectResults = [];

  for (const effect of effects) {
    effectResults.push({
      effect,
      value: await effectHandlers[effect.type]?.(effect)
    });
  }

  return effectResults;
};

const createEventEmitter = (eventHandlers) => (events = []) => {
  events.forEach((event) => {
    eventHandlers[event.type]?.(event);
  });
};

function createEffectHandlers({
  state,
  collections,
  launchKioskBrowser,
  killKioskBrowser,
  setManualOverride,
  persistExternalPhotoMetadata,
  runCrawler,
  startRecrawlJob,
  startVisionAnalysisJob,
  triggerWeatherUpdate
}) {
  return {
    persist: async () => {
      saveCuratedCollections(collections, state);
    },
    'persist-external-photo-metadata': callOptionalPayloadHandler(persistExternalPhotoMetadata),
    'launch-kiosk': createManualOverrideEffect(setManualOverride, true, launchKioskBrowser),
    'kill-kiosk': createManualOverrideEffect(setManualOverride, false, killKioskBrowser),
    'run-crawler': skipInTest(callOptionalPayloadHandler(runCrawler)),
    'persist-env-vars': async (effect) => {
      const { entries, runtimeFlags } = normalizeEnvVarEffectPayload(effect);

      persistEnvVars(entries);
      applyRuntimeFlags(state, runtimeFlags);

      return {
        entries: { ...entries },
        runtimeFlags: { ...runtimeFlags }
      };
    },
    'start-recrawl-job': callOptionalPayloadHandler(startRecrawlJob),
    'start-vision-analysis-job': callOptionalPayloadHandler(startVisionAnalysisJob),
    'refresh-weather': createWeatherRefreshEffect(triggerWeatherUpdate)
  };
}

function createEventHandlers({ state, io, broadcastStateSync }) {
  return {
    'photo-update': () => {
      if (state.activePhoto) {
        io.emit('photo-update', state.activePhoto);
      }
    },
    'state-sync': () => {
      broadcastStateSync();
    }
  };
}

function createDomainDispatcher({
  state,
  collections,
  io,
  getRuntimeContext = () => ({}),
  launchKioskBrowser,
  killKioskBrowser,
  setManualOverride,
  persistExternalPhotoMetadata,
  runCrawler,
  startRecrawlJob,
  startVisionAnalysisJob,
  triggerWeatherUpdate
}) {
  function refreshSnapshot() {
    return syncLegacySnapshot(state, collections, getRuntimeContext());
  }

  function broadcastStateSync() {
    refreshSnapshot();
    io.emit('state-sync', state);
  }

  const reduceCommand = (command, env = {}) => reduceDomainCommand(
    buildDomainState(state, collections, getRuntimeContext()),
    command,
    env
  );

  const applyReducerResult = (reducerResult) => applyDomainState(
    state,
    collections,
    reducerResult.nextState
  );

  const effectHandlers = createEffectHandlers({
    state,
    collections,
    launchKioskBrowser,
    killKioskBrowser,
    setManualOverride,
    persistExternalPhotoMetadata,
    runCrawler,
    startRecrawlJob,
    startVisionAnalysisJob,
    triggerWeatherUpdate
  });
  const eventHandlers = createEventHandlers({ state, io, broadcastStateSync });
  const interpretEffects = createEffectInterpreter(effectHandlers);
  const emitEvents = createEventEmitter(eventHandlers);

  /**
   * @param {Command | null | undefined} command
   * @param {Record<string, unknown>} [env]
   */
  async function dispatchCommand(command, env = {}) {
    if (!command) {
      return null;
    }

    /** @type {ReducerResult} */
    const reducerResult = reduceCommand(command, env);
    const snapshot = applyReducerResult(reducerResult);
    const effectResults = await interpretEffects(reducerResult.effects);

    emitEvents(reducerResult.events);

    return { reducerResult, snapshot, effectResults };
  }

  return {
    broadcastStateSync,
    dispatchCommand,
    refreshSnapshot
  };
}

module.exports = {
  createDomainDispatcher
};
