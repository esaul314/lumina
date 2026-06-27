// @ts-check

const { saveCuratedCollections } = require('../config/collections.js');
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
  runCrawler
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

    if (effect.type === 'run-crawler' && typeof runCrawler === 'function') {
      await runCrawler(effect.payload || {});
    }
  }

  async function dispatchCommand(command, env = {}) {
    if (!command) {
      return null;
    }

    const currentState = buildDomainState(state, collections, getRuntimeContext());
    const reducerResult = reduceDomainCommand(currentState, command, env);
    const snapshot = applyDomainState(state, collections, reducerResult.nextState);

    for (const effect of reducerResult.effects) {
      await interpretEffect(effect);
    }

    reducerResult.events.forEach((event) => {
      if (event.type === 'photo-update' && state.activePhoto) {
        io.emit('photo-update', state.activePhoto);
      }

      if (event.type === 'state-sync') {
        broadcastStateSync();
      }
    });

    return { reducerResult, snapshot };
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
