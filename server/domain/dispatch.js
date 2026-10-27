// @ts-check

const { saveCuratedCollections } = require('../config/collections.js');
const { persistEnvVars } = require('../config/env.js');
const { reduceDomainCommand } = require('./reducer.js');
const { applyDomainState, buildDomainState, syncLegacySnapshot } = require('./snapshot.js');
const { reduceAsyncSequentially } = require('../utils/asyncReduce.js');
const { createClosedInterpreter } = require('../utils/fn.js');

/** @typedef {import('./types').Command} Command */
/** @typedef {import('./types').Effect} Effect */
/** @typedef {import('./types').Event} Event */
/** @typedef {import('./types').ReducerResult} ReducerResult */
/** @typedef {import('./types').ReducerEnvironment} ReducerEnvironment */
/** @typedef {import('./snapshot').Snapshot} Snapshot */
/** @typedef {import('./snapshot').LegacyState} LegacyState */
/** @typedef {import('./snapshot').RuntimeOverrides} RuntimeOverrides */
/** @typedef {import('./types').CollectionsState} CollectionsState */
/** @typedef {import('./types').ExternalPhotoMetadataPayload} ExternalPhotoMetadataPayload */
/** @typedef {import('./types').CategoryEffectPayload} CategoryEffectPayload */

/**
 * Adapters may complete synchronously or return an awaited value/thenable.
 * Results remain opaque aliases; an unavailable adapter resolves undefined.
 * Payloads are forwarded by identity, not copied before adapter execution.
 *
 * @template P
 * @typedef {(payload: P) => unknown} PayloadAdapter
 */

/**
 * Mutable shell dependencies. State/collections and io.emit are required.
 * Runtime context is read afresh for reduction/refresh (not awaited); only an
 * omitted/undefined reader receives the default. Optional non-functions are
 * ignored by effect handlers. No adapter validation or rollback is performed.
 * Manual override runs synchronously before launch/kill; its result is ignored,
 * not awaited. Weather completion is discarded and ordinary Error failures are
 * warned/swallowed; nullish failures or warning failures can still reject.
 * runCrawler is suppressed only when NODE_ENV is exactly 'test'. Persistence is
 * module-owned, not an injected dependency; it precedes runtime-flag assignment.
 *
 * @typedef {object} DispatcherDependencies
 * @property {LegacyState} state
 * @property {CollectionsState} collections
 * @property {{emit: (event: 'photo-update' | 'state-sync', payload: import('./types').Photo | LegacyState) => unknown}} io
 * @property {(() => RuntimeOverrides)} [getRuntimeContext]
 * @property {(() => unknown)} [launchKioskBrowser]
 * @property {(() => unknown)} [killKioskBrowser]
 * @property {((active: boolean) => unknown)} [setManualOverride]
 * @property {PayloadAdapter<ExternalPhotoMetadataPayload>} [persistExternalPhotoMetadata]
 * @property {PayloadAdapter<CategoryEffectPayload>} [refreshActiveFeed]
 * @property {PayloadAdapter<CategoryEffectPayload>} [runCrawler]
 * @property {PayloadAdapter<CategoryEffectPayload>} [startRecrawlJob]
 * @property {PayloadAdapter<CategoryEffectPayload>} [startVisionAnalysisJob]
 * @property {(() => unknown)} [triggerWeatherUpdate]
 */

/**
 * Public methods retain shell effects: refresh mutates legacy state and returns
 * its snapshot; broadcast refreshes before emitting and returns undefined.
 * Event emission is synchronous; returned emitter promises are not awaited.
 *
 * @typedef {{
 *   refreshSnapshot: () => Snapshot,
 *   broadcastStateSync: () => void,
 *   dispatchCommand: (command: Command | null | undefined, env?: ReducerEnvironment) => Promise<DispatchResult | null>
 * }} DomainDispatcher
 */

