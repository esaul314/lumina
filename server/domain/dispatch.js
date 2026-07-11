// @ts-check

const { saveCuratedCollections } = require('../config/collections.js');
const { persistEnvVars } = require('../config/env.js');
const { reduceDomainCommand } = require('./reducer.js');
const { applyDomainState, buildDomainState, syncLegacySnapshot } = require('./snapshot.js');

const callOptionalPayloadHandler = (handler) => (effect) => (
  typeof handler === 'function'
    ? handler(effect.payload || {})
    : undefined
);

const skipInTest = (handler) => (effect) => (
  process.env.NODE_ENV !== 'test'
    ? handler(effect)
    : undefined
);

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
    'launch-kiosk': async () => {
      if (typeof setManualOverride === 'function') {
        setManualOverride(true);
      }
      if (typeof launchKioskBrowser === 'function') {
        launchKioskBrowser();
      }
    },
    'kill-kiosk': async () => {
      if (typeof setManualOverride === 'function') {
        setManualOverride(false);
      }
      if (typeof killKioskBrowser === 'function') {
        killKioskBrowser();
      }
    },
    'run-crawler': skipInTest(callOptionalPayloadHandler(runCrawler)),
    'persist-env-vars': async (effect) => {
      const entries = effect.payload?.entries && typeof effect.payload.entries === 'object'
        ? effect.payload.entries
        : {};
      const runtimeFlags = effect.payload?.runtimeFlags && typeof effect.payload.runtimeFlags === 'object'
        ? effect.payload.runtimeFlags
        : {};

      persistEnvVars(entries);
      Object.entries(runtimeFlags).forEach(([flag, enabled]) => {
        state[flag] = Boolean(enabled);
      });

      return {
        entries: { ...entries },
        runtimeFlags: { ...runtimeFlags }
      };
    },
    'start-recrawl-job': callOptionalPayloadHandler(startRecrawlJob),
    'start-vision-analysis-job': callOptionalPayloadHandler(startVisionAnalysisJob),
    'refresh-weather': async () => {
      if (typeof triggerWeatherUpdate !== 'function') {
        return undefined;
      }

      try {
        await triggerWeatherUpdate();
      } catch (error) {
        console.warn('[Domain Dispatch] Weather refresh failed after state update:', error.message);
      }
      return undefined;
    }
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

  async function interpretEffect(effect) {
    const handler = effectHandlers[effect.type];
    return handler ? handler(effect) : undefined;
  }

  function emitReducerEvent(event) {
    const handler = eventHandlers[event.type];
    if (handler) {
      handler(event);
    }
  }

  async function dispatchCommand(command, env = {}) {
    if (!command) {
      return null;
    }

    const currentState = buildDomainState(state, collections, getRuntimeContext());
    const reducerResult = reduceDomainCommand(currentState, command, env);
    const snapshot = applyDomainState(state, collections, reducerResult.nextState);
    const effectResults = [];

    for (const effect of reducerResult.effects) {
      effectResults.push({
        effect,
        value: await interpretEffect(effect)
      });
    }

    reducerResult.events.forEach(emitReducerEvent);

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
