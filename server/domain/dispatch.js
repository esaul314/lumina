// @ts-check

const { saveCuratedCollections } = require('../config/collections.js');
const { persistEnvVars } = require('../config/env.js');
const { reduceDomainCommand } = require('./reducer.js');
const { applyDomainState, buildDomainState, syncLegacySnapshot } = require('./snapshot.js');

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

  async function interpretEffect(effect) {
    if (effect.type === 'persist') {
      saveCuratedCollections(collections, state);
      return;
    }

    if (effect.type === 'persist-external-photo-metadata' && typeof persistExternalPhotoMetadata === 'function') {
      return persistExternalPhotoMetadata(effect.payload || {});
    }

    if (effect.type === 'launch-kiosk') {
      if (typeof setManualOverride === 'function') {
        setManualOverride(true);
      }
      if (typeof launchKioskBrowser === 'function') {
        launchKioskBrowser();
      }
      return;
    }

    if (effect.type === 'kill-kiosk') {
      if (typeof setManualOverride === 'function') {
        setManualOverride(false);
      }
      if (typeof killKioskBrowser === 'function') {
        killKioskBrowser();
      }
      return;
    }

    if (effect.type === 'run-crawler' && typeof runCrawler === 'function' && process.env.NODE_ENV !== 'test') {
      await runCrawler(effect.payload || {});
      return;
    }

    if (effect.type === 'persist-env-vars') {
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
    }

    if (effect.type === 'start-recrawl-job' && typeof startRecrawlJob === 'function') {
      return startRecrawlJob(effect.payload || {});
    }

    if (effect.type === 'start-vision-analysis-job' && typeof startVisionAnalysisJob === 'function') {
      return startVisionAnalysisJob(effect.payload || {});
    }

    if (effect.type === 'refresh-weather' && typeof triggerWeatherUpdate === 'function') {
      try {
        await triggerWeatherUpdate();
      } catch (error) {
        console.warn('[Domain Dispatch] Weather refresh failed after state update:', error.message);
      }
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

    reducerResult.events.forEach((event) => {
      if (event.type === 'photo-update' && state.activePhoto) {
        io.emit('photo-update', state.activePhoto);
      }

      if (event.type === 'state-sync') {
        broadcastStateSync();
      }
    });

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