/**
 * Completed sequential handler result. Effect identity is retained and value is
 * the awaited, unvalidated adapter result (including undefined for no handler).
 *
 * @typedef {{ effect: Effect, value: unknown }} EffectResult
 */

/**
 * Snapshot captured before effects; callbacks and state-sync may subsequently
 * change the live shell. Results stay aligned with reducer effects, not cloned.
 *
 * @typedef {{ reducerResult: ReducerResult, snapshot: Snapshot, effectResults: EffectResult[] }} DispatchResult
 */

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

const normalizeRuntimeFlags = (runtimeFlags) => Object.fromEntries(
  Object.entries(normalizeRecord(runtimeFlags)).map(([flag, enabled]) => [flag, Boolean(enabled)])
);

const applyRuntimeFlags = (state, runtimeFlags) => Object.assign(
  state,
  normalizeRuntimeFlags(runtimeFlags)
);

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

/**
 * Resolve only the declared handler vocabulary for a typed domain item.
 *
 * The returned interpreter is data-last at the item boundary: callers keep
 * their own sequencing/result algebra while sharing closed type dispatch.
 *
 * @param {Record<string, (item: any) => any>} handlers
 * @returns {(item: { type?: string } | null | undefined) => any}
 */
const createTypedHandlerInvoker = (handlers) => {
  const resolveHandler = createClosedInterpreter(handlers);

  return (item) => callIfFunction(resolveHandler(item?.type), item);
};

const createEffectInterpreter = (effectHandlers) => {
  const invokeHandler = createTypedHandlerInvoker(effectHandlers);
  const interpret = async (effectResults, effect) => [
    ...effectResults,
    {
      effect,
      value: await invokeHandler(effect)
    }
  ];

  return reduceAsyncSequentially(interpret, []);
};

const createEventEmitter = (eventHandlers) => {
  const invokeHandler = createTypedHandlerInvoker(eventHandlers);

  return (events = []) => {
    events.forEach((event) => {
      invokeHandler(event);
    });
  };
};

function createEffectHandlers({
  state,
  collections,
  launchKioskBrowser,
  killKioskBrowser,
  setManualOverride,
  persistExternalPhotoMetadata,
  refreshActiveFeed,
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
    'refresh-active-feed': callOptionalPayloadHandler(refreshActiveFeed),
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

/**
 * Capture adapters once; keep state/context reads and ordered effects in the shell.
 * @param {DispatcherDependencies} dependencies
 * @returns {DomainDispatcher}
 */
function createDomainDispatcher({
  state,
  collections,
  io,
  getRuntimeContext = () => ({}),
  launchKioskBrowser,
  killKioskBrowser,
  setManualOverride,
  persistExternalPhotoMetadata,
  refreshActiveFeed,
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

  /**
   * @param {Command} command
   * @param {ReducerEnvironment} [env={}]
   * @returns {ReducerResult}
   */
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
    refreshActiveFeed,
    runCrawler,
    startRecrawlJob,
    startVisionAnalysisJob,
    triggerWeatherUpdate
  });
  const eventHandlers = createEventHandlers({ state, io, broadcastStateSync });
  const interpretEffects = createEffectInterpreter(effectHandlers);
  const emitEvents = createEventEmitter(eventHandlers);

  /**
   * Reduce -> apply snapshot -> await effects in order -> emit events.
   * A missing command resolves null before reading runtime/environment inputs.
   * Rejections propagate; applied state and completed effects are not rolled back,
   * and pending events are not emitted after an effect failure.
   *
   * @param {Command | null | undefined} command
   * @param {ReducerEnvironment} [env={}]
   * @returns {Promise<DispatchResult | null>}
   * @throws {unknown} Reduction, snapshot, effect, or event failures reject the promise.
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
  createDomainDispatcher,
  createEffectInterpreter,
  createEventEmitter,
  createTypedHandlerInvoker,
  normalizeRuntimeFlags
};
