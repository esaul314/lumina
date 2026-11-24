// @ts-check

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runInNewContext } = require('vm');
const {
  SOCKET_ASYNC_JOB_COMMAND_SPECS,
  SOCKET_COMMAND_LISTENER_SPECS,
  SOCKET_DURABLE_COMMAND_SPECS,
  SOCKET_SECRET_COMMAND_SPECS,
  SOCKET_STATE_PATCH_SPECS,
  REST_ADMIN_SECRET_ROUTE_SPECS,
  REST_ASYNC_JOB_ROUTE_SPECS,
  REST_ADVANCE_PHOTO_ROUTE_SPECS,
  decodeActivePhotoCommand,
  decodeAdvancePhotoCommand,
  decodeAddPoolCommand,
  decodeCategorySelectionFromHttp,
  decodeCategorySelectionFromSocket,
  decodeDeletePoolCommand,
  decodePoolFeedConfigCommand,
  decodePoolKeywordsCommand,
  decodePoolPolicyCommand,
  decodePoolScopedRecrawlCommand,
  decodeBrokenPhotoCommand,
  decodePhotoCropCommand,
  decodePhotoLovedCommand,
  decodePhotoMetadataCommand,
  decodePhotoRatingCommand,
  decodePhotoPreventPairingCommand,
  decodeRecrawlCommand,
  decodeScreensaverActiveCommand,
  decodeStatePatchCommand,
  decodeTumblrApiKeyCommand,
  decodeUseApiTokenCommand,
  decodeVisionAnalysisCommand,
  PHOTO_PATCH_COMMAND_ROUTE_SPECS,
  createPoolPatchCommandRouteSpecs
} = require('./commands.js');
const {
  buildBalancedFeed,
  deriveCurrentFrame,
  filterPhotosForNight,
  filterPhotosForTime,
  filterPhotosForWeather,
  normalizeCategorySelection,
  selectSmartPhoto,
  selectWeightedRandomPhoto
} = require('./selectors.js');
const selectors = require('./selectors.js');
const commands = require('./commands.js');
const { reduceDomainCommand } = require('./reducer.js');
const {
  buildPersistedSnapshot,
  loadCollectionsSnapshot,
  normalizePersistedSnapshot
} = require('../config/collectionsCodec.js');
const {
  updatePhotoByUrl,
  updatePhotosList
} = require('../config/collectionPhotoProjections.js');
const { createClosedInterpreter, createIndexedInterpreter } = require('../utils/fn.js');
const {
  normalizePhotoAddedAt,
  normalizePhotoTimestamp,
  stampNewPhotos
} = require('./photoTimestamps.js');
const {
  normalizePoolPolicy,
  pruneExpiredPhotos,
  applyPoolPolicy
} = require('./poolRetention.js');
const {
  appendUniqueCategory,
  formatLocalTime,
  isPoolScheduleActive,
  resolveScheduledPool,
  scheduleIdentity
} = require('./poolSchedule.js');
const {
  applyDomainState,
  buildDomainState,
  buildSnapshot
} = require('./snapshot.js');
const { createEventEmitter, createTypedHandlerInvoker } = require('./dispatch.js');

const findSocketStatePatchDecode = (event) => SOCKET_STATE_PATCH_SPECS.find((spec) => spec.event === event)?.decode ?? null;
const findSocketCommandSpec = (event) => SOCKET_DURABLE_COMMAND_SPECS.find((spec) => spec.event === event) ?? null;
const findSocketAsyncJobSpec = (event) => SOCKET_ASYNC_JOB_COMMAND_SPECS.find((spec) => spec.event === event) ?? null;
const findSocketListenerSpec = (event) => SOCKET_COMMAND_LISTENER_SPECS.find((spec) => spec.event === event) ?? null;
const findSocketSecretSpec = (event) => SOCKET_SECRET_COMMAND_SPECS.find((spec) => spec.event === event) ?? null;
const findRestAdminSecretRouteSpec = (path) => REST_ADMIN_SECRET_ROUTE_SPECS.find((spec) => spec.path === path) ?? null;
const findRestAsyncJobRouteSpec = (path) => REST_ASYNC_JOB_ROUTE_SPECS.find((spec) => spec.path === path) ?? null;
const findRestAdvanceRouteSpec = (path) => REST_ADVANCE_PHOTO_ROUTE_SPECS.find((spec) => spec.path === path) ?? null;
const findPhotoPatchRouteSpec = (key) => PHOTO_PATCH_COMMAND_ROUTE_SPECS.find((spec) => spec.key === key) ?? null;
const findPoolPatchRouteSpec = (specs, key) => specs.find((spec) => spec.key === key) ?? null;

function createState(overrides = {}) {
  const baseState = {
    config: {
      theme: 'Zen Retreat',
      scaleMode: 'cover',
      splitPortrait: true,
      splitCropPercent: 50,
      widgets: { clock: true, qrcode: true },
      inactivityTimeout: 600000,
      slideshowInterval: 120000,
      alignTimeOfDay: false,
      alignWeather: false,
      allowOpenAiFallback: false,
      nightPercentage: 50,
      searchKeywords: {
        'Scenic Nature': ['forest'],
        'Liminal Spaces': ['hallway']
      },
      feedConfigs: {},
      poolPolicies: {},
      excludedKeywords: [],
      autoLocation: false,
      manualLocation: {}
    },
    runtime: {
      screensaverActive: false,
      hasUseApiToken: false,
      hasTumblrApiKey: false,
      browserRunning: false,
      manualOverride: false,
      newsSentiment: { weatherMatch: 'Cloudy' },
      physicalWeather: { weatherMatch: 'Cloudy' },
      weather: null
    },
    library: {
      collections: {
        'Scenic Nature': [
          { url: 'land-1', title: 'Sunny Forest', rating: 10, orientation: 'landscape', isSunny: true, category: 'Scenic Nature' },
          { url: 'land-2', title: 'Foggy River', rating: 8, orientation: 'landscape', isCloudy: true, category: 'Scenic Nature' }
        ],
        'Liminal Spaces': [
          { url: 'port-1', title: 'Midnight Hallway', rating: 10, orientation: 'portrait', isNight: true, category: 'Liminal Spaces' },
          { url: 'port-2', title: 'Silent Corridor', rating: 9, orientation: 'portrait', isCloudy: true, category: 'Liminal Spaces' }
        ]
      },
      externalCollections: {},
      photosList: [
        { url: 'port-1', title: 'Midnight Hallway', rating: 10, orientation: 'portrait', isNight: true, category: 'Liminal Spaces' },
        { url: 'port-2', title: 'Silent Corridor', rating: 9, orientation: 'portrait', isCloudy: true, category: 'Liminal Spaces' }
      ]
    },
    playback: {
      selectedCategories: ['Liminal Spaces'],
      activePhotoUrl: 'port-1',
      splitSeed: 1,
      lastDirection: 'next',
      poolSequenceCursors: {}
    }
  };

  return {
    ...baseState,
    ...overrides,
    config: {
      ...baseState.config,
      ...(overrides.config || {})
    },
    runtime: {
      ...baseState.runtime,
      ...(overrides.runtime || {})
    },
    library: {
      ...baseState.library,
      ...(overrides.library || {})
    },
    playback: {
      ...baseState.playback,
      ...(overrides.playback || {})
    }
  };
}

function runDomainTests({ logSuite, assertTest }) {
  logSuite('Functional Core Domain');

  assertTest('session pool policy contract closes nested records before its generic map', () => {
    const source = fs.readFileSync(require.resolve('./types.js'), 'utf8');
    const property = source.split('\n').find((line) => line.endsWith(' poolPolicies'));
    // Delimiter regression only: this is not JSDoc parsing or TypeScript checking.
    assert.match(property, /priority\?: number \} \}>=\} poolPolicies$/);
    assert.strictEqual([...property].filter((value) => value === '{').length,
      [...property].filter((value) => value === '}').length);
  });

  assertTest('scalar patch compatibility can exceed the declared state shape through public snapshots', () => {
    const state = createState();
    const before = JSON.stringify(state);
    const env = { now: new Date(0), rng: () => 0 };
    [
      ['theme', 9], ['inactivityTimeout', 'later'], ['slideshowInterval', 'later'],
      ['scaleMode', 'stretch'], ['splitPortrait', 'false'], ['splitCropPercent', 'bad'],
      ['alignTimeOfDay', 'false'], ['alignWeather', 'false'],
      ['nightPercentage', 'bad'], ['allowOpenAiFallback', 'false']
    ].forEach(([field, value]) => {
      const input = Object.freeze({ [field]: value });
      const command = decodeStatePatchCommand(input);
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(result.nextState.config[field], value, field);
      assert.strictEqual(snapshot.config[field], value, field);
      assert.strictEqual(snapshot[field], value, field);
      assert.deepStrictEqual(reduceDomainCommand(state, command, env), result);
      assert.strictEqual(JSON.stringify(state), before);
      assert.strictEqual(input[field], value);
    });
  });

  assertTest('theme compatibility preserves raw values and aliases across state and snapshots', () => {
    const state = createState();
    const nested = Object.freeze({ marker: 'shared' });
    const value = Object.freeze({ nested });
    const env = { now: new Date(0), rng: () => 0 };
    [value, null, 0, false, ''].forEach((theme) => {
      const command = decodeStatePatchCommand(Object.freeze({ theme }));
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(command.payload.theme, theme);
      assert.strictEqual(result.nextState.config.theme, theme);
      assert.strictEqual(snapshot.theme, theme);
      assert.strictEqual(snapshot.config.theme, theme);
      const legacy = { ...state.config, ...state.runtime, theme, currentCategory: 'Scenic Nature', photosList: [] };
      const rebuilt = buildDomainState(legacy, state.library.collections);
      assert.strictEqual(rebuilt.config.theme, theme);
      assert.strictEqual(buildSnapshot(rebuilt).theme, theme);
      assert.strictEqual(legacy.theme, theme);
    });
    const omitted = decodeStatePatchCommand({ theme: undefined });
    assert.deepStrictEqual(omitted.payload, {});
    assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
    const legacy = { ...state.config, ...state.runtime, theme: undefined, currentCategory: 'Scenic Nature', photosList: [] };
    assert.strictEqual(buildDomainState(legacy, state.library.collections).config.theme, undefined);
    assert.strictEqual(state.config.theme, 'Zen Retreat');
    assert.strictEqual(value.nested, nested);
  });

  assertTest('direct change-theme retains its separate truthy fallback and string coercion', () => {
    const theme = Object.freeze({ toString: () => 'legacy theme' });
    const state = createState({ config: { theme } });
    const env = { now: new Date(0), rng: () => 0 };
    const fallback = reduceDomainCommand(state, { type: 'change-theme' }, env);
    const explicit = reduceDomainCommand(state, { type: 'change-theme', payload: { theme: 'new theme' } }, env);
    assert.strictEqual(fallback.nextState.config.theme, 'legacy theme');
    assert.strictEqual(explicit.nextState.config.theme, 'new theme');
    assert.strictEqual(state.config.theme, theme);
    const failure = new Error('theme coercion');
    const throwing = createState({ config: { theme: { toString: () => { throw failure; } } } });
    assert.throws(() => reduceDomainCommand(throwing, { type: 'change-theme' }, env), (error) => error === failure);
  });

  assertTest('timing compatibility preserves raw values through patches and legacy snapshots', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ value: 'later' });
    ['inactivityTimeout', 'slideshowInterval'].forEach((field) => {
      [shared, null, 0, false, ''].forEach((value) => {
        const command = decodeStatePatchCommand(Object.freeze({ [field]: value }));
        const result = reduceDomainCommand(state, command, env);
        const snapshot = buildSnapshot(result.nextState);
        assert.strictEqual(command.payload[field], value);
        assert.strictEqual(result.nextState.config[field], value);
        assert.strictEqual(snapshot[field], value);
        assert.strictEqual(snapshot.config[field], value);
        const legacy = { ...state.config, ...state.runtime, [field]: value, currentCategory: 'Scenic Nature', photosList: [] };
        const rebuilt = buildDomainState(legacy, state.library.collections);
        assert.strictEqual(rebuilt.config[field], value);
        assert.strictEqual(buildSnapshot(rebuilt)[field], value);
        assert.strictEqual(legacy[field], value);
      });
      const omitted = decodeStatePatchCommand({ [field]: undefined });
      assert.deepStrictEqual(omitted.payload, {});
      assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
      const legacy = { ...state.config, ...state.runtime, [field]: undefined, currentCategory: 'Scenic Nature', photosList: [] };
      assert.strictEqual(buildDomainState(legacy, state.library.collections).config[field], undefined);
    });
    assert.strictEqual(state.config.inactivityTimeout, 600000);
    assert.strictEqual(state.config.slideshowInterval, 120000);
  });

  assertTest('direct change-interval retains numeric coercion and omitted-payload NaN', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const value = Object.freeze({ valueOf: () => 45000 });
    assert.strictEqual(reduceDomainCommand(state, { type: 'change-interval', payload: { intervalMs: value } }, env).nextState.config.slideshowInterval, 45000);
    assert.ok(Number.isNaN(reduceDomainCommand(state, { type: 'change-interval' }, env).nextState.config.slideshowInterval));
    const failure = new Error('interval coercion');
    const throwing = { valueOf: () => { throw failure; } };
    assert.throws(() => reduceDomainCommand(state, { type: 'change-interval', payload: { intervalMs: throwing } }, env), (error) => error === failure);
    assert.strictEqual(state.config.slideshowInterval, 120000);
  });

  assertTest('scale mode compatibility preserves raw values through patches and legacy snapshots', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ mode: 'custom' });
    [shared, null, 0, false, '', 'stretch'].forEach((scaleMode) => {
      const command = decodeStatePatchCommand(Object.freeze({ scaleMode }));
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(command.payload.scaleMode, scaleMode);
      assert.strictEqual(result.nextState.config.scaleMode, scaleMode);
      assert.strictEqual(snapshot.scaleMode, scaleMode);
      assert.strictEqual(snapshot.config.scaleMode, scaleMode);
      const legacy = { ...state.config, ...state.runtime, scaleMode, currentCategory: 'Scenic Nature', photosList: [] };
      const rebuilt = buildDomainState(legacy, state.library.collections);
      assert.strictEqual(rebuilt.config.scaleMode, scaleMode);
      assert.strictEqual(buildSnapshot(rebuilt).scaleMode, scaleMode);
      assert.strictEqual(legacy.scaleMode, scaleMode);
    });
    const omitted = decodeStatePatchCommand({ scaleMode: undefined });
    assert.deepStrictEqual(omitted.payload, {});
    assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
    const legacy = { ...state.config, ...state.runtime, scaleMode: undefined, currentCategory: 'Scenic Nature', photosList: [] };
    assert.strictEqual(buildDomainState(legacy, state.library.collections).config.scaleMode, undefined);
    assert.strictEqual(state.config.scaleMode, 'cover');
  });

  assertTest('direct scale command preserves values and skips omitted or undefined modes', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ mode: 'custom' });
    [shared, null, false, 'stretch'].forEach((mode) => {
      const result = reduceDomainCommand(state, { type: 'set-scale-mode', payload: { mode } }, env);
      assert.strictEqual(result.nextState.config.scaleMode, mode);
      assert.deepStrictEqual(result.effects.map(({ type }) => type), ['persist']);
    });
    [{ type: 'set-scale-mode' }, { type: 'set-scale-mode', payload: { mode: undefined } }].forEach((command) => {
      const result = reduceDomainCommand(state, command, env);
      assert.strictEqual(result.nextState, state);
      assert.deepStrictEqual(result.effects, []);
    });
    assert.strictEqual(state.config.scaleMode, 'cover');
  });

  assertTest('split crop compatibility preserves raw patches and nullish legacy and frame defaults', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ crop: 'custom' });
    [shared, null, 0, false, '', 'wide'].forEach((splitCropPercent) => {
      const input = Object.freeze({ splitCropPercent });
      const command = decodeStatePatchCommand(input);
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(command.payload.splitCropPercent, splitCropPercent);
      assert.strictEqual(snapshot.splitCropPercent, splitCropPercent);
      assert.strictEqual(snapshot.config.splitCropPercent, splitCropPercent);
      assert.strictEqual(snapshot.currentFrame.crop.secondaryPercent, splitCropPercent ?? selectors.DEFAULT_SPLIT_CROP);
      const legacy = { ...state.config, ...state.runtime, splitCropPercent, currentCategory: 'Scenic Nature', photosList: [] };
      const rebuilt = buildDomainState(legacy, state.library.collections);
      assert.strictEqual(rebuilt.config.splitCropPercent, splitCropPercent ?? 50);
      assert.strictEqual(input.splitCropPercent, splitCropPercent);
    });
    const omitted = decodeStatePatchCommand({ splitCropPercent: undefined });
    assert.deepStrictEqual(omitted.payload, {});
    assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
    const legacy = { ...state.config, ...state.runtime, splitCropPercent: undefined, currentCategory: 'Scenic Nature', photosList: [] };
    assert.strictEqual(buildDomainState(legacy, state.library.collections).config.splitCropPercent, 50);
    const secondary = { ...state.library.photosList[1], cropPercent: 0 };
    const withPhotoCrop = createState({ config: { splitCropPercent: shared }, library: { photosList: [state.library.photosList[0], secondary] } });
    assert.strictEqual(deriveCurrentFrame(withPhotoCrop).crop.secondaryPercent, 0);
    assert.strictEqual(deriveCurrentFrame(createState({ config: { splitCropPercent: undefined } })).crop.secondaryPercent, selectors.DEFAULT_SPLIT_CROP);
    assert.strictEqual(state.config.splitCropPercent, 50);
  });

  assertTest('direct split crop command uses numeric coercion and preserves failures', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const value = Object.freeze({ valueOf: () => 35 });
    const result = reduceDomainCommand(state, { type: 'set-split-crop', payload: { percent: value } }, env);
    assert.strictEqual(result.nextState.config.splitCropPercent, 35);
    assert.deepStrictEqual(result.effects.map(({ type }) => type), ['persist']);
    assert.ok(Number.isNaN(reduceDomainCommand(state, { type: 'set-split-crop' }, env).nextState.config.splitCropPercent));
    const failure = new Error('crop coercion');
    assert.throws(() => reduceDomainCommand(state, { type: 'set-split-crop', payload: { percent: { valueOf: () => { throw failure; } } } }, env), (error) => error === failure);
    assert.strictEqual(state.config.splitCropPercent, 50);
  });

  assertTest('split portrait patches retain raw values while legacy rebuilds and frame selection use truthiness', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ [Symbol.toPrimitive]: () => { throw new Error('unexpected coercion'); } });
    [shared, null, 0, false, '', 'false'].forEach((splitPortrait) => {
      const input = Object.freeze({ splitPortrait });
      const command = decodeStatePatchCommand(input);
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(command.payload.splitPortrait, splitPortrait);
      assert.strictEqual(result.nextState.config.splitPortrait, splitPortrait);
      assert.strictEqual(snapshot.splitPortrait, splitPortrait);
      assert.strictEqual(snapshot.config.splitPortrait, splitPortrait);
      assert.strictEqual(snapshot.currentFrame.context.splitEligible, Boolean(splitPortrait));
      assert.strictEqual(snapshot.currentFrame.layout, splitPortrait ? 'split' : 'single');
      const legacy = { ...state.config, ...state.runtime, splitPortrait, currentCategory: 'Scenic Nature', photosList: [] };
      const rebuilt = buildDomainState(legacy, state.library.collections);
      assert.strictEqual(rebuilt.config.splitPortrait, Boolean(splitPortrait));
      assert.strictEqual(legacy.splitPortrait, splitPortrait);
      assert.strictEqual(input.splitPortrait, splitPortrait);
    });
    const omitted = decodeStatePatchCommand({ splitPortrait: undefined });
    assert.deepStrictEqual(omitted.payload, {});
    assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
    const legacy = { ...state.config, ...state.runtime, splitPortrait: undefined, currentCategory: 'Scenic Nature', photosList: [] };
    assert.strictEqual(buildDomainState(legacy, state.library.collections).config.splitPortrait, false);
    assert.strictEqual(state.config.splitPortrait, true);
  });

  assertTest('direct split portrait commands use boolean truthiness and persist only changes', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    [null, 0, false, ''].forEach((enabled) => {
      const result = reduceDomainCommand(state, { type: 'set-split-portrait', payload: { enabled } }, env);
      assert.strictEqual(result.nextState.config.splitPortrait, false);
      assert.deepStrictEqual(result.effects.map(({ type }) => type), ['persist']);
    });
    [{}, 'false', 1].forEach((enabled) => {
      const result = reduceDomainCommand(state, { type: 'set-split-portrait', payload: { enabled } }, env);
      assert.strictEqual(result.nextState, state);
      assert.deepStrictEqual(result.effects, []);
    });
    const omitted = reduceDomainCommand(state, { type: 'set-split-portrait' }, env);
    assert.strictEqual(omitted.nextState.config.splitPortrait, false);
    assert.deepStrictEqual(omitted.effects.map(({ type }) => type), ['persist']);
    assert.strictEqual(state.config.splitPortrait, true);
  });

  assertTest('fallback consent patches preserve raw values while legacy rebuilds use truthiness', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ [Symbol.toPrimitive]: () => { throw new Error('unexpected coercion'); } });
    [shared, null, 0, false, '', 'false'].forEach((allowOpenAiFallback) => {
      const input = Object.freeze({ allowOpenAiFallback });
      const command = decodeStatePatchCommand(input);
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(command.payload.allowOpenAiFallback, allowOpenAiFallback);
      assert.strictEqual(result.nextState.config.allowOpenAiFallback, allowOpenAiFallback);
      assert.strictEqual(snapshot.allowOpenAiFallback, allowOpenAiFallback);
      assert.strictEqual(snapshot.config.allowOpenAiFallback, allowOpenAiFallback);
      const legacy = { ...state.config, ...state.runtime, allowOpenAiFallback, currentCategory: 'Scenic Nature', photosList: [] };
      assert.strictEqual(buildDomainState(legacy, state.library.collections).config.allowOpenAiFallback, Boolean(allowOpenAiFallback));
      const target = { ...legacy };
      applyDomainState(target, {}, result.nextState);
      assert.strictEqual(target.allowOpenAiFallback, allowOpenAiFallback);
      assert.strictEqual(input.allowOpenAiFallback, allowOpenAiFallback);
    });
    const omitted = decodeStatePatchCommand({ allowOpenAiFallback: undefined });
    assert.deepStrictEqual(omitted.payload, {});
    assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
    const legacy = { ...state.config, ...state.runtime, allowOpenAiFallback: undefined, currentCategory: 'Scenic Nature', photosList: [] };
    assert.strictEqual(buildDomainState(legacy, state.library.collections).config.allowOpenAiFallback, false);
    assert.strictEqual(state.config.allowOpenAiFallback, false);
  });

  assertTest('legacy fallback consent toggle coerces inputs before patching', () => {
    const decode = findSocketStatePatchDecode('toggle-allow-openai-fallback');
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    [null, 0, false, '', undefined, 'false', {}].forEach((value) => {
      const command = decode(value);
      assert.deepStrictEqual(command, { type: 'patch-state', payload: { allowOpenAiFallback: Boolean(value) } });
      const result = reduceDomainCommand(state, command, env);
      assert.strictEqual(result.nextState.config.allowOpenAiFallback, Boolean(value));
      assert.strictEqual(result.nextState === state, !value);
    });
  });

  assertTest('weather alignment preserves raw patches and uses truthiness at compatibility boundaries', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ [Symbol.toPrimitive]: () => { throw new Error('unexpected coercion'); } });
    const rows = Object.freeze([Object.freeze({ url: 'snow', isSnowy: true }), Object.freeze({ url: 'sun', isSunny: true })]);
    const decodeToggle = findSocketStatePatchDecode('toggle-align-weather');
    [shared, null, 0, false, '', 'false'].forEach((alignWeather) => {
      const input = Object.freeze({ alignWeather });
      const command = decodeStatePatchCommand(input);
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(command.payload.alignWeather, alignWeather);
      assert.strictEqual(result.nextState.config.alignWeather, alignWeather);
      assert.strictEqual(snapshot.alignWeather, alignWeather);
      assert.strictEqual(snapshot.config.alignWeather, alignWeather);
      const legacy = { ...state.config, ...state.runtime, alignWeather, currentCategory: 'Scenic Nature', photosList: [] };
      assert.strictEqual(buildDomainState(legacy, state.library.collections).config.alignWeather, Boolean(alignWeather));
      const target = { ...legacy };
      applyDomainState(target, {}, result.nextState);
      assert.strictEqual(target.alignWeather, alignWeather);
      const selected = filterPhotosForWeather(rows, alignWeather, 'Snowy', 'Sunny', () => 0);
      if (alignWeather) assert.deepStrictEqual(selected, [rows[0]]);
      else assert.strictEqual(selected, rows);
      assert.deepStrictEqual(decodeToggle(alignWeather), { type: 'patch-state', payload: { alignWeather: Boolean(alignWeather) } });
      assert.strictEqual(input.alignWeather, alignWeather);
    });
    const omitted = decodeStatePatchCommand({ alignWeather: undefined });
    assert.deepStrictEqual(omitted.payload, {});
    assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
    assert.deepStrictEqual(decodeToggle(undefined), { type: 'patch-state', payload: { alignWeather: false } });
    assert.strictEqual(filterPhotosForWeather(rows, undefined, 'Snowy', 'Sunny', () => assert.fail('disabled weather must not draw')), rows);
    assert.strictEqual(state.config.alignWeather, false);
  });

  assertTest('time alignment preserves raw patches and uses truthiness at compatibility boundaries', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ [Symbol.toPrimitive]: () => { throw new Error('unexpected coercion'); } });
    const rows = Object.freeze([Object.freeze({ url: 'day', rating: 0 }), Object.freeze({ url: 'night', rating: 0, isNight: true })]);
    const decodeToggle = findSocketStatePatchDecode('toggle-align-time');
    [shared, null, 0, false, '', 'false'].forEach((alignTimeOfDay) => {
      const input = Object.freeze({ alignTimeOfDay });
      const command = decodeStatePatchCommand(input);
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(command.payload.alignTimeOfDay, alignTimeOfDay);
      assert.strictEqual(result.nextState.config.alignTimeOfDay, alignTimeOfDay);
      assert.strictEqual(snapshot.alignTimeOfDay, alignTimeOfDay);
      assert.strictEqual(snapshot.config.alignTimeOfDay, alignTimeOfDay);
      const legacy = { ...state.config, ...state.runtime, alignTimeOfDay, currentCategory: 'Scenic Nature', photosList: [] };
      assert.strictEqual(buildDomainState(legacy, state.library.collections).config.alignTimeOfDay, Boolean(alignTimeOfDay));
      const target = { ...legacy };
      applyDomainState(target, {}, result.nextState);
      assert.strictEqual(target.alignTimeOfDay, alignTimeOfDay);
      const selected = filterPhotosForNight(rows, alignTimeOfDay, true, 100, () => 0);
      if (alignTimeOfDay) assert.deepStrictEqual(selected, [rows[1]]);
      else assert.strictEqual(selected, rows);
      assert.strictEqual(selectors.selectSmartPhotoFromFeed({ photos: rows, alignTimeOfDay, isNight: true, nightPercentage: 100, ...env }), rows[alignTimeOfDay ? 1 : 0]);
      assert.deepStrictEqual(decodeToggle(alignTimeOfDay), { type: 'patch-state', payload: { alignTimeOfDay: Boolean(alignTimeOfDay) } });
      assert.strictEqual(input.alignTimeOfDay, alignTimeOfDay);
    });
    const omitted = decodeStatePatchCommand({ alignTimeOfDay: undefined });
    assert.deepStrictEqual(omitted.payload, {});
    assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
    assert.deepStrictEqual(decodeToggle(undefined), { type: 'patch-state', payload: { alignTimeOfDay: false } });
    const noDraw = () => assert.fail('disabled or daytime preference must not draw');
    assert.strictEqual(filterPhotosForNight(rows, undefined, true, 100, noDraw), rows);
    assert.strictEqual(filterPhotosForNight(rows, shared, false, 100, noDraw), rows);
    assert.strictEqual(filterPhotosForNight(rows, shared, true, 100, () => 1), rows);
    assert.strictEqual(state.config.alignTimeOfDay, false);
  });

  assertTest('night percentage preserves raw state and native selector coercion', () => {
    const state = createState();
    const env = { now: new Date(0), rng: () => 0 };
    const shared = Object.freeze({ valueOf: () => 75 });
    const rows = Object.freeze([Object.freeze({ url: 'day', rating: 0 }), Object.freeze({ url: 'night', rating: 0, isNight: true })]);
    const cases = [[shared, true], [null, true], [false, false], [0, false], ['', false], ['75', true], ['bad', false], [NaN, false]];
    cases.forEach(([nightPercentage, selectsNight]) => {
      const input = Object.freeze({ nightPercentage });
      const command = decodeStatePatchCommand(input);
      const result = reduceDomainCommand(state, command, env);
      const snapshot = buildSnapshot(result.nextState);
      assert.strictEqual(command.payload.nightPercentage, nightPercentage);
      assert.strictEqual(result.nextState.config.nightPercentage, nightPercentage);
      assert.strictEqual(snapshot.nightPercentage, nightPercentage);
      assert.strictEqual(snapshot.config.nightPercentage, nightPercentage);
      const legacy = { ...state.config, ...state.runtime, nightPercentage, currentCategory: 'Scenic Nature', photosList: [] };
      assert.strictEqual(buildDomainState(legacy, state.library.collections).config.nightPercentage, nightPercentage ?? 50);
      const target = { ...legacy };
      applyDomainState(target, {}, result.nextState);
      assert.strictEqual(target.nightPercentage, nightPercentage);
      const selected = filterPhotosForNight(rows, true, true, nightPercentage, () => 0.4);
      if (selectsNight) assert.deepStrictEqual(selected, [rows[1]]);
      else assert.strictEqual(selected, rows);
      assert.strictEqual(input.nightPercentage, nightPercentage);
    });
    const omitted = decodeStatePatchCommand({ nightPercentage: undefined });
    assert.deepStrictEqual(omitted.payload, {});
    assert.strictEqual(reduceDomainCommand(state, omitted, env).nextState, state);
    assert.deepStrictEqual(filterPhotosForNight(rows, true, true, undefined, () => 0.49), [rows[1]]);
    assert.strictEqual(filterPhotosForNight(rows, true, true, null, () => 0.5), rows);
    const decodePercent = findSocketStatePatchDecode('change-night-percentage');
    assert.deepStrictEqual(decodePercent('75.9'), { type: 'patch-state', payload: { nightPercentage: 75 } });
    assert.strictEqual(decodePercent(null), null);
    assert.strictEqual(decodePercent('bad'), null);
    assert.strictEqual(selectors.selectSmartPhotoFromFeed({ photos: rows, alignTimeOfDay: true, isNight: true, nightPercentage: '100', ...env }), rows[1]);
    assert.strictEqual(selectors.selectSmartPhotoFromFeed({ photos: rows, alignTimeOfDay: true, isNight: true, nightPercentage: 0, ...env }), rows[0]);
    const failure = new Error('numeric coercion');
    const throwing = Object.freeze({ [Symbol.toPrimitive]: () => { throw failure; } });
    const noDraw = () => assert.fail('inactive or empty night preference must not draw');
    assert.strictEqual(filterPhotosForNight(rows, false, true, throwing, noDraw), rows);
    assert.strictEqual(filterPhotosForNight(rows, true, false, throwing, noDraw), rows);
    const dayOnly = Object.freeze([rows[0]]);
    assert.strictEqual(filterPhotosForNight(dayOnly, true, true, throwing, noDraw), dayOnly);
    const calls = [];
    assert.throws(() => filterPhotosForNight(rows, true, true, throwing, () => { calls.push('rng'); return 0; }), (error) => error === failure);
    assert.deepStrictEqual(calls, ['rng']);
    assert.throws(() => filterPhotosForNight(rows, true, true, 1n, () => 0), TypeError);
    assert.strictEqual(state.config.nightPercentage, 50);
  });

  assertTest('active photo decoding checks the URL but does not validate optional Photo metadata', () => {
    const photo = Object.freeze({ url: 'preview', title: 9, width: 'wide', orientation: 'sideways' });
    const command = decodeActivePhotoCommand(photo);
    assert.strictEqual(command.payload.photo, photo);
    assert.strictEqual(command.payload.url, 'preview');
    assert.strictEqual(command.payload.photo.title, 9);
    assert.strictEqual(command.payload.photo.width, 'wide');
    assert.strictEqual(selectors.inferOrientation(command.payload.photo), 'unknown');
  });

  assertTest('active photo preview compatibility preserves object aliases and native URL reads', () => {
    const inherited = Object.create({ url: 'inherited' });
    const array = Object.assign([], { url: 'array' });
    [inherited, array].forEach((photo) => {
      const command = decodeActivePhotoCommand(photo);
      assert.strictEqual(command.payload.url, photo.url);
      assert.strictEqual(command.payload.photo, photo);
    });
    const callable = Object.assign(() => {}, { url: 'callable' });
    assert.deepStrictEqual(decodeActivePhotoCommand(callable), {
      type: 'set-active-photo', payload: { url: 'callable' }
    });
    assert.deepStrictEqual(decodeActivePhotoCommand(' string-url '), {
      type: 'set-active-photo', payload: { url: ' string-url ' }
    });
    let reads = 0;
    const changing = { get url() { return reads++ === 0 ? 'first' : 17; } };
    const command = decodeActivePhotoCommand(changing);
    assert.strictEqual(command.payload.url, 'first');
    assert.strictEqual(command.payload.photo, changing);
    assert.strictEqual(command.payload.photo.url, 17);
    const failure = new Error('preview URL getter');
    assert.throws(() => decodeActivePhotoCommand({ get url() { throw failure; } }), (error) => error === failure);
  });

  assertTest('active photo previews are shallow-copied into the feed without metadata normalization', () => {
    const nested = Object.freeze({ source: 'alias' });
    const preview = Object.freeze({ url: 'unlisted-preview', title: 9, width: 'wide', nested });
    const state = createState();
    const command = decodeActivePhotoCommand(preview);
    const result = reduceDomainCommand(state, command, { now: new Date(0), rng: () => 0 });
    const staged = result.nextState.library.photosList.find(({ url }) => url === preview.url);
    assert.notStrictEqual(staged, preview);
    assert.strictEqual(staged.title, 9);
    assert.strictEqual(staged.width, 'wide');
    assert.strictEqual(staged.nested, nested);
    assert.strictEqual(command.payload.photo, preview);
    assert.ok(!state.library.photosList.some(({ url }) => url === preview.url));
  });

  assertTest('staged preview metadata survives both public feed projections without normalization', () => {
    const nested = Object.freeze({ marker: 'shared' });
    const preview = Object.freeze({ url: 'raw-preview', title: 9, width: 'wide', nested });
    const state = createState();
    const result = reduceDomainCommand(state, decodeActivePhotoCommand(preview), { now: new Date(0), rng: () => 0 });
    const feed = result.nextState.library.photosList;
    const staged = feed.find((photo) => photo.url === preview.url);
    const snapshot = buildSnapshot(result.nextState);
    const copied = snapshot.photosList.find((photo) => photo.url === preview.url);
    assert.strictEqual(snapshot.library, result.nextState.library);
    assert.strictEqual(snapshot.library.photosList, feed);
    assert.notStrictEqual(snapshot.photosList, feed);
    assert.notStrictEqual(copied, staged);
    assert.strictEqual(copied.title, 9);
    assert.strictEqual(copied.width, 'wide');
    assert.strictEqual(copied.nested, nested);
    assert.strictEqual(staged.nested, nested);
    assert.ok(!state.library.photosList.some((photo) => photo.url === preview.url));
  });

  assertTest('legacy feed rebuilding shallow-copies raw rows and preserves metadata aliases', () => {
    const state = createState();
    const nested = Object.freeze({ marker: 'shared' });
    const row = Object.freeze({ url: 'legacy-raw', title: 9, width: 'wide', nested });
    const legacy = { ...state.config, ...state.runtime, currentCategory: 'Scenic Nature', photosList: [row] };
    const rebuilt = buildDomainState(legacy, state.library.collections);
    const snapshot = buildSnapshot(rebuilt);
    assert.notStrictEqual(rebuilt.library.photosList, legacy.photosList);
    assert.notStrictEqual(rebuilt.library.photosList[0], row);
    assert.notStrictEqual(snapshot.photosList[0], rebuilt.library.photosList[0]);
    [rebuilt.library.photosList[0], snapshot.photosList[0]].forEach((photo) => {
      assert.strictEqual(photo.title, 9);
      assert.strictEqual(photo.width, 'wide');
      assert.strictEqual(photo.nested, nested);
    });
    assert.strictEqual(legacy.photosList[0], row);
  });

  assertTest('trim string projection preserves input boundaries and native idempotence', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./commands.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.trimStringForTest = trimString;`, sandbox);
    const trim = sandbox.trimStringForTest;
    const uninspected = Object.defineProperty({}, 'trim', { get: () => assert.fail('non-string inspected') });
    [null, undefined, false, 0, Symbol('input'), new String('x'), uninspected].forEach((value) => {
      assert.strictEqual(trim(value), '');
    });
    [[' x ', 'x'], ['\t  ', ''], ['\u200b', '\u200b']].forEach(([value, expected]) => {
      assert.strictEqual(trim(value), expected);
      assert.strictEqual(trim(trim(value)), trim(value));
    });
    assert.deepStrictEqual(decodeDeletePoolCommand(' pool '), { type: 'delete-pool', payload: { name: 'pool' } });
    assert.deepStrictEqual(decodePoolScopedRecrawlCommand(' pool '), {
      type: 'trigger-recrawl', payload: { categories: ['pool'] }
    });
  });

  assertTest('trim string projection preserves native lookup, raw results and failures', () => {
    const calls = [];
    const failure = new Error('trim failed');
    const sandbox = { module: { exports: {} }, require, calls, failure, result: null };
    const source = fs.readFileSync(require.resolve('./commands.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.trimStringForTest = trimString;`, sandbox);
    const trim = sandbox.trimStringForTest;
    runInNewContext(`
      Object.defineProperty(String.prototype, 'trim', {
        configurable: true,
        get() {
          calls.push(['lookup', String(this)]);
          return function () { 'use strict'; calls.push(['call', this]); return result; };
        }
      });
    `, sandbox);
    [Object.freeze({ marker: 'alias' }), 0, false, null, undefined].forEach((result) => {
      sandbox.result = result;
      assert.strictEqual(trim(' original '), result);
      assert.deepStrictEqual(calls.map((call) => Array.from(call)), [['lookup', ' original '], ['call', ' original ']]);
      calls.length = 0;
    });
    assert.strictEqual(trim({ trim: () => assert.fail('non-string inspected') }), '');
    assert.deepStrictEqual(calls, []);
    runInNewContext("Object.defineProperty(String.prototype, 'trim', { get() { throw failure; } });", sandbox);
    assert.throws(() => trim('x'), (error) => error === failure);
    runInNewContext("Object.defineProperty(String.prototype, 'trim', { value() { throw failure; } });", sandbox);
    assert.throws(() => trim('x'), (error) => error === failure);
    runInNewContext("Object.defineProperty(String.prototype, 'trim', { value: 1 });", sandbox);
    assert.throws(() => trim('x'), (error) => error.name === 'TypeError');
  });

  assertTest('widget patch preserves ordinary decoding and truthy-name short circuit', () => {
    const decode = findSocketStatePatchDecode('toggle-widget');
    assert.deepStrictEqual(decode({ widgetName: ' clock ', visible: 0 }), {
      type: 'patch-state', payload: { widgets: { clock: 0 } }
    });
    const visible = () => assert.fail('visible must not be read for empty names');
    ['', '  ', null, false, 1, new String('clock')].forEach((widgetName) => {
      assert.strictEqual(decode({ widgetName, get visible() { return visible(); } }), null);
    });
  });

  assertTest('widget patch accepts native property access and retains raw visibility aliases', () => {
    const build = commands.buildWidgetPatch;
    [null, undefined, false, 0, 'clock', Symbol('input')].forEach((input) => {
      assert.strictEqual(build(input), null);
    });
    const value = Object.freeze({ raw: 'visible' });
    const prototype = { widgetName: ' clock ', visible: value };
    const inherited = Object.create(prototype);
    const callable = Object.assign(() => {}, { widgetName: ' clock ', visible: value });
    [inherited, callable].forEach((input) => {
      const first = build(input);
      const second = build(input);
      assert.strictEqual(first.widgets.clock, value);
      assert.notStrictEqual(first, second);
      assert.notStrictEqual(first.widgets, second.widgets);
      assert.strictEqual(input.widgetName, ' clock ');
    });
    const missing = build({ widgetName: 'clock' });
    assert.ok(Object.hasOwn(missing.widgets, 'clock'));
    assert.strictEqual(missing.widgets.clock, undefined);
  });

  assertTest('widget patch preserves proxy lookup order and exact accessor failures', () => {
    const build = commands.buildWidgetPatch;
    const failure = new Error('lookup failed');
    const reads = [];
    const input = new Proxy({ widgetName: ' clock ', visible: false }, {
      get(target, key, receiver) {
        reads.push(key);
        return Reflect.get(target, key, receiver);
      }
    });
    assert.deepStrictEqual(build(input), { widgets: { clock: false } });
    assert.deepStrictEqual(reads, ['widgetName', 'visible']);
    ['widgetName', 'visible'].forEach((key) => {
      const throwing = new Proxy({ widgetName: 'clock' }, {
        get(target, property, receiver) {
          if (property === key) throw failure;
          return Reflect.get(target, property, receiver);
        }
      });
      assert.throws(() => build(throwing), (error) => error === failure);
    });
  });

  assertTest('widget patch preserves native computed-key coercion, ordering and errors', () => {
    const calls = [];
    const failure = new Error('key conversion failed');
    const sandbox = { module: { exports: {} }, require, calls, result: null };
    const source = fs.readFileSync(require.resolve('./commands.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildWidgetPatchForTest = buildWidgetPatch;\nglobalThis.decodeWidgetForTest = SOCKET_STATE_PATCH_SPECS.find((spec) => spec.event === 'toggle-widget').decode;`, sandbox);
    const build = sandbox.buildWidgetPatchForTest;
    runInNewContext(`
      Object.defineProperty(String.prototype, 'trim', {
        configurable: true,
        get() {
          calls.push('trim lookup');
          return function () { 'use strict'; calls.push(['trim call', this]); return result; };
        }
      });
    `, sandbox);
    const symbol = Symbol('widget');
    const key = { [Symbol.toPrimitive](hint) { calls.push(['key conversion', hint, this]); return symbol; } };
    const visible = Object.freeze({ raw: true });
    const input = { get widgetName() { calls.push('name'); return ' raw '; }, get visible() { calls.push('visible'); return visible; } };
    sandbox.result = key;
    const patch = build(input);
    assert.strictEqual(patch.widgets[symbol], visible);
    assert.deepStrictEqual(Reflect.ownKeys(patch.widgets), [symbol]);
    assert.strictEqual(calls[0], 'name');
    assert.strictEqual(calls[1], 'trim lookup');
    assert.deepStrictEqual(Array.from(calls[2]), ['trim call', ' raw ']);
    assert.deepStrictEqual(calls[3], ['key conversion', 'string', key]);
    assert.strictEqual(calls[4], 'visible');
    calls.length = 0;
    const command = sandbox.decodeWidgetForTest(input);
    assert.strictEqual(command.type, 'patch-state');
    assert.strictEqual(command.payload.widgets[symbol], visible);
    assert.deepStrictEqual(Reflect.ownKeys(command.payload.widgets), [symbol]);
    calls.length = 0;
    sandbox.result = '__proto__';
    const special = build(input).widgets;
    assert.strictEqual(Object.hasOwn(special, '__proto__'), true);
    assert.strictEqual(special.__proto__, visible);
    calls.length = 0;
    sandbox.result = 0;
    assert.strictEqual(build(input), null);
    assert.deepStrictEqual(calls.slice(0, 2), ['name', 'trim lookup']);
    assert.strictEqual(calls.length, 3);
    calls.length = 0;
    sandbox.result = { [Symbol.toPrimitive]() { calls.push('throwing key'); throw failure; } };
    assert.throws(() => build(input), (error) => error === failure);
    assert.strictEqual(calls.at(-1), 'throwing key');
    assert.ok(!calls.includes('visible'));
    calls.length = 0;
    sandbox.result = { [Symbol.toPrimitive]() { return {}; } };
    assert.throws(() => build(input), (error) => error.name === 'TypeError');
    assert.ok(!calls.includes('visible'));
  });

  assertTest('required string decoding preserves primitive values and rejects non-strings without coercion', () => {
    const nonString = Object.defineProperty({}, 'trim', { get: () => assert.fail('non-strings must not be inspected') });
    const accepted = [' raw url ', '\u200b', 'x'];
    const rejected = ['', ' \t\n', null, undefined, 0, false, Symbol('url'), new String('url'), nonString];
    accepted.forEach((url) => {
      assert.strictEqual(decodeActivePhotoCommand(url).payload.url, url);
      assert.strictEqual(decodeBrokenPhotoCommand({ url }).payload.url, url);
    });
    rejected.forEach((url) => {
      assert.strictEqual(decodeActivePhotoCommand({ url }), null);
      assert.strictEqual(decodeBrokenPhotoCommand({ url }), null);
    });
    assert.deepStrictEqual(decodeDeletePoolCommand(' pool '), {
      type: 'delete-pool', payload: { name: 'pool' }
    });
  });

  assertTest('required string projection preserves native trim lookup, truthiness and failures', () => {
    const calls = [];
    const failure = new Error('trim failed');
    const sandbox = { module: { exports: {} }, require, calls, failure, result: null };
    const source = fs.readFileSync(require.resolve('./commands.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.readRequiredStringForTest = readRequiredString;`, sandbox);
    const read = sandbox.readRequiredStringForTest;
    [' x ', 'x', '', ' \t'].forEach((value) => assert.strictEqual(read(read(value)), read(value)));
    runInNewContext(`
      Object.defineProperty(String.prototype, 'trim', {
        configurable: true,
        get() {
          calls.push(['lookup', String(this)]);
          return function () { 'use strict'; calls.push(['call', this]); return result; };
        }
      });
    `, sandbox);
    sandbox.result = Object.freeze({ truthy: true });
    assert.strictEqual(read(' original '), ' original ');
    assert.deepStrictEqual(calls.map((call) => Array.from(call)), [['lookup', ' original '], ['call', ' original ']]);
    calls.length = 0;
    sandbox.result = 0;
    assert.strictEqual(read(' original '), null);
    assert.deepStrictEqual(calls.map((call) => Array.from(call)), [['lookup', ' original '], ['call', ' original ']]);
    calls.length = 0;
    assert.strictEqual(read({ trim: () => assert.fail('not a primitive string') }), null);
    assert.deepStrictEqual(calls, []);
    runInNewContext("Object.defineProperty(String.prototype, 'trim', { get() { throw failure; } });", sandbox);
    assert.throws(() => read('x'), (error) => error === failure);
    runInNewContext("Object.defineProperty(String.prototype, 'trim', { value() { throw failure; } });", sandbox);
    assert.throws(() => read('x'), (error) => error === failure);
  });

  assertTest('unknown decoder inputs preserve inherited and callable property access and exact getter failures', () => {
    [
      [decodeCategorySelectionFromHttp, 'category', 'Scenic Nature', 'select-categories', 'categories'],
      [decodeScreensaverActiveCommand, 'active', true, 'set-screensaver-active', 'active']
    ].forEach(([decode, field, value, type, outputField]) => {
      [Object.create({ [field]: value }), Object.assign(() => {}, { [field]: value })].forEach((input) => {
        assert.deepStrictEqual(decode(input), { type, payload: { [outputField]: value } });
      });
      [null, undefined, false, 0, 'plain', Symbol('input')].forEach((input) => {
        assert.strictEqual(decode(input), null);
      });
      const failure = new Error('isolated decoder getter failure');
      const input = Object.defineProperty({}, field, { get: () => { throw failure; } });
      assert.throws(() => decode(input), (error) => error === failure);
    });
  });

  assertTest('HTTP category decoder reads inherited callable properties eagerly and in order', () => {
    const reads = [];
    const prototype = {
      get category() { reads.push(['category', this]); return ' Primary '; },
      get categories() { reads.push(['categories', this]); return ['Ignored']; }
    };
    const input = () => {};
    Object.setPrototypeOf(input, prototype);
    assert.deepStrictEqual(decodeCategorySelectionFromHttp(input), {
      type: 'select-categories', payload: { categories: ' Primary ' }
    });
    assert.deepStrictEqual(reads, [['category', input], ['categories', input]]);
    assert.strictEqual(decodeCategorySelectionFromHttp({ category: '', categories: 'fallback' }), null);
    assert.deepStrictEqual(decodeCategorySelectionFromHttp({ categories: ['one', 'two'] }), {
      type: 'select-categories', payload: { categories: 'one,two' }
    });
    const failure = new Error('second lookup');
    const proxyReads = [];
    const proxy = new Proxy({}, { get: (_, key) => {
      proxyReads.push(key);
      if (key === 'category') return 'valid';
      throw failure;
    } });
    assert.throws(() => decodeCategorySelectionFromHttp(proxy), (error) => error === failure);
    assert.deepStrictEqual(proxyReads, ['category', 'categories']);
  });

  assertTest('HTTP category decoder preserves custom array join results and failures', () => {
    const result = Object.freeze({ raw: true });
    const calls = [];
    const categories = [];
    categories.join = function (separator) { calls.push([this, separator]); return result; };
    const input = Object.freeze({ categories });
    const decoded = decodeCategorySelectionFromHttp(input);
    assert.strictEqual(decoded.payload.categories, result);
    assert.deepStrictEqual(calls, [[categories, ',']]);
    categories.join = () => 0;
    assert.strictEqual(decodeCategorySelectionFromHttp(input), null);
    const failure = new Error('join failed');
    categories.join = () => { throw failure; };
    assert.throws(() => decodeCategorySelectionFromHttp(input), (error) => error === failure);
  });

  assertTest('screensaver decoder validates the first read and preserves the raw second read', () => {
    const raw = Object.freeze({ marker: 'second read' });
    const reads = [];
    const prototype = Object.defineProperty({}, 'active', {
      get() {
        reads.push(this);
        return reads.length === 1 ? false : raw;
      }
    });
    const input = Object.assign(() => {}, { marker: 'callable' });
    Object.setPrototypeOf(input, prototype);
    const decoded = decodeScreensaverActiveCommand(input);
    assert.deepStrictEqual(reads, [input, input]);
    assert.strictEqual(decoded.type, 'set-screensaver-active');
    assert.strictEqual(decoded.payload.active, raw);
    const result = reduceDomainCommand(createState(), decoded);
    assert.strictEqual(result.nextState.runtime.screensaverActive, true);

    let rejectedReads = 0;
    assert.strictEqual(decodeScreensaverActiveCommand({
      get active() { rejectedReads += 1; return 'true'; }
    }), null);
    assert.strictEqual(rejectedReads, 1);
  });

  assertTest('screensaver decoder preserves proxy lookups and second-read failures', () => {
    const reads = [];
    const failure = new Error('second active lookup failed');
    const input = new Proxy({}, {
      get(target, key, receiver) {
        reads.push([target, key, receiver]);
        if (reads.length === 1) return true;
        throw failure;
      }
    });
    assert.throws(() => decodeScreensaverActiveCommand(input), (error) => error === failure);
    assert.deepStrictEqual(reads.map(([, key, receiver]) => [key, receiver]), [
      ['active', input], ['active', input]
    ]);
  });

  assertTest('optional direct command payloads retain compatibility rather than guarantee normalized state', () => {
    [
      ['set-scale-mode', 'scaleMode', 'cover'],
      ['change-interval', 'slideshowInterval', NaN],
      ['set-split-crop', 'splitCropPercent', NaN],
      ['set-split-portrait', 'splitPortrait', false]
    ].forEach(([type, field, expected]) => {
      const state = createState();
      const before = JSON.stringify(state);
      const result = reduceDomainCommand(state, Object.freeze({ type }), { now: new Date(0), rng: () => 0 });
      assert.strictEqual(result.nextState.config[field], expected, type);
      if (type === 'set-scale-mode') assert.strictEqual(result.nextState, state);
      assert.strictEqual(JSON.stringify(state), before);
    });
  });

  assertTest('command payload contracts match every reducer branch and exported decoder result', () => {
    const types = fs.readFileSync(require.resolve('./types.js'), 'utf8');
    const reducer = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    const source = fs.readFileSync(require.resolve('./commands.js'), 'utf8');
    const payloads = types.match(/@typedef \{\{([^]*?)\}\} CommandPayloads/)[1];
    const declared = [...payloads.matchAll(/^ \* {3}'([^']+)':/gm)].map(([, name]) => name);
    const handled = [...reducer.matchAll(/^ {2}(?: {4})?'([^']+)':/gm)].map(([, name]) => name);
    assert.strictEqual(declared.length, 25);
    assert.deepStrictEqual(declared.sort(), handled.sort());
    assert.match(types, /payload\?: CommandPayloads\[K\]/);
    assert.match(types, /keywords: unknown\[\]/);
    Object.keys(commands).filter((name) => name.startsWith('decode')).forEach((name) => {
      const position = source.search(new RegExp(`(?:function|const) ${name}\\b`));
      const prefix = source.slice(0, position);
      const contract = prefix.slice(prefix.lastIndexOf('/**'));
      assert.match(contract, /@(?:type \{CommandDecoder\}|returns \{(?:Command|ScreensaverActiveCommand|CategorySelectionCommand) \| null\})/, name);
      assert.ok(contract.endsWith('*/\n'), name);
    });
  });

  assertTest('decoder contracts preserve pass-through values and photo aliases without promising validation', () => {
    const widget = Object.freeze({ arbitrary: 'truthy' });
    const exclusions = Object.freeze([null, 7, ' phrase ']);
    const input = Object.freeze({ theme: 9, splitPortrait: 'false', widgets: widget, excludedKeywords: exclusions });
    const patch = decodeStatePatchCommand(input);
    assert.strictEqual(patch.payload.theme, 9);
    assert.strictEqual(patch.payload.splitPortrait, 'false');
    assert.deepStrictEqual(patch.payload.widgets, widget);
    assert.notStrictEqual(patch.payload.widgets, widget);
    assert.strictEqual(patch.payload.excludedKeywords, exclusions);
    assert.strictEqual(commands.decodeExcludedKeywordsCommand(exclusions).payload.keywords, exclusions);
    const photo = Object.freeze({ url: ' preview ', title: 'Untrimmed URL' });
    assert.strictEqual(decodeActivePhotoCommand(photo).payload.photo, photo);
    assert.strictEqual(decodeActivePhotoCommand(photo).payload.url, ' preview ');
    const metadata = decodePhotoMetadataCommand({ url: 'p', orientation: 'portrait', width: 'bad', height: Infinity });
    assert.ok(Number.isNaN(metadata.payload.width));
    assert.strictEqual(metadata.payload.height, Infinity);
    assert.strictEqual(decodePhotoMetadataCommand({ url: 'p', orientation: 'unknown' }), null);
  });

  assertTest('boolean field patches preserve direct and partial curry behavior', () => {
    const build = commands.buildBooleanFieldPatch;
    const values = [undefined, null, false, 0, '', true, 1, 'false', Object.freeze({})];
    values.forEach((value) => {
      const expected = { enabled: Boolean(value) };
      assert.deepStrictEqual(build('enabled', value), expected);
      assert.deepStrictEqual(build()('enabled')()(value, 'ignored'), expected);
      assert.notStrictEqual(build('enabled', value), build('enabled', value));
    });
    assert.deepStrictEqual(build(undefined, true), { undefined: true });
    assert.deepStrictEqual(build(7, false, 'ignored'), { 7: false });
    const key = Symbol('field');
    assert.deepStrictEqual(build(key)(true), { [key]: true });
  });

  assertTest('boolean field patches retain native property-key coercion and errors', () => {
    const build = commands.buildBooleanFieldPatch;
    const calls = [];
    const key = { [Symbol.toPrimitive]: (hint) => { calls.push(hint); return 'enabled'; } };
    const partial = build(key);
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(partial(true), { enabled: true });
    assert.deepStrictEqual(calls, ['string']);
    const failure = new Error('key coercion');
    assert.throws(() => build({ [Symbol.toPrimitive]: () => { throw failure; } }, true), (error) => error === failure);
    assert.throws(() => build({ [Symbol.toPrimitive]: () => ({}) }, true), TypeError);
  });

  assertTest('state patch decoder accepts non-array objects without requiring a plain prototype', () => {
    const inherited = Object.create({ theme: 'inherited', autoLocation: 1 });
    const hidden = Object.defineProperty(Object.create(null), 'theme', { value: 'hidden' });
    [inherited, hidden, new Date(0), new Map(), new Number(1), Object.freeze({})].forEach((input) => {
      const command = decodeStatePatchCommand(input);
      assert.strictEqual(command.type, 'patch-state');
      assert.notStrictEqual(command.payload, input);
    });
    assert.deepStrictEqual(decodeStatePatchCommand(inherited).payload, { theme: 'inherited', autoLocation: true });
    assert.deepStrictEqual(decodeStatePatchCommand(hidden).payload, { theme: 'hidden' });
    [null, undefined, false, 1, 'object', Symbol('input'), [], () => {}].forEach((input) => {
      assert.strictEqual(decodeStatePatchCommand(input), null);
    });
  });

  assertTest('state patch decoder retains ordered repeated property reads and accessor failures', () => {
    const reads = [];
    const keywords = Object.freeze(['late']);
    const input = Object.defineProperties({}, {
      theme: { get: () => { reads.push('theme'); return 'visible'; } },
      excludedKeywords: { get: () => { reads.push('excludedKeywords'); return keywords; } },
      autoLocation: { get: () => { reads.push('autoLocation'); return 1; } },
      widgets: { get: () => { reads.push('widgets'); return reads.filter((item) => item === 'widgets').length === 1 ? {} : ['late']; } }
    });
    const command = decodeStatePatchCommand(input);
    assert.deepStrictEqual(reads, ['theme', 'theme', 'excludedKeywords', 'excludedKeywords',
      'autoLocation', 'autoLocation', 'widgets', 'widgets']);
    assert.deepStrictEqual(command.payload, { theme: 'visible', excludedKeywords: keywords,
      autoLocation: true, widgets: { 0: 'late' } });
    assert.strictEqual(command.payload.excludedKeywords, keywords);

    const failure = new Error('second widget read');
    let count = 0;
    const failing = Object.defineProperty({}, 'widgets', {
      get: () => { if (++count === 2) throw failure; return {}; }
    });
    assert.throws(() => decodeStatePatchCommand(failing), (error) => error === failure);
    assert.strictEqual(count, 2);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    assert.throws(() => decodeStatePatchCommand(revoked.proxy), TypeError);
  });

  assertTest('job command payloads become detached ordered category effect arrays', () => {
    [
      [decodeRecrawlCommand, 'start-recrawl-job'],
      [decodeVisionAnalysisCommand, 'start-vision-analysis-job']
    ].forEach(([decode, effectType]) => {
      [undefined, null, {}, { categories: ' Pool ' }, { categories: [' Pool ', 'Pool', '', 3] }].forEach((input) => {
        const command = decode(input);
        const result = reduceDomainCommand(createState(), command, { now: new Date(0), rng: () => 0 });
        const categories = command.payload.categories ?? [];
        assert.deepStrictEqual(result.effects, [{ type: effectType, payload: { categories } }]);
        assert.notStrictEqual(result.effects[0].payload.categories, categories);
        assert.deepStrictEqual(result.events, []);
      });
      assert.strictEqual(decode({ categories: [] }), null);
      assert.strictEqual(decode([]), null);
    });
    const result = reduceDomainCommand(createState(), {
      type: 'trigger-recrawl', payload: { categories: 'Pool' }
    });
    assert.deepStrictEqual(result.effects[0].payload, { categories: [] });
  });

  assertTest('photo library updates gate raw feed callbacks and preserve copies, aliases and flags', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.update = withUpdatedPhoto;`, sandbox);
    const metadata = {}, row = { url: 'same', category: 'A', metadata }, raw = { url: 'same', title: 7, metadata }, miss = { url: 'miss', metadata };
    const state = createState({ library: { collections: { A: [row] }, externalCollections: { E: [row] }, photosList: [raw, miss], compatibility: metadata } });
    const calls = [];
    const unchanged = sandbox.update(state, 'same', photo => (calls.push(photo), photo));
    assert.strictEqual(unchanged.state, state);
    assert.deepStrictEqual([unchanged.changed, unchanged.changedInCollections, unchanged.changedInExternalCollections], [false, false, false]);
    assert.strictEqual(calls.length, 2, 'no feed callback when both libraries are unchanged');
    calls.length = 0;
    const updated = sandbox.update(state, 'same', photo => (calls.push(photo), { ...photo, loved: true }));
    assert.deepStrictEqual([updated.changed, updated.changedInCollections, updated.changedInExternalCollections], [true, true, true]);
    assert.strictEqual(calls.length, 3);
    assert.strictEqual(calls[2].category, undefined, 'feed updater does not receive library category filling');
    assert.strictEqual(updated.state.library.photosList[0].title, 7);
    assert.strictEqual(updated.state.library.photosList[0].metadata, metadata);
    assert.notStrictEqual(updated.state.library.photosList[1], miss);
    assert.strictEqual(updated.state.library.photosList[1].metadata, metadata);
    assert.strictEqual(Object.hasOwn(updated.state.library, 'compatibility'), false, 'existing library rebuild drops extra container fields');
    assert.strictEqual(updated.state.config, state.config);
    const failure = new Error('feed updater');
    assert.throws(() => sandbox.update(state, 'same', photo => {
      photo.metadata.visited = true;
      if (photo.title === 7) throw failure;
      return { ...photo, loved: true };
    }), error => error === failure);
    assert.strictEqual(metadata.visited, true, 'nested callback effects are not rolled back');
    assert.strictEqual(row.loved, undefined);
  });

  assertTest('photo persistence filters raw own metadata before ordered library flag effects', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.helpers = { buildDefinedMetadataPatch, buildPhotoPersistenceEffects };`, sandbox);
    const { buildDefinedMetadataPatch: defined, buildPhotoPersistenceEffects: effects } = sandbox.helpers;
    const shared = {}, symbol = Symbol('ignored'), calls = [];
    const raw = Object.assign(Object.create({ inherited: 1 }), { rating: 'raw', cropPercent: undefined, detail: shared, [symbol]: true });
    const filtered = defined(raw);
    assert.deepStrictEqual(Object.keys(filtered), ['rating', 'detail']);
    assert.strictEqual(filtered.rating, 'raw');
    assert.strictEqual(filtered.detail, shared);
    assert.deepStrictEqual(Object.getOwnPropertySymbols(filtered), []);
    const metadata = { get rating() { calls.push('metadata'); return 0; }, cropPercent: undefined, detail: shared };
    const flags = { get changedInCollections() { calls.push('curated'); return true; }, get changedInExternalCollections() { calls.push('external'); return true; } };
    const result = effects({ url: 'u', metadata, updateResult: flags });
    assert.strictEqual(Array.from(result, effect => effect.type).join(','), 'persist,persist-external-photo-metadata');
    assert.deepStrictEqual(calls, ['metadata', 'curated', 'external']);
    assert.notStrictEqual(result[1].payload.metadata, metadata);
    assert.strictEqual(result[1].payload.metadata.rating, 0);
    assert.strictEqual(result[1].payload.metadata.detail, shared);
    assert.strictEqual(effects({ url: 'u', metadata: {}, updateResult: flags }).length, 1);
    const failure = new Error('metadata');
    assert.throws(() => effects({ url: 'u', metadata: { get rating() { throw failure; } },
      updateResult: { changedInCollections: false, changedInExternalCollections: false } }), error => error === failure);
  });

  assertTest('photo reduction clones before updates and finalizes before metadata and event resolution', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.reducePhoto = reducePhotoLibraryCommand;`, sandbox);
    const row = { url: 'u', category: 'A' }, calls = [], now = new Date(0);
    const state = createState({ library: { collections: { A: [row] }, externalCollections: {}, photosList: [row] } });
    const keywords = state.config.searchKeywords;
    Object.defineProperty(state.config, 'searchKeywords', { enumerable: true, get: () => (calls.push('clone'), keywords) });
    let finalized;
    const events = [{ type: 'photo-update' }];
    const result = sandbox.reducePhoto(state, { url: 'u', updater: photo => (calls.push('update'), { ...photo, loved: true }),
      metadata: { get loved() { calls.push('metadata'); return true; } }, env: { now },
      afterUpdate: (next, context) => {
        calls.push('finalize'); assert.notStrictEqual(next, state);
        assert.strictEqual(context.updateResult.state, next); assert.strictEqual(context.now, now);
        return finalized = { state: next, photoChanged: true };
      }, eventsFor: value => (calls.push('events'), assert.strictEqual(value, finalized), events) });
    assert.deepStrictEqual(calls, ['clone', 'clone', 'update', 'update', 'finalize', 'metadata', 'events']);
    assert.strictEqual(result.nextState, finalized.state);
    assert.strictEqual(result.events, events);
    const skipped = () => assert.fail('no-op continuation must not run');
    const noOp = sandbox.reducePhoto(state, { url: 'u', updater: photo => photo, metadata: { get loved() { return skipped(); } }, afterUpdate: skipped, eventsFor: skipped });
    assert.strictEqual(noOp.nextState, state);
    assert.strictEqual(noOp.events.length + noOp.effects.length, 0);
  });

  assertTest('isolated photo counterexamples retain payload-free persist and unvalidated patch spread behavior', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.reviewPhotos = { buildPhotoPersistenceEffects, buildPhotoCommandReducer };`, sandbox);
    const { buildPhotoPersistenceEffects: effects, buildPhotoCommandReducer: build } = sandbox.reviewPhotos;
    const persisted = effects({ url: 'u', metadata: { loved: true }, updateResult: { changedInCollections: true, changedInExternalCollections: false } });
    assert.strictEqual(persisted.length, 1);
    assert.strictEqual(persisted[0].type, 'persist');
    assert.strictEqual(Object.hasOwn(persisted[0], 'payload'), false);
    assert.throws(() => persisted[0].payload.url, error => error.name === 'TypeError');
    const row = Object.freeze({ url: 'u', title: 'original', category: 'A' });
    const state = createState({ library: { collections: { A: [row] }, externalCollections: {}, photosList: [row] } });
    const result = build({ buildPatch: () => ({ loved: true, url: 7, title: 9 }) })(state, { payload: { url: 'u' } });
    assert.strictEqual(result.nextState.library.collections.A[0].url, 7, 'typing repair must not add runtime validation');
    assert.strictEqual(result.nextState.library.collections.A[0].title, 9);
    assert.strictEqual(row.url, 'u');
    assert.strictEqual(row.title, 'original');
  });

  assertTest('photo assembly retains repeated payload reads, patch/finalizer aliases and raw feed fields', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.buildPhoto = buildPhotoCommandReducer;`, sandbox);
    const calls = [], payload = { loved: true }, patch = { loved: true }, token = {}, state = createState(), env = { now: new Date(0) };
    let options, reads = 0;
    const finalizer = () => assert.fail('assembly must not execute finalizer');
    sandbox.reducePhotoLibraryCommand = (received, value) => (calls.push('reduce'), assert.strictEqual(received, state), options = value, token);
    const reduce = sandbox.buildPhoto({ buildPatch: value => (calls.push('patch'), assert.strictEqual(value, payload), patch),
      resolveAfterUpdate: value => (calls.push('resolve'), assert.strictEqual(value, payload), finalizer) });
    const command = { get payload() { calls.push('payload'); return ++reads === 1 ? payload : { url: { toString: () => (calls.push('url'), 'u') } }; } };
    assert.strictEqual(reduce(state, command, env), token);
    assert.deepStrictEqual(calls, ['payload', 'patch', 'payload', 'url', 'resolve', 'reduce']);
    assert.strictEqual(options.metadata, patch);
    assert.strictEqual(options.afterUpdate, finalizer);
    assert.strictEqual(options.env, env);
    assert.strictEqual(options.url, 'u');
    const raw = { url: 'u', title: 7, rating: 'legacy' }, projected = options.updater(raw);
    assert.strictEqual(projected.title, 7);
    assert.strictEqual(projected.rating, 'legacy');
    assert.strictEqual(projected.loved, true);
    assert.notStrictEqual(projected, raw);
  });

  assertTest('photo commands describe exact external metadata patches after curated persistence', () => {
    const cases = [
      ['rate-photo', { rating: 7 }, { rating: 7 }],
      ['mark-photo-broken', {}, { rating: 1, isBroken: true }],
      ['set-photo-crop', { cropPercent: 0 }, { cropPercent: 0 }],
      ['set-photo-prevent-pairing', { preventPairing: true }, { preventPairing: true }],
      ['set-photo-loved', { loved: true }, { loved: true }],
      ['report-photo-metadata', { orientation: 'landscape', width: 100 }, { orientation: 'landscape', width: 100 }]
    ];
    cases.forEach(([type, fields, metadata]) => {
      const row = Object.freeze({ url: 'shared', category: 'Pool', rating: 5 });
      const state = createState({ library: { collections: { Pool: [row] }, externalCollections: { External: [row] } } });
      const before = JSON.stringify(state);
      const command = Object.freeze({ type, payload: Object.freeze({ url: 'shared', ...fields }) });
      const result = reduceDomainCommand(state, command, { now: new Date(0), rng: () => 0 });
      assert.deepStrictEqual(result.effects, [
        { type: 'persist' }, { type: 'persist-external-photo-metadata', payload: { url: 'shared', metadata } }
      ], type);
      assert.strictEqual(JSON.stringify(state), before, type);
    });
  });

  assertTest('environment-secret and payload-free effects retain distinct description shapes', () => {
    const state = createState();
    const command = Object.freeze({ type: 'save-env-secret', payload: Object.freeze({ envKey: ' TEST_KEY ', runtimeFlag: ' present ', value: ' value ' }) });
    const result = reduceDomainCommand(state, command);
    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.effects, [{ type: 'persist-env-vars', payload: {
      entries: { TEST_KEY: ' value ' }, runtimeFlags: { present: true }
    } }]);
    assert.deepStrictEqual(reduceDomainCommand(state, { type: 'save-env-secret', payload: { envKey: ' ', runtimeFlag: 'present' } }).effects, []);
    [true, false].forEach((active) => {
      const changed = createState({ runtime: { screensaverActive: !active, browserRunning: !active, manualOverride: !active } });
      const effect = reduceDomainCommand(changed, { type: 'set-screensaver-active', payload: { active } }).effects[0];
      assert.deepStrictEqual(effect, { type: active ? 'launch-kiosk' : 'kill-kiosk' });
      assert.strictEqual(Object.hasOwn(effect, 'payload'), false);
    });
  });

  assertTest('all exported domain selector functions document their shared inputs and results', () => {
    const source = fs.readFileSync(require.resolve('./selectors.js'), 'utf8');
    Object.entries(selectors).filter(([, value]) => typeof value === 'function').forEach(([name]) => {
      const prefix = source.slice(0, source.indexOf(`function ${name}(`));
      const contract = prefix.slice(prefix.lastIndexOf('/**'));
      assert.match(contract, /@param\s+\{/, name);
      assert.match(contract, /@returns\s+\{/, name);
      assert.ok(contract.endsWith('*/\n'), name);
    });
    ['CollectionsState', 'CurrentFrame', 'DomainState', 'Photo'].forEach((name) =>
      assert.ok(source.includes(`import('./types').${name}`), name));
    assert.match(source, /@typedef \{WeightedPhotoOptions<T> & SmartPreferences\} SmartFeedOptions/);
  });

  assertTest('selector normalization visibility dedupe and lookups preserve ordered row aliases', () => {
    const first = Object.freeze({ url: 'same', category: 'Pool', title: 'Keep' });
    const duplicate = Object.freeze({ url: 'same', title: 'Later' });
    const rows = Object.freeze([first, duplicate, { url: 'banned', rating: 1 }, { url: 'broken', isBroken: true }]);
    const visible = selectors.filterVisiblePhotos(rows, []);
    assert.deepStrictEqual(visible, rows.slice(0, 2));
    assert.notStrictEqual(visible, rows);
    assert.strictEqual(selectors.uniqByUrl(visible)[0], first);
    assert.deepStrictEqual(selectors.filterVisiblePhotos(rows, [' keep ']), rows.slice(1, 2));
    assert.deepStrictEqual(selectors.filterVisiblePhotos(null, []), []);
    assert.strictEqual(selectors.matchesExcludedKeywords([''], first), true);
    assert.strictEqual(selectors.matchesExcludedKeywords('keep', first), false);
    assert.deepStrictEqual(selectors.normalizeCategorySelection([' Liminal Space ', 'Liminal Spaces', 'Google Photos', 'bad'], ['Liminal Spaces']), ['Liminal Spaces', 'Google Photos']);
    assert.deepStrictEqual(selectors.normalizeCategorySelection(null, [], ' AI Creation '), ['AI Creations']);
    assert.strictEqual(selectors.normalizeCategoryName(null), '');
    assert.strictEqual(selectors.findPhotoInFeed(rows, 'same'), first);
    assert.strictEqual(selectors.getPhotoByUrl({ Pool: [first] }, 'same', { External: [duplicate] }), first);
    assert.strictEqual(selectors.findPhotoInFeed(undefined, 'same'), null);
    assert.strictEqual(selectors.getPhotoByUrl({}, 'missing'), null);
  });

  assertTest('generic list selectors retain aliases and pure filter composition laws', () => {
    const rows = Object.freeze([Object.freeze({ url: 'a' }), Object.freeze({ url: 'b', title: 'b' }), Object.freeze({ url: 'a' })]);
    let draws = 0;
    const shuffled = selectors.shuffleWithRng(rows, () => { draws += 1; return 0; });
    assert.deepStrictEqual(shuffled, [rows[1], rows[2], rows[0]]);
    assert.strictEqual(draws, rows.length - 1);
    assert.notStrictEqual(shuffled, rows);
    assert.deepStrictEqual(selectors.interleaveLists([[rows[0]], [rows[1], rows[2]]]), [rows[0], rows[1], rows[0], rows[2]]);
    assert.deepStrictEqual(selectors.interleaveLists([]), []);
    assert.deepStrictEqual(selectors.interleaveLists([[], [rows[0]]]), [undefined, rows[0]]);
    const unique = selectors.uniqByUrl(rows);
    assert.deepStrictEqual(selectors.uniqByUrl(unique), unique);
    const visible = selectors.filterVisiblePhotos(rows, []);
    assert.deepStrictEqual(selectors.filterVisiblePhotos(visible, []), visible);
    assert.deepStrictEqual(selectors.filterVisiblePhotos([...rows, ...rows], ['b']), [rows[0], rows[2], rows[0], rows[2]]);
    assert.notStrictEqual(selectors.uniqByUrl(unique), unique); // Value-idempotent, not reference-idempotent.
  });

  assertTest('visibility filtering preserves raw row aliases and native predicate behavior', () => {
    const url = Object.freeze({ id: 42 });
    const first = Object.freeze({ url, title: 9, author: false, category: 'Pool', rating: '1', nested: Object.freeze({ marker: true }) });
    const second = Object.freeze({ url: 7, title: 'other', isBroken: 0 });
    const rows = Object.freeze([null, first, second, { url: 'rated', rating: 1 }, { url: 'broken', isBroken: 'false' }, { url: 0 }, undefined]);
    const visible = selectors.filterVisiblePhotos(rows);
    assert.deepStrictEqual(visible, [first, second]);
    assert.notStrictEqual(visible, rows);
    assert.strictEqual(visible[0], first);
    assert.strictEqual(visible[0].url, url);
    assert.strictEqual(visible[0].nested, first.nested);
    assert.deepStrictEqual(selectors.filterVisiblePhotos(rows, [' 9 ']), [second]);
    assert.deepStrictEqual(selectors.filterVisiblePhotos([...rows, ...rows], ['other']), [first, first]);
    assert.deepStrictEqual(selectors.filterVisiblePhotos(visible), visible);
    const failure = new Error('visibility title getter');
    const accessor = { url: 'accessor', get title() { throw failure; } };
    assert.strictEqual(selectors.filterVisiblePhotos([accessor])[0], accessor);
    assert.throws(() => selectors.filterVisiblePhotos([accessor], ['x']), (error) => error === failure);
    assert.throws(() => selectors.filterVisiblePhotos([{ url: 'symbol', title: Symbol('title') }], ['x']), TypeError);
  });

  assertTest('visibility and deduplication predicates preserve access order and short circuits', () => {
    const reads = [];
    const url = { [Symbol.toPrimitive]() { throw new Error('unexpected URL coercion'); } };
    const row = {
      get url() { reads.push('url'); return url; },
      get rating() { reads.push('rating'); return 0; },
      get isBroken() { reads.push('broken'); return false; },
      get title() { reads.push('title'); return 'keep'; },
      get author() { reads.push('author'); return ''; },
      get category() { reads.push('category'); return ''; }
    };
    assert.strictEqual(selectors.filterVisiblePhotos([null, row, undefined], ['exclude'])[0], row);
    assert.deepStrictEqual(reads, ['url', 'rating', 'broken', 'title', 'author', 'category']);
    reads.length = 0;
    assert.strictEqual(selectors.uniqByUrl([null, row, row, undefined])[0], row);
    assert.deepStrictEqual(reads, ['url', 'url', 'url', 'url', 'url']);
    const failure = new Error('unexpected later read');
    const noUrl = { url: 0, get rating() { throw failure; } };
    const rated = { url: 'rated', rating: 1, get isBroken() { throw failure; } };
    const broken = { url: 'broken', isBroken: true, get title() { throw failure; } };
    assert.deepStrictEqual(selectors.filterVisiblePhotos([noUrl, rated, broken], ['exclude']), []);
    const urlFailure = new Error('URL getter');
    const throwing = { get url() { throw urlFailure; } };
    assert.throws(() => selectors.filterVisiblePhotos([throwing]), (error) => error === urlFailure);
    assert.throws(() => selectors.uniqByUrl([throwing]), (error) => error === urlFailure);
  });

  assertTest('feed lookup preserves unnormalized rows and native strict matching', () => {
    const url = Object.freeze({ id: 42 });
    const first = Object.freeze({ url, title: 9, nested: Object.freeze({ value: true }) });
    const duplicate = Object.freeze({ url, title: 'later' });
    const rows = Object.freeze([first, duplicate, Object.freeze({ url: 42 }), Object.freeze({})]);
    assert.strictEqual(selectors.findPhotoInFeed(rows, url), first);
    assert.strictEqual(selectors.findPhotoInFeed(rows, { id: 42 }), null);
    assert.strictEqual(selectors.findPhotoInFeed(rows, '42'), null);
    assert.strictEqual(selectors.findPhotoInFeed(rows, 42), rows[2]);
    assert.strictEqual(selectors.findPhotoInFeed(rows, undefined), rows[3]);
    assert.strictEqual(selectors.findPhotoInFeed([null, rows[3]], undefined), null);
    assert.strictEqual(selectors.findPhotoInFeed(null, url), null);
    const failure = new Error('lookup URL getter');
    assert.throws(() => selectors.findPhotoInFeed([{ get url() { throw failure; } }], url), (error) => error === failure);
    assert.strictEqual(first.nested, rows[0].nested);
  });

  assertTest('URL deduplication preserves raw rows and native Set equality', () => {
    const url = Object.freeze({ id: 42 });
    const first = Object.freeze({ url, title: 9, nested: Object.freeze({ marker: true }) });
    const other = Object.freeze({ url: Object.freeze({ id: 42 }), title: false });
    const number = Object.freeze({ url: 42 });
    const rows = Object.freeze([null, first, Object.freeze({ url }), other, number,
      Object.freeze({ url: 42 }), Object.freeze({ url: 0 }), Object.freeze({ url: NaN }), undefined]);
    const unique = selectors.uniqByUrl(rows);
    assert.deepStrictEqual(unique, [first, other, number]);
    assert.strictEqual(unique[0], first);
    assert.strictEqual(unique[0].nested, first.nested);
    assert.notStrictEqual(unique, rows);
    assert.deepStrictEqual(selectors.uniqByUrl(unique), unique);
    assert.deepStrictEqual(selectors.uniqByUrl([]), []);
    let reads = 0;
    const accessor = { get url() { reads += 1; return 'accessor'; } };
    assert.strictEqual(selectors.uniqByUrl([accessor])[0], accessor);
    assert.strictEqual(reads, 3);
    const failure = new Error('dedupe URL getter');
    assert.throws(() => selectors.uniqByUrl([{ get url() { throw failure; } }]), (error) => error === failure);
  });

  assertTest('balanced feed contracts preserve external override first URL ownership and immutable copies', () => {
    const shared = Object.freeze({ url: 'shared', title: 'External' });
    const curated = Object.freeze({ url: 'curated' });
    const options = Object.freeze({
      selectedCategories: Object.freeze(['A', 'B', 'C']),
      collections: Object.freeze({ A: Object.freeze([curated]), B: Object.freeze([{ url: 'shared', title: 'B' }, { url: 'b' }]), C: Object.freeze([curated]) }),
      externalCollections: Object.freeze({ A: Object.freeze([shared]), C: Object.freeze([]) }),
      rng: () => 0.99
    });
    const before = JSON.stringify(options);
    const feed = buildBalancedFeed(options);
    assert.deepStrictEqual(feed.map(({ url, category }) => [url, category]), [['shared', 'A'], ['b', 'B']]);
    assert.notStrictEqual(feed[0], shared);
    assert.strictEqual(shared.category, undefined);
    assert.deepStrictEqual(buildBalancedFeed(options), feed);
    assert.strictEqual(JSON.stringify(options), before);
  });

  assertTest('time weather and night selector contracts preserve boundaries identities and conditional draws', () => {
    [
      ['08:00', '08:00', '18:00', true], ['18:00', '08:00', '18:00', false],
      ['00:00', '18:00', '06:00', true], ['06:00', '18:00', '06:00', false],
      ['08:00', '08:00', '08:00', false], ['bad', '08:00', '18:00', false]
    ].forEach(([now, start, end, expected]) => assert.strictEqual(selectors.isTimeInSchedule(now, start, end), expected));
    const rows = Object.freeze([Object.freeze({ url: 'snow', isSnowy: true, isNight: true }), Object.freeze({ url: 'sun', isSunny: true })]);
    const noDraw = () => assert.fail('identity branch must not draw');
    assert.strictEqual(filterPhotosForWeather(rows, false, 'Snowy', 'Sunny', noDraw), rows);
    assert.strictEqual(filterPhotosForWeather(rows, true, 'Rainy', 'Sunny', noDraw), rows);
    assert.strictEqual(filterPhotosForWeather(rows, true, 'Snowy', 'Sunny', () => 0.8), rows);
    assert.deepStrictEqual(filterPhotosForWeather(rows, true, 'Snowy', 'Sunny', () => 0.799), [rows[0]]);
    assert.strictEqual(filterPhotosForNight(rows, true, false, 100, noDraw), rows);
    assert.strictEqual(filterPhotosForNight(rows, true, true, null, () => 0.5), rows);
    assert.deepStrictEqual(filterPhotosForNight(rows, true, true, null, () => 0.499), [rows[0]]);
    const timed = Object.freeze([...rows, Object.freeze({ url: 'timed', timeRanges: [{ start: '08:00', end: '18:00' }] })]);
    assert.deepStrictEqual(filterPhotosForTime(timed, new Date(2026, 0, 1, 18)), rows);
  });

  assertTest('smart selectors rotate time-eligible pools before preferences and preserve zero-weight aliases', () => {
    const photos = Object.freeze([
      Object.freeze({ url: 'a', category: 'A', rating: 0 }),
      Object.freeze({ url: 'b', category: 'B', isSunny: true }),
      Object.freeze({ url: 'b2', category: 'B', isNight: true, isSunny: true }),
      Object.freeze({ url: 'closed', category: 'C', timeRanges: [{ start: '18:00', end: '06:00' }] })
    ]);
    const options = Object.freeze({ photos, now: new Date(2026, 0, 1, 9), rng: () => 0, alignWeather: true, newsMatch: 'Sunny', alignTimeOfDay: true, isNight: true, nightPercentage: 100 });
    const choose = (previousCategory, direction = 'next') => selectors.selectSmartPhotoFromFeed({ ...options, previousCategory, direction });
    assert.strictEqual(choose('A'), photos[2]);
    assert.strictEqual(choose('B'), photos[0]);
    assert.strictEqual(choose('A', 'prev'), photos[2]);
    assert.strictEqual(selectWeightedRandomPhoto({ photos: [photos[0]], rng: () => assert.fail('zero weight must not draw') }), photos[0]);
    assert.strictEqual(selectWeightedRandomPhoto({ photos: [photos[1], photos[2]], currentPhotoUrl: 'b', rng: () => 0 }), photos[2]);
    assert.strictEqual(selectors.selectSmartPhotoFromFeed({ ...options, photos: [] }), null);
    const state = createState({ library: { photosList: photos.slice(1, 3) }, config: { alignTimeOfDay: true, nightPercentage: 100 }, runtime: { weather: { current: { is_day: 0 } } }, playback: { activePhotoUrl: null } });
    assert.strictEqual(selectSmartPhoto({ state, now: options.now, rng: options.rng }), photos[2]);
  });

  assertTest('smart selection preserves raw staged rows and pool-key identity', () => {
    const category = Object.freeze({ pool: 'raw' });
    const metadata = Object.freeze({ marker: true });
    const preview = { url: 'smart-preview', category, title: 9, rating: '5', metadata };
    const staged = reduceDomainCommand(createState(), { type: 'set-active-photo', payload: { url: preview.url, photo: preview } }).nextState;
    const row = staged.library.photosList.find((photo) => photo.url === preview.url);
    const other = Object.freeze({ url: 'other', category: 'other', rating: 0 });
    const photos = Object.freeze([row, other]);
    const state = { ...staged, library: { ...staged.library, photosList: photos } };
    const options = { photos, now: new Date(2026, 0, 1, 9), rng: () => 0 };
    assert.strictEqual(selectSmartPhoto({ state, ...options }), other);
    assert.strictEqual(selectors.selectSmartPhotoFromFeed({ ...options, previousCategory: 'other' }), row);
    assert.strictEqual(selectors.selectSmartPhotoFromFeed({ ...options, previousCategory: category }), other);
    assert.strictEqual(selectors.selectSmartPhotoFromFeed({ ...options, previousCategory: { pool: 'raw' } }), row);
    assert.strictEqual(row.metadata, metadata);
    assert.strictEqual(row.title, 9);
    assert.strictEqual(state.library.photosList, photos);
    assert.strictEqual(selectors.selectSmartPhotoFromFeed({ ...options, photos: [{ url: 'hidden', isBroken: true }] }), null);
  });

  assertTest('smart selection retains native rating and schedule coercion failures', () => {
    const now = new Date(2026, 0, 1, 9);
    const failure = new Error('rating coercion');
    const rating = { valueOf: () => { throw failure; } };
    assert.throws(() => selectWeightedRandomPhoto({ photos: [{ url: 'raw', rating }], rng: () => 0 }), error => error === failure);
    assert.throws(() => selectors.selectSmartPhotoFromFeed({ photos: [{ url: 'raw', timeRanges: [null] }], now, rng: () => 0 }), TypeError);
    const coerced = { url: 'raw', rating: '0', timeRanges: 'ignored' };
    assert.strictEqual(selectors.selectSmartPhotoFromFeed({ photos: [coerced], now, rng: () => assert.fail('zero weight must not draw') }), coerced);
  });

  assertTest('night and rating division retain native numeric coercion and evaluation order', () => {
    const events = [];
    const numeric = (value) => Object.freeze({
      [Symbol.toPrimitive]: (hint) => { events.push(`coerce:${hint}`); return value; }
    });
    const rows = Object.freeze([Object.freeze({ url: 'day' }), Object.freeze({ url: 'night', isNight: true })]);
    const percentage = numeric('75');
    assert.deepStrictEqual(filterPhotosForNight(rows, true, true, percentage, () => { events.push('rng'); return 0.5; }), [rows[1]]);
    assert.deepStrictEqual(events, ['rng', 'coerce:number']);

    events.length = 0;
    const weighted = Object.freeze([
      Object.freeze({ url: 'first', rating: numeric('5') }),
      Object.freeze({ url: 'second', rating: numeric('10') })
    ]);
    assert.strictEqual(selectWeightedRandomPhoto({ photos: weighted, rng: () => { events.push('rng'); return 0.5; } }), weighted[1]);
    assert.deepStrictEqual(events, ['coerce:number', 'coerce:number', 'rng']);

    [false, '', '75', 'invalid', Infinity, -0].forEach((value) => {
      const selected = filterPhotosForNight(rows, true, true, value, () => 0.4);
      assert.strictEqual(selected === rows, !(0.4 < (value / 100)));
    });
  });

  assertTest('night and rating division preserve native and user coercion failures', () => {
    const rows = Object.freeze([Object.freeze({ url: 'night', isNight: true })]);
    const failure = new Error('coercion failed');
    const invalidValues = [Symbol('rating'), 1n, Object.freeze({ [Symbol.toPrimitive]: () => { throw failure; } })];
    const capture = (operation) => {
      try { operation(); }
      catch (error) { return error; }
      assert.fail('expected native division to throw');
    };
    invalidValues.forEach((value) => {
      const nativeError = capture(() => value / 100);
      const nightError = capture(() => filterPhotosForNight(rows, true, true, value, () => 0));
      const ratingError = capture(() => selectWeightedRandomPhoto({ photos: [{ url: 'weighted', rating: value }], rng: () => 0 }));
      [nightError, ratingError].forEach((error) => {
        assert.strictEqual(error.constructor, nativeError.constructor);
        assert.strictEqual(error.message, nativeError.message);
        if (value === invalidValues[2]) assert.strictEqual(error, failure);
      });
    });
  });

  assertTest('sequential selector reads per-pool cursors without advancing them or applying schedules', () => {
    const photos = [{ url: 'a', category: 'A' }, { url: 'b', category: 'B' }, { url: 'b2', category: 'B', timeRanges: [{ start: '00:00', end: '00:00' }] }];
    const state = createState({ library: { photosList: photos }, playback: { activePhotoUrl: 'a', poolSequenceCursors: { B: 1 } } });
    const before = JSON.stringify(state);
    assert.strictEqual(selectors.selectSequentialPhoto({ state }), photos[2]);
    assert.strictEqual(selectors.selectSequentialPhoto({ state, direction: 'prev' }), photos[1]);
    assert.strictEqual(JSON.stringify(state), before);
    assert.strictEqual(selectors.selectSequentialPhoto({ state: createState({ library: { photosList: [] } }) }), null);
  });

  assertTest('sequential selection retains raw feed aliases and rotates pools without normalizing metadata', () => {
    const category = Object.freeze({ toString: () => 'raw-pool' });
    const metadata = Object.freeze({ marker: true });
    const photos = Object.freeze([
      Object.freeze({ url: 'first', category: 'A', title: 12 }),
      Object.freeze({ url: 'second', category, title: 42, width: 'wide', metadata }),
      Object.freeze({ url: 'third', category, title: false, metadata }),
      Object.freeze({ url: 'hidden', category, isBroken: 'yes' })
    ]);
    const cursors = Object.freeze({ 'raw-pool': 1 });
    const state = createState({ library: { photosList: photos }, playback: { activePhotoUrl: 'first', poolSequenceCursors: cursors } });
    const selected = selectors.selectSequentialPhoto({ state });
    assert.strictEqual(selected, photos[2]);
    assert.strictEqual(selected.metadata, metadata);
    assert.strictEqual(selected.title, false);
    assert.strictEqual(selectors.selectSequentialPhoto({ state, direction: 'prev' }), photos[1]);
    assert.strictEqual(state.playback.poolSequenceCursors, cursors);
    assert.strictEqual(state.library.photosList, photos);
  });

  assertTest('sequential cursor lookup preserves native symbol keys and coercion order', () => {
    const key = Symbol('pool');
    const events = [];
    const category = { [Symbol.toPrimitive]: (hint) => { events.push(`coerce:${hint}`); return key; } };
    const photos = [{ url: 'first', category: 'A' }, { url: 'second', category }, { url: 'third', category }];
    const cursors = new Proxy({ [key]: 1, [String(key)]: 0 }, {
      get: (target, property) => { events.push(property); return Reflect.get(target, property); }
    });
    const state = createState({ library: { photosList: photos }, playback: { activePhotoUrl: 'first', poolSequenceCursors: cursors } });
    assert.strictEqual(selectors.selectSequentialPhoto({ state }), photos[2]);
    assert.deepStrictEqual(events, ['coerce:string', key]);
    assert.strictEqual(state.playback.poolSequenceCursors, cursors);

    const directPhotos = [{ url: 'first', category: 'A' }, { url: 'second', category: key }, { url: 'third', category: key }];
    const directState = createState({ library: { photosList: directPhotos }, playback: { activePhotoUrl: 'first', poolSequenceCursors: cursors } });
    events.length = 0;
    assert.strictEqual(selectors.selectSequentialPhoto({ state: directState }), directPhotos[2]);
    assert.deepStrictEqual(events, [key]);
  });

  assertTest('sequential cursor lookup short-circuits nullish cursors and propagates key failures', () => {
    const failure = new Error('key coercion failed');
    let calls = 0;
    const category = { [Symbol.toPrimitive]: () => { calls += 1; throw failure; } };
    const photos = [{ url: 'first', category: 'A' }, { url: 'second', category }, { url: 'third', category }];
    const makeState = (poolSequenceCursors) => createState({ library: { photosList: photos }, playback: { activePhotoUrl: 'first', poolSequenceCursors } });
    [null, undefined].forEach((cursors) => {
      assert.strictEqual(selectors.selectSequentialPhoto({ state: makeState(cursors) }), photos[1]);
      assert.strictEqual(calls, 0);
    });
    assert.throws(() => selectors.selectSequentialPhoto({ state: makeState({}) }), (error) => error === failure);
    assert.strictEqual(calls, 1);
  });

  assertTest('sequential selection preserves staged preview rows and null when all rows are hidden', () => {
    const preview = { url: 'preview-raw', title: 9, width: 'wide', metadata: { shared: true } };
    const staged = reduceDomainCommand(createState(), { type: 'set-active-photo', payload: { url: preview.url, photo: preview } }).nextState;
    const row = staged.library.photosList.find((photo) => photo.url === preview.url);
    const selected = selectors.selectSequentialPhoto({ state: { ...staged, library: { ...staged.library, photosList: [row] }, playback: { ...staged.playback, activePhotoUrl: null } } });
    assert.strictEqual(selected, row);
    assert.strictEqual(selected.title, 9);
    assert.strictEqual(selected.metadata, preview.metadata);
    const hidden = createState({ library: { photosList: [{ url: 'excluded', rating: 1 }, { title: 'missing URL' }] } });
    assert.strictEqual(selectors.selectSequentialPhoto({ state: hidden }), null);
  });

  assertTest('library update contracts retain last-match precedence and shallow no-op semantics', () => {
    const first = Object.freeze({ url: 'same', category: 'A', rating: 4 });
    const last = Object.freeze({ url: 'same', category: 'B', rating: 5 });
    const collections = Object.freeze({ A: Object.freeze([first]) });
    const external = Object.freeze({ B: Object.freeze([last]) });
    const noOp = selectors.updatePhotoInCollections(collections, 'same', photo => photo);
    assert.strictEqual(noOp.changed, false);
    assert.strictEqual(noOp.updatedPhoto, first);
    assert.notStrictEqual(noOp.collections.A[0], first);
    const updated = selectors.updatePhotoInLibraries(collections, external, 'same', photo => ({ ...photo, rating: 5 }));
    assert.strictEqual(updated.changedInCollections, true);
    assert.strictEqual(updated.changedInExternalCollections, false);
    assert.strictEqual(updated.changed, true);
    assert.strictEqual(updated.updatedPhoto, last);
    const externalOnly = selectors.updatePhotoInLibraries({ A: [last] }, { B: [first] }, 'same', photo => ({ ...photo, rating: 5 }));
    assert.deepStrictEqual([externalOnly.changedInCollections, externalOnly.changedInExternalCollections, externalOnly.changed], [false, true, true]);
    assert.strictEqual(externalOnly.updatedPhoto, externalOnly.externalCollections.B[0]);
    assert.strictEqual(first.rating, 4);
    assert.strictEqual(selectors.updatePhotoInCollections(collections, 'missing', () => assert.fail('miss must not update')).updatedPhoto, null);
    const failure = new Error('updater');
    assert.throws(() => selectors.updatePhotoInLibraries(collections, external, 'same', () => { throw failure; }), error => error === failure);
  });

  assertTest('private record equality preserves strict values, own-key asymmetry and native failures', () => {
    const sandbox = { module: { exports: {} } };
    runInNewContext(`${fs.readFileSync(require.resolve('./selectors.js'), 'utf8')}\nglobalThis.equal = shallowEqualRecords;`, sandbox);
    const { equal } = sandbox, symbol = Symbol('ignored'), shared = {};
    assert.strictEqual(equal(shared, shared), true);
    assert.strictEqual(equal({ value: NaN }, { value: NaN }), false);
    assert.strictEqual(equal({ value: -0 }, { value: 0 }), true);
    assert.strictEqual(equal({ value: shared }, { value: shared }), true);
    assert.strictEqual(equal({ value: [] }, { value: [] }), false);
    assert.strictEqual(equal({ [symbol]: 1 }, { [symbol]: 2 }), true);
    const inherited = Object.assign(Object.create({ a: 1 }), { b: 2 });
    assert.strictEqual(equal({ a: 1 }, inherited), true);
    assert.strictEqual(equal(inherited, { a: 1 }), false);
    assert.strictEqual(equal({ a: undefined }, { b: undefined }), true);
    assert.strictEqual(equal(null, false), true);
    assert.strictEqual(equal('ab', { 0: 'a', 1: 'b' }), true);
    const failure = new Error('read'), reads = [];
    const left = { get a() { reads.push('left'); return 1; }, get b() { throw failure; } };
    const right = { get a() { reads.push('right'); return 2; }, b: 0 };
    assert.strictEqual(equal(left, right), false);
    assert.deepStrictEqual(reads, ['left', 'right']);
    assert.throws(() => equal(left, { a: 1, b: 0 }), error => error === failure);
    assert.throws(() => equal(new Proxy({}, { ownKeys: () => { throw failure; } }), {}), error => error === failure);
  });

  assertTest('category projections retain shallow metadata and nullish external lookup precedence', () => {
    const sandbox = { module: { exports: {} } };
    runInNewContext(`${fs.readFileSync(require.resolve('./selectors.js'), 'utf8')}\nglobalThis.tag = attachCategory; globalThis.lookup = getCategoryPhotos;`, sandbox);
    const metadata = {}, symbol = Symbol('metadata'), photo = Object.freeze({ url: 'u', category: 'A', metadata, [symbol]: metadata });
    const tagged = sandbox.tag('B', photo), equal = sandbox.tag('A', photo);
    assert.notStrictEqual(equal, photo);
    assert.strictEqual(tagged.category, 'B');
    assert.strictEqual(tagged.metadata, metadata);
    assert.strictEqual(tagged[symbol], metadata);
    const inherited = Object.assign(Object.create({ category: 'A' }), { url: 'u' });
    assert.strictEqual(Object.hasOwn(sandbox.tag('A', inherited), 'category'), false);
    let reads = 0;
    sandbox.tag('A', { url: 'u', get category() { reads += 1; return 'A'; } });
    assert.strictEqual(reads, 2, 'equality reads category before spread reads it again');
    const curated = [photo], external = [];
    assert.strictEqual(sandbox.lookup('A', { A: curated }, { A: external }), external);
    assert.strictEqual(sandbox.lookup('A', { A: curated }, { A: null }), curated);
    assert.strictEqual(sandbox.lookup('A', { A: curated }, undefined), curated);
    assert.strictEqual(sandbox.lookup('A', {}, Object.create({ A: curated })), curated);
    assert.notStrictEqual(sandbox.lookup('missing', {}), sandbox.lookup('missing', {}));
    assert.throws(() => sandbox.lookup('A', {}, null), error => error.name === 'TypeError');
    const failure = new Error('category');
    assert.throws(() => sandbox.tag('A', { get category() { throw failure; } }), error => error === failure);
    assert.throws(() => sandbox.lookup('A', {}, { get A() { throw failure; } }), error => error === failure);
  });

  assertTest('named library traversal copies misses and no-ops, retains holes and last-match aliases', () => {
    const metadata = {}, symbol = Symbol('pool');
    const miss = Object.freeze({ url: 'miss', title: 17, metadata });
    const first = Object.freeze({ url: 'same', category: null, rating: 4, metadata });
    const last = Object.freeze({ url: 'same', category: 'own', rating: 5, metadata });
    const rows = Object.freeze(Object.assign(Array(6), { 0: miss, 1: first, 3: null, 4: false, 5: undefined }));
    const collections = Object.freeze(Object.assign(Object.create({ inherited: [last] }), {
      B: rows, A: Object.freeze([last]), empty: null, [symbol]: [last]
    }));
    const calls = [];
    const result = selectors.updatePhotoInCollections(collections, 'same', photo => {
      calls.push(photo);
      return { ...photo, rating: 5 };
    });
    assert.deepStrictEqual(calls.map(photo => photo.category), ['B', 'own']);
    assert.notStrictEqual(calls[0], first);
    assert.notStrictEqual(calls[1], last);
    assert.deepStrictEqual(Object.keys(result.collections), ['B', 'A', 'empty']);
    assert.deepStrictEqual(Object.getOwnPropertySymbols(result.collections), []);
    assert.notStrictEqual(result.collections.B, rows);
    assert.notStrictEqual(result.collections.B[0], miss);
    assert.strictEqual(result.collections.B[0].title, 17);
    assert.strictEqual(result.collections.B[0].metadata, metadata);
    assert.strictEqual(result.collections.B[1].metadata, metadata);
    assert.strictEqual(2 in result.collections.B, false);
    assert.deepStrictEqual(result.collections.B.slice(3), [null, false, undefined]);
    assert.deepStrictEqual(result.collections.empty, []);
    assert.strictEqual(result.changed, true);
    assert.strictEqual(result.updatedPhoto, last);
    assert.notStrictEqual(result.collections.A[0], last);
    assert.strictEqual(first.category, null);
    const absent = selectors.updatePhotoInCollections({ A: [last] }, 'miss', () => assert.fail('no callback on miss'));
    assert.strictEqual(absent.changed, false);
    assert.strictEqual(absent.updatedPhoto, null);
    assert.notStrictEqual(absent.collections.A[0], last);
  });

  assertTest('library callbacks follow enumeration and curated/external order without rollback', () => {
    const calls = [], metadata = {}, failure = new Error('callback');
    const first = { url: 'u', category: 'first', metadata }, last = { url: 'u', category: 'last', metadata };
    const curated = { get 10() { calls.push('enum 10'); return [last]; }, get 2() { calls.push('enum 2'); return [first]; } };
    const external = { get E() { calls.push('enum external'); return [last]; } };
    assert.throws(() => selectors.updatePhotoInLibraries(curated, external, 'u', photo => {
      calls.push(photo.category);
      photo.metadata.visited = true;
      if (calls.includes('enum external')) throw failure;
      return { ...photo, loved: true };
    }), error => error === failure);
    assert.deepStrictEqual(calls, ['enum 2', 'enum 10', 'first', 'last', 'enum external', 'last']);
    assert.strictEqual(metadata.visited, true, 'nested callback effects remain visible on failure');
    assert.strictEqual(first.loved, undefined);
    calls.length = 0;
    const broken = { get A() { calls.push('enum A'); return [first]; }, get B() { throw failure; } };
    assert.throws(() => selectors.updatePhotoInCollections(broken, 'u', () => calls.push('callback')), error => error === failure);
    assert.deepStrictEqual(calls, ['enum A'], 'Object.entries reads all pool values before the first callback');
    const defaulted = selectors.updatePhotoInLibraries({ A: [first] }, undefined, 'u', photo => photo);
    assert.strictEqual(defaulted.changedInExternalCollections, false);
    assert.deepStrictEqual(defaulted.externalCollections, {});
    assert.throws(() => selectors.updatePhotoInLibraries({}, null, 'u', photo => photo), error => error.name === 'TypeError');
  });

  assertTest('frame selectors preserve feed-first aliases detached categories and zero crop values', () => {
    const primary = { url: 'port-1', category: 'Liminal Spaces', orientation: 'portrait', cropPercent: 0, cropPositionY: 0 };
    const secondary = { url: 'port-2', category: 'Liminal Spaces', width: 1, height: 2, cropPercent: 0 };
    const state = createState({ library: { photosList: [primary, secondary] } });
    const before = JSON.stringify(state);
    const frame = deriveCurrentFrame(state);
    assert.strictEqual(selectors.getActivePhoto(state), primary);
    assert.strictEqual(frame.primary, primary);
    assert.strictEqual(frame.secondary, secondary);
    assert.deepStrictEqual(frame.crop, { primaryPercent: 0, primaryPositionY: 0, secondaryPercent: 0, secondaryPositionY: null });
    assert.notStrictEqual(frame.context.categories, state.playback.selectedCategories);
    assert.deepStrictEqual(deriveCurrentFrame(state), frame);
    assert.strictEqual(JSON.stringify(state), before);
    assert.strictEqual(selectors.inferOrientation({ url: 'square', width: 2, height: 2 }), 'landscape');
    assert.strictEqual(selectors.inferOrientation(null), 'unknown');
    assert.strictEqual(selectors.getActivePhoto(createState({ playback: { activePhotoUrl: null } })), null);
  });

  assertTest('active photo lookup preserves unvalidated preview aliases and library fallback precedence', () => {
    const metadata = Object.freeze({ shared: true });
    const preview = { url: 'raw-active', title: 7, orientation: 'sideways', width: '1', height: 2, metadata };
    const staged = reduceDomainCommand(createState(), { type: 'set-active-photo', payload: { url: preview.url, photo: preview } }).nextState;
    const stagedRow = staged.library.photosList.find((photo) => photo.url === preview.url);
    const curated = Object.freeze({ url: preview.url, title: 'curated' });
    const external = Object.freeze({ url: preview.url, title: 'external' });
    const library = { ...staged.library, collections: { A: [curated] }, externalCollections: { B: [external] } };
    const state = { ...staged, library };
    assert.strictEqual(selectors.getActivePhoto(state), stagedRow);
    assert.strictEqual(selectors.getActivePhoto(state).metadata, metadata);
    assert.strictEqual(selectors.inferOrientation(stagedRow), 'unknown');
    const noFeed = { ...state, library: { ...library, photosList: [] } };
    assert.strictEqual(selectors.getActivePhoto(noFeed), curated);
    assert.strictEqual(selectors.getActivePhoto({ ...noFeed, library: { ...noFeed.library, collections: {} } }), external);
    assert.strictEqual(selectors.getActivePhoto({ ...noFeed, playback: { ...noFeed.playback, activePhotoUrl: 'missing' } }), null);
    assert.strictEqual(selectors.getActivePhoto({ ...noFeed, playback: { ...noFeed.playback, activePhotoUrl: '' } }), null);
    assert.strictEqual(state.library.photosList, staged.library.photosList);
  });

  assertTest('current frame and snapshot retain raw staged and paired photo aliases', () => {
    const category = Object.freeze({ legacy: 'pool' });
    const crop = Object.freeze({ legacy: 'crop' });
    const preview = { url: 'raw-preview', orientation: 'portrait', category, cropPercent: crop, cropPositionY: false };
    const staged = reduceDomainCommand(createState(), { type: 'set-active-photo', payload: { url: preview.url, photo: preview } }).nextState;
    const primary = staged.library.photosList.find((photo) => photo.url === preview.url);
    const secondary = Object.freeze({ url: 'raw-pair', orientation: 'portrait', category, cropPercent: 0, cropPositionY: crop });
    const state = { ...staged, library: { ...staged.library, photosList: [primary, secondary] } };
    const frame = deriveCurrentFrame(state);
    const snapshot = buildSnapshot(state);
    assert.strictEqual(frame.primary, primary);
    assert.strictEqual(frame.secondary, secondary);
    assert.strictEqual(frame.layout, 'split');
    assert.deepStrictEqual(frame.crop, { primaryPercent: crop, primaryPositionY: false, secondaryPercent: 0, secondaryPositionY: crop });
    assert.strictEqual(frame.context.category, category);
    assert.notStrictEqual(frame.context.categories, state.playback.selectedCategories);
    assert.strictEqual(snapshot.activePhoto, primary);
    assert.strictEqual(snapshot.activeSecondPhoto, secondary);
    assert.strictEqual(snapshot.currentFrame.primary, primary);
    assert.strictEqual(snapshot.currentFrame.secondary, secondary);
    assert.notStrictEqual(snapshot.photosList[0], primary);
    assert.strictEqual(snapshot.photosList[0].cropPercent, crop);
    assert.strictEqual(state.library.photosList[1], secondary);
  });

  assertTest('current frame preserves nullish defaults and native malformed URL failures', () => {
    const primary = { url: 'primary', orientation: 'portrait', category: 0, cropPercent: null };
    const secondary = { url: 7, orientation: 'portrait', category: 'other', cropPositionY: null };
    const state = createState({ config: { splitCropPercent: false }, library: { photosList: [primary, secondary] }, playback: { activePhotoUrl: 'primary' } });
    const frame = deriveCurrentFrame(state);
    assert.strictEqual(frame.secondary, secondary);
    assert.strictEqual(frame.context.category, 0);
    assert.deepStrictEqual(frame.crop, { primaryPercent: null, primaryPositionY: null, secondaryPercent: false, secondaryPositionY: null });
    const invalidPair = { ...state, library: { ...state.library, photosList: [primary, secondary, { url: 8, orientation: 'portrait' }] } };
    assert.throws(() => deriveCurrentFrame(invalidPair), TypeError);
    const noPrimary = { ...state, playback: { ...state.playback, activePhotoUrl: null } };
    assert.strictEqual(deriveCurrentFrame(noPrimary).primary, null);
    assert.strictEqual(deriveCurrentFrame(noPrimary).layout, 'single');
  });

  assertTest('pairing sort preserves dynamic URL method receiver, argument and result coercion', () => {
    const events = [];
    const firstUrl = Object.freeze({ id: 'first' });
    const secondUrl = {
      get localeCompare() {
        events.push('method');
        return function (other) {
          events.push(this === secondUrl && other === firstUrl ? 'call' : 'wrong call');
          return { valueOf: () => { events.push('result coercion'); return -1; } };
        };
      }
    };
    const primary = { url: 'primary', orientation: 'portrait' };
    const first = { get url() { events.push('first url'); return firstUrl; }, orientation: 'portrait' };
    const second = { get url() { events.push('second url'); return secondUrl; }, orientation: 'portrait' };
    const photos = Object.freeze([primary, first, second]);
    const state = createState({ library: { photosList: photos }, playback: { activePhotoUrl: 'primary' } });
    const frame = deriveCurrentFrame(state);
    assert.deepStrictEqual(events.slice(-5), ['second url', 'method', 'first url', 'call', 'result coercion']);
    assert.ok(frame.secondary === first || frame.secondary === second);
    assert.deepStrictEqual(photos, [primary, first, second]);
  });

  assertTest('pairing sort retains single-candidate short circuit and native failures', () => {
    const failure = new Error('comparison failed');
    const primary = { url: 'primary', orientation: 'portrait' };
    const malformed = { url: 7, orientation: 'portrait' };
    const state = createState({ library: { photosList: [primary, malformed] }, playback: { activePhotoUrl: 'primary' } });
    assert.strictEqual(deriveCurrentFrame(state).secondary, malformed);
    const withSecond = (url) => ({ ...state, library: { ...state.library, photosList: [primary, malformed, { url, orientation: 'portrait' }] } });
    assert.throws(() => deriveCurrentFrame(withSecond({ localeCompare: 42 })), TypeError);
    assert.throws(() => deriveCurrentFrame(withSecond({ get localeCompare() { throw failure; } })), (error) => error === failure);
    assert.throws(() => deriveCurrentFrame(withSecond({ localeCompare: () => ({ valueOf: () => { throw failure; } }) })), (error) => error === failure);
  });

  assertTest('orientation projection ignores malformed metadata without coercion and propagates accessors', () => {
    const noCoercion = Object.freeze({ valueOf: () => assert.fail('dimensions must not be coerced') });
    const rows = [
      [{ orientation: 'portrait', width: 9, height: 1 }, 'portrait'],
      [{ orientation: false, width: 1, height: 2 }, 'portrait'],
      [{ orientation: 'sideways', width: 2, height: 2 }, 'landscape'],
      [{ width: noCoercion, height: 2 }, 'unknown'],
      [{ width: NaN, height: 2 }, 'landscape'],
      [undefined, 'unknown']
    ];
    rows.forEach(([row, expected]) => assert.strictEqual(selectors.inferOrientation(row), expected));
    const failure = new Error('orientation access');
    assert.throws(() => selectors.inferOrientation({ get orientation() { throw failure; } }), error => error === failure);
  });

  assertTest('selector ambient defaults are undefined-only and injected failures propagate exactly', () => {
    const reads = [];
    const sandbox = { module: { exports: {} }, Date: class extends Date {
      constructor() { super(2026, 0, 1, 9); reads.push('date'); }
    }, Math: { get random() { reads.push('random'); return () => { reads.push('draw'); return 0; }; } } };
    runInNewContext(fs.readFileSync(require.resolve('./selectors.js'), 'utf8'), sandbox);
    const isolated = sandbox.module.exports;
    assert.strictEqual(isolated.selectSmartPhotoFromFeed({ photos: [] }), null);
    assert.deepStrictEqual(reads, ['date', 'random']);
    reads.length = 0;
    assert.throws(() => isolated.selectSmartPhotoFromFeed({ photos: [], now: null, rng: null }), error => error.name === 'TypeError');
    assert.deepStrictEqual(reads, []);
    const failure = new Error('random');
    assert.throws(() => selectors.selectSmartPhotoFromFeed({ photos: [{ url: 'one' }], now: new Date(2026, 0, 1, 9), rng: () => { throw failure; } }), error => error === failure);
  });

  assertTest('smart state selection forwards explicit nulls to native clock and conditional random operations', () => {
    const now = new Date(2026, 0, 1, 9);
    const empty = createState({ library: { photosList: [] } });
    const zeroWeight = { url: 'zero', category: 'pool', rating: 0 };
    const one = createState({ library: { photosList: [zeroWeight] }, playback: { activePhotoUrl: null } });
    [empty, createState({ library: { photosList: [] }, runtime: { weather: { current: { is_day: 1 } } } })]
      .forEach((state) => assert.throws(() => selectSmartPhoto({ state, now: null, rng: null }), TypeError));
    assert.strictEqual(selectSmartPhoto({ state: empty, now, rng: null }), null);
    assert.strictEqual(selectSmartPhoto({ state: one, now, rng: null }), zeroWeight);
    const weighted = createState({ library: { photosList: [{ ...zeroWeight, rating: 2 }] }, playback: { activePhotoUrl: null } });
    assert.throws(() => selectSmartPhoto({ state: weighted, now, rng: null }), TypeError);
  });

  assertTest('smart state selection observes weather precedence and clock before conditional random draws', () => {
    const calls = [];
    const now = new Date(2026, 0, 1, 9);
    now.getHours = () => { calls.push('hours'); return 9; };
    now.getMinutes = () => { calls.push('minutes'); return 0; };
    const rng = () => { calls.push('draw'); return 0; };
    const row = { url: 'one', category: 'pool', rating: 10 };
    const state = createState({ library: { photosList: [row] }, playback: { activePhotoUrl: null } });
    assert.strictEqual(selectSmartPhoto({ state, now, rng }), row);
    assert.deepStrictEqual(calls, ['hours', 'hours', 'hours', 'minutes', 'draw']);
    calls.length = 0;
    const withWeather = { ...state, runtime: { ...state.runtime, weather: { current: { is_day: 1 } } } };
    assert.strictEqual(selectSmartPhoto({ state: withWeather, now, rng }), row);
    assert.deepStrictEqual(calls, ['hours', 'minutes', 'draw']);
    const failure = new Error('clock failed');
    now.getHours = () => { throw failure; };
    assert.throws(() => selectSmartPhoto({ state: withWeather, now, rng }), error => error === failure);
  });

  assertTest('sequence playback does not invoke truthy malformed clock or random inputs', () => {
    const state = createState();
    const env = { now: {}, rng: {} };
    const sequence = { type: 'advance-photo', payload: { direction: 'next', strategy: 'sequence' } };
    const smart = { ...sequence, payload: { ...sequence.payload, strategy: 'smart' } };
    assert.strictEqual(reduceDomainCommand(state, sequence, env).nextState.playback.activePhotoUrl, 'port-2');
    assert.throws(() => reduceDomainCommand(state, smart, env), TypeError);
  });

  assertTest('normalizes category aliases and drops invalid selections', () => {
    const selected = normalizeCategorySelection(
      'Liminal Space,AI Creation,Missing',
      ['Scenic Nature', 'Liminal Spaces', 'AI Creations']
    );
    assert.deepStrictEqual(selected, ['Liminal Spaces', 'AI Creations']);
  });

  assertTest('balances feeds while respecting exclusions', () => {
    const photos = buildBalancedFeed({
      selectedCategories: ['Scenic Nature', 'Liminal Spaces'],
      collections: createState().library.collections,
      excludedKeywords: ['hallway'],
      rng: () => 0.1
    });
    assert.strictEqual(photos.some((photo) => photo.url === 'port-1'), false);
    assert.strictEqual(photos.length, 3);
  });

  assertTest('builds a Google Photos feed from external cached items', () => {
    const photos = buildBalancedFeed({
      selectedCategories: ['Google Photos'],
      collections: createState().library.collections,
      externalCollections: {
        'Google Photos': [
          {
            url: '/api/google-photos/media/picker-123?w=2560&h=1440',
            title: 'Picker Photo',
            rating: 10
          }
        ]
      },
      excludedKeywords: [],
      rng: () => 0.1
    });

    assert.strictEqual(photos.length, 1);
    assert.strictEqual(photos[0].category, 'Google Photos');
    assert.strictEqual(photos[0].title, 'Picker Photo');
  });

  assertTest('weighted selection favors high ratings with deterministic rng', () => {
    const picked = selectWeightedRandomPhoto({
      photos: [
        { url: 'low', title: 'Low', rating: 2 },
        { url: 'high', title: 'High', rating: 10 }
      ],
      rng: () => 0.9
    });
    assert.strictEqual(picked?.url, 'high');
  });

  assertTest('weighted selection gives each active pool equal share regardless of pool size or ratings', () => {
    const photos = [
      { url: 'google-1', category: 'Google Photos', rating: 2 },
      { url: 'nature-1', category: 'Scenic Nature', rating: 10 },
      { url: 'nature-2', category: 'Scenic Nature', rating: 10 },
      { url: 'nature-3', category: 'Scenic Nature', rating: 10 },
      { url: 'nature-4', category: 'Scenic Nature', rating: 10 }
    ];
    const counts = { 'Google Photos': 0, 'Scenic Nature': 0 };

    for (let index = 0; index < 100; index += 1) {
      let call = 0;
      const selected = selectWeightedRandomPhoto({
        photos,
        rng: () => {
          call += 1;
          return call === 1 ? (index + 0.5) / 100 : 0.5;
        }
      });
      counts[selected.category] += 1;
    }

    assert.deepStrictEqual(counts, { 'Google Photos': 50, 'Scenic Nature': 50 });
  });

  assertTest('advance-photo command decoder preserves an explicit sequence strategy', () => {
    assert.deepStrictEqual(decodeAdvancePhotoCommand('prev', 'sequence'), {
      type: 'advance-photo',
      payload: {
        direction: 'prev',
        strategy: 'sequence'
      }
    });
  });

  assertTest('photo command decoders normalize prevent-pairing, loved, and broken-photo payloads', () => {
    assert.deepStrictEqual(decodePhotoPreventPairingCommand({
      url: ' https://example.com/photo.jpg ',
      preventPairing: 1,
      preserveActive: 'yes'
    }), {
      type: 'set-photo-prevent-pairing',
      payload: {
        url: ' https://example.com/photo.jpg ',
        preventPairing: true,
        preserveActive: true
      }
    });
    assert.deepStrictEqual(decodePhotoLovedCommand({
      url: ' https://example.com/photo.jpg ',
      loved: 'yes'
    }), {
      type: 'set-photo-loved',
      payload: {
        url: ' https://example.com/photo.jpg ',
        loved: true
      }
    });
    assert.deepStrictEqual(decodeBrokenPhotoCommand({ url: 'broken-photo' }), {
      type: 'mark-photo-broken',
      payload: {
        url: 'broken-photo'
      }
    });
    assert.strictEqual(decodePhotoPreventPairingCommand({ preventPairing: true }), null);
    assert.strictEqual(decodePhotoLovedCommand({ loved: true }), null);
    assert.strictEqual(decodeBrokenPhotoCommand({ url: '   ' }), null);
  });

  assertTest('photo command decoders share url validation while preserving active-photo previews and partial crop patches', () => {
    assert.deepStrictEqual(decodeActivePhotoCommand({
      url: 'preview-photo',
      title: 'Preview Photo',
      author: 'Lumina'
    }), {
      type: 'set-active-photo',
      payload: {
        url: 'preview-photo',
        photo: {
          url: 'preview-photo',
          title: 'Preview Photo',
          author: 'Lumina'
        }
      }
    });
    assert.deepStrictEqual(decodePhotoCropCommand({
      url: 'crop-photo',
      cropPercent: 135
    }), {
      type: 'set-photo-crop',
      payload: {
        url: 'crop-photo',
        cropPercent: 135
      }
    });
    assert.strictEqual(decodeActivePhotoCommand({ title: 'Missing URL' }), null);
    assert.strictEqual(decodePhotoCropCommand({
      url: 'crop-photo',
      cropPercent: 250
    }), null);
  });

  assertTest('state patch projection preserves listed order, repeated reads and raw inherited aliases', () => {
    const { pickStatePatchFields: pick, STATE_PATCH_FIELDS: fields } = require('./statePatch.js');
    const shared = {}, calls = [], counts = {};
    const offered = Object.assign(Object.create({ theme: shared }), { scaleMode: 0, splitPortrait: null });
    const payload = new Proxy(offered, { get: (target, key) => {
      calls.push(key); counts[key] = (counts[key] || 0) + 1;
      return key === 'scaleMode' && counts[key] === 2 ? undefined : target[key];
    } });
    const result = pick(payload);
    assert.deepStrictEqual(calls, fields.flatMap(field => ['theme', 'scaleMode', 'splitPortrait'].includes(field) ? [field, field] : [field]));
    assert.deepStrictEqual(Object.keys(result), ['theme', 'scaleMode', 'splitPortrait']);
    assert.strictEqual(result.theme, shared);
    assert.strictEqual(result.splitPortrait, null);
    assert.strictEqual(Object.hasOwn(result, 'scaleMode'), true);
    assert.strictEqual(result.scaleMode, undefined, 'the second getter value is copied verbatim');
    assert.notStrictEqual(pick(null), pick(undefined));
    assert.deepStrictEqual(pick(1), {});
    const failure = new Error('second field read'); let reads = 0;
    assert.throws(() => pick({ get theme() { if (++reads === 2) throw failure; return shared; } }), error => error === failure);
    assert.strictEqual(reads, 2);
  });

  assertTest('mutable patch field extensions preserve raw values without normalizing special fields', () => {
    const sharedFields = require('./statePatch.js').STATE_PATCH_FIELDS, before = [...sharedFields];
    const sandbox = { module: { exports: {} } };
    runInNewContext(fs.readFileSync(require.resolve('./statePatch.js'), 'utf8'), sandbox);
    const { STATE_PATCH_FIELDS: fields, pickStatePatchFields: pick } = sandbox.module.exports;
    assert.notStrictEqual(fields, sharedFields);
    fields.push('visionConfig', 'manualLocation');
    const raw = {}, result = pick({ visionConfig: 7, manualLocation: raw });
    assert.strictEqual(result.visionConfig, 7);
    assert.strictEqual(result.manualLocation, raw);
    assert.throws(() => result.visionConfig.apiUrl.trim(), error => error.name === 'TypeError');
    assert.deepStrictEqual(sharedFields, before, 'only the isolated VM list may be extended');
  });

  assertTest('state patch normalizers retain native coercion, exact defaults and unvalidated boundaries', () => {
    const sandbox = { module: { exports: {} } };
    runInNewContext(`${fs.readFileSync(require.resolve('./statePatch.js'), 'utf8')}\nglobalThis.helpers = { trimString, normalizeCoordinate };`, sandbox);
    const { trimString: trim, normalizeCoordinate: coordinate } = sandbox.helpers;
    const { normalizeManualLocation: location, normalizeVisionConfig: vision } = require('./statePatch.js');
    const fallback = {};
    assert.strictEqual(trim({ toString: () => assert.fail('trim must not coerce') }), '');
    assert.strictEqual(trim('  moon  '), 'moon');
    assert.strictEqual(coordinate(' 7.5suffix', fallback), 7.5);
    [undefined, null, Infinity, Symbol('coordinate')].forEach(value => assert.strictEqual(coordinate(value, fallback), fallback));
    assert.strictEqual(Object.is(coordinate('-0', fallback), -0), true);
    assert.deepStrictEqual(location({ lat: '999tail', lon: '-999', city: ' City ', regionName: 7 }), {
      lat: 999, lon: -999, city: 'City', regionName: 'Quebec', country: 'Canada'
    });
    assert.deepStrictEqual(location(0), location(undefined));
    assert.notStrictEqual(location(), location());
    assert.deepStrictEqual(vision({ apiUrl: ' url ', apiKey: 7, model: new String('boxed'), fallbackUrl: ' next ' }), {
      apiUrl: 'url', apiKey: '', model: '', fallbackUrl: 'next', fallbackApiKey: '', fallbackModel: ''
    });
    assert.deepStrictEqual(vision(false), vision(undefined));
    assert.notStrictEqual(vision(), vision());
    [location, vision].forEach(normalize => assert.throws(() => normalize(null), error => error.name === 'TypeError'));
  });

  assertTest('location destructuring precedes coercion while vision reads stop at the first native failure', () => {
    const { normalizeManualLocation: location, normalizeVisionConfig: vision } = require('./statePatch.js');
    const calls = [], failure = new Error('native read/coercion');
    const lat = { toString: () => { calls.push('coerce lat'); throw failure; } };
    const input = Object.fromEntries(['lat', 'lon', 'city', 'regionName', 'country'].map(field => [field, undefined]));
    Object.keys(input).forEach(field => Object.defineProperty(input, field, { get: () => (calls.push(field), field === 'lat' ? lat : undefined) }));
    assert.throws(() => location(input), error => error === failure);
    assert.deepStrictEqual(calls, ['lat', 'lon', 'city', 'regionName', 'country', 'coerce lat']);
    calls.length = 0;
    assert.throws(() => vision({ get apiUrl() { calls.push('url'); return ' url '; }, get apiKey() { calls.push('key'); throw failure; },
      get model() { return assert.fail('read after failure'); } }), error => error === failure);
    assert.deepStrictEqual(calls, ['url', 'key']);
  });

  assertTest('state patch decoder normalizes location, widgets, and vision config payloads', () => {
    assert.deepStrictEqual(decodeStatePatchCommand({
      widgets: { clock: 0 },
      autoLocation: 1,
      manualLocation: {
        lat: 'bad',
        lon: '-73.60',
        city: ' Verdun ',
        regionName: ' Quebec ',
        country: ' Canada '
      },
      visionConfig: {
        apiUrl: ' https://vision.example/api ',
        model: ' gpt-4.1-mini '
      }
    }), {
      type: 'patch-state',
      payload: {
        widgets: { clock: 0 },
        autoLocation: true,
        manualLocation: {
          lat: 45.45,
          lon: -73.6,
          city: 'Verdun',
          regionName: 'Quebec',
          country: 'Canada'
        },
        visionConfig: {
          apiUrl: 'https://vision.example/api',
          apiKey: '',
          model: 'gpt-4.1-mini',
          fallbackUrl: '',
          fallbackApiKey: '',
          fallbackModel: ''
        }
      }
    });
  });

  assertTest('shared state-patch field specs keep decode and reducer scalar updates aligned', () => {
    const state = createState();
    const command = decodeStatePatchCommand({
      theme: 'Cosmic Night',
      inactivityTimeout: 300000,
      slideshowInterval: 45000,
      scaleMode: 'contain',
      splitPortrait: false,
      splitCropPercent: 35,
      alignTimeOfDay: true,
      alignWeather: true,
      nightPercentage: 25,
      allowOpenAiFallback: true
    });

    assert.deepStrictEqual(command, {
      type: 'patch-state',
      payload: {
        theme: 'Cosmic Night',
        inactivityTimeout: 300000,
        slideshowInterval: 45000,
        scaleMode: 'contain',
        splitPortrait: false,
        splitCropPercent: 35,
        alignTimeOfDay: true,
        alignWeather: true,
        nightPercentage: 25,
        allowOpenAiFallback: true
      }
    });

    const result = reduceDomainCommand(state, command);

    Object.entries(command.payload).forEach(([field, value]) => {
      assert.deepStrictEqual(result.nextState.config[field], value);
    });
    assert.deepStrictEqual(result.events.map((event) => event.type), ['state-sync']);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist']);
  });

  assertTest('reducer command-family interpreter indexes supported commands without widening unknown keys', () => {
    const state = createState();

    ['unknown-command', 'toString', '__proto__'].forEach((type) => {
      const result = reduceDomainCommand(state, { type });

      assert.strictEqual(result.nextState, state);
      assert.deepStrictEqual(result.events, []);
      assert.deepStrictEqual(result.effects, []);
    });

    const nullCommandResult = reduceDomainCommand(state, null);
    assert.strictEqual(nullCommandResult.nextState, state);
  });

  assertTest('reducer command-family interpreter keeps family environment adapters explicit', () => {
    const result = reduceDomainCommand(createState(), {
      type: 'advance-photo',
      payload: { direction: 'next', strategy: 'smart' }
    }, {
      now: new Date('2026-06-27T12:00:00'),
      rng: () => 0
    });

    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'port-2');
    assert.deepStrictEqual(result.events.map((event) => event.type), ['photo-update', 'state-sync']);
  });

  assertTest('state cloning owns its shallow containers while retaining nested metadata aliases', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.clone = cloneState;`, sandbox);
    const shared = Object.freeze({ nested: true });
    const state = createState({
      config: { feedConfigs: { A: shared }, poolPolicies: { A: shared }, manualLocation: { detail: shared }, visionConfig: { detail: shared } },
      runtime: { weather: { location: shared }, newsSentiment: { detail: shared }, physicalWeather: { detail: shared } },
      library: { collections: { A: [{ url: 'a', metadata: shared }] }, externalCollections: { E: [{ url: 'e', metadata: shared }] }, photosList: [{ url: shared, metadata: shared }] }
    });
    const cloned = sandbox.clone(state);
    const containers = [[], ['config'], ['runtime'], ['library'], ['playback'],
      ['config', 'widgets'], ['config', 'searchKeywords'], ['config', 'feedConfigs'], ['config', 'poolPolicies'],
      ['config', 'excludedKeywords'], ['config', 'manualLocation'], ['config', 'visionConfig'],
      ['runtime', 'weather'], ['runtime', 'newsSentiment'], ['runtime', 'physicalWeather'],
      ['library', 'collections'], ['library', 'collections', 'A'], ['library', 'collections', 'A', 0],
      ['library', 'externalCollections'], ['library', 'externalCollections', 'E'], ['library', 'externalCollections', 'E', 0],
      ['library', 'photosList'], ['library', 'photosList', 0], ['playback', 'selectedCategories'], ['playback', 'poolSequenceCursors']];
    const at = (value, keys) => keys.reduce((current, key) => current[key], value);
    containers.forEach(keys => assert.notStrictEqual(at(cloned, keys), at(state, keys), keys.join('.')));
    [cloned.config.feedConfigs.A, cloned.config.poolPolicies.A, cloned.config.manualLocation.detail,
      cloned.config.visionConfig.detail, cloned.runtime.weather.location, cloned.runtime.newsSentiment.detail,
      cloned.runtime.physicalWeather.detail, cloned.library.collections.A[0].metadata,
      cloned.library.externalCollections.E[0].metadata, cloned.library.photosList[0].metadata,
      cloned.library.photosList[0].url].forEach(value => assert.strictEqual(value, shared));
    cloned.library.collections.A[0].url = 'changed';
    cloned.playback.selectedCategories.push('A');
    assert.strictEqual(state.library.collections.A[0].url, 'a');
    assert.deepStrictEqual(state.playback.selectedCategories, ['Liminal Spaces']);
  });

  assertTest('state cloning normalizes keywords and owns fresh optional defaults without claiming a deep clone', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.clone = cloneState;`, sandbox);
    const state = createState({
      config: { searchKeywords: { A: ['  mist  ', '', 'river'] }, poolPolicies: undefined, visionConfig: undefined },
      library: { externalCollections: undefined }, playback: { poolSequenceCursors: undefined }
    });
    const first = sandbox.clone(state), second = sandbox.clone(state);
    assert.deepStrictEqual(Array.from(first.config.searchKeywords.A), ['mist', 'river']);
    assert.notStrictEqual(first.config.searchKeywords.A, state.config.searchKeywords.A);
    assert.strictEqual(first.config.visionConfig, undefined);
    assert.strictEqual(first.runtime.weather, null);
    [first.config.poolPolicies, first.library.externalCollections, first.playback.poolSequenceCursors]
      .forEach(value => assert.deepStrictEqual(Object.keys(value), []));
    assert.notStrictEqual(first.config.poolPolicies, second.config.poolPolicies);
    assert.notStrictEqual(first.library.externalCollections, second.library.externalCollections);
    assert.notStrictEqual(first.playback.poolSequenceCursors, second.playback.poolSequenceCursors);
    assert.deepStrictEqual(state.config.searchKeywords.A, ['  mist  ', '', 'river']);
    assert.deepStrictEqual(Object.keys(first), ['config', 'runtime', 'library', 'playback']);
  });

  assertTest('state cloning propagates native reads and malformed rows without touching later sections', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.clone = cloneState;`, sandbox);
    const state = createState(), failure = new Error('config read failed');
    Object.defineProperty(state.config, 'widgets', { enumerable: true, get: () => { throw failure; } });
    Object.defineProperty(state, 'runtime', { get: () => assert.fail('later runtime read') });
    assert.throws(() => sandbox.clone(state), error => error === failure);
    assert.throws(() => sandbox.clone(null), error => error.name === 'TypeError');
    const malformed = createState({ library: { collections: { A: {} } } });
    Object.defineProperty(malformed, 'playback', { get: () => assert.fail('later playback read') });
    assert.throws(() => sandbox.clone(malformed), error => error.name === 'TypeError' && /map/.test(error.message));
  });

  assertTest('comparison primitives retain strict identity, shallow arrays and asymmetric sparse every semantics', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.compare = { arraysEqual, valuesEqual, shallowEqualObjects };`, sandbox);
    const { arraysEqual, valuesEqual } = sandbox.compare, shared = {};
    assert.strictEqual(arraysEqual(), true);
    assert.strictEqual(arraysEqual(undefined, []), true);
    assert.strictEqual(arraysEqual([NaN], [NaN]), false);
    assert.strictEqual(arraysEqual([-0, shared], [0, shared]), true);
    assert.strictEqual(arraysEqual([shared], [{}]), false);
    assert.strictEqual(arraysEqual(Array(1), [shared]), true);
    assert.strictEqual(arraysEqual([shared], Array(1)), false);
    const inheritedIndex = Array(1);
    Object.setPrototypeOf(inheritedIndex, Object.assign(Object.create(Array.prototype), { 0: shared }));
    assert.strictEqual(arraysEqual(inheritedIndex, [shared]), true);
    assert.strictEqual(arraysEqual(inheritedIndex, [{}]), false);
    assert.strictEqual(valuesEqual([shared], [shared]), true);
    assert.strictEqual(valuesEqual([[shared]], [[shared]]), false);
    assert.strictEqual(valuesEqual([], {}), false);
    assert.strictEqual(valuesEqual({}, []), false);
    assert.strictEqual(valuesEqual(NaN, NaN), false);
    assert.strictEqual(valuesEqual(-0, 0), true);
    assert.strictEqual(valuesEqual(shared, shared), true);
    assert.strictEqual(valuesEqual(undefined, undefined), true);
  });

  assertTest('comparison primitives preserve native key enumeration, asymmetric key lookup and failure order', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.compare = { arraysEqual, valuesEqual, shallowEqualObjects };`, sandbox);
    const { arraysEqual, valuesEqual, shallowEqualObjects } = sandbox.compare;
    const calls = [], failure = new Error('native comparison failed');
    const left = [1, 2], right = [9, 2];
    Object.defineProperty(left, 0, { get: () => (calls.push('left'), 1) });
    Object.defineProperty(right, 0, { get: () => (calls.push('right'), 9) });
    Object.defineProperty(left, 1, { get: () => assert.fail('every short-circuit') });
    assert.strictEqual(arraysEqual(left, []), false);
    assert.deepStrictEqual(calls, []);
    assert.strictEqual(arraysEqual(left, right), false);
    assert.deepStrictEqual(calls, ['left', 'right']);
    assert.strictEqual(shallowEqualObjects({ a: undefined }, { b: undefined }), true);
    const inherited = Object.assign(Object.create({ a: 1 }), { b: 2 });
    assert.strictEqual(shallowEqualObjects({ a: 1 }, inherited), true);
    assert.strictEqual(shallowEqualObjects(inherited, { a: 1 }), false);
    const hidden = Object.defineProperty({ [Symbol('ignored')]: 1 }, 'hidden', { value: 2 });
    assert.strictEqual(shallowEqualObjects(hidden, Object.create(null)), true);
    assert.strictEqual(shallowEqualObjects(), true);
    assert.strictEqual(shallowEqualObjects({ a: [1] }, { a: [1] }), true);
    assert.strictEqual(shallowEqualObjects({ a: {} }, { a: {} }), false);
    calls.length = 0;
    const ordered = Object.fromEntries(['2', '1', 'z'].map(key => [key, 1]));
    Object.keys(ordered).forEach(key => Object.defineProperty(ordered, key, { get: () => (calls.push(key), 1) }));
    assert.strictEqual(shallowEqualObjects(ordered, { 1: 1, 2: 1, z: 1 }), true);
    assert.deepStrictEqual(calls, ['1', '2', 'z']);
    calls.length = 0;
    const record = new Proxy({ get a() { calls.push('get left'); throw failure; } }, {
      ownKeys: target => (calls.push('keys left'), Reflect.ownKeys(target))
    });
    const other = new Proxy({ get a() { return assert.fail('right getter after left failure'); } }, {
      ownKeys: target => (calls.push('keys right'), Reflect.ownKeys(target))
    });
    assert.throws(() => shallowEqualObjects(record, other), error => error === failure);
    assert.deepStrictEqual(calls, ['keys left', 'keys right', 'get left']);
    assert.strictEqual(shallowEqualObjects(record, {}), false);
    assert.throws(() => arraysEqual({ length: 0, every: () => { throw failure; } }, []), error => error === failure);
    assert.throws(() => shallowEqualObjects(new Proxy({}, { ownKeys: () => { throw failure; } }), other), error => error === failure);
    assert.throws(() => arraysEqual(null), error => error.name === 'TypeError');
    assert.throws(() => shallowEqualObjects(null), error => error.name === 'TypeError');
    const revoked = Proxy.revocable([], {}); revoked.revoke();
    assert.throws(() => valuesEqual(revoked.proxy, []), error => error.name === 'TypeError');
  });

  assertTest('single-field assignment skips undefined reads and retains strict identity and native write failures', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.assign = assignIfChanged;`, sandbox);
    const shared = {}, key = Symbol('field'), failure = new Error('native assignment failed');
    const target = { zero: -0, nan: NaN, item: shared, [key]: false };
    assert.strictEqual(sandbox.assign(target, 'zero', 0), false);
    assert.ok(Object.is(target.zero, -0));
    assert.strictEqual(sandbox.assign(target, 'nan', NaN), true);
    assert.strictEqual(sandbox.assign(target, 'item', shared), false);
    const replacement = {};
    assert.strictEqual(sandbox.assign(target, 'item', replacement), true);
    assert.strictEqual(target.item, replacement);
    assert.strictEqual(sandbox.assign(target, key, true), true);
    assert.strictEqual(target[key], true);
    Object.defineProperty(target, 'unread', { get: () => { throw failure; } });
    assert.strictEqual(sandbox.assign(target, 'unread', undefined), false);
    assert.strictEqual(sandbox.assign(null, key, undefined), false);
    assert.throws(() => sandbox.assign(target, 'unread', 1), error => error === failure);
    Object.defineProperty(target, 'unwritten', { get: () => 1, set: () => { throw failure; } });
    assert.strictEqual(sandbox.assign(target, 'unwritten', 1), false);
    assert.throws(() => sandbox.assign(target, 'unwritten', 2), error => error === failure);
  });

  assertTest('field assignment visits every present entry in order, preserving symbols, skips and partial writes on failure', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.assign = assignFields;`, sandbox);
    const calls = [], key = Symbol('field'), target = { [key]: false }, failure = new Error('tuple iterator failed');
    let value = 0;
    Object.defineProperty(target, 'count', { get: () => (calls.push(`read ${value}`), value), set: next => { calls.push(`write ${next}`); value = next; } });
    Object.defineProperty(target, 'skip', { get: () => assert.fail('undefined read') });
    const entries = Object.freeze(Object.assign([Object.freeze(['count', 1])], {
      2: Object.freeze([key, true]), 3: Object.freeze(['count', 2]),
      4: Object.freeze(['skip', undefined]), 5: Object.freeze(['count', 2])
    }));
    assert.strictEqual(sandbox.assign(target, entries), true);
    assert.deepStrictEqual(calls, ['read 0', 'write 1', 'read 1', 'write 2', 'read 2']);
    assert.strictEqual(target[key], true);
    assert.strictEqual(sandbox.assign(target, Array(2)), false);
    assert.strictEqual(sandbox.assign(target, [['count', 2], [key, true]]), false);
    const broken = { [Symbol.iterator]: () => { throw failure; } };
    assert.throws(() => sandbox.assign(target, [['count', 3], broken, ['count', 4]]), error => error === failure);
    assert.strictEqual(value, 3);
    assert.throws(() => sandbox.assign(target, { reduce: () => { throw failure; } }), error => error === failure);
    assert.throws(() => sandbox.assign(target, [null]), error => error.name === 'TypeError');
  });

  assertTest('event and persistence descriptions copy only outer arrays with fresh records and exact ordering', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.describe = { withPersist, emitStateSync, emitPhotoUpdate, stateSyncEventsFor };`, sandbox);
    const { withPersist, emitStateSync, emitPhotoUpdate, stateSyncEventsFor } = sandbox.describe;
    const event = Object.freeze({ type: 'photo-update' }), effect = Object.freeze({ type: 'run-crawler', payload: { categories: ['A'] } });
    [[withPersist, effect, ['persist', 'run-crawler']], [emitStateSync, event, ['photo-update', 'state-sync']],
      [emitPhotoUpdate, event, ['photo-update', 'photo-update', 'state-sync']]].forEach(([describe, entry, types]) => {
      const input = Object.freeze([entry]), first = describe(input), second = describe(input);
      assert.notStrictEqual(first, input);
      assert.notStrictEqual(first, second);
      assert.deepStrictEqual(Array.from(first, item => item.type), types);
      assert.strictEqual(first[describe === withPersist ? 1 : 0], entry);
      const added = describe === withPersist ? 0 : 1;
      assert.notStrictEqual(first[added], second[added]);
      assert.deepStrictEqual(Array.from(describe(), item => item.type), Array.from(describe(undefined), item => item.type));
      assert.notStrictEqual(describe(), describe());
      assert.strictEqual(describe(Array(1))[describe === withPersist ? 1 : 0], undefined);
    });
    [false, 0, '', null, undefined, NaN].forEach(value => assert.deepStrictEqual(Array.from(stateSyncEventsFor(value), event => event.type), ['state-sync']));
    [true, [], {}, 'changed'].forEach(value => assert.deepStrictEqual(Array.from(stateSyncEventsFor(value), event => event.type), ['photo-update', 'state-sync']));
    const first = stateSyncEventsFor(true), second = stateSyncEventsFor(true);
    assert.notStrictEqual(first, second);
    first.forEach((event, index) => assert.notStrictEqual(event, second[index]));
  });

  assertTest('description primitives preserve native iterator/default failures without inspecting entries or truthy flags', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.describe = { withPersist, emitStateSync, emitPhotoUpdate, stateSyncEventsFor };`, sandbox);
    const { withPersist, emitStateSync, emitPhotoUpdate, stateSyncEventsFor } = sandbox.describe;
    const failure = new Error('native iterator failed'), calls = [];
    const entry = Object.defineProperty({}, 'type', { get: () => assert.fail('entry inspection') });
    [withPersist, emitStateSync, emitPhotoUpdate].forEach(describe => {
      const input = { *[Symbol.iterator]() { calls.push('iterate'); yield entry; throw failure; } };
      assert.throws(() => describe(input), error => error === failure);
      [null, false, 0].forEach(value => assert.throws(() => describe(value), error => error.name === 'TypeError'));
      const iteratorGetter = { get [Symbol.iterator]() { throw failure; } };
      assert.throws(() => describe(iteratorGetter), error => error === failure);
    });
    assert.deepStrictEqual(calls, ['iterate', 'iterate', 'iterate']);
    const flag = { [Symbol.toPrimitive]: () => assert.fail('truthiness coercion') };
    assert.deepStrictEqual(Array.from(stateSyncEventsFor(flag), event => event.type), ['photo-update', 'state-sync']);
    sandbox.emitStateSync = () => { throw failure; };
    assert.throws(() => stateSyncEventsFor(false), error => error === failure);
    sandbox.emitPhotoUpdate = () => { throw failure; };
    assert.throws(() => stateSyncEventsFor(true), error => error === failure);
  });

  assertTest('navigation transport specs capture inputs once without coupling fallback arguments to decoders', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./commands.js'), 'utf8')}\nglobalThis.navigationSpec = createAdvancePhotoTransportSpec;`, sandbox);
    const reads = [], rawMessage = { legacy: true };
    const input = Object.fromEntries(Object.entries({ direction: 'prev', socketEvent: 'previous', routePath: '/previous', notFoundMessage: rawMessage })
      .map(([key, value]) => [key, { get: () => { reads.push(key); return value; }, enumerable: true }]));
    const spec = sandbox.navigationSpec(Object.defineProperties({}, input));
    assert.deepStrictEqual(reads, ['direction', 'socketEvent', 'routePath', 'notFoundMessage']);
    assert.strictEqual(spec.notFoundMessage, rawMessage);
    assert.notStrictEqual(spec.fallbackArgs, sandbox.navigationSpec({ direction: 'prev' }).fallbackArgs);
    spec.direction = 'next'; spec.fallbackArgs[0] = 'next';
    assert.strictEqual(spec.decodeSocket().payload.direction, 'prev');
    assert.strictEqual(spec.decodeSocket().payload.strategy, 'smart');
    assert.strictEqual(spec.decodeRest().payload.direction, 'prev');
    assert.strictEqual(spec.decodeRest().payload.strategy, 'sequence');
    const first = spec.decodeRest(), second = spec.decodeRest();
    assert.notStrictEqual(first, second); assert.notStrictEqual(first.payload, second.payload);
    assert.strictEqual(reads.length, 4); // decoding uses captured values, not later input reads
  });

  assertTest('navigation specifications preserve raw invalid directions and native accessor failures', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./commands.js'), 'utf8')}\nglobalThis.navigationSpec = createAdvancePhotoTransportSpec;`, sandbox);
    const rawDirection = { toString: () => assert.fail('direction was coerced') };
    const spec = sandbox.navigationSpec(Object.create({ direction: rawDirection, socketEvent: 'raw' }));
    assert.strictEqual(spec.direction, rawDirection); assert.strictEqual(spec.fallbackArgs[0], rawDirection);
    assert.strictEqual(spec.decodeSocket(), null); assert.strictEqual(spec.decodeRest(), null);
    assert.strictEqual(spec.socketEvent, 'raw');
    const failure = new Error('navigation getter');
    assert.throws(() => sandbox.navigationSpec({ get direction() { throw failure; } }), error => error === failure);
    assert.throws(() => sandbox.navigationSpec(null), error => error.name === 'TypeError');
  });

  assertTest('private compiler contracts preserve domain boundaries and navigation transport descriptors', () => {
    const ts = require('typescript');
    const file = require.resolve('./reducer.js'), source = fs.readFileSync(file, 'utf8');
    const selectorFile = require.resolve('./selectors.js'), selectorSource = fs.readFileSync(selectorFile, 'utf8');
    const patchFile = require.resolve('./statePatch.js'), patchSource = fs.readFileSync(patchFile, 'utf8');
    const commandFile = require.resolve('./commands.js'), commandSource = fs.readFileSync(commandFile, 'utf8');
    const root = path.resolve(__dirname, '../..'), configPath = path.join(root, 'tsconfig.domain.json');
    const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
    const fixture = `
const cloneFixture = cloneState(/** @type {DomainState} */ ({}));
/** @type {DomainState} */ const validCloneFixture = cloneFixture;
/** @type {unknown} */ const rawCloneUrlFixture = cloneFixture.playback.activePhotoUrl;
/** @type {0 extends (1 & typeof cloneFixture.playback.activePhotoUrl) ? true : false} */ const cloneResultIsAny = false;
// @ts-expect-error complete domain sections are required
cloneState({});
// @ts-expect-error null isn't a documented input, despite retaining native runtime failure
cloneState(null);
// @ts-expect-error compatibility playback URL must be narrowed, not assumed normalized
/** @type {string} */ const normalizedCloneUrlFixture = cloneFixture.playback.activePhotoUrl;
// @ts-expect-error cloned widget values aren't string values
/** @type {string} */ const wrongCloneWidgetFixture = cloneFixture.config.widgets.clock;
/** @type {readonly unknown[]} */ const comparisonArrayFixture = [1, 'one', {}];
/** @type {boolean} */ const arrayComparisonFixture = arraysEqual(comparisonArrayFixture, [null]);
/** @type {boolean} */ const valueComparisonFixture = valuesEqual(null, { legacy: true });
/** @type {boolean} */ const objectComparisonFixture = shallowEqualObjects(cloneFixture, {});
arraysEqual(); shallowEqualObjects(undefined); stateSyncEventsFor({ legacy: true });
// @ts-expect-error array comparison documents arrays, not a scalar with native failure
arraysEqual(1, []);
// @ts-expect-error null is not an undefined default
arraysEqual(null);
// @ts-expect-error object comparison does not document null enumeration
shallowEqualObjects(null, {});
// @ts-expect-error object comparison documents objects, not boxed primitive enumeration
shallowEqualObjects(1, {});
const assignmentSymbolFixture = Symbol('field');
const assignmentTargetFixture = { count: 1, label: 'old', [assignmentSymbolFixture]: false };
/** @type {boolean} */ const assignedFixture = assignIfChanged(assignmentTargetFixture, 'count', 2);
assignIfChanged(assignmentTargetFixture, assignmentSymbolFixture, true);
assignIfChanged(assignmentTargetFixture, 'count', undefined);
/** @type {readonly FieldEntry<typeof assignmentTargetFixture>[]} */
const assignmentEntriesFixture = [['count', 2], ['label', 'new'], [assignmentSymbolFixture, true], ['count', undefined]];
/** @type {boolean} */ const assignedFieldsFixture = assignFields(assignmentTargetFixture, assignmentEntriesFixture);
assignIfChanged(cloneFixture.runtime, 'screensaverActive', true);
assignFields(cloneFixture.playback, [['splitSeed', 2], ['lastDirection', 'prev']]);
// @ts-expect-error canonical domain fields retain their own types
assignFields(cloneFixture.runtime, [['screensaverActive', 'active']]);
/** @type {FieldEntry<typeof assignmentTargetFixture>} */
const assignmentUnionFixture = Math.random() ? ['count', 3] : ['label', 'next'];
assignIfChanged(assignmentTargetFixture, ...assignmentUnionFixture);
/** @type {'count' | 'label'} */ const assignmentUnionKeyFixture = Math.random() ? 'count' : 'label';
// @ts-expect-error independently unioned keys/values are not correlated entries
assignIfChanged(assignmentTargetFixture, assignmentUnionKeyFixture, 'wrong for count');
// @ts-expect-error a count cannot receive the label's value type
assignIfChanged(assignmentTargetFixture, 'count', 'wrong');
// @ts-expect-error symbol keys retain their own value type
assignIfChanged(assignmentTargetFixture, assignmentSymbolFixture, 1);
// @ts-expect-error unknown keys cannot widen the target
assignIfChanged(assignmentTargetFixture, 'missing', 1);
// @ts-expect-error bulk entries retain each key/value relationship, not two independent unions
assignFields(assignmentTargetFixture, [['count', 'wrong']]);
// @ts-expect-error entry tuples need a key as well as a value (undefined is allowed explicitly)
assignFields(assignmentTargetFixture, [['count']]);
// @ts-expect-error targets are objects, not primitive mutation destinations
assignIfChanged(null, 'count', 1);
/** @type {readonly Event[]} */ const eventsInputFixture = [{ type: 'photo-update' }];
/** @type {readonly Effect[]} */ const effectsInputFixture = [{ type: 'run-crawler', payload: { categories: ['A'] } }];
const describedEventsFixture = emitPhotoUpdate(emitStateSync(eventsInputFixture));
const describedEffectsFixture = withPersist(effectsInputFixture);
/** @type {ReducerResult} */ const primitiveResultFixture = { nextState: cloneFixture, events: describedEventsFixture, effects: describedEffectsFixture };
/** @type {Event[]} */ const conditionalEventsFixture = stateSyncEventsFor(null);
withPersist(); withPersist(undefined); emitStateSync(); emitPhotoUpdate(undefined);
/** @type {0 extends (1 & typeof describedEffectsFixture[number]['type']) ? true : false} */ const describedEffectIsAny = false;
/** @type {0 extends (1 & typeof describedEventsFixture[number]['type']) ? true : false} */ const describedEventIsAny = false;
// @ts-expect-error canonical effects with required payloads cannot omit them
withPersist([{ type: 'run-crawler' }]);
// @ts-expect-error canonical effect payload fields keep their types
withPersist([{ type: 'run-crawler', payload: { categories: [1] } }]);
// @ts-expect-error effect names are not event descriptions
emitStateSync([{ type: 'persist' }]);
// @ts-expect-error photo helper accepts canonical events, not arbitrary names
emitPhotoUpdate([{ type: 'wrong' }]);
// @ts-expect-error null does not select the undefined-only effect default
withPersist(null);
// @ts-expect-error events remain closed descriptions, not strings
/** @type {string[]} */ const wrongConditionalEventsFixture = stateSyncEventsFor(true);
const poolDefaultsFixture = normalizeFeedConfigKeywords([{ legacy: 1 }]);
/** @type {number} */ const poolLegacyFixture = poolDefaultsFixture.unsplash.keywords[0].legacy;
/** @type {0 extends (1 & typeof poolDefaultsFixture.unsplash.keywords[number]) ? true : false} */ const poolKeywordIsAny = false;
/** @type {boolean} */ const poolArticEnabledFixture = poolDefaultsFixture.artic.enabled;
/** @type {boolean} */ const poolExistsFixture = hasPool(cloneFixture, Symbol('pool'));
/** @type {string} */ const poolNameFixture = normalizePoolName({ legacy: true });
/** @type {boolean} */ const poolCreatedFixture = addPoolState(cloneFixture, 'A', Object.freeze(['sun']));
addPoolState(cloneFixture, 'existing', undefined); // guard or native iteration failure, not a default
assignPoolKeywords(cloneFixture, 'A', [{ timeStart: '22:00', timeEnd: '06:00', keywords: ['moon'] }]);
const poolConfigFixture = mergePoolFeedConfig({ legacy: 1 }, Symbol('source'), undefined);
/** @type {unknown} */ const poolRawConfigFixture = poolConfigFixture.legacy;
/** @type {0 extends (1 & typeof poolConfigFixture.legacy) ? true : false} */ const poolConfigIsAny = false;
/** @type {boolean} */ const poolMergeFixture = mergePoolSourceConfig(cloneFixture, 'A', undefined, undefined);
/** @type {boolean} */ const poolPolicyFixture = assignPoolPolicy(cloneFixture, 'A', { maxPhotos: '12', schedule: { enabled: 'yes' } });
assignPoolPolicy(cloneFixture, 'A', undefined);
/** @type {boolean} */ const poolRemovedFixture = removePoolState(cloneFixture, 'A');
// @ts-expect-error pool creation requires canonical state, not partial sections
addPoolState({}, 'A', ['sun']);
// @ts-expect-error canonical creation keywords are strings (no normalization here)
addPoolState(cloneFixture, 'A', [1]);
// @ts-expect-error pool mutation names are normalized strings at this boundary
removePoolState(cloneFixture, 1);
// @ts-expect-error source patches must be canonical records, not scalars
mergePoolSourceConfig(cloneFixture, 'A', 'source', 1);
// @ts-expect-error pure source projection has the same patch contract
mergePoolFeedConfig({}, 'source', 1);
// @ts-expect-error policy must be a policy-input object or undefined
assignPoolPolicy(cloneFixture, 'A', 1);
// @ts-expect-error generic source defaults require an iterable
normalizeFeedConfigKeywords(1);
// @ts-expect-error generic copied keyword metadata does not become normalized strings
/** @type {string[]} */ const wrongPoolKeywordsFixture = poolDefaultsFixture.unsplash.keywords;
// @ts-expect-error compatibility config fields are still unknown, not normalized
/** @type {number} */ const wrongPoolConfigFixture = poolConfigFixture.legacy;
// @ts-expect-error pool assignment reports boolean flags, not the mutated state
/** @type {DomainState} */ const wrongPoolResultFixture = assignPoolKeywords(cloneFixture, 'A', ['sun']);
/** @overload @param {Photo} photo @returns {Photo} */
/** @overload @param {FeedPhoto} photo @returns {FeedPhoto} */
/** @param {FeedPhoto} photo @returns {FeedPhoto} */
function photoUpdaterFixture(photo) { return { ...photo, loved: true }; }
const photoMutationFixture = withUpdatedPhoto(cloneFixture, 'u', photoUpdaterFixture);
/** @type {DomainState} */ const photoMutationStateFixture = photoMutationFixture.state;
/** @type {0 extends (1 & typeof photoMutationFixture.state.library.photosList[number]['url']) ? true : false} */ const photoMutationUrlIsAny = false;
const definedPhotoMetadataFixture = buildDefinedMetadataPatch({ rating: 'raw', detail: { shared: true }, cropPercent: undefined });
/** @type {0 extends (1 & typeof definedPhotoMetadataFixture.rating) ? true : false} */ const definedPhotoMetadataIsAny = false;
const photoFlagsFixture = { changedInCollections: true, changedInExternalCollections: false };
const photoEffectsFixture = buildPhotoPersistenceEffects({ url: 'u', metadata: { rating: 0, cropPercent: undefined }, updateResult: photoFlagsFixture });
/** @type {Effect[]} */ const canonicalPhotoEffectsFixture = photoEffectsFixture;
const firstPhotoEffectFixture = photoEffectsFixture[0];
if (firstPhotoEffectFixture.type === 'persist') {
  /** @type {'persist'} */ const curatedPersistTagFixture = firstPhotoEffectFixture.type;
  // @ts-expect-error payload-free curated persistence has no payload
  const wrongCuratedPersistPayloadFixture = firstPhotoEffectFixture.payload;
}
// @ts-expect-error photo persistence payload requires variant narrowing
const wrongUnnarrowedPhotoPayloadFixture = firstPhotoEffectFixture.payload.url;
if (firstPhotoEffectFixture.type === 'persist-external-photo-metadata') {
  /** @type {number | undefined} */ const photoRatingFixture = firstPhotoEffectFixture.payload.metadata.rating;
  // @ts-expect-error canonical persisted rating is not a string
  /** @type {string} */ const wrongPersistedPhotoRatingFixture = firstPhotoEffectFixture.payload.metadata.rating;
}
/** @type {ReturnType<typeof keepUpdatedPhotoState>} */ const preservedPhotoFixture = preserveUpdatedPhotoState(cloneFixture, { url: 'u' });
/** @type {ReducerResult} */ const photoReductionFixture = reducePhotoLibraryCommand(cloneFixture, {
  url: 'u', updater: photoUpdaterFixture, metadata: { loved: true },
  afterUpdate: (state, context) => { /** @type {boolean} */ const external = context.updateResult.changedInExternalCollections; return keepUpdatedPhotoState(state); },
  eventsFor: finalized => finalized.photoChanged ? [{ type: 'photo-update' }] : [{ type: 'state-sync' }]
});
const assembledPhotoFixture = buildPhotoCommandReducer({ buildPatch: ({ loved }) => ({ loved: Boolean(loved) }) });
/** @type {ReducerResult} */ const assembledPhotoResultFixture = assembledPhotoFixture(cloneFixture, { payload: { url: 'u', loved: true } });
const safeExtraPhotoPatchFixture = () => ({ loved: true, url: 'u', title: 'safe', detail: { legacy: true } });
const safeExtraPhotoReducerFixture = buildPhotoCommandReducer({ buildPatch: safeExtraPhotoPatchFixture });
/** @type {ReducerResult} */ const safeExtraPhotoResultFixture = safeExtraPhotoReducerFixture(cloneFixture, { payload: { url: 'u' } });
const malformedExtraPhotoPatchFixture = () => ({ loved: true, url: 7, title: 9 });
// @ts-expect-error inferred extra known Photo fields must retain their canonical types
buildPhotoCommandReducer({ buildPatch: malformedExtraPhotoPatchFixture });
// @ts-expect-error raw feed metadata must not be claimed normalized
/** @type {string} */ const wrongUpdatedPhotoTitleFixture = photoMutationFixture.state.library.photosList[0].title;
// @ts-expect-error raw metadata is not normalized by undefined filtering
/** @type {number} */ const wrongDefinedPhotoMetadataFixture = definedPhotoMetadataFixture.rating;
// @ts-expect-error updater must return photos for both library and raw-feed inputs
withUpdatedPhoto(cloneFixture, 'u', () => 7);
/** @type {import('./selectors').PhotoUpdater} */ const normalizedOnlyPhotoUpdaterFixture = photo => photo;
// @ts-expect-error an updater cannot assume every feed row is normalized
withUpdatedPhoto(cloneFixture, 'u', normalizedOnlyPhotoUpdaterFixture);
// @ts-expect-error canonical effect metadata rejects unnormalized ratings
buildPhotoPersistenceEffects({ url: 'u', metadata: { rating: 'raw' }, updateResult: photoFlagsFixture });
// @ts-expect-error library mutation flags are booleans
buildPhotoPersistenceEffects({ url: 'u', metadata: {}, updateResult: { changedInCollections: 'yes', changedInExternalCollections: false } });
// @ts-expect-error photo finalization needs a canonical state
reducePhotoLibraryCommand(cloneFixture, { url: 'u', updater: photoUpdaterFixture, metadata: {}, afterUpdate: () => ({ state: 'wrong', photoChanged: false }) });
// @ts-expect-error photo event callbacks return events, not persistence effects
reducePhotoLibraryCommand(cloneFixture, { url: 'u', updater: photoUpdaterFixture, metadata: {}, eventsFor: () => [{ type: 'persist' }] });
// @ts-expect-error photo assembly patches retain canonical metadata types
buildPhotoCommandReducer({ buildPatch: () => ({ rating: 'raw' }) });
`;
    const selectorFixture = `
const libraryInputFixture = { A: [{ url: 'u', category: 'A', metadata: { shared: true } }] };
/** @type {PhotoUpdater} */ const libraryIdentityFixture = photo => photo;
const namedLibraryFixture = updatePhotoInNamedCollections(libraryInputFixture, 'u', photo => {
  /** @type {string} */ const copiedUrl = photo.url;
  /** @type {0 extends (1 & typeof photo.url) ? true : false} */ const updaterUrlIsAny = false;
  return { ...photo, url: copiedUrl, loved: true };
});
/** @type {CollectionUpdate} */ const namedLibraryResultFixture = namedLibraryFixture;
/** @type {Photo | null} */ const namedLibraryPhotoFixture = namedLibraryFixture.updatedPhoto;
/** @type {0 extends (1 & typeof namedLibraryFixture.collections.A[number]['url']) ? true : false} */ const namedLibraryUrlIsAny = false;
/** @type {Photo[]} */ const categoryPhotosFixture = getCategoryPhotos('A', libraryInputFixture, undefined);
/** @type {Photo} */ const categoryPhotoFixture = attachCategory('B', libraryInputFixture.A[0]);
/** @type {boolean} */ const recordComparisonFixture = shallowEqualRecords(null, { raw: true });
const canonicalLibraryStateFixture = /** @type {DomainState} */ ({});
/** @type {LibraryUpdate} */ const publicLibraryFixture = updatePhotoInLibraries(canonicalLibraryStateFixture.library.collections,
  canonicalLibraryStateFixture.library.externalCollections, 'u', photo => ({ ...photo, rating: 5 }));
/** @type {CollectionUpdate} */ const publicCollectionFixture = updatePhotoInCollections(libraryInputFixture, 'u', photo => photo);
// @ts-expect-error the private traversal needs a canonical URL-bearing row
updatePhotoInNamedCollections({ A: [{ title: 'no url' }] }, 'u', libraryIdentityFixture);
// @ts-expect-error updater output must still be a Photo
updatePhotoInNamedCollections(libraryInputFixture, 'u', () => ({ rating: 5 }));
// @ts-expect-error callbacks cannot replace a numeric rating with arbitrary compatibility metadata
updatePhotoInNamedCollections(libraryInputFixture, 'u', () => ({ url: 'u', rating: 'five' }));
// @ts-expect-error canonical URL lookup inputs are strings, not boxed/unnarrowed values
updatePhotoInNamedCollections(libraryInputFixture, {}, libraryIdentityFixture);
// @ts-expect-error no match remains nullable
/** @type {Photo} */ const missingLibraryPhotoFixture = namedLibraryFixture.updatedPhoto;
// @ts-expect-error changed is boolean, not a string
/** @type {string} */ const wrongLibraryChangedFixture = namedLibraryFixture.changed;
// @ts-expect-error category keys are strings
attachCategory(1, libraryInputFixture.A[0]);
// @ts-expect-error category projection cannot claim to normalize an unvalidated feed URL
attachCategory('A', { url: { raw: true } });
// @ts-expect-error only undefined uses the external-map default
getCategoryPhotos('A', libraryInputFixture, null);
// @ts-expect-error lookup accepts photo lists, not scalar pool contents
getCategoryPhotos('A', { A: 1 });
// @ts-expect-error the shallow predicate produces a boolean, not a canonicalized record
/** @type {Photo} */ const wrongRecordComparisonFixture = shallowEqualRecords({}, {});
`;
    const patchFixture = `
const rawPatchFixture = pickStatePatchFields(/** @type {unknown} */ ({ theme: { legacy: true } }));
/** @type {Record<string, unknown>} */ const rawPatchRecordFixture = rawPatchFixture;
/** @type {0 extends (1 & typeof rawPatchFixture.theme) ? true : false} */ const patchScalarIsAny = false;
STATE_PATCH_FIELDS.push('visionConfig'); // compile-only public mutation; no shared runtime list is changed
const mutableVisionFixture = pickStatePatchFields({ visionConfig: 7 }).visionConfig;
/** @type {0 extends (1 & typeof mutableVisionFixture) ? true : false} */ const mutableVisionIsAny = false;
if (mutableVisionFixture) {
  // @ts-expect-error mutable-list raw fields are not normalized vision records
  /** @type {string} */ const wrongMutableVisionUrlFixture = mutableVisionFixture.apiUrl;
}
const patchLocationFixture = normalizeManualLocation(/** @type {unknown} */ ({}));
/** @type {NonNullable<StatePatchPayload['manualLocation']>} */ const canonicalLocationFixture = patchLocationFixture;
/** @type {0 extends (1 & typeof patchLocationFixture.lat) ? true : false} */ const patchLatitudeIsAny = false;
const patchVisionFixture = normalizeVisionConfig(/** @type {unknown} */ ({}));
/** @type {NonNullable<StatePatchPayload['visionConfig']>} */ const canonicalVisionFixture = patchVisionFixture;
/** @type {0 extends (1 & typeof patchVisionFixture.apiKey) ? true : false} */ const patchVisionIsAny = false;
normalizeManualLocation(null); normalizeVisionConfig(false); normalizeVisionConfig(null); // unknown input is not validation
normalizeManualLocation(); normalizeVisionConfig(); pickStatePatchFields();
/** @type {string} */ const trimmedPatchFixture = trimString({ unvalidated: true });
/** @type {number} */ const patchCoordinateFixture = normalizeCoordinate(Symbol('coordinate'), 45);
const coordinateFallbackTokenFixture = { legacy: true };
const coordinateFallbackFixture = normalizeCoordinate(null, coordinateFallbackTokenFixture);
/** @type {number | typeof coordinateFallbackTokenFixture} */ const preservedFallbackFixture = coordinateFallbackFixture;
// @ts-expect-error generic coordinate fallback is not guaranteed numeric
/** @type {number} */ const wrongCoordinateFallbackFixture = coordinateFallbackFixture;
// @ts-expect-error raw scalar patch values must be narrowed, not assumed normalized
/** @type {string} */ const wrongPatchScalarFixture = rawPatchFixture.theme;
// @ts-expect-error coordinates are numeric on successful normalization
/** @type {string} */ const wrongPatchLatitudeFixture = patchLocationFixture.lat;
// @ts-expect-error vision fields normalize to strings, not numbers
/** @type {number} */ const wrongPatchVisionFixture = patchVisionFixture.apiKey;
// @ts-expect-error primitive-only trimming produces strings, not numbers
/** @type {number} */ const wrongTrimmedPatchFixture = trimString(1);
`;
    const commandFixture = `
const navigationInputFixture = { direction: /** @type {'next' | 'prev'} */ ('next'), socketEvent: 'next', routePath: '/next', notFoundMessage: 'missing' };
const navigationFixture = createAdvancePhotoTransportSpec(navigationInputFixture);
/** @type {0 extends (1 & typeof navigationFixture.direction) ? true : false} */ const navigationDirectionIsAny = false;
/** @type {'next' | 'prev'} */ const navigationDirectionFixture = navigationFixture.direction;
navigationFixture.direction = 'prev'; navigationFixture.fallbackArgs.push('prev'); // no immutability promise
/** @type {Command | null} */ const navigationSocketCommandFixture = navigationFixture.decodeSocket();
const navigationRouteFixture = REST_ADVANCE_PHOTO_ROUTE_SPECS[0];
/** @type {string} */ const navigationPathFixture = navigationRouteFixture.path;
/** @type {0 extends (1 & typeof navigationRouteFixture.path) ? true : false} */ const navigationPathIsAny = false;
/** @type {0 extends (1 & typeof navigationRouteFixture.notFoundMessage) ? true : false} */ const navigationMetadataIsAny = false;
// @ts-expect-error extra decorator metadata is not promised normalized by this boundary
/** @type {string} */ const navigationMetadataFixture = navigationRouteFixture.notFoundMessage;
const navigationRestCommandFixture = navigationRouteFixture.decode();
/** @type {0 extends (1 & typeof navigationRestCommandFixture) ? true : false} */ const navigationDecodedIsAny = false;
if (navigationRestCommandFixture?.type === 'advance-photo') {
  /** @type {'next' | 'prev' | undefined} */ const navigationRestDirectionFixture = navigationRestCommandFixture.payload?.direction;
}
// @ts-expect-error the specification input documents supported directions, not raw compatibility values
createAdvancePhotoTransportSpec({ ...navigationInputFixture, direction: 7 });
const malformedNavigationInputFixture = { ...navigationInputFixture, direction: 'sideways', metadata: true };
// @ts-expect-error inferred extra input fields do not erase a malformed known direction
createAdvancePhotoTransportSpec(malformedNavigationInputFixture);
// @ts-expect-error fallback arguments retain the navigation direction vocabulary
navigationFixture.fallbackArgs.push('sideways');
// @ts-expect-error public REST descriptors have string paths, not arbitrary raw values
navigationRouteFixture.path = 7;
// @ts-expect-error navigation decoders read no request payload
navigationRouteFixture.decode({ direction: 'next' });
// @ts-expect-error nullable command results require narrowing before payload access
navigationRestCommandFixture.payload.direction;
/** @type {unknown} */ const navigationRawMetadataFixture = navigationRouteFixture.notFoundMessage;
navigationRouteFixture.path = '/supported'; navigationRouteFixture.decode = () => null;
/** @type {string} */ const navigationPathKeyFixture = 'path';
// @ts-expect-error dynamic writes must not corrupt a promised string path
navigationRouteFixture[navigationPathKeyFixture] = 7;
/** @type {string} */ const navigationDecoderKeyFixture = 'decode';
// @ts-expect-error dynamic writes must not corrupt a promised decoder
navigationRouteFixture[navigationDecoderKeyFixture] = 7;
`;
    // ponytail: one compiler owner injects four modules; no program per helper.
    const fixtureDiagnostics = (text, selectorText, patchText, commandText = commandSource) => {
      const modules = new Map([[file, { text, fixture }], [selectorFile, { text: selectorText, fixture: selectorFixture }],
        [patchFile, { text: patchText, fixture: patchFixture }], [commandFile, { text: commandText, fixture: commandFixture }]]);
      const host = ts.createCompilerHost(parsed.options), read = host.getSourceFile;
      host.getSourceFile = (name, version, onError, newFile) => {
        const input = modules.get(path.resolve(name));
        return input ? ts.createSourceFile(name, `${input.text}\n${input.fixture}`, version, true) : read(name, version, onError, newFile);
      };
      const program = ts.createProgram(parsed.fileNames, parsed.options, host);
      return ts.getPreEmitDiagnostics(program).filter(diagnostic => {
        const input = diagnostic.file && modules.get(path.resolve(diagnostic.file.fileName));
        return input && diagnostic.start > input.text.length;
      });
    };
    assert.deepStrictEqual(fixtureDiagnostics(source, selectorSource, patchSource).map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
    const contractNames = new Set(['cloneState', 'normalizeFeedConfigKeywords', 'hasPool', 'normalizePoolName', 'mergePoolFeedConfig',
      'addPoolState', 'assignPoolKeywords', 'mergePoolSourceConfig', 'assignPoolPolicy', 'removePoolState', 'withUpdatedPhoto',
      'buildDefinedMetadataPatch', 'buildPhotoPersistenceEffects', 'keepUpdatedPhotoState', 'preserveUpdatedPhotoState',
      'reducePhotoLibraryCommand', 'readPhotoCommandUrl', 'buildPhotoCommandReducer']);
    // Strip contiguous overload/implementation docs once for every injected boundary.
    const withoutContracts = (name, text, names) => {
      const tree = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
      return tree.statements.filter(node => node.jsDoc?.length && (
        ts.isFunctionDeclaration(node) ? names.has(node.name?.text)
          : ts.isVariableStatement(node) && node.declarationList.declarations.some(item => names.has(item.name.getText(tree)))
      )).map(node => [node.jsDoc[0].pos, node.getStart(tree)]).sort(([left], [right]) => right - left)
        .reduce((input, [start, end]) => input.slice(0, start) + input.slice(end), text);
    };
    const withoutContract = withoutContracts(file, source, contractNames);
    const withoutLibraryContracts = ['attachCategory', 'getCategoryPhotos', 'updatePhotoInNamedCollections'].reduce((text, name) => {
      const start = text.indexOf(`function ${name}(`), comment = text.lastIndexOf('/**', start);
      return text.slice(0, comment) + text.slice(start);
    }, selectorSource);
    const withoutPatchContracts = ['trimString', 'normalizeCoordinate', 'pickStatePatchFields', 'normalizeVisionConfig', 'normalizeManualLocation'].reduce((text, name) => {
      const start = text.indexOf(`const ${name} =`), comment = text.lastIndexOf('/**', start);
      return text.slice(0, comment) + text.slice(start);
    }, patchSource);
    const withoutNavigationContract = withoutContracts(commandFile, commandSource, new Set(['createAdvancePhotoTransportSpec', 'REST_ADVANCE_PHOTO_ROUTE_SPECS']));
    const sensitive = fixtureDiagnostics(withoutContract, withoutLibraryContracts, withoutPatchContracts, withoutNavigationContract);
    const navigationSensitive = sensitive.filter(item => item.file.fileName === commandFile);
    assert.ok(navigationSensitive.some(item => item.code === 2322 && item.file.text.slice(item.start, item.start + 100).includes('navigationDirectionIsAny')), 'Navigation direction must not become any');
    assert.ok(navigationSensitive.some(item => item.code === 2322 && item.file.text.slice(item.start, item.start + 100).includes('navigationPathIsAny')), 'Public navigation paths must not become any');
    const patchSensitive = sensitive.filter(item => item.file.fileName === patchFile);
    assert.ok(patchSensitive.some(item => item.code === 2578 && item.file.text.slice(item.start, item.start + 100).includes('generic coordinate fallback')), 'Coordinate contracts must enforce generic fallback correlation');
    assert.ok(patchSensitive.some(item => item.code === 2322 && item.file.text.slice(item.start, item.start + 100).includes('patchLatitudeIsAny')), 'Location coordinates must retain their non-any leaf contract');
    const cloneSensitive = sensitive.filter(item => item.file.fileName === file);
    const librarySensitive = sensitive.filter(item => item.file.fileName === selectorFile);
    assert.ok(cloneSensitive.some(item => item.code === 2322 && item.file.text.slice(item.start, item.start + 100).includes('photoMutationUrlIsAny')), 'Photo mutation output must retain its non-any raw feed leaf');
    assert.ok(cloneSensitive.some(item => item.code === 2578 && item.file.text.slice(item.start, item.start + 100).includes('raw metadata is not normalized')), 'Raw metadata filtering must not acquire normalized fields');
    assert.ok(cloneSensitive.some(item => item.code === 2578 && item.file.text.slice(item.start, item.start + 100).includes('complete domain sections')), 'Removing the clone contract must invalidate its negative assertion');
    assert.ok(cloneSensitive.some(item => item.code === 2322 && item.file.text.slice(item.start, item.start + 100).includes('cloneResultIsAny')), 'The anti-any assertion must also reject an untyped clone result');
    assert.ok(cloneSensitive.some(item => item.code === 2578 && item.file.text.slice(item.start, item.start + 100).includes('pool creation requires')), 'Removing pool contracts must invalidate their negative assertion');
    assert.ok(cloneSensitive.some(item => item.code === 2322 && item.file.text.slice(item.start, item.start + 100).includes('poolKeywordIsAny')), 'The anti-any leaf assertion must reject untyped pool keyword copies');
    assert.ok(librarySensitive.some(item => item.code === 2578), 'Removing library contracts must invalidate negative compiler assertions');
    assert.ok(librarySensitive.some(item => item.code === 2322), 'The anti-any leaf assertion must reject an untyped library result');
  });

  assertTest('result envelopes preserve uninspected aliases and undefined-only output defaults', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.wrapResult = createResult;`, sandbox);
    const uninspected = new Proxy({}, { get: () => assert.fail('constructor inspected input') });
    const events = Object.freeze([{ type: 'photo-update' }]);
    const effects = Object.freeze([{ type: 'refresh-weather' }]);
    const result = sandbox.wrapResult(uninspected, events, effects);
    assert.deepStrictEqual(Object.keys(result), ['nextState', 'events', 'effects']);
    assert.strictEqual(result.nextState, uninspected);
    assert.strictEqual(result.events, events);
    assert.strictEqual(result.effects, effects);
    assert.notStrictEqual(result, sandbox.wrapResult(uninspected, events, effects));
    // Neither malformed descriptions nor state values are validated or normalized.
    [null, false, 0, '', NaN, uninspected, () => assert.fail('executed description')].forEach(value => {
      const raw = sandbox.wrapResult(value, value, value);
      assert.strictEqual(raw.nextState, value);
      assert.strictEqual(raw.events, value);
      assert.strictEqual(raw.effects, value);
    });
    const missingState = sandbox.wrapResult(undefined);
    assert.strictEqual(missingState.nextState, undefined);
    assert.strictEqual(missingState.events.length, 0);
    assert.strictEqual(missingState.effects.length, 0);
  });

  assertTest('result constructors retain state and effect aliases with fresh ordered descriptions', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.results = { createResult, unchangedResult, stateSyncResult, photoUpdateResult, effectOnlyResult };`, sandbox);
    const { createResult, unchangedResult, stateSyncResult, photoUpdateResult, effectOnlyResult } = sandbox.results;
    const state = Object.freeze({ raw: true });
    const cases = [
      { make: (state, effects) => createResult(state, undefined, effects), eventTypes: [] },
      { make: unchangedResult, eventTypes: [] },
      { make: stateSyncResult, eventTypes: ['state-sync'] },
      { make: photoUpdateResult, eventTypes: ['photo-update', 'state-sync'] },
      { make: effectOnlyResult, eventTypes: [] }
    ];
    cases.forEach(({ make, eventTypes }) => {
      const first = make(state);
      const second = make(state, undefined);
      assert.strictEqual(first.nextState, state);
      assert.strictEqual(second.nextState, state);
      assert.notStrictEqual(first, second);
      assert.notStrictEqual(first.events, second.events);
      assert.notStrictEqual(first.effects, second.effects);
      assert.notStrictEqual(first.events, first.effects);
      assert.deepStrictEqual(Array.from(first.events, event => event.type), eventTypes);
      assert.deepStrictEqual(Array.from(second.events, event => event.type), eventTypes);
      assert.strictEqual(first.effects.length, 0);
      assert.strictEqual(second.effects.length, 0);
      first.events.forEach((event, index) => assert.notStrictEqual(event, second.events[index]));
      first.effects.push({ type: 'persist' });
      assert.strictEqual(second.effects.length, 0);
    });
    const effects = Object.freeze([{ type: 'persist' }, { type: 'refresh-weather' }]);
    [stateSyncResult, photoUpdateResult, effectOnlyResult].forEach(make => {
      [null, false, 0, '', effects, new Proxy({}, { get: () => assert.fail('effect read') })].forEach(raw => {
        const result = make(state, raw);
        assert.strictEqual(result.nextState, state);
        assert.strictEqual(result.effects, raw);
      });
    });
  });

  assertTest('event result constructors propagate native iteration failures without inspecting effects', () => {
    const failure = new Error('event iteration failed');
    const sandbox = { module: { exports: {} }, require, failure };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.results = { createResult, unchangedResult, stateSyncResult, photoUpdateResult, effectOnlyResult };\nglobalThis.failIteration = () => { Array.prototype[Symbol.iterator] = () => { throw failure; }; };`, sandbox);
    const { createResult, unchangedResult, stateSyncResult, photoUpdateResult, effectOnlyResult } = sandbox.results;
    const state = new Proxy({}, { get: () => assert.fail('state read') });
    const effects = new Proxy({}, { get: () => assert.fail('effect read before event construction') });
    sandbox.failIteration();
    [stateSyncResult, photoUpdateResult].forEach(make => {
      assert.throws(() => make(state, effects), error => error === failure);
    });
    // Empty outputs allocate but never iterate; raw descriptions are only forwarded.
    assert.strictEqual(createResult(state, effects, effects).events, effects);
    assert.strictEqual(unchangedResult(state).nextState, state);
    assert.strictEqual(effectOnlyResult(state, effects).effects, effects);
  });

  assertTest('family dispatch returns exact results and adapts only the selected environment', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildFamilies = createReducerFamilyInterpreter;`, sandbox);
    const state = Object.freeze(createState());
    const env = Object.freeze({ marker: true });
    const result = Object.freeze({ arbitrary: 'result' });
    const calls = [];
    const reduce = sandbox.buildFamilies([
      { reducers: { bare: (s, c, e) => (calls.push('bare'), assert.strictEqual(s, state), assert.strictEqual(e, undefined), result) } },
      {
        buildEnv: original => (calls.push('adapt'), assert.strictEqual(original, env), null),
        reducers: { adapted: (s, c, e) => (calls.push('reduce'), assert.strictEqual(s, state), assert.strictEqual(c, command), assert.strictEqual(e, null), result) }
      },
      { buildEnv: () => assert.fail('unselected adapter'), reducers: { other: () => result } }
    ]);
    const command = Object.freeze({ type: 'adapted' });
    assert.strictEqual(reduce(state, command, env), result);
    assert.deepStrictEqual(calls, ['adapt', 'reduce']);
    calls.length = 0;
    assert.strictEqual(reduce(state, { type: 'bare' }, env), result);
    assert.deepStrictEqual(calls, ['bare']);
  });

  assertTest('keyed family handlers retain command, adapted environment and heterogeneous result identities', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildFamilies = createReducerFamilyInterpreter;`, sandbox);
    const state = Object.freeze(createState());
    const env = Object.freeze({ seed: 3 });
    const adapted = Object.freeze({ factor: 3 });
    const secret = Object.freeze({ type: 'save-env-secret', payload: Object.freeze({ value: 'example' }) });
    const recrawl = Object.freeze({ type: 'trigger-recrawl', payload: Object.freeze({ categories: ['garden'] }) });
    const result = Object.freeze({ saved: true });
    const calls = [];
    const select = (command, original, output) => (s, c, e) => {
      calls.push(c.type);
      assert.strictEqual(s, state);
      assert.strictEqual(c, command);
      assert.strictEqual(e, original);
      return output;
    };
    const reduce = sandbox.buildFamilies([
      { buildEnv: () => assert.fail('overridden adapter'), reducers: { 'save-env-secret': () => assert.fail('overridden handler') } },
      {
        buildEnv: original => (calls.push('adapt'), assert.strictEqual(original, env), adapted),
        reducers: {
          'save-env-secret': select(secret, adapted, result),
          'trigger-recrawl': select(recrawl, adapted, 7)
        }
      }
    ]);
    assert.strictEqual(reduce(state, secret, env), result);
    assert.strictEqual(reduce(state, recrawl, env), 7);
    assert.deepStrictEqual(calls, ['adapt', 'save-env-secret', 'adapt', 'trigger-recrawl']);
    calls.length = 0;
    assert.strictEqual(reduce(state, { type: 'missing' }, env).nextState, state);
    assert.deepStrictEqual(calls, []);
  });

  assertTest('family indexing captures own string entries eagerly with last-callable-key precedence', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildFamilies = createReducerFamilyInterpreter;`, sandbox);
    const calls = [];
    const first = Object.create({ inherited: () => assert.fail('inherited') }, {
      key: { enumerable: true, get: () => (calls.push('key'), () => 'first') },
      ignored: { enumerable: true, get: () => (calls.push('ignored'), 42) },
      hidden: { value: () => assert.fail('hidden') },
      [Symbol('symbol')]: { enumerable: true, value: () => assert.fail('symbol') }
    });
    const last = { key: () => 'last', ['__proto__']: () => 'explicit' };
    const reduce = sandbox.buildFamilies([
      { get reducers() { calls.push('reducers'); return first; }, get buildEnv() { calls.push('build env'); return undefined; } },
      { reducers: last }, { reducers: { key: false } }
    ]);
    assert.deepStrictEqual(calls, ['reducers', 'build env', 'key', 'ignored']);
    last.key = () => 'replacement must not be observed';
    const state = createState();
    assert.strictEqual(reduce(state, { get type() { calls.push('type'); return 'key'; } }), 'last');
    assert.deepStrictEqual(calls, ['reducers', 'build env', 'key', 'ignored', 'type']);
    assert.strictEqual(reduce(state, { type: '__proto__' }), 'explicit');
    [null, undefined, {}, { type: 'inherited' }, { type: 'hidden' }, { type: 'ignored' },
      { type: { toString: () => assert.fail('keys must not coerce') } }].forEach(command => {
      const a = reduce(state, command);
      const b = reduce(state, command);
      assert.strictEqual(a.nextState, state);
      assert.strictEqual(a.events.length, 0);
      assert.strictEqual(a.effects.length, 0);
      assert.notStrictEqual(a, b);
      assert.notStrictEqual(a.events, b.events);
      assert.notStrictEqual(a.effects, b.effects);
    });
  });

  assertTest('family dispatch propagates native registration, lookup, adapter and reducer failures in order', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildFamilies = createReducerFamilyInterpreter;`, sandbox);
    const failure = new Error('family failure');
    const fail = () => { throw failure; };
    assert.throws(() => sandbox.buildFamilies([{ reducers: { get key() { return fail(); } } }]), error => error === failure);
    const state = createState();
    const calls = [];
    const reduce = sandbox.buildFamilies([
      { buildEnv: () => (calls.push('adapter'), fail()), reducers: { adapt: () => assert.fail('after failed adapter') } },
      { buildEnv: () => (calls.push('adapter'), false), reducers: { run: (s, c, e) => (calls.push('reducer'), assert.strictEqual(e, false), fail()) } },
      { buildEnv: false, reducers: { bare: (s, c, e) => (assert.strictEqual(e, undefined), 'bare') } },
      { buildEnv: true, reducers: { malformed: () => assert.fail('after malformed adapter') } }
    ]);
    assert.throws(() => reduce(state, { get type() { return fail(); } }), error => error === failure);
    assert.deepStrictEqual(calls, []);
    assert.throws(() => reduce(state, { type: 'adapt' }), error => error === failure);
    assert.deepStrictEqual(calls, ['adapter']);
    calls.length = 0;
    assert.throws(() => reduce(state, { type: 'run' }), error => error === failure);
    assert.deepStrictEqual(calls, ['adapter', 'reducer']);
    assert.strictEqual(reduce(state, { type: 'bare' }), 'bare');
    assert.throws(() => reduce(state, { type: 'malformed' }), error => error.name === 'TypeError');
  });

  assertTest('public family dispatch preserves raw selected URL identity without mutating its input', () => {
    const rawUrl = Object.freeze({ id: 'family-selected' });
    const row = Object.freeze({ url: rawUrl, rating: 0 });
    const state = createState({
      library: { collections: { pool: [row] }, externalCollections: {}, photosList: [] },
      playback: { selectedCategories: ['pool'], activePhotoUrl: null }
    });
    const result = reduceDomainCommand(state, { type: 'select-categories', payload: { categories: ['pool'] } }, {
      now: new Date(2026, 0, 1), rng: () => assert.fail('zero-weight selection must not draw')
    });
    assert.strictEqual(result.nextState.playback.activePhotoUrl, rawUrl);
    assert.notStrictEqual(result.nextState, state);
    assert.strictEqual(state.playback.activePhotoUrl, null);
    assert.strictEqual(state.library.photosList.length, 0);
    assert.deepStrictEqual(result.events.map(({ type }) => type), ['photo-update', 'state-sync']);
  });

  assertTest('raw active URL state composes reduction, snapshot application and legacy rebuilding by identity', () => {
    const rawUrl = Object.freeze({ id: 'raw-active', toString: () => assert.fail('URL must not coerce') });
    const row = Object.freeze({ url: rawUrl, category: 'pool', orientation: 'landscape' });
    const state = Object.freeze(createState({
      config: { splitPortrait: false },
      library: { collections: {}, externalCollections: {}, photosList: [row] },
      playback: { selectedCategories: ['pool'], activePhotoUrl: rawUrl }
    }));
    const env = Object.freeze({ now: new Date(2026, 0, 1), rng: () => assert.fail('unexpected RNG draw') });
    const reduced = reduceDomainCommand(state, null, env);
    assert.strictEqual(reduced.nextState, state);
    const snapshot = buildSnapshot(reduced.nextState);
    assert.strictEqual(snapshot.playback, state.playback);
    assert.strictEqual(snapshot.activePhoto, row);
    assert.strictEqual(snapshot.photosList[0].url, rawUrl);
    assert.notStrictEqual(snapshot.photosList[0], row);
    const legacy = {};
    const applied = applyDomainState(legacy, {}, reduced.nextState);
    assert.strictEqual(applied.playback, state.playback);
    assert.strictEqual(legacy.activePhoto, row);
    const rebuilt = buildDomainState(legacy, {});
    assert.strictEqual(rebuilt.playback.activePhotoUrl, rawUrl);
    assert.notStrictEqual(rebuilt.library.photosList[0], row);
    assert.strictEqual(buildSnapshot(rebuilt).activePhoto.url, rawUrl);
    assert.strictEqual(reduceDomainCommand(rebuilt, null, env).nextState, rebuilt);
    const differentIdentity = { ...state, playback: { ...state.playback, activePhotoUrl: { id: 'raw-active' } } };
    assert.strictEqual(buildSnapshot(differentIdentity).activePhoto, null);
  });

  assertTest('legacy active URL projection preserves truthiness, single reads and native failures', () => {
    const baseline = buildSnapshot(createState({ config: { splitPortrait: false } }));
    [false, 0, NaN, '', null, undefined, 42, Symbol('url'), Object.freeze({ id: 'url' })].forEach(url => {
      let reads = 0;
      const activePhoto = Object.freeze({ get url() { reads += 1; return url; } });
      const rebuilt = buildDomainState({ ...baseline, activePhoto }, {});
      assert.strictEqual(rebuilt.playback.activePhotoUrl, url || null);
      assert.strictEqual(reads, 1);
    });
    const failure = new Error('raw URL read');
    const legacy = { ...baseline, activePhoto: { get url() { throw failure; } } };
    assert.throws(() => buildDomainState(legacy, {}), error => error === failure);
    assert.strictEqual(baseline.playback.activePhotoUrl, 'port-1');
  });

  assertTest('reducer execution inputs replay time-filtered selection without mutating inputs', () => {
    const state = Object.freeze(createState({
      library: {
        photosList: [
          { url: 'morning', category: 'Liminal Spaces', timeRanges: [{ start: '06:00', end: '11:59' }] },
          { url: 'afternoon', category: 'Liminal Spaces', timeRanges: [{ start: '12:00', end: '17:59' }] }
        ]
      },
      playback: { activePhotoUrl: null }
    }));
    const command = Object.freeze({ type: 'advance-photo', payload: Object.freeze({ strategy: 'smart' }) });
    const before = JSON.stringify(state);

    [['09:00', 'morning'], ['15:00', 'afternoon']].forEach(([time, expected]) => {
      const now = Object.freeze(new Date(`2026-10-25T${time}:00`));
      const env = Object.freeze({ now, rng: () => 0 });
      const first = reduceDomainCommand(state, command, env);
      const second = reduceDomainCommand(state, command, env);

      assert.deepStrictEqual(first, second);
      assert.notStrictEqual(first.nextState, state);
      assert.strictEqual(first.nextState.playback.activePhotoUrl, expected);
      assert.deepStrictEqual(first.events.map(({ type }) => type), ['photo-update', 'state-sync']);
      assert.deepStrictEqual(first.effects, []);
      assert.strictEqual(now.getTime(), new Date(`2026-10-25T${time}:00`).getTime());
    });
    assert.strictEqual(JSON.stringify(state), before);
  });

  assertTest('reducer no-ops retain state identity with fresh result arrays and never draw randomness', () => {
    const state = Object.freeze(createState());
    const env = Object.freeze({ now: new Date('2026-10-25T12:00:00'), rng: () => assert.fail('Unexpected RNG draw') });
    const commands = [null, undefined, { type: 'unknown' }, { type: 'toString' }, { type: 'delete-pool', payload: { name: '' } }];
    const results = commands.map((command) => reduceDomainCommand(state, command, env));

    results.forEach((result) => {
      assert.deepStrictEqual(result, { nextState: state, events: [], effects: [] });
      assert.strictEqual(result.nextState, state);
      assert.notStrictEqual(result.events, result.effects);
      assert.notStrictEqual(result.events, reduceDomainCommand(state, null, env).events);
    });
  });

  assertTest('reducer propagates exact environment failures without changing the input state', () => {
    const state = createState();
    const before = JSON.stringify(state);
    const failure = new Error('Injected execution failure');
    const command = { type: 'advance-photo', payload: { strategy: 'smart' } };
    const reject = () => { throw failure; };
    [
      { get now() { return reject(); }, get rng() { return assert.fail('Read after failed clock'); } },
      { now: new Date('2026-10-25T12:00:00'), rng: reject }
    ].forEach((env) => {
      assert.throws(() => reduceDomainCommand(state, command, env), (error) => error === failure);
      assert.strictEqual(JSON.stringify(state), before);
    });
  });

  assertTest('reducer resolves truthy clock/random defaults eagerly and independently before lookup', () => {
    const reads = [];
    const isolatedModule = { exports: {} };
    runInNewContext(fs.readFileSync(path.join(__dirname, 'reducer.js'), 'utf8'), {
      module: isolatedModule,
      require,
      Date: class extends Date {
        constructor() { super('2026-10-25T12:00:00'); reads.push('clock'); }
      },
      Math: { get random() { reads.push('random-default'); return () => { reads.push('draw'); return 0; }; } }
    });
    const reduce = isolatedModule.exports.reduceDomainCommand;
    const state = createState();
    const now = new Date('2026-10-25T12:00:00');
    const rng = () => 0;

    [undefined, {}, { now: null, rng: null }, { now: false, rng: 0 }, { now: '', rng: '' }].forEach((env) => {
      reads.length = 0;
      assert.strictEqual(reduce(state, null, env).nextState, state);
      assert.deepStrictEqual(reads, ['clock', 'random-default']);
    });
    [[{ now }, ['random-default']], [{ rng }, ['clock']], [{ now, rng }, []]].forEach(([env, expected]) => {
      reads.length = 0;
      reduce(state, null, env);
      assert.deepStrictEqual(reads, expected);
    });
    reads.length = 0;
    reduce(state, { type: 'advance-photo', payload: { strategy: 'smart' } });
    assert.deepStrictEqual(reads, ['clock', 'random-default', 'draw']);
    assert.throws(() => reduce(state, null, null), { name: 'TypeError' });
  });

  assertTest('feed and pool reducer builders resolve declarative options from one command context', () => {
    const state = createState({
      playback: {
        selectedCategories: ['Scenic Nature'],
        activePhotoUrl: 'port-1',
        lastDirection: 'next'
      }
    });

    const feedResult = reduceDomainCommand(state, {
      type: 'select-categories',
      payload: { categories: ['Liminal Spaces'] }
    });
    const poolResult = reduceDomainCommand(state, {
      type: 'set-pool-keywords',
      payload: { name: 'Scenic Nature', keywords: ['mountain'] }
    });

    assert.deepStrictEqual(feedResult.events.map((event) => event.type), ['photo-update', 'state-sync']);
    assert.deepStrictEqual(poolResult.events.map((event) => event.type), ['state-sync']);
    assert.deepStrictEqual(poolResult.effects.map((effect) => effect.type), ['persist']);
  });

  assertTest('shared command payload boundary preserves invalid no-op semantics across reducer families', () => {
    const state = createState();
    const invalidCommands = [
      { type: 'delete-pool', payload: { name: '   ' } },
      { type: 'set-pool-keywords', payload: { name: '   ', keywords: ['mist'] } },
      { type: 'set-active-photo', payload: { title: 'Missing URL' } }
    ];

    invalidCommands.forEach((command) => {
      const result = reduceDomainCommand(state, command);

      assert.strictEqual(result.nextState, state);
      assert.deepStrictEqual(result.events, []);
      assert.deepStrictEqual(result.effects, []);
    });
  });

  assertTest('indexed interpreters preserve declarative order and isolate unknown keys', () => {
    const interpret = createIndexedInterpreter(
      [
        ['first', (value) => value + 1],
        ['first', (value) => value + 2]
      ],
      (handler, value) => handler(value),
      () => 'fallback'
    );

    assert.strictEqual(interpret('first', 1), 3);
    assert.strictEqual(interpret('toString', 1), 'fallback');
    assert.strictEqual(interpret('__proto__', 1), 'fallback');
  });

  assertTest('closed interpreters adapt handler records without opening prototype keys', () => {
    const interpret = createClosedInterpreter({
      increment: (value) => value + 1
    }, (handler, value) => handler(value), () => 'fallback');

    assert.strictEqual(interpret('increment', 1), 2);
    assert.strictEqual(interpret('toString', 1), 'fallback');
    assert.strictEqual(interpret('__proto__', 1), 'fallback');
  });

  assertTest('handler invokers capture a closed table and forward original items and results', () => {
    const shared = { marker: true };
    const promise = Promise.resolve(shared);
    const seen = [];
    const handlers = Object.assign(Object.create({ inherited: () => 'inherited' }), {
      sync: (item) => { seen.push(item); return shared; },
      async: () => promise,
      nonFunction: 42
    });
    Object.defineProperty(handlers, 'hidden', { value: () => 'hidden' });
    const invoke = createTypedHandlerInvoker(handlers);
    const item = { type: 'sync', payload: shared };
    handlers.sync = () => 'replaced';
    handlers.later = () => 'later';

    assert.strictEqual(invoke(item), shared);
    assert.strictEqual(seen[0], item);
    assert.strictEqual(invoke({ type: 'async' }), promise);
    [null, undefined, {}, { type: 'inherited' }, { type: 'hidden' },
      { type: 'toString' }, { type: 'later' }, { type: 'nonFunction' }]
      .forEach((input) => assert.strictEqual(invoke(input), undefined));
  });

  assertTest('handler invokers preserve capture and invocation failure boundaries', () => {
    const failure = new Error('handler failure');
    const captureFailure = new Error('capture failure');
    assert.throws(() => createTypedHandlerInvoker({ get broken() { throw captureFailure; } }),
      (error) => error === captureFailure);
    const invoke = createTypedHandlerInvoker({ broken: () => { throw failure; } });
    assert.throws(() => invoke({ type: 'broken' }), (error) => error === failure);
    assert.throws(() => invoke({ get type() { throw failure; } }), (error) => error === failure);
  });

  assertTest('event emission keeps the declared vocabulary closed', () => {
    const emitted = [];
    const emitEvents = createEventEmitter({
      'state-sync': (event) => emitted.push(event.type)
    });

    emitEvents([
      { type: 'state-sync' },
      { type: 'toString' },
      { type: '__proto__' },
      { type: 'unknown-event' }
    ]);

    assert.deepStrictEqual(emitted, ['state-sync']);
  });

  assertTest('shared socket state-patch specs compose the patch-state command boundary declaratively', () => {
    const decodeWidgetCommand = findSocketStatePatchDecode('toggle-widget');
    const decodeThemeCommand = findSocketStatePatchDecode('change-theme');
    const decodeIntervalCommand = findSocketStatePatchDecode('change-interval');
    const decodeAlignWeatherCommand = findSocketStatePatchDecode('toggle-align-weather');
    const decodeManualLocationCommand = findSocketStatePatchDecode('update-manual-location');

    assert.deepStrictEqual(decodeWidgetCommand({ widgetName: 'clock', visible: 0 }), {
      type: 'patch-state',
      payload: {
        widgets: { clock: 0 }
      }
    });
    assert.deepStrictEqual(decodeThemeCommand(' Cosmic Night '), {
      type: 'patch-state',
      payload: {
        theme: 'Cosmic Night'
      }
    });
    assert.deepStrictEqual(decodeIntervalCommand(45000), {
      type: 'patch-state',
      payload: {
        slideshowInterval: 45000
      }
    });
    assert.deepStrictEqual(decodeAlignWeatherCommand(true), {
      type: 'patch-state',
      payload: {
        alignWeather: true
      }
    });
    assert.deepStrictEqual(decodeManualLocationCommand({
      lat: '45.50',
      lon: '-73.57',
      city: ' Verdun ',
      regionName: ' Quebec ',
      country: ' Canada '
    }), {
      type: 'patch-state',
      payload: {
        manualLocation: {
          lat: 45.5,
          lon: -73.57,
          city: 'Verdun',
          regionName: 'Quebec',
          country: 'Canada'
        }
      }
    });
  });

  assertTest('shared socket state-patch specs reject invalid enum and percent payloads', () => {
    const decodeScaleModeCommand = findSocketStatePatchDecode('change-scale-mode');
    const decodeNightPercentageCommand = findSocketStatePatchDecode('change-night-percentage');

    assert.deepStrictEqual(decodeScaleModeCommand('contain'), {
      type: 'patch-state',
      payload: {
        scaleMode: 'contain'
      }
    });
    assert.strictEqual(decodeScaleModeCommand('stretch'), null);
    assert.deepStrictEqual(decodeNightPercentageCommand(25), {
      type: 'patch-state',
      payload: {
        nightPercentage: 25
      }
    });
    assert.strictEqual(decodeNightPercentageCommand(250), null);
  });

  assertTest('shared durable socket command specs centralize legacy event decoding and fallback policy metadata', () => {
    const categorySpec = findSocketCommandSpec('change-category');
    const nextPhotoSpec = findSocketCommandSpec('next-photo');
    const brokenPhotoSpec = findSocketCommandSpec('mark-photo-broken');

    assert.deepStrictEqual(categorySpec?.decode(' Scenic Nature,Liminal Spaces '), {
      type: 'select-categories',
      payload: {
        categories: ' Scenic Nature,Liminal Spaces '
      }
    });
    assert.strictEqual(categorySpec?.fallbackKey, 'categorySelection');
    assert.deepStrictEqual(nextPhotoSpec?.decode(), {
      type: 'advance-photo',
      payload: {
        direction: 'next',
        strategy: 'smart'
      }
    });
    assert.deepStrictEqual(nextPhotoSpec?.fallbackArgs, ['next']);
    assert.deepStrictEqual(brokenPhotoSpec?.decode({ url: 'broken-photo' }), {
      type: 'mark-photo-broken',
      payload: {
        url: 'broken-photo'
      }
    });
    assert.strictEqual(brokenPhotoSpec?.fallbackKey, 'brokenPhoto');
  });

  assertTest('shared async-job and secret socket specs keep their command and acknowledgement metadata declarative', () => {
    const recrawlSpec = findSocketAsyncJobSpec('trigger-recrawl');
    const visionSpec = findSocketAsyncJobSpec('trigger-vision-analysis');
    const useApiSpec = findSocketSecretSpec('save-useapi-token');
    const useApiRouteSpec = findRestAdminSecretRouteSpec('/api/admin/secrets/useapi-token');

    assert.deepStrictEqual(recrawlSpec?.decode({ categories: [' Scenic Nature ', ''] }), {
      type: 'trigger-recrawl',
      payload: {
        categories: ['Scenic Nature']
      }
    });
    assert.strictEqual(recrawlSpec?.unavailableEvent, 'recrawl-complete');
    assert.deepStrictEqual(visionSpec?.unavailablePayload, {
      type: 'vision-analysis',
      status: 'failed',
      error: 'Vision-analysis dispatcher unavailable.'
    });
    assert.deepStrictEqual(useApiSpec?.decode({ token: ' secret-123 ' }), {
      type: 'save-env-secret',
      payload: {
        envKey: 'USEAPI_TOKEN',
        runtimeFlag: 'hasUseApiToken',
        value: 'secret-123'
      }
    });
    assert.deepStrictEqual(useApiSpec?.decode({ token: ' secret-123 ' }), useApiRouteSpec?.decode({ token: ' secret-123 ' }));
    assert.strictEqual(useApiSpec?.successEvent, 'useapi-token-saved');
  });

  assertTest('shared socket listener specs collapse registration families onto one declarative table', () => {
    const listenerEvents = SOCKET_COMMAND_LISTENER_SPECS.map(({ event }) => event);
    const expectedEvents = [
      ...SOCKET_STATE_PATCH_SPECS,
      ...SOCKET_DURABLE_COMMAND_SPECS,
      ...SOCKET_ASYNC_JOB_COMMAND_SPECS,
      ...SOCKET_SECRET_COMMAND_SPECS
    ].map(({ event }) => event);

    assert.deepStrictEqual(listenerEvents, expectedEvents);
    assert.strictEqual(findSocketListenerSpec('change-theme')?.family, 'state-patch');
    assert.strictEqual(findSocketListenerSpec('next-photo')?.family, 'durable-command');
    assert.strictEqual(findSocketListenerSpec('trigger-recrawl')?.family, 'async-job');
    assert.strictEqual(findSocketListenerSpec('save-useapi-token')?.family, 'secret-save');
  });

  assertTest('screensaver decoder requires an explicit boolean active flag', () => {
    assert.deepStrictEqual(decodeScreensaverActiveCommand({ active: true }), {
      type: 'set-screensaver-active',
      payload: { active: true }
    });
    assert.strictEqual(decodeScreensaverActiveCommand({ active: 'true' }), null);
  });

  assertTest('filters time, weather, and night candidates declaratively', () => {
    const timed = filterPhotosForTime([
      { url: 'day', timeRanges: [{ start: '08:00', end: '18:00' }] },
      { url: 'night', timeRanges: [{ start: '18:00', end: '06:00' }] }
    ], new Date('2026-06-27T21:00:00-04:00'));
    assert.deepStrictEqual(timed.map((photo) => photo.url), ['night']);

    const weather = filterPhotosForWeather([
      { url: 'rain', isRain: true },
      { url: 'sun', isSunny: true }
    ], true, 'Rainy', 'Cloudy', () => 0.1);
    assert.deepStrictEqual(weather.map((photo) => photo.url), ['rain']);

    const night = filterPhotosForNight([
      { url: 'night', isNight: true },
      { url: 'day', isNight: false }
    ], true, true, 100, () => 0.1);
    assert.deepStrictEqual(night.map((photo) => photo.url), ['night']);
  });

  assertTest('night filtering preserves an explicit 0% preference', () => {
    const candidates = [
      { url: 'night', isNight: true },
      { url: 'day', isNight: false }
    ];
    const filtered = filterPhotosForNight(candidates, true, true, 0, () => 0.1);
    assert.deepStrictEqual(filtered.map((photo) => photo.url), ['night', 'day']);
  });

  assertTest('derives split currentFrame without mutable second-photo state', () => {
    const frame = deriveCurrentFrame(createState());
    assert.strictEqual(frame.layout, 'split');
    assert.strictEqual(frame.primary?.url, 'port-1');
    assert.strictEqual(frame.secondary?.url, 'port-2');
    assert.strictEqual(frame.context.splitEligible, true);
  });

  assertTest('crop updates flow through the live split frame and persistence state', () => {
    const primaryCropResult = reduceDomainCommand(createState(), {
      type: 'set-photo-crop',
      payload: { url: 'port-1', cropPercent: 37 }
    });
    const primaryFrame = deriveCurrentFrame(primaryCropResult.nextState);

    assert.strictEqual(primaryFrame.primary?.cropPercent, 37);
    assert.strictEqual(primaryCropResult.nextState.library.photosList.find((photo) => photo.url === 'port-1')?.cropPercent, 37);
    assert.deepStrictEqual(primaryCropResult.events.map((event) => event.type), ['state-sync']);
    assert.deepStrictEqual(primaryCropResult.effects.map((effect) => effect.type), ['persist']);

    const secondaryCropResult = reduceDomainCommand(primaryCropResult.nextState, {
      type: 'set-photo-crop',
      payload: { url: 'port-2', cropPercent: 82 }
    });
    const secondaryFrame = deriveCurrentFrame(secondaryCropResult.nextState);

    assert.strictEqual(secondaryFrame.secondary?.url, 'port-2');
    assert.strictEqual(secondaryFrame.secondary?.cropPercent, 82);
    assert.strictEqual(secondaryCropResult.nextState.library.collections['Liminal Spaces'][1].cropPercent, 82);
  });

  assertTest('external Google Photos metadata updates emit a source-local persistence effect through the shared reducer path', () => {
    const googleUrl = '/api/google-photos/media/picker-123?w=2560&h=1440';
    const state = createState({
      library: {
        collections: createState().library.collections,
        externalCollections: {
          'Google Photos': [{
            url: googleUrl,
            title: 'Picker Photo',
            category: 'Google Photos',
            preventPairing: false
          }]
        },
        photosList: [{
          url: googleUrl,
          title: 'Picker Photo',
          category: 'Google Photos',
          preventPairing: false
        }]
      },
      playback: {
        selectedCategories: ['Google Photos'],
        activePhotoUrl: googleUrl,
        splitSeed: 0,
        lastDirection: 'next'
      }
    });

    const result = reduceDomainCommand(state, {
      type: 'set-photo-prevent-pairing',
      payload: { url: googleUrl, preventPairing: true, preserveActive: true }
    });

    assert.strictEqual(result.nextState.library.externalCollections['Google Photos'][0].preventPairing, true);
    assert.strictEqual(result.nextState.playback.activePhotoUrl, googleUrl);
    assert.deepStrictEqual(result.events.map((event) => event.type), ['state-sync']);
    assert.deepStrictEqual(result.effects, [{
      type: 'persist-external-photo-metadata',
      payload: {
        url: googleUrl,
        metadata: { preventPairing: true }
      }
    }]);
  });

  assertTest('external Google Photos pairing metadata can be cleared through the shared reducer path', () => {
    const googleUrl = '/api/google-photos/media/picker-456?w=2560&h=1440';
    const state = createState({
      library: {
        collections: createState().library.collections,
        externalCollections: {
          'Google Photos': [{ url: googleUrl, preventPairing: true }]
        },
        photosList: [{ url: googleUrl, preventPairing: true }]
      },
      playback: {
        selectedCategories: ['Google Photos'],
        activePhotoUrl: googleUrl,
        splitSeed: 0,
        lastDirection: 'next'
      }
    });

    const result = reduceDomainCommand(state, {
      type: 'set-photo-prevent-pairing',
      payload: { url: googleUrl, preventPairing: false }
    });

    assert.strictEqual(result.nextState.library.externalCollections['Google Photos'][0].preventPairing, false);
    assert.deepStrictEqual(result.effects, [{
      type: 'persist-external-photo-metadata',
      payload: {
        url: googleUrl,
        metadata: { preventPairing: false }
      }
    }]);
  });

  assertTest('loved photo updates flow through the shared reducer and persistence path', () => {
    const result = reduceDomainCommand(createState(), {
      type: 'set-photo-loved',
      payload: { url: 'port-1', loved: true }
    });
    const frame = deriveCurrentFrame(result.nextState);

    assert.strictEqual(result.nextState.library.collections['Liminal Spaces'][0].loved, true);
    assert.strictEqual(result.nextState.library.photosList.find((photo) => photo.url === 'port-1')?.loved, true);
    assert.strictEqual(frame.primary?.loved, true);
    assert.deepStrictEqual(result.events.map((event) => event.type), ['state-sync']);
    assert.deepStrictEqual(result.effects, [{ type: 'persist' }]);
  });

  assertTest('loved Google Photos metadata emits a source-local persistence effect through the shared reducer path', () => {
    const googleUrl = '/api/google-photos/media/picker-loved?w=2560&h=1440';
    const state = createState({
      library: {
        collections: createState().library.collections,
        externalCollections: {
          'Google Photos': [{
            url: googleUrl,
            title: 'Loved Picker Photo',
            category: 'Google Photos',
            loved: false
          }]
        },
        photosList: [{
          url: googleUrl,
          title: 'Loved Picker Photo',
          category: 'Google Photos',
          loved: false
        }]
      },
      playback: {
        selectedCategories: ['Google Photos'],
        activePhotoUrl: googleUrl,
        splitSeed: 0,
        lastDirection: 'next'
      }
    });

    const result = reduceDomainCommand(state, {
      type: 'set-photo-loved',
      payload: { url: googleUrl, loved: true }
    });

    assert.strictEqual(result.nextState.library.externalCollections['Google Photos'][0].loved, true);
    assert.deepStrictEqual(result.effects, [{
      type: 'persist-external-photo-metadata',
      payload: {
        url: googleUrl,
        metadata: { loved: true }
      }
    }]);
  });

  assertTest('report-photo-metadata decodes and persists Google Photos dimensions through the same effect language', () => {
    const googleUrl = '/api/google-photos/media/picker-456?w=2560&h=1440';
    const state = createState({
      library: {
        collections: createState().library.collections,
        externalCollections: {
          'Google Photos': [{
            url: googleUrl,
            title: 'Picker Photo',
            category: 'Google Photos'
          }]
        },
        photosList: [{
          url: googleUrl,
          title: 'Picker Photo',
          category: 'Google Photos'
        }]
      },
      playback: {
        selectedCategories: ['Google Photos'],
        activePhotoUrl: googleUrl,
        splitSeed: 0,
        lastDirection: 'next'
      }
    });
    const command = decodePhotoMetadataCommand({
      url: googleUrl,
      orientation: 'portrait',
      width: 1080,
      height: 1920
    });
    const result = reduceDomainCommand(state, command);

    assert.strictEqual(result.nextState.library.externalCollections['Google Photos'][0].orientation, 'portrait');
    assert.strictEqual(result.nextState.library.externalCollections['Google Photos'][0].width, 1080);
    assert.strictEqual(result.nextState.library.externalCollections['Google Photos'][0].height, 1920);
    assert.deepStrictEqual(result.events.map((event) => event.type), ['state-sync']);
    assert.deepStrictEqual(result.effects, [{
      type: 'persist-external-photo-metadata',
      payload: {
        url: googleUrl,
        metadata: {
          orientation: 'portrait',
          width: 1080,
          height: 1920
        }
      }
    }]);
  });

  assertTest('photo mutation patches drive both immutable photo state and persisted metadata', () => {
    const googleUrl = '/api/google-photos/media/picker-crop?w=2560&h=1440';
    const state = createState({
      library: {
        collections: createState().library.collections,
        externalCollections: {
          'Google Photos': [{ url: googleUrl, category: 'Google Photos' }]
        },
        photosList: [{ url: googleUrl, category: 'Google Photos' }]
      },
      playback: {
        selectedCategories: ['Google Photos'],
        activePhotoUrl: googleUrl,
        splitSeed: 0,
        lastDirection: 'next'
      }
    });

    const result = reduceDomainCommand(state, {
      type: 'set-photo-crop',
      payload: { url: googleUrl, cropPercent: 42 }
    });

    assert.strictEqual(result.nextState.library.externalCollections['Google Photos'][0].cropPercent, 42);
    assert.strictEqual(result.nextState.library.externalCollections['Google Photos'][0].cropPositionY, undefined);
    assert.deepStrictEqual(result.effects, [{
      type: 'persist-external-photo-metadata',
      payload: {
        url: googleUrl,
        metadata: { cropPercent: 42 }
      }
    }]);
  });

  assertTest('disallowing pairing can preserve the focused split portrait as the active single photo', () => {
    const result = reduceDomainCommand(createState(), {
      type: 'set-photo-prevent-pairing',
      payload: { url: 'port-2', preventPairing: true, preserveActive: true }
    });
    const frame = deriveCurrentFrame(result.nextState);

    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'port-2');
    assert.strictEqual(frame.layout, 'single');
    assert.strictEqual(frame.primary?.url, 'port-2');
    assert.strictEqual(frame.secondary, null);
    assert.strictEqual(frame.primary?.preventPairing, true);
    assert.deepStrictEqual(result.events.map((event) => event.type), ['photo-update', 'state-sync']);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist']);
  });

  assertTest('reducer banning the active photo advances playback exactly once', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'rate-photo',
      payload: { url: 'port-1', rating: 1 }
    }, { now: new Date('2026-06-27T02:00:00'), rng: () => 0.1 });

    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'port-2');
    assert.strictEqual(result.nextState.library.photosList.some((photo) => photo.url === 'port-1'), false);
    assert.deepStrictEqual(result.events.map((event) => event.type), ['photo-update', 'state-sync']);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist']);
  });

  assertTest('marking the active photo broken shares the same immutable recovery continuation', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'mark-photo-broken',
      payload: { url: 'port-1' }
    }, { now: new Date('2026-06-27T02:00:00'), rng: () => 0.1 });

    assert.strictEqual(state.playback.activePhotoUrl, 'port-1');
    assert.strictEqual(state.library.photosList.some((photo) => photo.url === 'port-1'), true);
    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'port-2');
    assert.strictEqual(result.nextState.library.photosList.some((photo) => photo.url === 'port-1'), false);
    assert.deepStrictEqual(result.events.map((event) => event.type), ['photo-update', 'state-sync']);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist']);
  });

  assertTest('broken-photo recovery selects once and repeated reports cannot skip the healthy replacement', () => {
    const original = createState();
    const command = { type: 'mark-photo-broken', payload: { url: 'port-1' } };
    const env = { now: new Date('2026-06-27T02:00:00'), rng: () => 0.1 };
    const recovered = reduceDomainCommand(original, command, env);
    const repeated = reduceDomainCommand(recovered.nextState, command, env);

    assert.strictEqual(recovered.nextState.playback.activePhotoUrl, 'port-2');
    assert.strictEqual(recovered.events.filter(event => event.type === 'photo-update').length, 1);
    assert.strictEqual(repeated.nextState, recovered.nextState);
    assert.deepStrictEqual(repeated.events, []);
    assert.deepStrictEqual(repeated.effects, []);
    assert.strictEqual(original.playback.activePhotoUrl, 'port-1');
    assert.strictEqual(original.library.collections['Liminal Spaces'][0].isBroken, undefined);
  });

  assertTest('a broken secondary is removed without advancing the healthy primary', () => {
    const original = createState();
    const result = reduceDomainCommand(original, {
      type: 'mark-photo-broken', payload: { url: 'port-2' }
    }, { now: new Date('2026-06-27T02:00:00'), rng: () => 0.1 });

    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'port-1');
    assert.strictEqual(result.nextState.library.photosList.some(photo => photo.url === 'port-2'), false);
    assert.deepStrictEqual(result.events.map(event => event.type), ['state-sync']);
    assert.strictEqual(original.library.photosList.length, 2);
  });

  assertTest('sequence advance walks the balanced multi-feed order and prev reverses it', () => {
    const state = createState({
      library: {
        collections: createState().library.collections,
        externalCollections: {},
        photosList: [
          { url: 'land-1', title: 'Sunny Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' },
          { url: 'port-1', title: 'Midnight Hallway', rating: 10, orientation: 'portrait', category: 'Liminal Spaces' },
          { url: 'land-2', title: 'Foggy River', rating: 8, orientation: 'landscape', category: 'Scenic Nature' },
          { url: 'port-2', title: 'Silent Corridor', rating: 9, orientation: 'portrait', category: 'Liminal Spaces' }
        ]
      },
      playback: {
        selectedCategories: ['Scenic Nature', 'Liminal Spaces'],
        activePhotoUrl: 'land-1',
        splitSeed: 1,
        lastDirection: 'next'
      }
    });

    const goNext = (currentState) => reduceDomainCommand(currentState, {
      type: 'advance-photo',
      payload: { direction: 'next', strategy: 'sequence' }
    });
    const goPrev = (currentState) => reduceDomainCommand(currentState, {
      type: 'advance-photo',
      payload: { direction: 'prev', strategy: 'sequence' }
    });

    const second = goNext(state).nextState;
    const third = goNext(second).nextState;
    const rewound = goPrev(third).nextState;

    assert.strictEqual(second.playback.activePhotoUrl, 'port-1');
    assert.strictEqual(third.playback.activePhotoUrl, 'land-2');
    assert.strictEqual(rewound.playback.activePhotoUrl, 'port-1');
  });

  assertTest('shared playback reducer specs stage selected preview photos into the visible feed before activation', () => {
    const state = createState({
      library: {
        ...createState().library,
        photosList: [
          { url: 'port-1', title: 'Midnight Hallway', rating: 10, orientation: 'portrait', category: 'Liminal Spaces' }
        ]
      }
    });
    const result = reduceDomainCommand(state, {
      type: 'set-active-photo',
      payload: {
        url: 'preview-1',
        photo: {
          url: 'preview-1',
          title: 'Preview Photo',
          author: 'Lumina',
          category: 'Preview'
        }
      }
    });

    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'preview-1');
    assert.strictEqual(result.nextState.library.photosList[0].url, 'preview-1');
    assert.strictEqual(result.nextState.library.photosList[0].title, 'Preview Photo');
    assert.deepStrictEqual(result.events.map((event) => event.type), ['photo-update', 'state-sync']);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('shared playback reducer specs keep active-photo selection silent when the target photo cannot be resolved', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'set-active-photo',
      payload: {
        url: 'missing-preview'
      }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('reducer exclusion updates recompute playback consistently', () => {
    const state = createState({
      library: {
        collections: {
          'Scenic Nature': [
            { url: 'land-1', title: 'Sunny Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' },
            { url: 'land-2', title: 'Anime Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' }
          ],
          'Liminal Spaces': createState().library.collections['Liminal Spaces']
        },
        photosList: [
          { url: 'land-1', title: 'Sunny Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' },
          { url: 'land-2', title: 'Anime Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' }
        ]
      },
      playback: {
        selectedCategories: ['Scenic Nature'],
        activePhotoUrl: 'land-2',
        splitSeed: 0,
        lastDirection: 'next'
      }
    });
    const result = reduceDomainCommand(state, {
      type: 'update-excluded-keywords',
      payload: { keywords: ['anime'] }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'land-1');
    assert.strictEqual(result.nextState.library.photosList.length, 1);
  });

  assertTest('state and feed mutations share a clone-and-continue boundary', () => {
    const state = createState();
    const unchangedStateMutation = reduceDomainCommand(state, {
      type: 'change-theme',
      payload: { theme: state.config.theme }
    });
    const unchangedFeedMutation = reduceDomainCommand(state, {
      type: 'update-excluded-keywords',
      payload: { keywords: [] }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    [unchangedStateMutation, unchangedFeedMutation].forEach((result) => {
      assert.strictEqual(result.nextState, state);
      assert.deepStrictEqual(result.events, []);
      assert.deepStrictEqual(result.effects, []);
    });

    const changedStateMutation = reduceDomainCommand(state, {
      type: 'change-theme',
      payload: { theme: 'Cosmic Night' }
    });
    const changedFeedMutation = reduceDomainCommand(state, {
      type: 'update-excluded-keywords',
      payload: { keywords: ['forest'] }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.notStrictEqual(changedStateMutation.nextState, state);
    assert.notStrictEqual(changedFeedMutation.nextState, state);
    assert.strictEqual(state.config.theme, 'Zen Retreat');
    assert.deepStrictEqual(state.config.excludedKeywords, []);
  });

  assertTest('state and feed mutation results resolve event/effect continuations consistently', () => {
    const state = createState();
    const changedState = reduceDomainCommand(state, {
      type: 'set-split-portrait',
      payload: { enabled: false }
    });
    const changedFeed = reduceDomainCommand(state, {
      type: 'update-excluded-keywords',
      payload: { keywords: ['forest'] }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.deepStrictEqual(changedState.events.map(({ type }) => type), ['state-sync']);
    assert.deepStrictEqual(changedState.effects.map(({ type }) => type), ['persist']);
    assert.deepStrictEqual(changedFeed.events.map(({ type }) => type), ['state-sync']);
    assert.deepStrictEqual(changedFeed.effects.map(({ type }) => type), ['persist']);
  });

  assertTest('shared feed reducer specs preserve forced reselection, exclusion clears, and invalid delete no-op semantics', () => {
    const selected = reduceDomainCommand(createState(), {
      type: 'select-categories',
      payload: { categories: 'Liminal Spaces' }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.9 });

    assert.deepStrictEqual(selected.nextState.playback.selectedCategories, ['Liminal Spaces']);
    assert.strictEqual(selected.nextState.playback.activePhotoUrl, 'port-2');
    assert.deepStrictEqual(selected.events.map((event) => event.type), ['photo-update', 'state-sync']);

    const cleared = reduceDomainCommand(createState({
      config: {
        ...createState().config,
        excludedKeywords: ['anime']
      }
    }), {
      type: 'update-excluded-keywords',
      payload: { keywords: [] }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.deepStrictEqual(cleared.nextState.config.excludedKeywords, []);
    assert.deepStrictEqual(cleared.effects.map((effect) => effect.type), ['persist']);

    const state = createState();
    const invalidDelete = reduceDomainCommand(state, {
      type: 'delete-pool',
      payload: { name: '   ' }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.strictEqual(invalidDelete.nextState, state);
    assert.deepStrictEqual(invalidDelete.events, []);
    assert.deepStrictEqual(invalidDelete.effects, []);
  });

  assertTest('reducer state patch updates widgets, exclusions, and weather-driven location settings declaratively', () => {
    const state = createState({
      library: {
        collections: {
          'Scenic Nature': [
            { url: 'land-1', title: 'Sunny Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' },
            { url: 'land-2', title: 'Anime Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' }
          ],
          'Liminal Spaces': createState().library.collections['Liminal Spaces']
        },
        photosList: [
          { url: 'land-1', title: 'Sunny Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' },
          { url: 'land-2', title: 'Anime Forest', rating: 10, orientation: 'landscape', category: 'Scenic Nature' }
        ]
      },
      playback: {
        selectedCategories: ['Scenic Nature'],
        activePhotoUrl: 'land-2',
        splitSeed: 0,
        lastDirection: 'next'
      }
    });
    const result = reduceDomainCommand(state, {
      type: 'patch-state',
      payload: {
        theme: 'Cosmic Night',
        widgets: { clock: false },
        excludedKeywords: ['anime'],
        autoLocation: true,
        manualLocation: { city: 'Montreal', lat: 45.5, lon: -73.6, regionName: 'Quebec', country: 'Canada' }
      }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.strictEqual(result.nextState.config.theme, 'Cosmic Night');
    assert.strictEqual(result.nextState.config.widgets.clock, false);
    assert.deepStrictEqual(result.nextState.config.excludedKeywords, ['anime']);
    assert.strictEqual(result.nextState.config.autoLocation, true);
    assert.deepStrictEqual(result.nextState.config.manualLocation, {
      city: 'Montreal',
      lat: 45.5,
      lon: -73.6,
      regionName: 'Quebec',
      country: 'Canada'
    });
    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'land-1');
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist', 'refresh-weather']);
    assert.deepStrictEqual(result.events.map((event) => event.type), ['photo-update', 'state-sync']);
  });

  assertTest('reducer patch specs compose immutable state writers without mutating the source snapshot', () => {
    const state = createState();
    const originalConfig = JSON.parse(JSON.stringify(state.config));
    const result = reduceDomainCommand(state, {
      type: 'patch-state',
      payload: {
        theme: 'Cosmic Night',
        widgets: { clock: false },
        manualLocation: { city: 'Montreal', lat: 45.5, lon: -73.6 }
      }
    });

    assert.deepStrictEqual(state.config, originalConfig);
    assert.notStrictEqual(result.nextState.config, state.config);
    assert.notStrictEqual(result.nextState.config.widgets, state.config.widgets);
    assert.notStrictEqual(result.nextState.config.manualLocation, state.config.manualLocation);
    assert.strictEqual(result.nextState.config.theme, 'Cosmic Night');
    assert.strictEqual(result.nextState.config.widgets.clock, false);
    assert.strictEqual(result.nextState.config.manualLocation.city, 'Montreal');
  });

  assertTest('reducer state patch keeps persistence ahead of weather refresh through the shared result builder', () => {
    const result = reduceDomainCommand(createState(), {
      type: 'patch-state',
      payload: { autoLocation: true }
    });

    assert.deepStrictEqual(result.events.map((event) => event.type), ['state-sync']);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist', 'refresh-weather']);
  });

  assertTest('feed and patch mutations share active-photo finalization after recomputing visibility', () => {
    const state = createState({
      library: {
        collections: {
          'Scenic Nature': [
            { url: 'land-1', title: 'Sunny Forest', rating: 10, category: 'Scenic Nature' },
            { url: 'land-2', title: 'Anime Forest', rating: 10, category: 'Scenic Nature' }
          ],
          'Liminal Spaces': createState().library.collections['Liminal Spaces']
        },
        photosList: [
          { url: 'land-1', title: 'Sunny Forest', rating: 10, category: 'Scenic Nature' },
          { url: 'land-2', title: 'Anime Forest', rating: 10, category: 'Scenic Nature' }
        ]
      },
      playback: {
        selectedCategories: ['Scenic Nature'],
        activePhotoUrl: 'land-2',
        splitSeed: 0,
        lastDirection: 'next'
      }
    });
    const command = { payload: { keywords: ['anime'] } };
    const env = { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 };

    const feedResult = reduceDomainCommand(state, {
      type: 'update-excluded-keywords',
      ...command
    }, env);
    const patchResult = reduceDomainCommand(state, {
      type: 'patch-state',
      payload: { excludedKeywords: command.payload.keywords }
    }, env);

    assert.strictEqual(feedResult.nextState.playback.activePhotoUrl, 'land-1');
    assert.strictEqual(patchResult.nextState.playback.activePhotoUrl, 'land-1');
    assert.deepStrictEqual(feedResult.events.map((event) => event.type), ['photo-update', 'state-sync']);
    assert.deepStrictEqual(patchResult.events.map((event) => event.type), ['photo-update', 'state-sync']);
  });

  assertTest('reducer patch-state no-op stays silent when the patch does not change any durable fields', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'patch-state',
      payload: {
        theme: state.config.theme,
        widgets: { clock: state.config.widgets.clock }
      }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('effect reducer defaults produce fresh descriptions without cloning state', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildEffect = buildEffectResultReducer;`, sandbox);
    const state = Object.freeze({ marker: true });
    const reduce = sandbox.buildEffect({ effectType: 'persist', result: undefined, buildPayload: undefined });
    const [first, second] = [reduce(state, null), reduce(state, undefined)];
    const omitted = sandbox.buildEffect({ effectType: 'persist' })(state, null);
    [first, second, omitted].forEach(result => {
      assert.strictEqual(result.nextState, state);
      assert.strictEqual(result.events.length, 0);
      assert.strictEqual(result.effects[0].type, 'persist');
      assert.deepStrictEqual(Object.keys(result.effects[0].payload), []);
    });
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.events, second.events);
    assert.notStrictEqual(first.effects, second.effects);
    assert.notStrictEqual(first.effects[0], second.effects[0]);
    assert.notStrictEqual(first.effects[0].payload, second.effects[0].payload);
  });

  assertTest('effect reducer captures named options once and forwards command, state, payload and custom results', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildEffect = buildEffectResultReducer;`, sandbox);
    const state = Object.freeze({ marker: true });
    const command = Object.freeze({ request: true });
    const payload = Object.freeze({ categories: Object.freeze(['garden']) });
    const calls = [];
    let returned;
    let described;
    const reduce = sandbox.buildEffect({
      get effectType() { calls.push('type'); return 'start-recrawl-job'; },
      get result() { calls.push('result'); return function (original, effects) {
        'use strict';
        assert.strictEqual(arguments.length, 2);
        calls.push('finish');
        assert.strictEqual(this, undefined);
        assert.strictEqual(original, state);
        assert.strictEqual(effects.length, 1);
        assert.strictEqual(effects[0].payload, payload);
        assert.strictEqual(effects[0].type, 'start-recrawl-job');
        described = effects;
        return returned;
      }; },
      get buildPayload() { calls.push('builder'); return function (original) {
        'use strict';
        assert.strictEqual(arguments.length, 1);
        calls.push('build');
        assert.strictEqual(this, undefined);
        assert.strictEqual(original, command);
        return payload;
      }; }
    });
    assert.deepStrictEqual(calls, ['type', 'result', 'builder']);
    [Object.freeze({ custom: true }), undefined, null, false, 0, ''].forEach(value => {
      returned = value;
      assert.strictEqual(reduce(state, command), value);
      const previous = described;
      assert.strictEqual(reduce(state, command), value);
      assert.notStrictEqual(described, previous);
      assert.notStrictEqual(described[0], previous[0]);
    });
    assert.deepStrictEqual(calls.slice(3), Array.from({ length: 12 }, () => ['build', 'finish']).flat());
  });

  assertTest('effect reducer falsy payloads skip even a noncallable result and retain fresh no-op outputs', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildEffect = buildEffectResultReducer;`, sandbox);
    const state = Object.freeze({ marker: true });
    [undefined, null, false, 0, '', NaN].forEach(payload => {
      const reduce = sandbox.buildEffect({ effectType: 'persist-env-vars', result: null, buildPayload: () => payload });
      const [first, second] = [reduce(state, null), reduce(state, null)];
      assert.strictEqual(first.nextState, state);
      assert.strictEqual(first.events.length, 0);
      assert.strictEqual(first.effects.length, 0);
      assert.notStrictEqual(first, second);
      assert.notStrictEqual(first.events, second.events);
      assert.notStrictEqual(first.effects, second.effects);
    });
    // Truthy malformed data remains a description, not a validation failure.
    const malformed = sandbox.buildEffect({ effectType: 'persist-env-vars', buildPayload: () => 'raw' })(state, null);
    assert.strictEqual(malformed.effects[0].payload, 'raw');
  });

  assertTest('effect reducer propagates exact option and callback failures in native evaluation order', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildEffect = buildEffectResultReducer;`, sandbox);
    const build = sandbox.buildEffect;
    const failure = new Error('effect boundary failed');
    const state = Object.freeze({});
    const calls = [];
    ['effectType', 'result', 'buildPayload'].forEach((failing, index) => {
      calls.length = 0;
      const options = Object.fromEntries(['effectType', 'result', 'buildPayload'].map(key => [key, undefined]));
      Object.keys(options).forEach(key => Object.defineProperty(options, key, {
        get() { calls.push(key); if (key === failing) throw failure; return undefined; }
      }));
      assert.throws(() => build(options), error => error === failure);
      assert.deepStrictEqual(calls, ['effectType', 'result', 'buildPayload'].slice(0, index + 1));
    });
    assert.throws(() => build({ buildPayload: () => { throw failure; }, result: () => assert.fail('result ran') })(state, null), error => error === failure);
    assert.throws(() => build({ buildPayload: () => (calls.push('payload'), {}), result: () => { throw failure; } })(state, null), error => error === failure);
    assert.strictEqual(calls.at(-1), 'payload');
    [null, false, 0, ''].forEach(value => {
      assert.throws(() => build({ buildPayload: value })(state, null), error => error.name === 'TypeError' && /buildPayload is not a function/.test(error.message));
      assert.throws(() => build({ result: value })(state, null), error => error.name === 'TypeError' && /result is not a function/.test(error.message));
    });
    [undefined, null].forEach(options => assert.throws(() => build(options), error => error.name === 'TypeError'));
  });

  assertTest('mutation output resolution preserves values, aliases, and native factory failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.resolveOutput = resolveMutationOutput;`, sandbox);
    const context = Object.freeze({ value: 3 });
    const values = Object.freeze([1, 2]);
    const record = Object.freeze({ value: 4 });
    assert.strictEqual(sandbox.resolveOutput(values, context), values);
    assert.strictEqual(sandbox.resolveOutput(record, context), record);
    assert.strictEqual(sandbox.resolveOutput(null, context), null);
    assert.strictEqual(sandbox.resolveOutput((input) => input, context), context);
    const failure = new Error('factory failure');
    assert.throws(() => sandbox.resolveOutput(() => { throw failure; }, context), (error) => error === failure);
  });

  assertTest('mutation result resolves ordered factories against the exact selected context', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildResult = buildMutationResult;`, sandbox);
    const state = Object.freeze({ state: true });
    const context = Object.freeze({ context: true });
    const events = Object.freeze([{ type: 'photo-update' }]);
    const effects = Object.freeze([{ type: 'refresh-weather' }]);
    const calls = [];
    const options = {
      get events() { calls.push('read events'); return (value) => (calls.push('events'), assert.strictEqual(value, context), events); },
      get effects() { calls.push('read effects'); return (value) => (calls.push('effects'), assert.strictEqual(value, context), effects); },
      get persist() { calls.push('read persist'); return true; },
      get context() { calls.push('read context'); return context; }
    };
    const result = sandbox.buildResult(state, options);
    assert.deepStrictEqual(calls, ['read events', 'read effects', 'read persist', 'read context', 'effects', 'events']);
    assert.strictEqual(result.nextState, state);
    assert.strictEqual(result.events, events);
    assert.notStrictEqual(result.effects, effects);
    assert.deepStrictEqual(Array.from(result.effects, (effect) => effect.type), ['persist', 'refresh-weather']);
    assert.strictEqual(result.effects[1], effects[0]);
    for (const [supplied, expected] of [[undefined, state], [null, null], [false, false], [0, 0]]) {
      const observed = sandbox.buildResult(state, { context: supplied, events: (value) => (assert.strictEqual(value, expected), events), effects });
      assert.strictEqual(observed.events, events);
      assert.strictEqual(observed.effects, effects);
    }
  });

  assertTest('mutation result keeps default, falsy, malformed, and failure behavior', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildResult = buildMutationResult;`, sandbox);
    const state = Object.freeze({});
    const first = sandbox.buildResult(state, {});
    const second = sandbox.buildResult(state, {});
    assert.deepStrictEqual(Array.from(first.events, (event) => event.type), ['state-sync']);
    assert.notStrictEqual(first.events, second.events);
    assert.notStrictEqual(first.effects, second.effects);
    for (const value of [null, false, 0, '', NaN]) {
      const result = sandbox.buildResult(state, { events: () => value, effects: () => value });
      assert.strictEqual(result.events.length, 0);
      assert.strictEqual(result.effects.length, 0);
    }
    const malformed = Object.freeze({ unexpected: true });
    const passthrough = sandbox.buildResult(state, { events: malformed, effects: malformed });
    assert.strictEqual(passthrough.events, malformed);
    assert.strictEqual(passthrough.effects, malformed);
    const calls = [];
    assert.throws(() => sandbox.buildResult(state, {
      effects: () => (calls.push('effects'), malformed),
      events: () => (calls.push('events'), []),
      persist: true
    }), (error) => error.name === 'TypeError');
    assert.deepStrictEqual(calls, ['effects', 'events']);
    const failure = new Error('effects failed');
    assert.throws(() => sandbox.buildResult(state, {
      effects: () => { throw failure; },
      events: () => { throw new Error('events must not run'); }
    }), (error) => error === failure);
    const eventFailure = new Error('events failed');
    const neverSpread = { get [Symbol.iterator]() { throw new Error('spread must not run'); } };
    assert.throws(() => sandbox.buildResult(state, {
      effects: neverSpread, events: () => { throw eventFailure; }, persist: true
    }), (error) => error === eventFailure);
    const getterFailure = new Error('context read failed');
    assert.throws(() => sandbox.buildResult(state, {
      get context() { throw getterFailure; },
      effects: () => { throw new Error('factory must not run'); }
    }), (error) => error === getterFailure);
    const spread = sandbox.buildResult(state, { effects: 'xy', persist: true });
    assert.deepStrictEqual(Array.from(spread.effects).slice(1), ['x', 'y']);
    assert.throws(() => sandbox.buildResult(state, null), (error) => error.name === 'TypeError');
  });

  assertTest('cloned mutations preserve continuation and unchanged identities', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reduceClone = reduceClonedMutation;`, sandbox);
    const state = createState();
    const calls = [];
    let cloned;
    const token = Object.freeze({ result: true });
    const changed = sandbox.reduceClone(state, (next) => {
      calls.push('apply');
      cloned = next;
      next.config.theme = 'changed';
      return 'truthy';
    }, (next) => (calls.push('continuation'), assert.strictEqual(next, cloned), token));
    assert.strictEqual(changed, token);
    assert.notStrictEqual(cloned, state);
    assert.notStrictEqual(cloned.config, state.config);
    assert.notStrictEqual(state.config.theme, 'changed');
    assert.deepStrictEqual(calls, ['apply', 'continuation']);
    for (const value of [false, 0, '', null, undefined, NaN]) {
      const result = sandbox.reduceClone(state, () => value, () => { throw new Error('must not continue'); });
      assert.strictEqual(result.nextState, state);
      assert.strictEqual(result.events.length, 0);
      assert.strictEqual(result.effects.length, 0);
      assert.notStrictEqual(result.events, result.effects);
    }
    const failure = new Error('callback failure');
    assert.throws(() => sandbox.reduceClone(state, () => { throw failure; }, () => token), (error) => error === failure);
    assert.throws(() => sandbox.reduceClone(state, () => true, () => { throw failure; }), (error) => error === failure);
    assert.throws(() => sandbox.reduceClone(null, () => { throw failure; }, () => token), (error) => error.name === 'TypeError');
  });

  assertTest('state mutation resolves options before cloning and factories only after changes', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reduceMutation = reduceStateMutation;`, sandbox);
    const state = createState();
    const reads = [];
    const keywords = state.config.searchKeywords;
    Object.defineProperty(state.config, 'searchKeywords', {
      enumerable: true,
      get: () => (reads.push('clone'), keywords)
    });
    const events = Object.freeze([{ type: 'photo-update' }]);
    const effects = Object.freeze([{ type: 'refresh-weather' }]);
    let applied;
    const options = {
      get apply() { reads.push('read apply'); return (next) => (reads.push('apply'), applied = next, true); },
      get events() { reads.push('read events'); return (next) => (reads.push('events'), assert.strictEqual(next, applied), events); },
      get effects() { reads.push('read effects'); return (next) => (reads.push('effects'), assert.strictEqual(next, applied), effects); },
      get persist() { reads.push('read persist'); return true; }
    };
    const result = sandbox.reduceMutation(state, options);
    assert.deepStrictEqual(reads, ['read apply', 'read events', 'read effects', 'read persist', 'clone', 'clone', 'apply', 'effects', 'events']);
    assert.strictEqual(result.nextState, applied);
    assert.strictEqual(result.events, events);
    assert.deepStrictEqual(Array.from(result.effects, (effect) => effect.type), ['persist', 'refresh-weather']);
    const noop = sandbox.reduceMutation(state, { apply: () => false, events: () => { throw new Error('unused'); } });
    assert.strictEqual(noop.nextState, state);
    assert.strictEqual(noop.events.length, 0);
    const defaults = sandbox.reduceMutation(state, { apply: () => true });
    assert.deepStrictEqual(Array.from(defaults.events, (event) => event.type), ['state-sync']);
    assert.strictEqual(defaults.effects.length, 0);
    const failure = new Error('option failure');
    assert.throws(() => sandbox.reduceMutation(state, { get events() { throw failure; } }), (error) => error === failure);
    assert.throws(() => sandbox.reduceMutation(state, null), (error) => error.name === 'TypeError');
  });

  assertTest('payload continuation skips only null and preserves argument aliases and failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.wrap = withCommandPayload;`, sandbox);
    const state = createState();
    const env = Object.freeze({ now: new Date(0) });
    const marker = Object.freeze({ result: true });
    for (const payload of [undefined, false, 0, '', Object.freeze({ value: 1 })]) {
      const command = Object.freeze({ payload });
      const reduce = sandbox.wrap((current, original) => {
        assert.strictEqual(current, command);
        assert.strictEqual(original, state);
        return payload;
      }, (original, current, value, runtime) => {
        assert.strictEqual(original, state);
        assert.strictEqual(current, command);
        assert.strictEqual(value, payload);
        assert.strictEqual(runtime, env);
        return marker;
      });
      assert.strictEqual(reduce(state, command, env), marker);
    }
    const noOp = sandbox.wrap(() => null, () => { throw new Error('must not run'); })(state, {});
    assert.strictEqual(noOp.nextState, state);
    assert.strictEqual(noOp.events.length, 0);
    assert.strictEqual(noOp.effects.length, 0);
    const defaultEnv = sandbox.wrap(() => 1, (_state, _command, _payload, runtime) => runtime);
    assert.deepStrictEqual(Object.keys(defaultEnv(state, {})), []);
    assert.strictEqual(defaultEnv(state, {}, null), null);
    const failure = new Error('payload failure');
    assert.throws(() => sandbox.wrap(() => { throw failure; }, () => marker)(state, {}), (error) => error === failure);
    assert.throws(() => sandbox.wrap(() => 1, () => { throw failure; })(state, {}), (error) => error === failure);
  });

  assertTest('reducer option projection reads all entries before resolving callbacks', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.resolveOptions = resolveReducerOptions;`, sandbox);
    const state = createState();
    const command = Object.freeze({});
    const payload = Object.freeze({});
    const calls = [];
    const symbol = Symbol('ignored');
    const options = Object.setPrototypeOf({
      get first() { calls.push('read first'); return (p, c, s) => (calls.push('first'), assert.strictEqual(p, payload), assert.strictEqual(c, command), assert.strictEqual(s, state), payload); },
      get second() { calls.push('read second'); return () => (calls.push('second'), false); },
      [symbol]: 'ignored'
    }, { inherited: 'ignored' });
    const result = sandbox.resolveOptions(options, payload, command, state);
    assert.deepStrictEqual(calls, ['read first', 'read second', 'first', 'second']);
    assert.deepStrictEqual(Object.keys(result), ['first', 'second']);
    assert.strictEqual(result.first, payload);
    assert.strictEqual(result.second, false);
    assert.strictEqual(Object.getOwnPropertySymbols(result).length, 0);
    const failure = new Error('option failure');
    assert.throws(() => sandbox.resolveOptions({ first: () => { throw failure; }, second: () => { throw new Error('must not run'); } }, payload, command, state), (error) => error === failure);
    assert.throws(() => sandbox.resolveOptions({ get first() { throw failure; } }, payload, command, state), (error) => error === failure);
  });

  assertTest('feed command resolves options before cloning and passes the finalizer through', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildFeed = buildFeedCommandReducer;\nglobalThis.replaceRecompute = fn => { recomputeAndEnsureActivePhoto = fn; };`, sandbox);
    const state = createState();
    const command = Object.freeze({});
    const payload = Object.freeze({});
    const calls = [];
    let cloned;
    const events = Object.freeze([{ type: 'photo-update' }]);
    sandbox.replaceRecompute((next, selection) => {
      calls.push('recompute');
      assert.strictEqual(next, cloned);
      assert.strictEqual(selection.direction, 'prev');
      return { state: next, photoChanged: true };
    });
    const option = (name, value) => (p, c, s) => {
      calls.push(name);
      assert.strictEqual(p, payload);
      assert.strictEqual(c, command);
      assert.strictEqual(s, state);
      return value;
    };
    const reduce = sandbox.buildFeed({
      readPayload: () => (calls.push('read'), payload),
      direction: option('direction', 'next'),
      forceReselect: option('force', false),
      eventsFor: option('events resolver', (finalized) => (calls.push('events finalizer'), assert.strictEqual(finalized.state, cloned), events)),
      persist: option('persist', true),
      apply: (next, p, c, original) => {
        calls.push('apply');
        cloned = next;
        assert.notStrictEqual(next, state);
        assert.strictEqual(p, payload);
        assert.strictEqual(c, command);
        assert.strictEqual(original, state);
        return true;
      }
    });
    const result = reduce(state, command, { direction: 'prev' });
    assert.deepStrictEqual(calls, ['read', 'direction', 'force', 'events resolver', 'persist', 'apply', 'recompute', 'events finalizer']);
    assert.strictEqual(result.nextState, cloned);
    assert.strictEqual(result.events, events);
    assert.deepStrictEqual(Array.from(result.effects, (effect) => effect.type), ['persist']);
    calls.length = 0;
    const noop = sandbox.buildFeed({ readPayload: () => payload, direction: option('direction', 'next'), apply: () => (calls.push('apply'), false) });
    assert.strictEqual(noop(state, command).nextState, state);
    assert.deepStrictEqual(calls, ['direction', 'apply']);
    const failure = new Error('resolver failed');
    const failing = sandbox.buildFeed({ readPayload: () => payload, direction: () => { throw failure; }, apply: () => { throw new Error('must not run'); } });
    assert.throws(() => failing(state, command), (error) => error === failure);
  });

  assertTest('feed mutation carries raw selected URLs and cloned state into environment factories', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reduceFeed = reduceFeedMutation;`, sandbox);
    const rawUrl = Object.freeze({ id: 'raw' });
    const row = Object.freeze({ url: rawUrl, rating: 0 });
    const state = createState({
      library: { collections: { pool: [row] }, externalCollections: {}, photosList: [] },
      playback: { selectedCategories: ['pool'], activePhotoUrl: null }
    });
    let clone;
    let context;
    const calls = [];
    const result = sandbox.reduceFeed(state, {
      apply: next => (clone = next, next.config.theme = 'changed', true),
      effects: () => assert.fail('environment overrides option factory')
    }, {
      now: new Date(2026, 0, 1), rng: () => assert.fail('no draw'), persist: true,
      effects: finalized => (calls.push('effects'), context = finalized, []),
      eventsFor: finalized => (calls.push('events'), assert.strictEqual(finalized, context), [])
    });
    assert.notStrictEqual(clone, state);
    assert.strictEqual(result.nextState, context.state);
    assert.strictEqual(result.nextState.config, clone.config);
    assert.strictEqual(result.nextState.playback.activePhotoUrl, rawUrl);
    assert.strictEqual(result.nextState.config.theme, 'changed');
    assert.notStrictEqual(state.config.theme, 'changed');
    assert.strictEqual(state.playback.activePhotoUrl, null);
    assert.deepStrictEqual(calls, ['effects', 'events']);
    assert.deepStrictEqual(Array.from(result.effects, effect => effect.type), ['persist']);
  });

  assertTest('feed command keeps command and payload aliases through raw-URL finalization', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildFeed = buildFeedCommandReducer;`, sandbox);
    const rawUrl = Object.freeze({ id: 'selected' });
    const payload = Object.freeze({ url: rawUrl, rating: 0 });
    const command = Object.freeze({ payload });
    const state = createState({ playback: { selectedCategories: ['pool'], activePhotoUrl: null } });
    let context;
    const reduce = sandbox.buildFeed({
      readPayload: (current, original) => (assert.strictEqual(current, command), assert.strictEqual(original, state), current.payload),
      apply: (next, selected, current, original) => {
        assert.strictEqual(selected, payload);
        assert.strictEqual(current, command);
        assert.strictEqual(original, state);
        next.library.collections.pool = [selected];
        return true;
      },
      eventsFor: selected => finalized => (assert.strictEqual(selected, payload), context = finalized, [])
    });
    const result = reduce(state, command, { now: new Date(2026, 0, 1), rng: () => assert.fail('no draw') });
    assert.strictEqual(result.nextState, context.state);
    assert.strictEqual(result.nextState.playback.activePhotoUrl, rawUrl);
    assert.strictEqual(result.events.length, 0);
    assert.strictEqual(state.library.collections.pool, undefined);
  });

  assertTest('feed command skip paths retain state and avoid environment reads or finalization', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildFeed = buildFeedCommandReducer;`, sandbox);
    const state = createState();
    const calls = [];
    const env = { get rng() { return assert.fail('skip must not read environment'); } };
    [null, { value: true }].forEach(payload => {
      calls.length = 0;
      const reduce = sandbox.buildFeed({
        readPayload: () => (calls.push('read'), payload),
        direction: () => (calls.push('resolve'), 'next'),
        apply: () => (calls.push('apply'), false)
      });
      const result = reduce(state, {}, env);
      assert.strictEqual(result.nextState, state);
      assert.strictEqual(result.events.length, 0);
      assert.strictEqual(result.effects.length, 0);
      assert.deepStrictEqual(calls, payload === null ? ['read'] : ['read', 'resolve', 'apply']);
    });
  });

  assertTest('pool mutation checks existence before copying options or cloning', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reducePool = reducePoolMutation;`, sandbox);
    const state = createState();
    const name = Object.freeze({ name: 'identity' });
    const calls = [];
    const options = {
      get poolExists() { calls.push('read guard'); return (current, key) => (calls.push('guard'), assert.strictEqual(current, state), assert.strictEqual(key, name), false); },
      get apply() { throw new Error('apply must not be read'); }
    };
    const missing = sandbox.reducePool(state, name, options);
    assert.strictEqual(missing.nextState, state);
    assert.strictEqual(missing.events.length, 0);
    assert.strictEqual(missing.effects.length, 0);
    assert.deepStrictEqual(calls, ['read guard', 'guard']);
    const failure = new Error('guard failed');
    assert.throws(() => sandbox.reducePool(state, name, { poolExists: () => { throw failure; } }), (error) => error === failure);
    assert.throws(() => sandbox.reducePool(state, name, { poolExists: true }), (error) => error.name === 'TypeError');
    assert.throws(() => sandbox.reducePool(state, name, null), (error) => error.name === 'TypeError');
    assert.strictEqual(sandbox.reducePool(state, 'missing').nextState, state);
  });

  assertTest('pool mutation rereads apply after option spread and keeps native receivers', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reducePool = reducePoolMutation;`, sandbox);
    const state = createState();
    const name = Object.freeze({ name: 'identity' });
    const calls = [];
    let clone;
    let reads = 0;
    const options = {
      get poolExists() { calls.push('read guard'); return () => (calls.push('guard'), true); },
      get apply() {
        calls.push('read apply');
        reads += 1;
        if (reads === 1) return () => { throw new Error('spread copy must not be called'); };
        return function (next, key) {
          calls.push('apply');
          assert.strictEqual(this, options);
          assert.strictEqual(key, name);
          clone = next;
          next.config.theme = 'pool change';
          return true;
        };
      },
      get effects() { calls.push('read effects'); return [{ type: 'refresh-weather' }]; },
      persist: true
    };
    const result = sandbox.reducePool(state, name, options);
    assert.deepStrictEqual(calls, ['read guard', 'guard', 'read guard', 'read apply', 'read effects', 'read apply', 'apply']);
    assert.notStrictEqual(clone, state);
    assert.strictEqual(result.nextState, clone);
    assert.notStrictEqual(state.config.theme, 'pool change');
    assert.deepStrictEqual(Array.from(result.effects, (effect) => effect.type), ['persist', 'refresh-weather']);
    const failure = new Error('apply failure');
    assert.throws(() => sandbox.reducePool(state, name, { poolExists: () => true, apply: () => { throw failure; } }), (error) => error === failure);
    assert.throws(() => sandbox.reducePool(state, name, { poolExists: () => true }), (error) => error.name === 'TypeError');
  });

  assertTest('guarded pool command resolves options before checking and copies enumerable payload fields', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildPool = buildPoolCommandReducer;`, sandbox);
    const state = createState();
    const command = Object.freeze({});
    const calls = [];
    const symbol = Symbol('copied');
    const payload = Object.assign(Object.create({ inherited: 'not copied' }), { name: 'garden', value: 7, [symbol]: 'copied' });
    Object.defineProperty(payload, 'hidden', { value: 'not copied' });
    const effects = Object.freeze([{ type: 'refresh-weather' }]);
    let clone;
    const build = (exists) => sandbox.buildPool({
      readPayload: (current, original) => (calls.push('read'), assert.strictEqual(current, command), assert.strictEqual(original, state), payload),
      effects: (item, current, original) => (calls.push('effects resolver'), assert.strictEqual(item, payload), assert.strictEqual(current, command), assert.strictEqual(original, state), effects),
      persist: (item) => (calls.push('persist resolver'), assert.strictEqual(item, payload), true),
      poolExists: (original, name) => (calls.push('guard'), assert.strictEqual(original, state), assert.strictEqual(name, payload.name), exists),
      apply: (next, copy, current, original) => {
        calls.push('apply');
        clone = next;
        assert.notStrictEqual(next, state);
        assert.notStrictEqual(copy, payload);
        assert.strictEqual(copy.name, payload.name);
        assert.strictEqual(copy.value, payload.value);
        assert.strictEqual(copy[symbol], 'copied');
        assert.strictEqual(copy.hidden, undefined);
        assert.strictEqual(copy.inherited, undefined);
        assert.strictEqual(current, command);
        assert.strictEqual(original, state);
        return true;
      }
    });
    const missing = build(false)(state, command);
    assert.strictEqual(missing.nextState, state);
    assert.deepStrictEqual(calls, ['read', 'effects resolver', 'persist resolver', 'guard']);
    calls.length = 0;
    const changed = build(true)(state, command);
    assert.strictEqual(changed.nextState, clone);
    assert.deepStrictEqual(calls, ['read', 'effects resolver', 'persist resolver', 'guard', 'apply']);
    assert.deepStrictEqual(Array.from(changed.effects, (effect) => effect.type), ['persist', 'refresh-weather']);
    assert.strictEqual(changed.effects[1], effects[0]);
  });

  assertTest('unguarded pool command retains payload identity and propagates resolver failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildPool = buildPoolCommandReducer;`, sandbox);
    const state = createState();
    const command = Object.freeze({});
    const payload = Object.freeze({ name: 'garden' });
    const calls = [];
    const reduce = sandbox.buildPool({
      readPayload: () => payload,
      requireExistingPool: false,
      poolExists: () => { throw new Error('guard must not run'); },
      apply: (next, current, cmd, original) => (calls.push('apply'), assert.notStrictEqual(next, state), assert.strictEqual(current, payload), assert.strictEqual(cmd, command), assert.strictEqual(original, state), false)
    });
    assert.strictEqual(reduce(state, command).nextState, state);
    assert.deepStrictEqual(calls, ['apply']);
    const failure = new Error('resolver failed');
    const failing = sandbox.buildPool({ readPayload: () => payload, effects: () => { throw failure; }, poolExists: () => { throw new Error('must not run'); }, apply: () => true });
    assert.throws(() => failing(state, command), (error) => error === failure);
    const skipped = sandbox.buildPool({ readPayload: () => null, effects: () => { throw new Error('must not run'); }, apply: () => true });
    assert.strictEqual(skipped(state, command).nextState, state);
  });

  assertTest('pool command overwrites a copied name with the earlier guarded read', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildPool = buildPoolCommandReducer;`, sandbox);
    const state = createState();
    const reads = [];
    const payload = { get name() { reads.push('name'); return reads.length === 1 ? 'guarded' : 'later'; } };
    const reduce = sandbox.buildPool({
      readPayload: () => payload,
      poolExists: (_state, name) => (assert.strictEqual(name, 'guarded'), true),
      apply: (_next, copy) => (assert.strictEqual(copy.name, 'guarded'), true)
    });
    assert.notStrictEqual(reduce(state, {}).nextState, state);
    assert.deepStrictEqual(reads, ['name', 'name']);
  });

  assertTest('feed recomputation forwards inputs and replaces only the shallow library feed', () => {
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    const state = createState();
    const feed = [{ url: 'new' }];
    const rng = () => 0.5;
    let inputs;
    const mockSelectors = { ...selectors, buildBalancedFeed: options => (inputs = options, feed) };
    const sandbox = { module: { exports: {} }, require: name => name === './selectors.js' ? mockSelectors : require(name) };
    runInNewContext(`${source}\nglobalThis.recompute = recomputeFeed;`, sandbox);
    const result = sandbox.recompute(state, rng);
    assert.notStrictEqual(result, state);
    assert.notStrictEqual(result.library, state.library);
    assert.strictEqual(result.library.photosList, feed);
    assert.strictEqual(result.library.collections, state.library.collections);
    assert.strictEqual(result.playback, state.playback);
    assert.strictEqual(result.config, state.config);
    assert.strictEqual(inputs.selectedCategories, state.playback.selectedCategories);
    assert.strictEqual(inputs.collections, state.library.collections);
    assert.strictEqual(inputs.externalCollections, state.library.externalCollections);
    assert.strictEqual(inputs.excludedKeywords, state.config.excludedKeywords);
    assert.strictEqual(inputs.rng, rng);
    assert.notStrictEqual(state.library.photosList, feed);
  });

  assertTest('feed recomputation precedes lookup and forwards selection inputs without normalization', () => {
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    const calls = [];
    const rawUrl = { raw: true };
    const feed = [{ url: rawUrl }];
    const now = new Date(2026, 0, 1);
    const rng = () => 0;
    let rebuilt;
    const mockSelectors = { ...selectors,
      buildBalancedFeed: options => (calls.push('build'), assert.strictEqual(options.rng, rng), feed),
      getActivePhoto: current => (calls.push('active'), rebuilt = current, null),
      selectSmartPhoto: options => (calls.push('select'), assert.strictEqual(options.state, rebuilt), assert.strictEqual(options.state.library.photosList, feed), assert.strictEqual(options.now, now), assert.strictEqual(options.rng, rng), assert.strictEqual(options.direction, 'prev'), feed[0])
    };
    const sandbox = { module: { exports: {} }, require: name => name === './selectors.js' ? mockSelectors : require(name) };
    runInNewContext(`${source}\nglobalThis.recomputeAndEnsure = recomputeAndEnsureActivePhoto;`, sandbox);
    const state = createState({ playback: { activePhotoUrl: 'old', splitSeed: 2 } });
    const result = sandbox.recomputeAndEnsure(state, { now, rng, direction: 'prev', forceReselect: true });
    assert.deepStrictEqual(calls, ['build', 'active', 'select']);
    assert.notStrictEqual(rebuilt, state);
    assert.strictEqual(result.state.library, rebuilt.library);
    assert.strictEqual(result.state.playback.activePhotoUrl, rawUrl);
    assert.strictEqual(result.photoChanged, true);
    assert.strictEqual(state.playback.activePhotoUrl, 'old');
  });

  assertTest('feed recomputation retains rebuilt state on a hit and propagates build failures first', () => {
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    const calls = [];
    const feed = [{ url: 'current' }];
    const failure = new Error('build failed');
    let fail = false;
    const mockSelectors = { ...selectors,
      buildBalancedFeed: options => { calls.push('build'); assert.strictEqual(options.rng, null); if (fail) throw failure; return feed; },
      getActivePhoto: () => (calls.push('active'), feed[0]),
      findPhotoInFeed: (rows, url) => (calls.push('find'), assert.strictEqual(rows, feed), assert.strictEqual(url, 'current'), feed[0]),
      selectSmartPhoto: () => assert.fail('retained photo must not select')
    };
    const sandbox = { module: { exports: {} }, require: name => name === './selectors.js' ? mockSelectors : require(name) };
    runInNewContext(`${source}\nglobalThis.recomputeAndEnsure = recomputeAndEnsureActivePhoto;`, sandbox);
    const state = createState({ playback: { activePhotoUrl: 'current' } });
    const result = sandbox.recomputeAndEnsure(state, { rng: null });
    assert.deepStrictEqual(calls, ['build', 'active', 'find']);
    assert.notStrictEqual(result.state, state);
    assert.strictEqual(result.state.library.photosList, feed);
    assert.strictEqual(result.state.playback, state.playback);
    assert.strictEqual(result.photoChanged, false);
    calls.length = 0;
    fail = true;
    assert.throws(() => sandbox.recomputeAndEnsure(state, { rng: null }), error => error === failure);
    assert.deepStrictEqual(calls, ['build']);
  });

  assertTest('feed recomputation uses native conditional RNG calls and leaves source rows untouched', () => {
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${source}\nglobalThis.recompute = recomputeFeed;`, sandbox);
    const single = Object.freeze({ url: 'one', rating: 2 });
    const state = createState({
      library: { collections: { pool: [single] }, externalCollections: {}, photosList: [] },
      playback: { selectedCategories: ['pool'] }
    });
    const result = sandbox.recompute(state, null);
    assert.strictEqual(result.library.photosList.length, 1);
    assert.notStrictEqual(result.library.photosList[0], single);
    assert.strictEqual(result.library.photosList[0].url, 'one');
    assert.strictEqual(single.category, undefined);
    state.library.collections.pool = [single, { url: 'two', rating: 2 }];
    assert.throws(() => sandbox.recompute(state, null), error => error.name === 'TypeError');
    let draws = 0;
    const shuffled = sandbox.recompute(state, () => (draws += 1, 0));
    assert.strictEqual(draws, 1);
    assert.deepStrictEqual(Array.from(shuffled.library.photosList, photo => photo.url), ['two', 'one']);
  });

  assertTest('active-photo projection copies playback and preserves raw URL and direction semantics', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.updateActive = updateActivePhotoUrl;`, sandbox);
    const state = createState({ playback: { activePhotoUrl: 'old', splitSeed: 3, lastDirection: 'prev' } });
    const rawUrl = Object.freeze({ identity: 'url' });
    const changed = sandbox.updateActive(state, { url: rawUrl }, 'next');
    assert.strictEqual(changed.changed, true);
    assert.strictEqual(changed.state.playback.activePhotoUrl, rawUrl);
    assert.strictEqual(changed.state.playback.splitSeed, 4);
    assert.strictEqual(changed.state.playback.lastDirection, 'next');
    assert.notStrictEqual(changed.state, state);
    assert.notStrictEqual(changed.state.playback, state.playback);
    assert.strictEqual(changed.state.library, state.library);
    assert.strictEqual(state.playback.activePhotoUrl, 'old');
    const unchanged = sandbox.updateActive(state, { url: 'old' }, null);
    assert.strictEqual(unchanged.changed, false);
    assert.strictEqual(unchanged.state.playback.splitSeed, 3);
    assert.strictEqual(unchanged.state.playback.lastDirection, 'prev');
    assert.notStrictEqual(unchanged.state, state);
    [null, undefined, { url: '' }, { url: 0 }, { url: false }].forEach((photo) => {
      assert.strictEqual(sandbox.updateActive(state, photo, undefined).state.playback.activePhotoUrl, null);
    });
  });

  assertTest('active-photo projection keeps native access, seed coercion and failure ordering', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.updateActive = updateActivePhotoUrl;`, sandbox);
    const calls = [];
    const state = createState({ playback: { activePhotoUrl: 'old', splitSeed: { valueOf() { calls.push('seed'); return 7; } } } });
    const photo = { get url() { calls.push('url'); return 'new'; } };
    assert.strictEqual(sandbox.updateActive(state, photo, 'next').state.playback.splitSeed, 8);
    assert.deepStrictEqual(calls, ['url', 'seed']);
    const failure = new Error('url access');
    assert.throws(() => sandbox.updateActive(state, { get url() { throw failure; } }, 'next'), error => error === failure);
    const invalidSeed = createState({ playback: { activePhotoUrl: 'old', splitSeed: Symbol('seed') } });
    assert.throws(() => sandbox.updateActive(invalidSeed, { url: 'new' }, 'next'), error => error.name === 'TypeError');
    assert.strictEqual(sandbox.updateActive(invalidSeed, { url: 'old' }, 'next').state.playback.splitSeed, invalidSeed.playback.splitSeed);
  });

  assertTest('active-photo maintenance keeps current feed aliases or reselects when forced', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.ensureActive = ensureActivePhoto;`, sandbox);
    const row = { url: 'current', category: 'pool', rating: 0 };
    const state = createState({ library: { photosList: [row] }, playback: { activePhotoUrl: 'current' } });
    const options = { now: new Date(2026, 0, 1, 9), rng: () => assert.fail('zero weight does not draw') };
    const retained = sandbox.ensureActive(state, options);
    assert.strictEqual(retained.state, state);
    assert.strictEqual(retained.photoChanged, false);
    const forced = sandbox.ensureActive(state, { ...options, forceReselect: true });
    assert.notStrictEqual(forced.state, state);
    assert.strictEqual(forced.state.playback.activePhotoUrl, 'current');
    assert.strictEqual(forced.photoChanged, false);
    const empty = createState({ library: { photosList: [] }, playback: { activePhotoUrl: 'missing', splitSeed: 3 } });
    const cleared = sandbox.ensureActive(empty, options);
    assert.strictEqual(cleared.state.playback.activePhotoUrl, null);
    assert.strictEqual(cleared.state.playback.splitSeed, 4);
    assert.strictEqual(cleared.photoChanged, true);
  });

  assertTest('active-photo maintenance looks up before forcing and forwards selector inputs unchanged', () => {
    const calls = [];
    const failure = new Error('lookup failure');
    const selected = { url: { raw: true } };
    const now = new Date(2026, 0, 1, 9);
    const rng = () => 0;
    const mockSelectors = { ...selectors,
      getActivePhoto: () => { calls.push('active'); return { url: 'existing' }; },
      findPhotoInFeed: (_rows, url) => { calls.push(`feed:${url}`); return { url }; },
      selectSmartPhoto: (options) => { calls.push('select'); assert.strictEqual(options.now, now); assert.strictEqual(options.rng, rng); assert.strictEqual(options.direction, 'prev'); return selected; }
    };
    const sandbox = { module: { exports: {} }, require: name => name === './selectors.js' ? mockSelectors : require(name) };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.ensureActive = ensureActivePhoto;`, sandbox);
    const state = createState();
    const result = sandbox.ensureActive(state, { now, rng, direction: 'prev', forceReselect: true });
    assert.deepStrictEqual(calls, ['active', 'feed:existing', 'select']);
    assert.strictEqual(result.state.playback.activePhotoUrl, selected.url);
    mockSelectors.findPhotoInFeed = () => { throw failure; };
    const failingSandbox = { module: { exports: {} }, require: name => name === './selectors.js' ? mockSelectors : require(name) };
    runInNewContext(`${source}\nglobalThis.ensureActive = ensureActivePhoto;`, failingSandbox);
    assert.throws(() => failingSandbox.ensureActive(state, { forceReselect: true }), error => error === failure);
  });

  assertTest('selectable photo lookup preserves feed, curated, external and fallback precedence', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.findSelectable = findSelectablePhoto;`, sandbox);
    const feed = { url: 'same', rating: 1, isBroken: true };
    const curated = { url: 'same' };
    const external = { url: 'same' };
    const fallback = Object.freeze({ url: 'different' });
    const state = createState();
    state.library = { photosList: [feed], collections: { curated: [curated] }, externalCollections: { external: [external] } };
    assert.strictEqual(sandbox.findSelectable(state, 'same', fallback), feed);
    state.library.photosList = [];
    assert.strictEqual(sandbox.findSelectable(state, 'same', fallback), curated);
    state.library.collections = {};
    assert.strictEqual(sandbox.findSelectable(state, 'same', fallback), external);
    state.library.externalCollections = {};
    assert.strictEqual(sandbox.findSelectable(state, 'same', fallback), fallback);
    assert.strictEqual(sandbox.findSelectable(state, 'same', 42), 42);
    assert.strictEqual(sandbox.findSelectable(state, 'same', false), null);
    assert.strictEqual(sandbox.findSelectable(state, 'same'), null);
    const key = {};
    const unvalidated = { url: key };
    state.library.photosList = [unvalidated];
    assert.strictEqual(sandbox.findSelectable(state, key, fallback), unvalidated);
    assert.strictEqual(sandbox.findSelectable(state, {}, fallback), fallback);
  });

  assertTest('selectable photo lookup short circuits feed hits but eagerly reads both pool maps', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.findSelectable = findSelectablePhoto;`, sandbox);
    const state = createState();
    const selected = { url: 'same' };
    const failure = new Error('external collection failure');
    state.library = { photosList: [selected], get collections() { throw failure; } };
    assert.strictEqual(sandbox.findSelectable(state, 'same'), selected);
    state.library = { photosList: [], collections: { pool: [selected] }, get externalCollections() { throw failure; } };
    assert.throws(() => sandbox.findSelectable(state, 'same'), (error) => error === failure);
    state.library = { photosList: [{ get url() { throw failure; } }], collections: {} };
    assert.throws(() => sandbox.findSelectable(state, 'same'), (error) => error === failure);
    state.library = { photosList: [null, { url: undefined }], collections: {}, externalCollections: {} };
    assert.strictEqual(sandbox.findSelectable(state, undefined, selected), selected);
  });

  assertTest('preview staging copies enumerable fields and retains nonmatching row aliases', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.prepend = prependVisiblePhoto;`, sandbox);
    const calls = [];
    const shared = {};
    const symbol = Symbol('photo metadata');
    const photo = Object.assign(Object.create({ inherited: 'not copied' }), { nested: shared, [symbol]: 'copied' });
    Object.defineProperty(photo, 'url', { enumerable: true, get: () => (calls.push('photo url'), 'same') });
    Object.defineProperty(photo, 'hidden', { value: 'not copied' });
    const keep = { get url() { calls.push('keep url'); return 'other'; } };
    const duplicate = { get url() { calls.push('duplicate url'); return 'same'; } };
    const rows = [keep, duplicate];
    const result = sandbox.prepend(rows, photo);
    assert.notStrictEqual(result, rows);
    assert.notStrictEqual(result[0], photo);
    assert.strictEqual(result[0].url, 'same');
    assert.strictEqual(result[0].nested, shared);
    assert.strictEqual(result[0][symbol], 'copied');
    assert.strictEqual('inherited' in result[0], false);
    assert.strictEqual('hidden' in result[0], false);
    assert.strictEqual(result[1], keep);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(calls, ['photo url', 'photo url', 'keep url', 'photo url', 'duplicate url', 'photo url']);
    assert.strictEqual(rows[1], duplicate);
  });

  assertTest('preview staging keeps no-op identity and propagates native access failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.prepend = prependVisiblePhoto;`, sandbox);
    const rows = [{ url: 'other' }];
    for (const photo of [null, undefined, {}, { url: 0 }, { url: '' }]) {
      assert.strictEqual(sandbox.prepend(rows, photo), rows);
    }
    assert.strictEqual(sandbox.prepend(null, null), null);
    const failure = new Error('URL read failed');
    assert.throws(() => sandbox.prepend(rows, { get url() { throw failure; } }), (error) => error === failure);
    assert.throws(() => sandbox.prepend([null], { url: 'x' }), (error) => error.name === 'TypeError');
    assert.throws(() => sandbox.prepend(null, { url: 'x' }), (error) => error.name === 'TypeError');
  });

  assertTest('playback command preserves callback aliases and resolves direction before cloning', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildPlayback = buildPlaybackCommandReducer;\nglobalThis.replaceUpdate = fn => { updateActivePhotoUrl = fn; };`, sandbox);
    const state = createState();
    const config = state.config;
    const calls = [];
    Object.defineProperty(state, 'config', { get: () => (calls.push('clone'), config) });
    const command = Object.freeze({});
    const payload = Object.freeze({});
    const selected = Object.freeze({ url: 'selected' });
    const env = Object.freeze({ rng: () => 0.5 });
    const prepared = createState();
    const updated = createState();
    sandbox.replaceUpdate((next, photo, direction) => {
      calls.push('update');
      assert.strictEqual(next, prepared);
      assert.strictEqual(photo, selected);
      assert.strictEqual(direction, 'prev');
      return { state: updated, changed: false };
    });
    const reduce = sandbox.buildPlayback({
      readPayload: (c, s) => (calls.push('read'), assert.strictEqual(c, command), assert.strictEqual(s, state), payload),
      selectPhoto: (s, p, e) => (calls.push('select'), assert.strictEqual(s, state), assert.strictEqual(p, payload), assert.strictEqual(e, env), selected),
      resolveDirection: (p, c, s, e) => (calls.push('direction'), assert.strictEqual(p, payload), assert.strictEqual(c, command), assert.strictEqual(s, state), assert.strictEqual(e, env), 'prev'),
      prepareState: (next, p, photo, c, s, e) => {
        calls.push('prepare');
        assert.notStrictEqual(next, state);
        assert.notStrictEqual(next.config, config);
        assert.strictEqual(p, payload);
        assert.strictEqual(photo, selected);
        assert.strictEqual(c, command);
        assert.strictEqual(s, state);
        assert.strictEqual(e, env);
        return prepared;
      }
    });
    const result = reduce(state, command, env);
    assert.ok(calls.includes('clone'));
    assert.deepStrictEqual(calls.filter((call) => call !== 'clone'), ['read', 'select', 'direction', 'prepare', 'update']);
    assert.ok(calls.indexOf('clone') > calls.indexOf('direction'));
    assert.ok(calls.lastIndexOf('clone') < calls.indexOf('prepare'));
    assert.strictEqual(result.nextState, updated);
    assert.deepStrictEqual(Array.from(result.events, (event) => event.type), ['photo-update', 'state-sync']);
    assert.strictEqual(result.effects.length, 0);
  });

  assertTest('playback command short circuits null payload and falsy selection, and forwards environment', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildPlayback = buildPlaybackCommandReducer;`, sandbox);
    const state = createState();
    const calls = [];
    let selection = null;
    let payload = null;
    let receivedEnv;
    const reduce = sandbox.buildPlayback({
      readPayload: () => (calls.push('read'), payload),
      selectPhoto: (_state, value, env) => (calls.push('select'), assert.strictEqual(value, payload), receivedEnv = env, selection),
      resolveDirection: () => { throw new Error('must not resolve direction'); },
      prepareState: () => { throw new Error('must not prepare'); }
    });
    assert.strictEqual(reduce(state, {}).nextState, state);
    assert.deepStrictEqual(calls, ['read']);
    payload = undefined;
    for (const value of [null, undefined, false, 0, '']) {
      calls.length = 0;
      selection = value;
      const result = reduce(state, {}, null);
      assert.strictEqual(result.nextState, state);
      assert.strictEqual(receivedEnv, null);
      assert.deepStrictEqual(calls, ['read', 'select']);
      assert.strictEqual(result.events.length, 0);
      assert.strictEqual(result.effects.length, 0);
    }
    reduce(state, {});
    assert.deepStrictEqual(Object.keys(receivedEnv), []);
  });

  assertTest('playback selection clones before preparation, updates unchanged URLs and propagates failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.applyPlayback = applyPlaybackSelection;\nglobalThis.buildPlayback = buildPlaybackCommandReducer;`, sandbox);
    const state = createState();
    const selected = { url: state.playback.activePhotoUrl };
    const result = sandbox.applyPlayback(state, selected, { direction: 'prev' });
    assert.notStrictEqual(result.nextState, state);
    assert.strictEqual(result.nextState.playback.activePhotoUrl, state.playback.activePhotoUrl);
    assert.strictEqual(result.nextState.playback.splitSeed, state.playback.splitSeed);
    assert.strictEqual(result.nextState.playback.lastDirection, 'prev');
    assert.deepStrictEqual(Array.from(result.events, (event) => event.type), ['photo-update', 'state-sync']);
    const failure = new Error('playback failed');
    assert.throws(() => sandbox.applyPlayback(state, selected, { prepareState: () => { throw failure; } }), (error) => error === failure);
    assert.throws(() => sandbox.applyPlayback(state, selected, { prepareState: () => null }), (error) => error.name === 'TypeError');
    const reduce = sandbox.buildPlayback({ readPayload: () => ({}), selectPhoto: () => selected, resolveDirection: () => { throw failure; } });
    assert.throws(() => reduce(state, {}), (error) => error === failure);
  });

  assertTest('feed finalization shares its projected context and preserves output ordering', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.finalize = finalizeFeedMutation;\nglobalThis.replaceRecompute = fn => { recomputeAndEnsureActivePhoto = fn; };`, sandbox);
    const state = createState();
    const finalState = createState();
    const finalized = { state: finalState, photoChanged: true };
    const calls = [];
    const directions = [];
    const effects = Object.freeze([{ type: 'refresh-weather' }]);
    sandbox.replaceRecompute((next, options) => {
      calls.push('recompute');
      assert.strictEqual(next, state);
      directions.push(options.direction);
      return finalized;
    });
    const result = sandbox.finalize(state, {
      direction: 'prev', persist: true,
      effects: (context) => (calls.push('effects'), assert.strictEqual(context, finalized), effects),
      eventsFor: (context) => (calls.push('events'), assert.strictEqual(context, finalized), [{ type: 'photo-update' }])
    });
    assert.strictEqual(result.nextState, finalState);
    assert.deepStrictEqual(calls, ['recompute', 'effects', 'events']);
    assert.deepStrictEqual(directions, ['prev']);
    assert.deepStrictEqual(Array.from(result.effects, (effect) => effect.type), ['persist', 'refresh-weather']);
    assert.deepStrictEqual(Array.from(result.events, (event) => event.type), ['photo-update']);
    const defaultResult = sandbox.finalize(state, {});
    assert.deepStrictEqual(Array.from(defaultResult.events, (event) => event.type), ['photo-update', 'state-sync']);
  });

  assertTest('feed finalization preserves raw active URLs and shares one context across factories', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.finalize = finalizeFeedMutation;`, sandbox);
    const rawUrl = Object.freeze({ media: 'raw' });
    const photo = Object.freeze({ url: rawUrl, rating: 0 });
    const state = createState({
      library: { collections: { pool: [photo] }, externalCollections: {}, photosList: [] },
      playback: { selectedCategories: ['pool'], activePhotoUrl: null }
    });
    const calls = [];
    let context;
    const result = sandbox.finalize(state, {
      now: new Date(2026, 0, 1), rng: () => assert.fail('zero weight does not draw'), persist: true,
      effects: finalized => (calls.push('effects'), context = finalized, [{ type: 'refresh-weather' }]),
      eventsFor: finalized => (calls.push('events'), assert.strictEqual(finalized, context), [{ type: 'photo-update' }])
    });
    assert.strictEqual(result.nextState, context.state);
    assert.strictEqual(context.photoChanged, true);
    assert.strictEqual(result.nextState.playback.activePhotoUrl, rawUrl);
    assert.strictEqual(state.playback.activePhotoUrl, null);
    assert.deepStrictEqual(calls, ['effects', 'events']);
    assert.deepStrictEqual(Array.from(result.effects, effect => effect.type), ['persist', 'refresh-weather']);
  });

  assertTest('feed finalization distinguishes default events from explicit falsy outputs', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.finalize = finalizeFeedMutation;\nglobalThis.replaceRecompute = fn => { recomputeAndEnsureActivePhoto = fn; };`, sandbox);
    const state = createState();
    [false, true].forEach(photoChanged => {
      sandbox.replaceRecompute(() => ({ state, photoChanged }));
      assert.deepStrictEqual(Array.from(sandbox.finalize(state, {}).events, event => event.type),
        photoChanged ? ['photo-update', 'state-sync'] : ['state-sync']);
      [null, false, 0, ''].forEach(value => {
        const result = sandbox.finalize(state, { eventsFor: value, effects: value });
        assert.strictEqual(result.nextState, state);
        assert.strictEqual(result.events.length, 0);
        assert.strictEqual(result.effects.length, 0);
        const resolved = sandbox.finalize(state, { eventsFor: () => value, effects: () => value });
        assert.strictEqual(resolved.events.length, 0);
        assert.strictEqual(resolved.effects.length, 0);
      });
    });
  });

  assertTest('feed finalization propagates failures at their original resolution boundary', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.finalize = finalizeFeedMutation;\nglobalThis.replaceRecompute = fn => { recomputeAndEnsureActivePhoto = fn; };`, sandbox);
    const state = createState();
    const failure = new Error('finalization failed');
    const calls = [];
    const stop = stage => { calls.push(stage); throw failure; };
    sandbox.replaceRecompute(() => (calls.push('recompute'), { state, photoChanged: false }));
    assert.throws(() => sandbox.finalize(state, {
      effects: () => stop('effects'), eventsFor: () => stop('events')
    }), error => error === failure);
    assert.deepStrictEqual(calls, ['recompute', 'effects']);
    calls.length = 0;
    assert.throws(() => sandbox.finalize(state, {
      effects: () => (calls.push('effects'), []), eventsFor: () => stop('events')
    }), error => error === failure);
    assert.deepStrictEqual(calls, ['recompute', 'effects', 'events']);
    calls.length = 0;
    assert.throws(() => sandbox.finalize(state, { get effects() { return stop('options'); } }), error => error === failure);
    assert.deepStrictEqual(calls, ['options']);
  });

  assertTest('feed mutation skips finalization on no-op and spreads environment after options', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reduceFeed = reduceFeedMutation;\nglobalThis.replaceRecompute = fn => { recomputeAndEnsureActivePhoto = fn; };`, sandbox);
    const state = createState();
    const calls = [];
    const failure = new Error('finalization failure');
    const env = { get direction() { calls.push('env'); return 'prev'; } };
    const options = {
      apply: (next) => (calls.push('apply'), next.config.theme = 'changed', true),
      get direction() { calls.push('options'); return 'next'; }
    };
    sandbox.replaceRecompute((next, selection) => {
      calls.push('recompute');
      assert.notStrictEqual(next, state);
      assert.strictEqual(selection.direction, 'prev');
      return { state: next, photoChanged: false };
    });
    const result = sandbox.reduceFeed(state, options, env);
    assert.deepStrictEqual(calls, ['apply', 'options', 'env', 'recompute']);
    assert.notStrictEqual(result.nextState, state);
    assert.notStrictEqual(state.config.theme, 'changed');
    assert.deepStrictEqual(Array.from(result.events, (event) => event.type), ['state-sync']);
    calls.length = 0;
    assert.strictEqual(sandbox.reduceFeed(state, {
      apply: () => false,
      get direction() { calls.push('options'); return 'next'; }
    }, env).nextState, state);
    assert.deepStrictEqual(calls, []);
    sandbox.replaceRecompute(() => { throw failure; });
    assert.throws(() => sandbox.reduceFeed(state, options, env), (error) => error === failure);
  });

  assertTest('field reducer composes selector, command reader and output factories with shared aliases', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildField = buildFieldCommandReducer;`, sandbox);
    const state = createState();
    const value = Object.freeze({ raw: true });
    const command = Object.freeze({ value });
    const calls = [];
    let clone;
    const reduce = sandbox.buildField((next) => (calls.push('select'), clone = next, next.config), 'theme',
      (current, next) => (calls.push('read'), assert.strictEqual(current, command), assert.strictEqual(next, clone), current.value),
      { effects: (next, current) => (calls.push('effects'), assert.strictEqual(next, clone), assert.strictEqual(current, command), []), persist: true });
    assert.deepStrictEqual(calls, []);
    const result = reduce(state, command);
    assert.deepStrictEqual(calls, ['select', 'read', 'effects']);
    assert.strictEqual(result.nextState, clone);
    assert.strictEqual(clone.config.theme, value);
    assert.notStrictEqual(state.config.theme, value);
    assert.deepStrictEqual(Array.from(result.events, (event) => event.type), ['state-sync']);
    assert.deepStrictEqual(Array.from(result.effects, (effect) => effect.type), ['persist']);
  });

  assertTest('field reducer preserves no-ops, native keys, option timing and failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildField = buildFieldCommandReducer;`, sandbox);
    const state = createState();
    const calls = [];
    const key = { [Symbol.toPrimitive]: () => (calls.push('key'), 'theme') };
    const reduce = sandbox.buildField((next) => (calls.push('select'), next.config), key,
      (command) => (calls.push('read'), command.value),
      { get events() { calls.push('options'); return []; } });
    assert.strictEqual(reduce(state, { value: undefined }).nextState, state);
    assert.deepStrictEqual(calls, ['options', 'select', 'read']);
    calls.length = 0;
    assert.strictEqual(reduce(state, { value: state.config.theme }).nextState, state);
    assert.deepStrictEqual(calls, ['options', 'select', 'read', 'key']);
    const failure = new Error('field failure');
    assert.throws(() => sandbox.buildField(() => { throw failure; }, 'theme', () => 1)(state, {}), (error) => error === failure);
    assert.throws(() => sandbox.buildField((next) => next.config, 'theme', () => { throw failure; })(state, {}), (error) => error === failure);
    assert.throws(() => sandbox.buildField((next) => next.config, { [Symbol.toPrimitive]() { throw failure; } }, () => 1)(state, {}), (error) => error === failure);
    assert.throws(() => sandbox.buildField((next) => next.config, 'theme', null)(state, {}), (error) => error.name === 'TypeError');
  });

  assertTest('entries reducer partially applies readers and preserves assignment order and aliases', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildEntries = buildEntriesCommandReducer;`, sandbox);
    const state = createState();
    const command = Object.freeze({ theme: 'new', interval: 7 });
    const reads = [];
    let selected;
    let cloned;
    const reduce = sandbox.buildEntries((next) => {
      reads.push('select');
      cloned = next;
      selected = new Proxy(next.config, { set: (target, key, value) => (reads.push(`set ${String(key)}`), Reflect.set(target, key, value)) });
      return selected;
    }, (current, next, target) => {
      reads.push('read');
      assert.strictEqual(current, command);
      assert.strictEqual(next, cloned);
      assert.strictEqual(target, selected);
      return [['theme', current.theme], ['slideshowInterval', current.interval]];
    }, {
      events: (next, current) => (assert.strictEqual(next, cloned), assert.strictEqual(current, command), []),
      persist: true
    });
    assert.deepStrictEqual(reads, []);
    const result = reduce(state, command);
    assert.deepStrictEqual(reads, ['select', 'read', 'set theme', 'set slideshowInterval']);
    assert.strictEqual(result.nextState, cloned);
    assert.notStrictEqual(cloned, state);
    assert.notStrictEqual(state.config.theme, command.theme);
    assert.strictEqual(cloned.config.theme, command.theme);
    assert.strictEqual(cloned.config.slideshowInterval, command.interval);
    assert.deepStrictEqual(Array.from(result.effects, (effect) => effect.type), ['persist']);
    const constant = sandbox.buildEntries((next) => next.config, [['theme', 'constant']]);
    assert.strictEqual(constant(state, command).nextState.config.theme, 'constant');
  });

  assertTest('entries reducer retains no-op, option spread and failure behavior', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.buildEntries = buildEntriesCommandReducer;`, sandbox);
    const state = createState();
    const calls = [];
    const options = { get events() { calls.push('options'); return () => { throw new Error('no event'); }; } };
    for (const entries of [null, false, {}, [], [['theme', undefined]], [['theme', state.config.theme]]]) {
      const reduce = sandbox.buildEntries((next) => (calls.push('select'), next.config), entries, options);
      assert.strictEqual(reduce(state, {}).nextState, state);
    }
    assert.deepStrictEqual(calls, Array.from({ length: 6 }, () => ['options', 'select']).flat());
    const failure = new Error('reader failed');
    assert.throws(() => sandbox.buildEntries(() => { throw failure; }, [])(state, {}), (error) => error === failure);
    assert.throws(() => sandbox.buildEntries((next) => next.config, () => { throw failure; })(state, {}), (error) => error === failure);
    assert.throws(() => sandbox.buildEntries(() => null, [['x', 1]])(state, {}), (error) => error.name === 'TypeError');
    assert.throws(() => sandbox.buildEntries((next) => next.config, [null])(state, {}), (error) => error.name === 'TypeError');
    assert.throws(() => sandbox.buildEntries((next) => next.config, [], { get events() { throw failure; } })(state, {}), (error) => error === failure);
  });

  assertTest('command mutation adapts callbacks with shared clone and command aliases', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reduceCommand = reduceCommandMutation;`, sandbox);
    const state = createState();
    const command = Object.freeze({ value: 'changed' });
    const calls = [];
    const events = Object.freeze([{ type: 'photo-update' }]);
    const effects = Object.freeze([{ type: 'refresh-weather' }]);
    let clone;
    const result = sandbox.reduceCommand(state, command, {
      apply: (next, current) => (calls.push('apply'), clone = next, assert.strictEqual(current, command), next.config.theme = current.value, 'yes'),
      events: (next, current) => (calls.push('events'), assert.strictEqual(next, clone), assert.strictEqual(current, command), events),
      effects: (next, current) => (calls.push('effects'), assert.strictEqual(next, clone), assert.strictEqual(current, command), effects),
      persist: true
    });
    assert.deepStrictEqual(calls, ['apply', 'effects', 'events']);
    assert.strictEqual(result.nextState, clone);
    assert.notStrictEqual(clone, state);
    assert.notStrictEqual(state.config.theme, command.value);
    assert.strictEqual(result.events, events);
    assert.deepStrictEqual(Array.from(result.effects, (effect) => effect.type), ['persist', 'refresh-weather']);
    const direct = sandbox.reduceCommand(state, command, { apply: () => true, events, effects });
    assert.strictEqual(direct.events, events);
    assert.strictEqual(direct.effects, effects);
    const noop = sandbox.reduceCommand(state, command, {
      apply: () => 0,
      events: () => { throw new Error('unused events'); },
      effects: () => { throw new Error('unused effects'); }
    });
    assert.strictEqual(noop.nextState, state);
    assert.strictEqual(noop.events.length, 0);
    assert.strictEqual(noop.effects.length, 0);
  });

  assertTest('command mutation preserves option reads, defaults and native failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reduceCommand = reduceCommandMutation;`, sandbox);
    const state = createState();
    const reads = [];
    const keywords = state.config.searchKeywords;
    Object.defineProperty(state.config, 'searchKeywords', { enumerable: true, get: () => (reads.push('clone'), keywords) });
    const options = {
      get apply() { reads.push('read apply'); return () => (reads.push('apply'), true); },
      get events() { reads.push('read events'); return undefined; },
      get effects() { reads.push('read effects'); return undefined; },
      get persist() { reads.push('read persist'); return false; }
    };
    const defaults = sandbox.reduceCommand(state, null, options);
    assert.deepStrictEqual(reads, ['read apply', 'read events', 'read effects', 'read persist', 'clone', 'clone', 'apply']);
    assert.deepStrictEqual(Array.from(defaults.events, (event) => event.type), ['state-sync']);
    assert.strictEqual(defaults.effects.length, 0);
    const falsy = sandbox.reduceCommand(state, undefined, { apply: () => true, events: null, effects: false });
    assert.strictEqual(falsy.events.length, 0);
    assert.strictEqual(falsy.effects.length, 0);
    const failure = new Error('callback failed');
    assert.throws(() => sandbox.reduceCommand(state, {}, { apply: () => { throw failure; } }), (error) => error === failure);
    assert.throws(() => sandbox.reduceCommand(state, {}, { apply: () => true, effects: () => { throw failure; } }), (error) => error === failure);
    assert.throws(() => sandbox.reduceCommand(state, {}, { get events() { throw failure; } }), (error) => error === failure);
    assert.throws(() => sandbox.reduceCommand(state, {}, null), (error) => error.name === 'TypeError');
    assert.throws(() => sandbox.reduceCommand(state, {}, {}), (error) => error.name === 'TypeError');
  });

  assertTest('private state-patch reducer clones before reading a patch, even for a no-op', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reducePatch = reduceStatePatchCommand;`, sandbox);
    const state = createState();
    const keywords = state.config.searchKeywords;
    const reads = [];
    Object.defineProperty(state.config, 'searchKeywords', {
      enumerable: true,
      configurable: true,
      get: () => (reads.push('clone'), keywords)
    });
    const patch = new Proxy({}, { get: () => (reads.push('patch'), undefined) });
    const env = { get now() { throw new Error('unused environment'); } };
    const first = sandbox.reducePatch(state, patch, env);
    const second = sandbox.reducePatch(state, null, env);
    assert.strictEqual(reads[0], 'clone');
    assert.ok(reads.indexOf('patch') > 0);
    assert.strictEqual(first.nextState, state);
    assert.strictEqual(second.nextState, state);
    assert.notStrictEqual(first.events, second.events);
    assert.notStrictEqual(first.effects, second.effects);
    assert.strictEqual(first.events.length, 0);
    assert.strictEqual(first.effects.length, 0);
    const failure = new Error('clone failed');
    Object.defineProperty(state.config, 'searchKeywords', { get: () => { throw failure; } });
    assert.throws(() => sandbox.reducePatch(state, null, env), (error) => error === failure);
  });

  assertTest('private state-patch reducer reads its environment only when exclusions change', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.reducePatch = reduceStatePatchCommand;`, sandbox);
    const state = createState();
    const reads = [];
    const failure = new Error('rng read failed');
    const env = {
      get now() { reads.push('now'); return new Date('2026-06-27T12:00:00'); },
      get rng() { reads.push('rng'); throw failure; }
    };
    const changed = sandbox.reducePatch(state, { theme: 'new theme', autoLocation: true }, env);
    assert.notStrictEqual(changed.nextState, state);
    assert.strictEqual(state.config.theme === 'new theme', false);
    assert.deepStrictEqual(reads, []);
    assert.deepStrictEqual(Array.from(changed.events, (event) => event.type), ['state-sync']);
    assert.deepStrictEqual(Array.from(changed.effects, (effect) => effect.type), ['persist', 'refresh-weather']);
    assert.throws(() => sandbox.reducePatch(state, { excludedKeywords: ['hallway'] }, env), (error) => error === failure);
    assert.deepStrictEqual(reads, ['now', 'rng']);
  });

  assertTest('shared patch specs retain callbacks, flags and fresh undefined defaults', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.makeSpec = createPatchSpec;`, sandbox);
    const readValue = () => 1;
    const hasChanged = () => true;
    const applyValue = (state) => state;
    const flags = Object.freeze({ refreshWeather: true });
    const options = Object.freeze({ readValue, hasChanged, applyValue, flags });
    const spec = sandbox.makeSpec(options);
    assert.notStrictEqual(spec, options);
    assert.strictEqual(spec.readValue, readValue);
    assert.strictEqual(spec.hasChanged, hasChanged);
    assert.strictEqual(spec.applyValue, applyValue);
    assert.strictEqual(spec.flags, flags);
    assert.notStrictEqual(sandbox.makeSpec({ ...options, flags: undefined }).flags, sandbox.makeSpec({ ...options, flags: undefined }).flags);
    assert.strictEqual(sandbox.makeSpec({ ...options, flags: null }).flags, null);
  });

  assertTest('shared patch interpreter preserves skip, comparison, write and flag ordering', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.applySpec = applyPatchSpec;\nglobalThis.skip = PATCH_SKIP;`, sandbox);
    const state = createState();
    const patch = Object.freeze({ raw: true });
    const context = { patch, nextState: state, changed: false, recomputePhotos: false, refreshWeather: false, extra: patch };
    const calls = [];
    const flags = {
      get recomputePhotos() { calls.push('recompute'); return 'yes'; },
      get refreshWeather() { calls.push('weather'); return 0; }
    };
    const written = { ...state };
    const spec = {
      readValue: (input, current) => { calls.push('read'); assert.strictEqual(input, patch); assert.strictEqual(current, state); return 7; },
      hasChanged: (current, value) => { calls.push('compare'); assert.strictEqual(current, state); assert.strictEqual(value, 7); return true; },
      applyValue: (current, value) => { calls.push('write'); assert.strictEqual(current, state); assert.strictEqual(value, 7); return written; },
      flags
    };
    const result = sandbox.applySpec(context, spec);
    assert.deepStrictEqual(calls, ['read', 'compare', 'write', 'recompute', 'weather']);
    assert.strictEqual(result.nextState, written);
    assert.strictEqual(result.extra, patch);
    assert.strictEqual(result.changed, true);
    assert.strictEqual(result.recomputePhotos, true);
    assert.strictEqual(result.refreshWeather, false);
    assert.strictEqual(context.changed, false);
    calls.length = 0;
    assert.strictEqual(sandbox.applySpec(context, { ...spec, readValue: () => sandbox.skip }), context);
    assert.deepStrictEqual(calls, []);
    assert.strictEqual(sandbox.applySpec(context, { ...spec, hasChanged: () => false }), context);
    assert.deepStrictEqual(calls, ['read']);
    calls.length = 0;
    const alreadySet = { ...context, recomputePhotos: true, refreshWeather: true };
    const unchangedFlags = sandbox.applySpec(alreadySet, { ...spec, flags: null });
    assert.strictEqual(unchangedFlags.recomputePhotos, true);
    assert.strictEqual(unchangedFlags.refreshWeather, true);
    assert.deepStrictEqual(calls, ['read', 'compare', 'write']);
  });

  assertTest('shared patch interpreter propagates callback and flag access failures in order', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.applySpec = applyPatchSpec;`, sandbox);
    const state = createState();
    const context = { patch: {}, nextState: state, changed: false, recomputePhotos: false, refreshWeather: false };
    const failure = new Error('patch failure');
    const calls = [];
    const base = {
      readValue: () => { calls.push('read'); return 1; },
      hasChanged: () => { calls.push('compare'); return true; },
      applyValue: () => { calls.push('write'); return state; },
      flags: { get recomputePhotos() { calls.push('flag'); throw failure; } }
    };
    assert.throws(() => sandbox.applySpec(context, base), (error) => error === failure);
    assert.deepStrictEqual(calls, ['read', 'compare', 'write', 'flag']);
    calls.length = 0;
    assert.throws(() => sandbox.applySpec(context, { ...base, hasChanged: () => { throw failure; } }), (error) => error === failure);
    assert.deepStrictEqual(calls, ['read']);
    assert.strictEqual(context.nextState, state);
  });

  assertTest('config patch specs preserve default reads, immutable writes and native keys', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.makeSpec = createConfigPatchSpec;\nglobalThis.applySpec = applyPatchSpec;`, sandbox);
    const state = createState();
    const key = Symbol('config');
    const value = Object.freeze({ marker: true });
    const spec = sandbox.makeSpec(key);
    const context = { patch: { [key]: value }, nextState: state, changed: false, recomputePhotos: false, refreshWeather: false };
    const result = sandbox.applySpec(context, spec);
    assert.strictEqual(result.nextState.config[key], value);
    assert.notStrictEqual(result.nextState, state);
    assert.notStrictEqual(result.nextState.config, state.config);
    assert.strictEqual(result.nextState.library, state.library);
    assert.strictEqual(state.config[key], undefined);
    assert.strictEqual(result.changed, true);
    assert.strictEqual(sandbox.applySpec({ ...context, patch: {} }, spec).nextState, state);
    assert.notStrictEqual(spec.flags, sandbox.makeSpec(key).flags);
    assert.throws(() => sandbox.makeSpec('theme', null), (error) => error.name === 'TypeError');
  });

  assertTest('config patch specs preserve custom callback order, flags and failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.makeSpec = createConfigPatchSpec;\nglobalThis.applySpec = applyPatchSpec;\nglobalThis.skip = PATCH_SKIP;`, sandbox);
    const state = createState();
    const patch = {};
    const calls = [];
    const flags = { recomputePhotos: 'yes', refreshWeather: 0 };
    const updated = { ...state };
    const options = {
      readValue: (input, current) => { calls.push('read'); assert.strictEqual(input, patch); assert.strictEqual(current, state); return 7; },
      hasChanged: (current, value) => { calls.push('compare'); assert.strictEqual(current, state); assert.strictEqual(value, 7); return true; },
      applyValue: (current, value) => { calls.push('apply'); assert.strictEqual(current, state); assert.strictEqual(value, 7); return updated; },
      flags
    };
    const spec = sandbox.makeSpec('theme', options);
    const context = { patch, nextState: state, changed: false, recomputePhotos: false, refreshWeather: true };
    assert.strictEqual(spec.flags, flags);
    const result = sandbox.applySpec(context, spec);
    assert.strictEqual(result.nextState, updated);
    assert.strictEqual(result.recomputePhotos, true);
    assert.strictEqual(result.refreshWeather, true);
    assert.deepStrictEqual(calls, ['read', 'compare', 'apply']);
    const skipped = sandbox.makeSpec('theme', { ...options, readValue: () => sandbox.skip });
    assert.strictEqual(sandbox.applySpec(context, skipped), context);
    const unchanged = sandbox.makeSpec('theme', { ...options, hasChanged: () => false });
    assert.strictEqual(sandbox.applySpec(context, unchanged), context);
    const failure = new Error('callback failed');
    assert.throws(() => sandbox.applySpec(context, sandbox.makeSpec('theme', { ...options, readValue: () => { throw failure; } })), (error) => error === failure);
    assert.throws(() => sandbox.applySpec(context, sandbox.makeSpec('theme', { ...options, flags: null })), (error) => error.name === 'TypeError');
  });

  assertTest('reducer object guard accepts object prototypes without inspecting properties', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.guardForTest = isPlainObject;`, sandbox);
    const guard = sandbox.guardForTest;
    const opaque = new Proxy({}, {
      get() { assert.fail('property read'); },
      getPrototypeOf() { assert.fail('prototype read'); },
      ownKeys() { assert.fail('property enumeration'); }
    });
    [Object.create(null), Object.create({ inherited: true }), new Date(), opaque].forEach((value) => {
      assert.strictEqual(guard(value), true);
      assert.strictEqual(guard(value), true);
    });
    [null, undefined, false, 0, '', 'object', Symbol('x'), 1n, [], () => {}].forEach((value) => {
      assert.strictEqual(guard(value), false);
    });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    assert.throws(() => guard(revoked.proxy), (error) => error.name === 'TypeError');
  });

  assertTest('vision and location patch readers preserve inherited values, reads, skips and failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.readersForTest = [readVisionConfigPatch, readManualLocationPatch];\nglobalThis.skipForTest = PATCH_SKIP;`, sandbox);
    const [readVision, readLocation] = sandbox.readersForTest;
    const state = createState();
    const calls = [];
    const vision = Object.create({ get model() { calls.push('model'); return ' model '; } });
    const location = Object.create({ get city() { calls.push('city'); return ' Montreal '; }, lat: '45.5', lon: '-73.6' });
    const patch = {
      get visionConfig() { calls.push('vision'); return vision; },
      get manualLocation() { calls.push('location'); return location; }
    };
    assert.strictEqual(readVision(patch, state).model, 'model');
    const normalized = readLocation(patch, state);
    assert.strictEqual(normalized.city, 'Montreal');
    assert.strictEqual(normalized.lat, 45.5);
    assert.strictEqual(normalized.lon, -73.6);
    assert.deepStrictEqual(calls, ['vision', 'vision', 'model', 'location', 'location', 'city']);
    [null, [], () => {}, 'invalid'].forEach((value) => {
      assert.strictEqual(readVision({ visionConfig: value }, state), sandbox.skipForTest);
      assert.strictEqual(readLocation({ manualLocation: value }, state), sandbox.skipForTest);
    });
    const failure = new Error('property failure');
    assert.throws(() => readVision({ visionConfig: { get apiUrl() { throw failure; } } }, state), (error) => error === failure);
    assert.throws(() => readLocation({ manualLocation: { get lat() { throw failure; } } }, state), (error) => error === failure);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    assert.throws(() => readLocation({ manualLocation: revoked.proxy }, state), (error) => error.name === 'TypeError');
  });

  assertTest('partially applied patch reader keeps missing and identity cases distinct', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.readPatchForTest = readPatchField;\nglobalThis.patchSkipForTest = PATCH_SKIP;`, sandbox);
    const read = sandbox.readPatchForTest;
    const state = createState();
    const value = Object.freeze({ marker: 'alias' });
    const symbol = Symbol('field');
    const identity = read(symbol);
    assert.strictEqual(identity({ [symbol]: value }, state), value);
    assert.strictEqual(identity({ [symbol]: null }, state), null);
    assert.strictEqual(identity({}, state), sandbox.patchSkipForTest);
    assert.strictEqual(identity(null, state), sandbox.patchSkipForTest);
    assert.strictEqual(read('length')('abc', state), 3);
    assert.strictEqual(read('clock', undefined)({ clock: value }, state), value);
    let reads = 0;
    const changing = { get clock() { return ++reads === 1 ? value : undefined; } };
    assert.strictEqual(read('clock')(changing, state), undefined);
    assert.strictEqual(reads, 2);
  });

  assertTest('patch reader preserves callback arguments, skip, and native key conversion order', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.readPatchForTest = readPatchField;\nglobalThis.patchSkipForTest = PATCH_SKIP;`, sandbox);
    const calls = [];
    const state = createState();
    const patch = { get clock() { calls.push('get'); return calls.length; } };
    const key = { [Symbol.toPrimitive](hint) { calls.push(`key:${hint}`); return 'clock'; } };
    const read = sandbox.readPatchForTest(key, (value, actualState, actualPatch) => {
      calls.push('normalize');
      assert.strictEqual(actualState, state);
      assert.strictEqual(actualPatch, patch);
      return value;
    });
    assert.strictEqual(read(patch, state), 4);
    assert.deepStrictEqual(calls, ['key:string', 'get', 'key:string', 'get', 'normalize']);
    assert.strictEqual(sandbox.readPatchForTest('x', () => undefined)({ x: 1 }, state), undefined);
    assert.strictEqual(sandbox.readPatchForTest('x', () => sandbox.patchSkipForTest)({ x: 1 }, state), sandbox.patchSkipForTest);
    assert.strictEqual(sandbox.readPatchForTest(key, () => assert.fail('missing field normalized'))(null, state), sandbox.patchSkipForTest);
    assert.strictEqual(calls.length, 5);
  });

  assertTest('patch reader propagates native lookup, key, and normalizer failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.readPatchForTest = readPatchField;`, sandbox);
    const read = sandbox.readPatchForTest;
    const failure = new Error('patch reader failure');
    const state = createState();
    let reads = 0;
    const patch = { get x() { if (++reads === 2) throw failure; return 1; } };
    assert.throws(() => read('x')(patch, state), (error) => error === failure);
    assert.strictEqual(reads, 2);
    assert.throws(() => read({ [Symbol.toPrimitive]() { throw failure; } })({ x: 1 }, state), (error) => error === failure);
    assert.throws(() => read('x', () => { throw failure; })({ x: 1 }, state), (error) => error === failure);
  });

  assertTest('widget patch reader normalizes only known own enumerable string keys', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.widgetReaderForTest = readWidgetPatch;\nglobalThis.widgetSkipForTest = PATCH_SKIP;`, sandbox);
    const read = sandbox.widgetReaderForTest;
    const state = createState();
    const widgetValues = Object.create({ qrcode: false });
    Object.defineProperties(widgetValues, {
      clock: { enumerable: true, value: Object.freeze({ raw: true }) },
      unknown: { enumerable: true, get: () => assert.fail('unknown value read') },
      qrcode: { enumerable: false, value: false },
      [Symbol('widget')]: { enumerable: true, get: () => assert.fail('symbol value read') }
    });
    const input = { widgets: widgetValues };
    const first = read(input, state);
    const second = read(input, state);
    assert.deepStrictEqual(Array.from(Object.entries(first), (entry) => Array.from(entry)), [['clock', true]]);
    assert.notStrictEqual(first, second);
    assert.strictEqual(Object.hasOwn(first, 'qrcode'), false);
    assert.strictEqual(Object.hasOwn(widgetValues, 'clock'), true);
    [null, undefined, false, 0, [], () => {}].forEach((widgets) => {
      assert.strictEqual(read({ widgets }, state), sandbox.widgetSkipForTest);
    });
    assert.strictEqual(read(null, state), sandbox.widgetSkipForTest);
    assert.strictEqual(read({ widgets: { unknown: true } }, state), sandbox.widgetSkipForTest);
  });

  assertTest('widget patch reader preserves repeated reads, filter order and exact failures', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.widgetReaderForTest = readWidgetPatch;\nglobalThis.widgetSkipForTest = PATCH_SKIP;`, sandbox);
    const read = sandbox.widgetReaderForTest;
    const calls = [];
    const failure = new Error('widget access failed');
    const values = new Proxy({ clock: 0, unknown: 1 }, {
      ownKeys(target) { calls.push('keys'); return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, key) { calls.push(`enumerate:${key}`); return Reflect.getOwnPropertyDescriptor(target, key); },
      get(target, key, receiver) { calls.push(`value:${key}`); return Reflect.get(target, key, receiver); }
    });
    const known = new Proxy({ clock: true }, {
      getOwnPropertyDescriptor(target, key) { calls.push(`known:${key}`); return Reflect.getOwnPropertyDescriptor(target, key); }
    });
    const state = { config: { widgets: known } };
    const patch = { get widgets() { calls.push('patch'); return values; } };
    const result = read(patch, state);
    assert.strictEqual(result.clock, false);
    assert.deepStrictEqual(calls, ['patch', 'patch', 'keys', 'enumerate:clock', 'enumerate:unknown', 'known:clock', 'known:unknown', 'value:clock']);
    let reads = 0;
    assert.strictEqual(read({ get widgets() { return ++reads === 1 ? {} : undefined; } }, state), sandbox.widgetSkipForTest);
    assert.strictEqual(reads, 2);
    assert.throws(() => read({ get widgets() { throw failure; } }, state), (error) => error === failure);
    assert.throws(() => read({ widgets: new Proxy({}, { ownKeys() { throw failure; } }) }, state), (error) => error === failure);
    assert.throws(() => read({ widgets: { get clock() { throw failure; } } }, state), (error) => error === failure);
  });

  assertTest('reducer normalizes raw widget values and ignores symbol and unknown keys', () => {
    const state = createState();
    const symbol = Symbol('widget');
    const widgets = { clock: 0, qrcode: 'false', extra: true, [symbol]: false };
    const result = reduceDomainCommand(state, { type: 'patch-state', payload: { widgets } });
    assert.deepStrictEqual(result.nextState.config.widgets, { clock: false, qrcode: true });
    assert.deepStrictEqual(state.config.widgets, { clock: true, qrcode: true });
    assert.deepStrictEqual(result.events.map((event) => event.type), ['state-sync']);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist']);
    assert.strictEqual(widgets[symbol], false);
    const unchanged = reduceDomainCommand(state, { type: 'patch-state', payload: { widgets: { extra: false, [symbol]: true } } });
    assert.strictEqual(unchanged.nextState, state);
    assert.deepStrictEqual(unchanged.effects, []);
  });

  assertTest('widget reader preserves absence and boolean own data properties for special keys', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.readWidgets = readWidgetPatch;`, sandbox);
    const known = Object.create({ inherited: true });
    Object.defineProperties(known, {
      hidden: { value: true, enumerable: false },
      absent: { value: true, enumerable: true }
    });
    // Object-literal __proto__ is special, so define it as an own data key.
    Object.defineProperty(known, '__proto__', { value: true, enumerable: true });
    const input = Object.fromEntries([['__proto__', 0], ['hidden', 'yes'], ['inherited', false]]);
    const output = sandbox.readWidgets({ widgets: input }, { config: { widgets: known } });
    assert.deepStrictEqual(Array.from(Object.entries(output), (entry) => Array.from(entry)), [
      ['__proto__', false], ['hidden', true]
    ]);
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(output, '__proto__'), {
      value: false, writable: true, enumerable: true, configurable: true
    });
    assert.strictEqual(Object.hasOwn(output, 'absent'), false);
    assert.strictEqual(Object.hasOwn(output, 'inherited'), false);
    assert.strictEqual(input.__proto__, 0);
  });

  assertTest('widget patch spec merges only normalized own entries and keeps no-op identity', () => {
    const sandbox = { module: { exports: {} }, require };
    const source = fs.readFileSync(require.resolve('./reducer.js'), 'utf8');
    runInNewContext(`${source}\nglobalThis.widgetSpec = PATCH_STATE_SPECS.find((spec) => spec.readValue === readWidgetPatch);\nglobalThis.applySpec = applyPatchSpec;`, sandbox);
    const state = createState();
    state.config.widgets = Object.fromEntries([['__proto__', true], ['clock', true], ['qrcode', false]]);
    const values = Object.fromEntries([['__proto__', 0], ['clock', 1], ['unknown', true]]);
    const context = { patch: { widgets: values }, nextState: state, changed: false, recomputePhotos: false, refreshWeather: false };
    const result = sandbox.applySpec(context, sandbox.widgetSpec);
    assert.notStrictEqual(result.nextState, state);
    assert.notStrictEqual(result.nextState.config.widgets, state.config.widgets);
    assert.deepStrictEqual(Object.entries(result.nextState.config.widgets), [['__proto__', false], ['clock', true], ['qrcode', false]]);
    assert.strictEqual(Object.hasOwn(result.nextState.config.widgets, '__proto__'), true);
    assert.strictEqual(Object.hasOwn(result.nextState.config.widgets, 'unknown'), false);
    assert.strictEqual(state.config.widgets.__proto__, true);
    const noChange = { ...context, nextState: result.nextState };
    assert.strictEqual(sandbox.applySpec(noChange, sandbox.widgetSpec), noChange);
  });

  assertTest('reducer patch-state specs ignore unknown widgets while composing recompute and weather-refresh flags', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'patch-state',
      payload: {
        widgets: {
          clock: false,
          qrcode: false,
          unknownWidget: true
        },
        excludedKeywords: ['hallway'],
        autoLocation: true
      }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.strictEqual(result.nextState.config.widgets.clock, false);
    assert.strictEqual(result.nextState.config.widgets.qrcode, false);
    assert.strictEqual(result.nextState.config.widgets.unknownWidget, undefined);
    assert.deepStrictEqual(result.nextState.config.excludedKeywords, ['hallway']);
    assert.strictEqual(result.nextState.config.autoLocation, true);
    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'port-2');
    assert.deepStrictEqual(result.events.map((event) => event.type), ['photo-update', 'state-sync']);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist', 'refresh-weather']);
  });

  assertTest('reducer excluded-keyword updates stay silent when the trimmed list is already active', () => {
    const state = createState({
      config: {
        ...createState().config,
        excludedKeywords: ['forest', 'mist']
      }
    });
    const result = reduceDomainCommand(state, {
      type: 'update-excluded-keywords',
      payload: { keywords: ['  forest  ', '', 'mist '] }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('reducer patch-state stays silent for already-normalized vision and manual location objects', () => {
    const state = createState({
      config: {
        ...createState().config,
        manualLocation: {
          city: 'Montreal',
          lat: 45.5,
          lon: -73.6,
          regionName: 'Quebec',
          country: 'Canada'
        },
        visionConfig: {
          apiUrl: 'https://vision.example/api',
          apiKey: '',
          model: 'gpt-4.1-mini',
          fallbackUrl: '',
          fallbackApiKey: '',
          fallbackModel: ''
        }
      }
    });
    const result = reduceDomainCommand(state, {
      type: 'patch-state',
      payload: {
        manualLocation: {
          city: 'Montreal',
          lat: 45.5,
          lon: -73.6,
          regionName: 'Quebec',
          country: 'Canada'
        },
        visionConfig: {
          apiUrl: 'https://vision.example/api',
          apiKey: '',
          model: 'gpt-4.1-mini',
          fallbackUrl: '',
          fallbackApiKey: '',
          fallbackModel: ''
        }
      }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('simple shared setter reducers keep config persistence and kiosk effects explicit', () => {
    const state = createState();
    const activeScreensaverState = createState({
      runtime: {
        ...createState().runtime,
        screensaverActive: true,
        manualOverride: true,
        browserRunning: true
      }
    });

    const splitPortraitResult = reduceDomainCommand(state, {
      type: 'set-split-portrait',
      payload: { enabled: false }
    });
    const splitCropResult = reduceDomainCommand(state, {
      type: 'set-split-crop',
      payload: { percent: 35 }
    });
    const scaleModeResult = reduceDomainCommand(state, {
      type: 'set-scale-mode',
      payload: { mode: 'contain' }
    });
    const themeResult = reduceDomainCommand(state, {
      type: 'change-theme',
      payload: { theme: 'Cosmic Night' }
    });
    const intervalResult = reduceDomainCommand(state, {
      type: 'change-interval',
      payload: { intervalMs: 45000 }
    });
    const screensaverResult = reduceDomainCommand(state, {
      type: 'set-screensaver-active',
      payload: { active: true }
    });
    const screensaverOffResult = reduceDomainCommand(activeScreensaverState, {
      type: 'set-screensaver-active',
      payload: { active: false }
    });

    assert.strictEqual(splitPortraitResult.nextState.config.splitPortrait, false);
    assert.deepStrictEqual(splitPortraitResult.effects.map((effect) => effect.type), ['persist']);
    assert.strictEqual(splitCropResult.nextState.config.splitCropPercent, 35);
    assert.deepStrictEqual(splitCropResult.effects.map((effect) => effect.type), ['persist']);
    assert.strictEqual(scaleModeResult.nextState.config.scaleMode, 'contain');
    assert.deepStrictEqual(scaleModeResult.effects.map((effect) => effect.type), ['persist']);
    assert.strictEqual(themeResult.nextState.config.theme, 'Cosmic Night');
    assert.deepStrictEqual(themeResult.effects, []);
    assert.strictEqual(intervalResult.nextState.config.slideshowInterval, 45000);
    assert.deepStrictEqual(intervalResult.effects, []);
    assert.strictEqual(screensaverResult.nextState.runtime.screensaverActive, true);
    assert.deepStrictEqual(screensaverResult.effects.map((effect) => effect.type), ['launch-kiosk']);
    assert.deepStrictEqual(screensaverOffResult.nextState.runtime, {
      ...activeScreensaverState.runtime,
      screensaverActive: false,
      manualOverride: false,
      browserRunning: false
    });
    assert.deepStrictEqual(screensaverOffResult.effects.map((effect) => effect.type), ['kill-kiosk']);
  });

  assertTest('simple config and runtime setter commands now no-op when the requested value is already active', () => {
    const state = createState();

    const sameSplitPortrait = reduceDomainCommand(state, {
      type: 'set-split-portrait',
      payload: { enabled: state.config.splitPortrait }
    });
    const sameSplitCrop = reduceDomainCommand(state, {
      type: 'set-split-crop',
      payload: { percent: state.config.splitCropPercent }
    });
    const sameScaleMode = reduceDomainCommand(state, {
      type: 'set-scale-mode',
      payload: { mode: state.config.scaleMode }
    });
    const sameTheme = reduceDomainCommand(state, {
      type: 'change-theme',
      payload: { theme: state.config.theme }
    });
    const sameInterval = reduceDomainCommand(state, {
      type: 'change-interval',
      payload: { intervalMs: state.config.slideshowInterval }
    });
    const sameScreensaverState = reduceDomainCommand(state, {
      type: 'set-screensaver-active',
      payload: { active: false }
    });

    [sameSplitPortrait, sameSplitCrop, sameScaleMode, sameTheme, sameInterval, sameScreensaverState].forEach((result) => {
      assert.strictEqual(result.nextState, state);
      assert.deepStrictEqual(result.events, []);
      assert.deepStrictEqual(result.effects, []);
    });
  });

  assertTest('shared photo mutation reducers stay silent when the requested metadata is already active', () => {
    const baseState = createState();
    const withKnownPhoto = (photo) => ({
      ...photo,
      ...(photo.url === 'port-1'
        ? {
            rating: 10,
            cropPercent: 37,
            cropPositionY: 22,
            preventPairing: false,
            width: 1080,
            height: 1920
          }
        : {})
    });
    const state = createState({
      library: {
        collections: Object.fromEntries(
          Object.entries(baseState.library.collections).map(([category, photos]) => [
            category,
            photos.map(withKnownPhoto)
          ])
        ),
        externalCollections: {},
        photosList: baseState.library.photosList.map(withKnownPhoto)
      }
    });

    const sameRating = reduceDomainCommand(state, {
      type: 'rate-photo',
      payload: { url: 'port-1', rating: 10 }
    });
    const sameCrop = reduceDomainCommand(state, {
      type: 'set-photo-crop',
      payload: { url: 'port-1', cropPercent: 37, cropPositionY: 22 }
    });
    const samePairing = reduceDomainCommand(state, {
      type: 'set-photo-prevent-pairing',
      payload: { url: 'port-1', preventPairing: false, preserveActive: false }
    });
    const sameMetadata = reduceDomainCommand(state, {
      type: 'report-photo-metadata',
      payload: { url: 'port-1', orientation: 'portrait', width: 1080, height: 1920 }
    });

    [sameRating, sameCrop, samePairing, sameMetadata].forEach((result) => {
      assert.strictEqual(result.nextState, state);
      assert.deepStrictEqual(result.events, []);
      assert.deepStrictEqual(result.effects, []);
    });
  });

  assertTest('reducer photo metadata commands stay silent when the target photo does not exist', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'set-photo-prevent-pairing',
      payload: { url: 'missing-photo', preventPairing: true }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('reducer pool add and delete transitions stay pure and explicit', () => {
    const added = reduceDomainCommand(createState(), {
      type: 'add-pool',
      payload: { name: 'Moody Rooms', keywords: ['moody', 'rooms'] }
    });
    assert.deepStrictEqual(added.effects.map((effect) => effect.type), ['persist', 'run-crawler']);
    assert.ok(added.nextState.library.collections['Moody Rooms']);

    const deleted = reduceDomainCommand(added.nextState, {
      type: 'delete-pool',
      payload: { name: 'Moody Rooms' }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });
    assert.strictEqual(deleted.nextState.library.collections['Moody Rooms'], undefined);
  });

  assertTest('pool names and creation retain truthy lookup, independent spreads and partial native failures', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.pools = { normalizePoolName, hasPool, normalizeFeedConfigKeywords, addPoolState };`, sandbox);
    const { normalizePoolName: name, hasPool: exists, normalizeFeedConfigKeywords: defaults, addPoolState: add } = sandbox.pools;
    const collections = Object.assign(Object.create({ inherited: [] }), { A: [] });
    const state = createState({ library: { collections, externalCollections: { external: [] } } });
    [0, false, NaN, null, undefined].forEach(value => assert.strictEqual(name(value), ''));
    assert.strictEqual(name({ toString: () => '  A  ' }), 'A');
    assert.strictEqual(exists(state, 'inherited'), true);
    assert.strictEqual(exists(state, 'external'), false);
    assert.strictEqual(exists(state, 0), false);
    const key = Symbol('pool'); collections[key] = [];
    assert.strictEqual(exists(state, key), true);
    let iterations = 0;
    const feeds = defaults({ *[Symbol.iterator]() { yield ++iterations; } });
    assert.deepStrictEqual(Object.keys(feeds), ['unsplash', 'wallhaven', 'metmuseum', 'artic']);
    assert.deepStrictEqual(Object.values(feeds).map(feed => feed.keywords[0]), [1, 2, 3, 4]);
    assert.strictEqual(feeds.artic.enabled, false);
    const keywords = Object.freeze([' raw ']);
    assert.strictEqual(add(state, 'New', keywords), true);
    const lists = [state.config.searchKeywords.New, ...Object.values(state.config.feedConfigs.New).map(feed => feed.keywords)];
    assert.strictEqual(new Set(lists).size, 5);
    lists.forEach(list => { assert.notStrictEqual(list, keywords); assert.strictEqual(list[0], ' raw '); });
    assert.strictEqual(add(state, 'A', undefined), false, 'guard precedes iteration');
    assert.throws(() => add(state, 'Partial', undefined), error => error.name === 'TypeError');
    assert.strictEqual(Object.hasOwn(collections, 'Partial'), true);
    assert.strictEqual(Object.hasOwn(state.config.searchKeywords, 'Partial'), false);
  });

  assertTest('pool keyword and source updates preserve raw no-ops, metadata aliases and native key defaults', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.pools = { assignPoolKeywords, mergePoolSourceConfig, mergePoolFeedConfig };`, sandbox);
    const { assignPoolKeywords: keywords, mergePoolSourceConfig: merge, mergePoolFeedConfig: project } = sandbox.pools;
    const raw = [' sun '], metadata = {}, symbol = Symbol('metadata');
    const original = { legacy: 17, sibling: metadata, unsplash: { enabled: false, keywords: raw, metadata }, [symbol]: metadata };
    const state = createState({ config: { searchKeywords: { A: raw }, feedConfigs: { A: original, Raw: 'xy' } } });
    assert.strictEqual(keywords(state, 'A', ['sun']), false);
    assert.strictEqual(state.config.searchKeywords.A, raw);
    const timed = { timeStart: '22:00', timeEnd: '06:00', keywords: [' moon '] };
    assert.strictEqual(keywords(state, 'missing', [timed]), true, 'no membership guard in assignment');
    assert.notStrictEqual(state.config.searchKeywords.missing[0], timed);
    assert.notStrictEqual(state.config.searchKeywords.missing[0].keywords, timed.keywords);
    assert.strictEqual(merge(state, 'A', 'unsplash', { keywords: [' sun '] }), false);
    assert.strictEqual(state.config.feedConfigs.A, original);
    assert.strictEqual(merge(state, 'A', 'unsplash', { enabled: true }), true);
    const updated = state.config.feedConfigs.A;
    assert.notStrictEqual(updated, original);
    assert.notStrictEqual(updated.unsplash, original.unsplash);
    assert.strictEqual(updated.unsplash.metadata, metadata);
    assert.strictEqual(updated.sibling, metadata);
    assert.strictEqual(updated[symbol], metadata);
    assert.strictEqual(updated.legacy, 17);
    assert.strictEqual(merge(state, 'Raw', undefined, { enabled: true }), true);
    assert.strictEqual(state.config.feedConfigs.Raw[0], 'x');
    assert.strictEqual(state.config.feedConfigs.Raw.undefined.enabled, true);
    assert.deepStrictEqual(Object.keys(project({}, undefined, undefined)), ['undefined']);
  });

  assertTest('pool policies remain prospective and removal touches only owned pool/config/selection state', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.pools = { assignPoolPolicy, removePoolState };`, sandbox);
    const { assignPoolPolicy: policy, removePoolState: remove } = sandbox.pools;
    const photos = Array.from({ length: 20 }, (_, index) => ({ url: String(index), addedAt: '2000-01-01' })), external = { A: photos };
    const state = createState({ config: { poolPolicies: undefined, searchKeywords: { A: [], B: [] }, feedConfigs: { A: {}, B: {} } },
      library: { collections: { A: photos, B: [] }, externalCollections: external, photosList: photos },
      playback: { selectedCategories: ['A', 'B'], poolSequenceCursors: { A: 2, B: 3 } } });
    const input = { maxPhotos: 1, retentionDays: '2' };
    assert.strictEqual(policy(state, 'A', input), true);
    assert.strictEqual(state.config.poolPolicies.A.maxPhotos, 12);
    assert.strictEqual(state.library.collections.A, photos);
    assert.strictEqual(photos.length, 20, 'assignment does not apply expiry or a cap');
    assert.strictEqual(policy(state, 'A', input), true, 'fresh normalized schedule is shallow-different');
    assert.strictEqual(remove(state, 'A'), true);
    [state.library.collections, state.config.searchKeywords, state.config.feedConfigs, state.config.poolPolicies, state.playback.poolSequenceCursors]
      .forEach(map => assert.strictEqual(Object.hasOwn(map, 'A'), false));
    assert.strictEqual(state.library.externalCollections, external);
    assert.strictEqual(state.library.photosList, photos);
    assert.strictEqual(state.playback.selectedCategories.join(','), 'B');
    const selected = state.playback.selectedCategories;
    assert.strictEqual(remove(state, 'missing'), false);
    assert.strictEqual(state.playback.selectedCategories, selected);
    assert.strictEqual(remove(state, 'B'), true);
    assert.strictEqual(state.playback.selectedCategories.join(','), 'Scenic Nature');
  });

  assertTest('pool mutations retain getter/delete order and earlier writes on native failure', () => {
    const sandbox = { module: { exports: {} }, require };
    runInNewContext(`${fs.readFileSync(require.resolve('./reducer.js'), 'utf8')}\nglobalThis.pools = { mergePoolFeedConfig, assignPoolPolicy, removePoolState };`, sandbox);
    const { mergePoolFeedConfig: merge, assignPoolPolicy: policy, removePoolState: remove } = sandbox.pools;
    const calls = [], failure = new Error('native failure');
    const config = { get source() { calls.push('source'); return { get original() { calls.push('nested'); return 1; } }; } };
    assert.throws(() => merge(config, 'source', { get value() { calls.push('patch'); throw failure; } }), error => error === failure);
    assert.deepStrictEqual(calls, ['source', 'source', 'nested', 'patch']);
    const state = createState({ config: { poolPolicies: undefined, searchKeywords: { A: ['sun'] },
      feedConfigs: new Proxy({ A: {} }, { deleteProperty: () => { throw failure; } }) }, library: { collections: { A: [] } } });
    assert.throws(() => policy(state, 'A', { get retentionDays() { throw failure; } }), error => error === failure);
    assert.strictEqual(Object.keys(state.config.poolPolicies).length, 0, 'nullish policy map initialized before normalization');
    const selected = state.playback.selectedCategories;
    assert.throws(() => remove(state, 'A'), error => error === failure);
    assert.strictEqual(Object.hasOwn(state.library.collections, 'A'), false);
    assert.strictEqual(Object.hasOwn(state.config.searchKeywords, 'A'), false);
    assert.strictEqual(Object.hasOwn(state.config.feedConfigs, 'A'), true);
    assert.strictEqual(state.playback.selectedCategories, selected);
  });

  assertTest('shared pool reducer specs preserve duplicate-add and invalid feed-config no-op semantics', () => {
    const initialState = createState();
    const added = reduceDomainCommand(initialState, {
      type: 'add-pool',
      payload: { name: 'Moody Rooms', keywords: ['moody', 'rooms'] }
    });
    const duplicateAdd = reduceDomainCommand(added.nextState, {
      type: 'add-pool',
      payload: { name: 'Moody Rooms', keywords: ['moody', 'rooms'] }
    });
    const invalidFeedConfig = reduceDomainCommand(initialState, {
      type: 'merge-pool-feed-config',
      payload: {
        name: 'Scenic Nature',
        source: '   ',
        config: ['not-an-object']
      }
    });

    [duplicateAdd, invalidFeedConfig].forEach((result, index) => {
      const expectedState = index === 0 ? added.nextState : initialState;
      assert.strictEqual(result.nextState, expectedState);
      assert.deepStrictEqual(result.events, []);
      assert.deepStrictEqual(result.effects, []);
    });
  });

  assertTest('reducer manual recrawl requests stay effect-only and keep state pure', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'trigger-recrawl',
      payload: { categories: ['Scenic Nature'] }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, [{
      type: 'start-recrawl-job',
      payload: { categories: ['Scenic Nature'] }
    }]);
  });

  assertTest('reducer manual vision-analysis requests stay effect-only and keep state pure', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'trigger-vision-analysis',
      payload: { categories: ['Scenic Nature'] }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, [{
      type: 'start-vision-analysis-job',
      payload: { categories: ['Scenic Nature'] }
    }]);
  });

  assertTest('reducer admin secret persistence stays effectful and updates runtime flags only through the shell', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'save-env-secret',
      payload: {
        envKey: 'USEAPI_TOKEN',
        runtimeFlag: 'hasUseApiToken',
        value: 'secret-123'
      }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, [{ type: 'state-sync' }]);
    assert.deepStrictEqual(result.effects, [{
      type: 'persist-env-vars',
      payload: {
        entries: { USEAPI_TOKEN: 'secret-123' },
        runtimeFlags: { hasUseApiToken: true }
      }
    }]);
  });

  assertTest('reducer admin secret persistence stays silent when the shared effect payload cannot be built', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'save-env-secret',
      payload: {
        envKey: '   ',
        runtimeFlag: 'hasUseApiToken',
        value: 'secret-123'
      }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('reducer pool keyword updates persist without mutating collections', () => {
    const result = reduceDomainCommand(createState(), {
      type: 'set-pool-keywords',
      payload: { name: 'Scenic Nature', keywords: ['forest', 'mist'] }
    });

    assert.deepStrictEqual(result.nextState.config.searchKeywords['Scenic Nature'], ['forest', 'mist']);
    assert.strictEqual(result.nextState.library.collections['Scenic Nature'].length, 2);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist']);
  });

  assertTest('reducer pool keyword updates preserve time-scoped keyword objects through the shared command path', () => {
    const result = reduceDomainCommand(createState(), {
      type: 'set-pool-keywords',
      payload: {
        name: 'Scenic Nature',
        keywords: [
          { timeStart: '18:00', timeEnd: '23:30', keywords: ['night sky', 'moon'] },
          'forest'
        ]
      }
    });

    assert.deepStrictEqual(result.nextState.config.searchKeywords['Scenic Nature'], [
      { timeStart: '18:00', timeEnd: '23:30', keywords: ['night sky', 'moon'] },
      'forest'
    ]);
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist']);
  });

  assertTest('reducer pool keyword updates stay silent when the normalized keyword list is unchanged', () => {
    const state = createState({
      config: {
        ...createState().config,
        searchKeywords: {
          ...createState().config.searchKeywords,
          'Scenic Nature': ['forest', 'mist']
        }
      }
    });
    const result = reduceDomainCommand(state, {
      type: 'set-pool-keywords',
      payload: { name: 'Scenic Nature', keywords: ['forest', 'mist'] }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('reducer pool keyword updates treat normalized time-scoped keyword specs as equality-aware no-ops', () => {
    const state = createState({
      config: {
        ...createState().config,
        searchKeywords: {
          ...createState().config.searchKeywords,
          'Scenic Nature': [
            { timeStart: '18:00', timeEnd: '23:30', keywords: ['night sky', 'moon'] }
          ]
        }
      }
    });
    const result = reduceDomainCommand(state, {
      type: 'set-pool-keywords',
      payload: {
        name: 'Scenic Nature',
        keywords: [
          { timeStart: ' 18:00 ', timeEnd: '23:30', keywords: [' night sky ', ' moon '] }
        ]
      }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('reducer pool feed config updates merge a source patch instead of replacing sibling fields', () => {
    const result = reduceDomainCommand(createState({
      config: {
        ...createState().config,
        feedConfigs: {
          'Scenic Nature': {
            reddit: { enabled: true, subreddits: ['EarthPorn'] }
          }
        }
      }
    }), {
      type: 'merge-pool-feed-config',
      payload: {
        name: 'Scenic Nature',
        source: 'reddit',
        config: { subreddits: ['CityPorn', 'WeatherPorn'] }
      }
    });

    assert.deepStrictEqual(result.nextState.config.feedConfigs['Scenic Nature'].reddit, {
      enabled: true,
      subreddits: ['CityPorn', 'WeatherPorn']
    });
    assert.deepStrictEqual(result.effects.map((effect) => effect.type), ['persist']);
  });

  assertTest('reducer pool feed config updates stay silent when a source patch does not change the effective config', () => {
    const state = createState({
      config: {
        ...createState().config,
        feedConfigs: {
          'Scenic Nature': {
            reddit: { enabled: true, subreddits: ['EarthPorn'] }
          }
        }
      }
    });
    const result = reduceDomainCommand(state, {
      type: 'merge-pool-feed-config',
      payload: {
        name: 'Scenic Nature',
        source: 'reddit',
        config: { enabled: true, subreddits: ['EarthPorn'] }
      }
    });

    assert.strictEqual(result.nextState, state);
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.effects, []);
  });

  assertTest('REST and socket adapters decode the same category command', () => {
    const httpCommand = decodeCategorySelectionFromHttp({ category: 'Liminal Space,AI Creation' });
    const socketCommand = decodeCategorySelectionFromSocket('Liminal Space,AI Creation');
    assert.deepStrictEqual(httpCommand, socketCommand);

    const httpResult = reduceDomainCommand(createState(), httpCommand, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });
    const socketResult = reduceDomainCommand(createState(), socketCommand, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });
    assert.deepStrictEqual(httpResult.nextState.playback, socketResult.nextState.playback);
  });

  assertTest('REST and socket adapters decode the same pool lifecycle commands', () => {
    assert.deepStrictEqual(
      decodeAddPoolCommand({ name: 'Moody Rooms', keywords: 'moody, rooms' }),
      {
        type: 'add-pool',
        payload: { name: 'Moody Rooms', keywords: ['moody', 'rooms'] }
      }
    );

    assert.deepStrictEqual(
      decodeDeletePoolCommand({ category: 'Moody Rooms' }),
      {
        type: 'delete-pool',
        payload: { name: 'Moody Rooms' }
      }
    );

    assert.deepStrictEqual(
      decodePoolKeywordsCommand({ category: 'Scenic Nature', keywords: ['forest', 'mist'] }),
      {
        type: 'set-pool-keywords',
        payload: { name: 'Scenic Nature', keywords: ['forest', 'mist'] }
      }
    );

    assert.deepStrictEqual(
      decodePoolKeywordsCommand({
        category: 'Scenic Nature',
        keywords: [
          { timeStart: ' 18:00 ', timeEnd: '23:30', keywords: [' night sky ', ' moon '] }
        ]
      }),
      {
        type: 'set-pool-keywords',
        payload: {
          name: 'Scenic Nature',
          keywords: [
            { timeStart: '18:00', timeEnd: '23:30', keywords: ['night sky', 'moon'] }
          ]
        }
      }
    );

    assert.deepStrictEqual(
      decodePoolFeedConfigCommand({
        category: 'Scenic Nature',
        source: 'reddit',
        config: { enabled: true, subreddits: ['EarthPorn'] }
      }),
      {
        type: 'merge-pool-feed-config',
        payload: {
          name: 'Scenic Nature',
          source: 'reddit',
          config: { enabled: true, subreddits: ['EarthPorn'] }
        }
      }
    );
  });

  assertTest('recrawl command decoding accepts empty global requests and scoped category arrays', () => {
    assert.deepStrictEqual(decodeRecrawlCommand(undefined), {
      type: 'trigger-recrawl',
      payload: {}
    });
    assert.deepStrictEqual(decodeRecrawlCommand({ categories: ['Scenic Nature', ' Liminal Spaces '] }), {
      type: 'trigger-recrawl',
      payload: {
        categories: ['Scenic Nature', 'Liminal Spaces']
      }
    });
    assert.strictEqual(decodeRecrawlCommand({ categories: ['   '] }), null);
  });

  assertTest('vision-analysis command decoding accepts empty global requests and scoped category arrays', () => {
    assert.deepStrictEqual(decodeVisionAnalysisCommand(undefined), {
      type: 'trigger-vision-analysis',
      payload: {}
    });
    assert.deepStrictEqual(decodeVisionAnalysisCommand({ categories: ['Scenic Nature', ' Liminal Spaces '] }), {
      type: 'trigger-vision-analysis',
      payload: {
        categories: ['Scenic Nature', 'Liminal Spaces']
      }
    });
    assert.strictEqual(decodeVisionAnalysisCommand({ categories: ['   '] }), null);
  });

  assertTest('admin secret decoders normalize REST and socket payloads into shared command shapes', () => {
    assert.deepStrictEqual(decodeUseApiTokenCommand({ token: '  useapi-secret  ' }), {
      type: 'save-env-secret',
      payload: {
        envKey: 'USEAPI_TOKEN',
        runtimeFlag: 'hasUseApiToken',
        value: 'useapi-secret'
      }
    });

    assert.deepStrictEqual(decodeTumblrApiKeyCommand({ value: 'tumblr-secret' }), {
      type: 'save-env-secret',
      payload: {
        envKey: 'TUMBLR_API_KEY',
        runtimeFlag: 'hasTumblrApiKey',
        value: 'tumblr-secret'
      }
    });

    assert.strictEqual(decodeUseApiTokenCommand({}), null);
  });

  assertTest('shared REST admin-secret route specs cover both secret endpoints through the same command shape', () => {
    const useApiSpec = findRestAdminSecretRouteSpec('/api/admin/secrets/useapi-token');
    const tumblrSpec = findRestAdminSecretRouteSpec('/api/admin/secrets/tumblr-api-key');

    assert.strictEqual(useApiSpec?.secretName, 'useapi-token');
    assert.deepStrictEqual(useApiSpec?.decode({ token: ' api-secret ' }), {
      type: 'save-env-secret',
      payload: {
        envKey: 'USEAPI_TOKEN',
        runtimeFlag: 'hasUseApiToken',
        value: 'api-secret'
      }
    });
    assert.strictEqual(tumblrSpec?.secretName, 'tumblr-api-key');
    assert.deepStrictEqual(tumblrSpec?.decode({ value: 'tumblr-secret' }), {
      type: 'save-env-secret',
      payload: {
        envKey: 'TUMBLR_API_KEY',
        runtimeFlag: 'hasTumblrApiKey',
        value: 'tumblr-secret'
      }
    });
  });

  assertTest('shared REST async-job route specs preserve effect types and accepted-job presenters', () => {
    const recrawlSpec = findRestAsyncJobRouteSpec('/api/jobs/recrawl');
    const visionSpec = findRestAsyncJobRouteSpec('/api/jobs/vision-analysis');
    const recrawlSocketSpec = findSocketAsyncJobSpec('trigger-recrawl');
    const submission = {
      job: {
        id: 'job-1',
        status: 'queued'
      },
      reused: 1
    };

    assert.strictEqual(recrawlSpec?.effectType, 'start-recrawl-job');
    assert.deepStrictEqual(recrawlSpec?.decode({ categories: [' Scenic Nature '] }), {
      type: 'trigger-recrawl',
      payload: {
        categories: ['Scenic Nature']
      }
    });
    assert.deepStrictEqual(recrawlSpec?.decode({ categories: [' Scenic Nature '] }), recrawlSocketSpec?.decode({ categories: [' Scenic Nature '] }));
    assert.deepStrictEqual(recrawlSpec?.present({ submission }), {
      job: { id: 'job-1', status: 'queued' },
      reused: true
    });
    assert.strictEqual(visionSpec?.effectType, 'start-vision-analysis-job');
    assert.deepStrictEqual(visionSpec?.decode(undefined), {
      type: 'trigger-vision-analysis',
      payload: {}
    });
  });

  assertTest('shared REST advance-photo route specs keep both directions on the sequence command path', () => {
    const nextSpec = findRestAdvanceRouteSpec('/api/photos/next');
    const prevSpec = findRestAdvanceRouteSpec('/api/photos/prev');
    const nextSocketSpec = findSocketCommandSpec('next-photo');
    const prevSocketSpec = findSocketCommandSpec('prev-photo');

    assert.deepStrictEqual(nextSpec?.decode(), {
      type: 'advance-photo',
      payload: {
        direction: 'next',
        strategy: 'sequence'
      }
    });
    assert.strictEqual(nextSocketSpec?.decode()?.payload.direction, nextSpec?.decode()?.payload.direction);
    assert.strictEqual(nextSocketSpec?.decode()?.payload.strategy, 'smart');
    assert.deepStrictEqual(prevSpec?.decode(), {
      type: 'advance-photo',
      payload: {
        direction: 'prev',
        strategy: 'sequence'
      }
    });
    assert.strictEqual(prevSocketSpec?.decode()?.payload.direction, prevSpec?.decode()?.payload.direction);
    assert.strictEqual(prevSocketSpec?.decode()?.payload.strategy, 'smart');
    assert.strictEqual(prevSpec?.notFoundMessage, 'Could not transition to previous photo.');
  });

  assertTest('shared photo patch route specs keep photo mutation command facts declarative', () => {
    const ratingSpec = findPhotoPatchRouteSpec('rating');
    const brokenSpec = findPhotoPatchRouteSpec('broken');
    const cropSpec = findPhotoPatchRouteSpec('crop');
    const pairingSpec = findPhotoPatchRouteSpec('prevent-pairing');
    const lovedSpec = findPhotoPatchRouteSpec('loved');

    assert.strictEqual(ratingSpec?.active({ body: { rating: 9 } }), true);
    assert.deepStrictEqual(ratingSpec?.decode({
      url: 'photo-1',
      body: { rating: 9 }
    }), {
      type: 'rate-photo',
      payload: {
        url: 'photo-1',
        rating: 9
      }
    });
    assert.deepStrictEqual(ratingSpec?.responsePatch({
      command: ratingSpec.decode({
        url: 'photo-1',
        body: { rating: 9 }
      })
    }), {
      rating: 9
    });

    assert.deepStrictEqual(cropSpec?.decode({
      url: 'photo-2',
      body: { cropPercent: 135 }
    }), {
      type: 'set-photo-crop',
      payload: {
        url: 'photo-2',
        cropPercent: 135
      }
    });
    assert.deepStrictEqual(brokenSpec?.responsePatch({
      command: brokenSpec.decode({
        url: 'photo-2b',
        body: { isBroken: true }
      })
    }), {
      isBroken: true,
      rating: 1
    });
    assert.deepStrictEqual(pairingSpec?.responsePatch({
      command: pairingSpec.decode({
        url: 'photo-3',
        body: { preventPairing: 1, preserveActive: true }
      })
    }), {
      preventPairing: true
    });
    assert.deepStrictEqual(lovedSpec?.decode({
      url: 'photo-4',
      body: { loved: 1 }
    }), {
      type: 'set-photo-loved',
      payload: {
        url: 'photo-4',
        loved: true
      }
    });
    assert.deepStrictEqual(lovedSpec?.responsePatch({
      command: lovedSpec.decode({
        url: 'photo-4',
        body: { loved: false }
      })
    }), {
      loved: false
    });
  });

  assertTest('shared photo transport specs keep overlapping REST patch and socket photo commands in one declarative family', () => {
    const ratingRouteSpec = findPhotoPatchRouteSpec('rating');
    const cropRouteSpec = findPhotoPatchRouteSpec('crop');
    const pairingRouteSpec = findPhotoPatchRouteSpec('prevent-pairing');
    const brokenRouteSpec = findPhotoPatchRouteSpec('broken');
    const ratingSocketSpec = findSocketCommandSpec('rate-photo');
    const cropSocketSpec = findSocketCommandSpec('set-photo-crop');
    const pairingSocketSpec = findSocketCommandSpec('set-photo-prevent-pairing');
    const brokenSocketSpec = findSocketCommandSpec('mark-photo-broken');
    const metadataSocketSpec = findSocketCommandSpec('report-photo-metadata');
    const lovedSocketSpec = findSocketCommandSpec('set-photo-loved');

    assert.deepStrictEqual(
      ratingRouteSpec?.decode({ url: 'photo-1', body: { rating: 6 } }),
      ratingSocketSpec?.decode({ url: 'photo-1', rating: 6 })
    );
    assert.deepStrictEqual(
      cropRouteSpec?.decode({ url: 'photo-2', body: { cropPercent: 144, cropPositionY: 28 } }),
      cropSocketSpec?.decode({ url: 'photo-2', cropPercent: 144, cropPositionY: 28 })
    );
    assert.deepStrictEqual(
      pairingRouteSpec?.decode({ url: 'photo-3', body: { preventPairing: true, preserveActive: true } }),
      pairingSocketSpec?.decode({ url: 'photo-3', preventPairing: true, preserveActive: true })
    );
    assert.deepStrictEqual(
      brokenRouteSpec?.decode({ url: 'photo-4' }),
      brokenSocketSpec?.decode({ url: 'photo-4' })
    );
    assert.deepStrictEqual(metadataSocketSpec?.decode({
      url: 'photo-5',
      orientation: 'portrait',
      width: 1080
    }), {
      type: 'report-photo-metadata',
      payload: {
        url: 'photo-5',
        orientation: 'portrait',
        width: 1080
      }
    });
    assert.strictEqual(lovedSocketSpec, null);
  });

  assertTest('shared patch transport builder keeps route-only, socket-only, and dynamic route expansions explicit', () => {
    const photoRouteKeys = PHOTO_PATCH_COMMAND_ROUTE_SPECS.map(({ key }) => key);
    const poolRouteKeys = createPoolPatchCommandRouteSpecs({
      feedConfigs: {
        reddit: { enabled: false },
        unsplash: { enabled: true }
      }
    }).map(({ key }) => key);

    assert.deepStrictEqual(photoRouteKeys, [
      'rating',
      'broken',
      'crop',
      'prevent-pairing',
      'loved'
    ]);
    assert.deepStrictEqual(poolRouteKeys, [
      'keywords',
      'policy',
      'feed-config:reddit',
      'feed-config:unsplash'
    ]);
    assert.strictEqual(findSocketCommandSpec('set-photo-loved'), null);
    assert.ok(findSocketCommandSpec('report-photo-metadata'));
    assert.ok(findSocketCommandSpec('update-feed-config'));
  });

  assertTest('pool retention policies normalize and prune only eligible aged photos', () => {
    assert.deepStrictEqual(normalizePoolPolicy({ retentionDays: 7, maxPhotos: 80 }), {
      retentionDays: 7,
      maxPhotos: 80,
      schedule: { enabled: false, start: '22:00', end: '06:00', priority: 0 }
    });
    const retained = pruneExpiredPhotos('2026-07-31T00:00:00Z', { retentionDays: 30 })([
      { url: 'fresh', addedAt: '2026-07-15T00:00:00Z' },
      { url: 'old', addedAt: '2026-06-01T00:00:00Z' },
      { url: 'loved', addedAt: '2026-01-01T00:00:00Z', loved: true },
      { url: 'legacy' }
    ]);
    assert.deepStrictEqual(retained.map(({ url }) => url), ['fresh', 'loved', 'legacy']);
  });

  assertTest('pool retention composes curried pruning and capping without mutating photos', () => {
    const photos = [
      { url: 'expired', addedAt: '2026-06-01T00:00:00Z' },
      { url: 'fresh-1', addedAt: '2026-07-20T00:00:00Z' },
      { url: 'fresh-2', addedAt: '2026-07-21T00:00:00Z' },
      { url: 'fresh-3', addedAt: '2026-07-22T00:00:00Z' },
      { url: 'loved', addedAt: '2026-01-01T00:00:00Z', loved: true }
    ];
    const before = photos.map((photo) => ({ ...photo }));
    const applyPolicy = applyPoolPolicy(
      '2026-07-31T00:00:00Z',
      { retentionDays: 30, maxPhotos: 12 }
    );

    const retained = applyPolicy(photos);

    assert.deepStrictEqual(retained.map(({ url }) => url), [
      'loved', 'fresh-1', 'fresh-2', 'fresh-3'
    ]);
    assert.deepStrictEqual(photos, before);
    assert.notStrictEqual(retained, photos);
  });

  assertTest('pool policy command shares normalized REST decoding and reducer persistence', () => {
    assert.deepStrictEqual(decodePoolPolicyCommand({ name: ' Scenic Nature ', policy: { retentionDays: 0, maxPhotos: 2 } }), {
      type: 'set-pool-policy',
      payload: {
        name: 'Scenic Nature',
        policy: {
          retentionDays: 1,
          maxPhotos: 12,
          schedule: { enabled: false, start: '22:00', end: '06:00', priority: 0 }
        }
      }
    });
    const result = reduceDomainCommand(createState(), {
      type: 'set-pool-policy',
      payload: { name: 'Scenic Nature', policy: { retentionDays: 14, maxPhotos: 500 } }
    });
    assert.deepStrictEqual(result.nextState.config.poolPolicies['Scenic Nature'], {
      retentionDays: 14,
      maxPhotos: 500,
      schedule: { enabled: false, start: '22:00', end: '06:00', priority: 0 }
    });
    assert.deepStrictEqual(result.effects.map(({ type }) => type), ['persist', 'refresh-active-feed']);
  });

  assertTest('shared pool transport specs keep overlapping REST patch and socket pool commands in one declarative family', () => {
    const specs = createPoolPatchCommandRouteSpecs({
      feedConfigs: {
        reddit: { enabled: false },
        unsplash: { enabled: true, keywords: ['forest'] }
      }
    });
    const keywordsSpec = findPoolPatchRouteSpec(specs, 'keywords');
    const redditSpec = findPoolPatchRouteSpec(specs, 'feed-config:reddit');
    const keywordsSocketSpec = findSocketCommandSpec('update-keywords');
    const feedConfigSocketSpec = findSocketCommandSpec('update-feed-config');

    assert.strictEqual(keywordsSpec?.active({
      body: { keywords: ['forest'] }
    }), true);
    assert.deepStrictEqual(
      keywordsSpec?.decode({
        name: 'Scenic Nature',
        body: { keywords: ['forest'] }
      }),
      keywordsSocketSpec?.decode({
        category: 'Scenic Nature',
        keywords: ['forest']
      })
    );
    assert.deepStrictEqual(redditSpec?.decode({
      name: 'Scenic Nature',
    }), {
      type: 'merge-pool-feed-config',
      payload: {
        name: 'Scenic Nature',
        source: 'reddit',
        config: { enabled: false }
      }
    });
    assert.deepStrictEqual(
      redditSpec?.decode({
        name: 'Scenic Nature'
      }),
      feedConfigSocketSpec?.decode({
        category: 'Scenic Nature',
        source: 'reddit',
        config: { enabled: false }
      })
    );
    assert.deepStrictEqual(decodePoolScopedRecrawlCommand(' Scenic Nature '), {
      type: 'trigger-recrawl',
      payload: {
        categories: ['Scenic Nature']
      }
    });
  });

  assertTest('category selection keeps Google Photos active pools populated from external cache state', () => {
    const baseState = createState();
    const result = reduceDomainCommand(createState({
      library: {
        ...baseState.library,
        externalCollections: {
          'Google Photos': [
            {
              url: '/api/google-photos/media/picker-456?w=2560&h=1440',
              title: 'Cached Google Photo',
              rating: 10,
              category: 'Google Photos'
            }
          ]
        },
        photosList: []
      },
      playback: {
        selectedCategories: ['Scenic Nature'],
        activePhotoUrl: 'land-1',
        splitSeed: 0,
        lastDirection: 'next'
      }
    }), {
      type: 'select-categories',
      payload: { categories: 'Google Photos' }
    }, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });

    assert.deepStrictEqual(result.nextState.playback.selectedCategories, ['Google Photos']);
    assert.strictEqual(result.nextState.library.photosList.length, 1);
    assert.strictEqual(result.nextState.library.photosList[0].title, 'Cached Google Photo');
    assert.strictEqual(result.nextState.playback.activePhotoUrl, result.nextState.library.photosList[0].url);
  });

  assertTest('REST and socket adapters decode the same rating command', () => {
    const command = decodePhotoRatingCommand({ url: 'port-1', rating: 7 });
    assert.deepStrictEqual(command, {
      type: 'rate-photo',
      payload: { url: 'port-1', rating: 7 }
    });
  });

  assertTest('deterministic smart-photo selection honors injected time and rng', () => {
    const state = createState({
      config: {
        ...createState().config,
        alignTimeOfDay: true,
        nightPercentage: 100
      },
      runtime: {
        ...createState().runtime,
        weather: { current: { is_day: 0 } }
      }
    });
    const photo = selectSmartPhoto({
      state,
      now: new Date('2026-06-27T23:00:00'),
      rng: () => 0.1
    });
    assert.strictEqual(photo?.url, 'port-1');
  });

  assertTest('smart photo selection keeps pool shares equal when weather matches only one pool', () => {
    const baseState = createState();
    const state = createState({
      config: { ...baseState.config, alignWeather: true },
      runtime: {
        ...baseState.runtime,
        physicalWeather: { weatherMatch: 'Snowy' }
      },
      library: {
        ...baseState.library,
        photosList: [
          { url: 'google-cloudy', category: 'Google Photos', rating: 10, isCloudy: true },
          { url: 'nature-snow-1', category: 'Scenic Nature', rating: 10, isSnowy: true },
          { url: 'nature-snow-2', category: 'Scenic Nature', rating: 10, isSnowy: true },
          { url: 'nature-snow-3', category: 'Scenic Nature', rating: 10, isSnowy: true }
        ]
      },
      playback: {
        ...baseState.playback,
        activePhotoUrl: null,
        selectedCategories: ['Google Photos', 'Scenic Nature']
      }
    });

    const photo = selectSmartPhoto({
      state,
      now: new Date('2026-06-27T12:00:00'),
      rng: () => 0
    });

    assert.strictEqual(photo?.category, 'Google Photos');
  });

  assertTest('automatic smart playback rotates unequal pools instead of weighting their photo counts', () => {
    const baseState = createState();
    let state = createState({
      library: {
        ...baseState.library,
        photosList: [
          { url: 'nature-1', category: 'Scenic Nature', rating: 10 },
          { url: 'google-1', category: 'Google Photos', rating: 2 },
          { url: 'nature-2', category: 'Scenic Nature', rating: 10 },
          { url: 'nature-3', category: 'Scenic Nature', rating: 10 }
        ]
      },
      playback: {
        ...baseState.playback,
        selectedCategories: ['Scenic Nature', 'Google Photos'],
        activePhotoUrl: 'nature-1'
      }
    });
    const categories = [];

    for (let index = 0; index < 8; index += 1) {
      const photo = selectSmartPhoto({ state, rng: () => 0.1 });
      categories.push(photo.category);
      state = {
        ...state,
        playback: { ...state.playback, activePhotoUrl: photo.url }
      };
    }

    assert.deepStrictEqual(categories, [
      'Google Photos', 'Scenic Nature', 'Google Photos', 'Scenic Nature',
      'Google Photos', 'Scenic Nature', 'Google Photos', 'Scenic Nature'
    ]);
  });

  assertTest('sequence advance rotates pools equally and cycles each pool independently', () => {
    const baseState = createState();
    const state = createState({
      library: {
        ...baseState.library,
        photosList: [
          { url: 'nature-1', category: 'Scenic Nature', rating: 10 },
          { url: 'google-1', category: 'Google Photos', rating: 10 },
          { url: 'nature-2', category: 'Scenic Nature', rating: 10 },
          { url: 'nature-3', category: 'Scenic Nature', rating: 10 }
        ]
      },
      playback: {
        ...baseState.playback,
        selectedCategories: ['Scenic Nature', 'Google Photos'],
        activePhotoUrl: 'nature-1',
        poolSequenceCursors: {}
      }
    });
    const urls = [];
    let current = state;

    for (let index = 0; index < 6; index += 1) {
      current = reduceDomainCommand(current, {
        type: 'advance-photo',
        payload: { direction: 'next', strategy: 'sequence' }
      }).nextState;
      urls.push(current.playback.activePhotoUrl);
    }

    assert.deepStrictEqual(urls, [
      'google-1', 'nature-2', 'google-1', 'nature-3', 'google-1', 'nature-1'
    ]);
  });

  assertTest('curried photo projections preserve unmatched identity and map immutably', () => {
    const photo = { url: 'target', title: 'Original' };
    const other = { url: 'other', title: 'Unchanged' };
    const updateTitle = (record) => ({ ...record, title: `${record.title} updated` });
    const updateTarget = updatePhotoByUrl('target', updateTitle);
    const source = [photo, other, null, undefined];
    const projected = updatePhotosList('target', updateTitle)(source);

    assert.deepStrictEqual(updateTarget(photo), {
      url: 'target',
      title: 'Original updated'
    });
    assert.strictEqual(
      updatePhotoByUrl('target', updateTitle, photo).title,
      'Original updated'
    );
    assert.strictEqual(updatePhotoByUrl('target')(updateTitle)(null), null);
    assert.strictEqual(updateTarget(other), other);
    assert.notStrictEqual(projected, source);
    assert.deepStrictEqual(projected, [
      { url: 'target', title: 'Original updated' },
      other,
      null,
      undefined
    ]);
    assert.strictEqual(projected[1], other);
    assert.strictEqual(photo.title, 'Original');
    assert.deepStrictEqual(updatePhotosList('target', updateTitle, null), []);
  });


  assertTest('weather location preference round-trips without changing other widget defaults or location data', () => {
    const defaults = { ...createState().config, widgets: { clock: true, weather: true, weatherLocation: true } };
    const dependencies = {
      defaultCollections: createState().library.collections,
      defaultState: defaults,
      buildFeedConfigsFromKeywords: () => ({})
    };
    [true, false].forEach((visible) => {
      const state = { ...defaults, widgets: { ...defaults.widgets, weatherLocation: visible } };
      const saved = buildPersistedSnapshot(dependencies.defaultCollections, state, 123);
      assert.deepStrictEqual(saved.widgets, { weatherLocation: visible });
      const restored = normalizePersistedSnapshot(saved, dependencies);
      assert.deepStrictEqual(restored.persistedState.widgets, state.widgets);
      assert.deepStrictEqual(restored.persistedState.manualLocation, state.manualLocation);
      assert.strictEqual(restored.persistedState.autoLocation, state.autoLocation);
      assert.deepStrictEqual(restored.collections, dependencies.defaultCollections);
      assert.strictEqual(defaults.widgets.weatherLocation, true);
    });
    [undefined, null, 'false', 0, {}].forEach((value) => {
      const restored = normalizePersistedSnapshot({ widgets: { weatherLocation: value, clock: false } }, dependencies);
      assert.deepStrictEqual(restored.persistedState.widgets, defaults.widgets);
    });
    assert.strictEqual(normalizePersistedSnapshot({}, dependencies).persistedState.widgets.weatherLocation, true);
    assert.strictEqual(normalizePersistedSnapshot({}, { ...dependencies, defaultState: {} }).persistedState.widgets.weatherLocation, true);
  });

  assertTest('weather label patch stays presentational with persistence and a sync event', () => {
    const state = createState();
    state.config.widgets = { ...state.config.widgets, weather: true, weatherLocation: true };
    const before = structuredClone(state);
    const result = reduceDomainCommand(state, { type: 'patch-state', payload: { widgets: { weatherLocation: false } } });
    assert.strictEqual(result.nextState.config.widgets.weatherLocation, false);
    assert.strictEqual(result.nextState.config.widgets.weather, true);
    assert.deepStrictEqual(result.nextState.runtime, state.runtime);
    assert.deepStrictEqual(result.nextState.library, state.library);
    assert.deepStrictEqual(result.nextState.playback, state.playback);
    assert.deepStrictEqual(result.nextState.config.manualLocation, state.config.manualLocation);
    assert.deepStrictEqual(result.effects.map(({ type }) => type), ['persist']);
    assert.deepStrictEqual(result.events.map(({ type }) => type), ['state-sync']);
    assert.deepStrictEqual(state, before);
    const snapshot = buildSnapshot(result.nextState);
    assert.strictEqual(snapshot.widgets.weatherLocation, false);
    assert.strictEqual(buildDomainState(snapshot, state.library.collections).config.widgets.weatherLocation, false);
  });

  assertTest('persistence codec normalizes legacy shapes and restores feed configs', () => {
    const normalized = normalizePersistedSnapshot({
      feeds: {
        'Scenic Nature': [{ url: 'dup', title: 'One' }],
        'Liminal Spaces': [{ url: 'dup', title: 'Duplicate' }]
      },
      searchKeywords: {
        'Scenic Nature': ['forest']
      }
    }, {
      defaultCollections: createState().library.collections,
      defaultState: {
        ...createState().config,
        searchKeywords: createState().config.searchKeywords,
        autoLocation: false,
        manualLocation: {},
        excludedKeywords: []
      },
      buildFeedConfigsFromKeywords: (searchKeywords) => ({
        'Scenic Nature': {
          unsplash: { enabled: true, keywords: searchKeywords['Scenic Nature'] }
        }
      })
    });

    assert.strictEqual(normalized.duplicatesRemoved, true);
    assert.ok(normalized.collections['Liminal Spaces'].length > 0);
    assert.deepStrictEqual(normalized.persistedState.feedConfigs['Scenic Nature'], {
      unsplash: { enabled: true, keywords: ['forest'] }
    });
  });

  assertTest('persistence fallback restoration cannot reintroduce a shared image URL', () => {
    const normalized = normalizePersistedSnapshot({}, {
      defaultCollections: {
        'Scenic Nature': [{ url: 'shared-default', title: 'First pool default' }],
        'Liminal Spaces': [{ url: 'shared-default', title: 'Duplicate pool default' }]
      },
      defaultState: { searchKeywords: {}, autoLocation: false, manualLocation: {}, excludedKeywords: [] },
      buildFeedConfigsFromKeywords: () => ({})
    });

    assert.deepStrictEqual(normalized.collections['Scenic Nature'].map((photo) => photo.url), ['shared-default']);
    assert.deepStrictEqual(normalized.collections['Liminal Spaces'], []);
    assert.strictEqual(normalized.duplicatesRemoved, true);
  });

  assertTest('persistence codec round-trips canonical snapshot fields', () => {
    const persisted = buildPersistedSnapshot(createState().library.collections, {
      searchKeywords: createState().config.searchKeywords,
      feedConfigs: { foo: { enabled: true } },
      poolPolicies: { 'Scenic Nature': { retentionDays: 14, maxPhotos: 500 } },
      autoLocation: true,
      manualLocation: { city: 'Montreal' },
      visionConfig: { model: 'gpt-4.1-mini' },
      scaleMode: 'contain',
      splitPortrait: true,
      splitCropPercent: 42,
      excludedKeywords: ['anime']
    }, 123);

    assert.strictEqual(persisted.lastUpdated, 123);
    assert.strictEqual(persisted.scaleMode, 'contain');
    assert.strictEqual(persisted.splitCropPercent, 42);
    assert.deepStrictEqual(persisted.locationSettings.manualLocation, { city: 'Montreal' });
    assert.deepStrictEqual(persisted.excludedKeywords, ['anime']);
    assert.deepStrictEqual(persisted.poolPolicies['Scenic Nature'], {
      retentionDays: 14,
      maxPhotos: 500,
      schedule: { enabled: false, start: '22:00', end: '06:00', priority: 0 }
    });
  });

  assertTest('persisted collection snapshots keep each image URL in its first pool only', () => {
    const collections = {
      'Scenic Nature': [
        { url: 'shared-image', title: 'First pool representation' },
        { url: 'nature-only', title: 'Nature image' }
      ],
      'Liminal Spaces': [
        { url: 'shared-image', title: 'Duplicate pool representation' },
        { url: 'liminal-only', title: 'Liminal image' }
      ]
    };

    const persisted = buildPersistedSnapshot(collections, {}, 456);

    assert.deepStrictEqual(persisted.feeds, {
      'Scenic Nature': [
        { url: 'shared-image', title: 'First pool representation', category: 'Scenic Nature' },
        { url: 'nature-only', title: 'Nature image', category: 'Scenic Nature' }
      ],
      'Liminal Spaces': [
        { url: 'liminal-only', title: 'Liminal image', category: 'Liminal Spaces' }
      ]
    });
    assert.strictEqual(collections['Liminal Spaces'][0].url, 'shared-image');
  });

  assertTest('persistence snapshot projections are deterministic and do not mutate their inputs', () => {
    const rawSnapshot = {
      feeds: {
        'Scenic Nature': [{ url: 'nature-image', title: 'Forest' }]
      },
      searchKeywords: { 'Scenic Nature': [' forest '] },
      locationSettings: { manualLocation: { city: 'Montreal' } }
    };
    const defaults = {
      defaultCollections: { 'Scenic Nature': [] },
      defaultState: {
        searchKeywords: {},
        autoLocation: false,
        manualLocation: {},
        excludedKeywords: []
      },
      buildFeedConfigsFromKeywords: (keywords) => ({
        'Scenic Nature': { unsplash: { keywords: keywords['Scenic Nature'] } }
      })
    };
    const originalRawSnapshot = JSON.parse(JSON.stringify(rawSnapshot));
    const originalDefaults = JSON.parse(JSON.stringify(defaults.defaultCollections));
    const normalized = normalizePersistedSnapshot(rawSnapshot, defaults);
    const normalizedState = {
      ...normalized.persistedState,
      searchKeywords: { ...normalized.persistedState.searchKeywords },
      feedConfigs: { ...normalized.persistedState.feedConfigs },
      poolPolicies: { ...normalized.persistedState.poolPolicies },
      manualLocation: { ...normalized.persistedState.manualLocation },
      excludedKeywords: [...normalized.persistedState.excludedKeywords]
    };
    const persisted = buildPersistedSnapshot(normalized.collections, normalized.persistedState, 456);

    assert.strictEqual(normalized.collections['Scenic Nature'][0].url, 'nature-image');
    assert.strictEqual(normalized.collections['Scenic Nature'][0].category, 'Scenic Nature');
    assert.deepStrictEqual(persisted.feeds, normalized.collections);
    assert.strictEqual(persisted.lastUpdated, 456);
    assert.deepStrictEqual(rawSnapshot, originalRawSnapshot);
    assert.deepStrictEqual(defaults.defaultCollections, originalDefaults);
    assert.deepStrictEqual(normalized.persistedState, normalizedState);
    assert.notStrictEqual(normalized.collections['Scenic Nature'], rawSnapshot.feeds['Scenic Nature']);
    assert.notStrictEqual(normalized.collections['Scenic Nature'][0], rawSnapshot.feeds['Scenic Nature'][0]);
  });

  assertTest('collection loading removes duplicate image URLs from disk and preserves sibling metadata', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-collection-codec-'));
    const jsonPath = path.join(directory, 'curated_collections.json');
    const originalSnapshot = {
      customMetadata: { retained: true },
      feeds: {
        'Scenic Nature': [
          { url: 'shared-image', title: 'First pool representation' },
          { url: 'nature-only', title: 'Nature image' }
        ],
        'Liminal Spaces': [
          { url: 'shared-image', title: 'Duplicate pool representation' },
          { url: 'liminal-only', title: 'Liminal image' }
        ]
      }
    };

    try {
      fs.writeFileSync(jsonPath, JSON.stringify(originalSnapshot), 'utf8');
      const loaded = loadCollectionsSnapshot({
        jsonPath,
        defaultCollections: { 'Scenic Nature': [], 'Liminal Spaces': [] },
        defaultState: { searchKeywords: {}, autoLocation: false, manualLocation: {}, excludedKeywords: [] },
        buildFeedConfigsFromKeywords: () => ({})
      });
      const persistedSnapshot = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

      assert.strictEqual(loaded.duplicatesRemoved, true);
      assert.deepStrictEqual(persistedSnapshot.customMetadata, originalSnapshot.customMetadata);
      assert.deepStrictEqual(persistedSnapshot.feeds['Scenic Nature'].map((photo) => photo.url), [
        'shared-image',
        'nature-only'
      ]);
      assert.deepStrictEqual(persistedSnapshot.feeds['Liminal Spaces'].map((photo) => photo.url), [
        'liminal-only'
      ]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  assertTest('pool schedules normalize daily windows and resolve overnight priority', () => {
    const selectedAtNight = resolveScheduledPool({
      poolPolicies: {
        'Night Mood': { schedule: { enabled: true, start: '22:00', end: '06:00', priority: 2 } },
        'Low Priority': { schedule: { enabled: true, start: '22:00', end: '06:00', priority: 1 } }
      },
      availableCategories: ['Scenic Nature', 'Night Mood', 'Low Priority'],
      now: new Date('2026-08-18T23:30:00')
    });
    assert.strictEqual(selectedAtNight.category, 'Night Mood');
    assert.strictEqual(resolveScheduledPool({
      poolPolicies: { 'Night Mood': { schedule: { enabled: true, start: '22:00', end: '06:00' } } },
      availableCategories: ['Night Mood'],
      now: new Date('2026-08-18T06:00:00')
    }), null);
    const baseline = ['Scenic Nature', 'Liminal Spaces'];
    const activated = appendUniqueCategory(baseline, 'Night Mood');
    assert.deepStrictEqual(activated, ['Scenic Nature', 'Liminal Spaces', 'Night Mood']);
    assert.deepStrictEqual(baseline, ['Scenic Nature', 'Liminal Spaces']);
    assert.deepStrictEqual(appendUniqueCategory(baseline, 'Scenic Nature'), baseline);
  });

  assertTest('pool schedule projections preserve identities and local-time boundaries', () => {
    const schedule = { enabled: true, start: '22:00', end: '06:00', priority: 4 };
    const baseline = ['Scenic Nature'];
    const appended = appendUniqueCategory(baseline, 'Night Mood');

    assert.strictEqual(formatLocalTime(new Date('2026-08-18T03:07:00')), '03:07');
    assert.strictEqual(isPoolScheduleActive(schedule, new Date('2026-08-18T23:30:00')), true);
    assert.strictEqual(isPoolScheduleActive(schedule, new Date('2026-08-18T12:00:00')), false);
    assert.strictEqual(scheduleIdentity('Night Mood', schedule), 'Night Mood|22:00|06:00|4');
    assert.notStrictEqual(appended, baseline);
    assert.deepStrictEqual(appended, ['Scenic Nature', 'Night Mood']);
  });

  assertTest('snapshot projections normalize immutably before the legacy shell applies them', () => {
    const sourceState = createState();
    const legacyState = {
      ...sourceState.config,
      ...sourceState.runtime,
      currentCategory: 'Liminal Space,Missing',
      photosList: [{ url: 'legacy-photo', title: 'Legacy' }],
      activePhoto: { url: 'portrait' }
    };
    const collections = {
      'Scenic Nature': [{ url: 'landscape', title: 'Landscape' }],
      'Liminal Spaces': [{ url: 'portrait', title: 'Portrait', orientation: 'portrait' }]
    };
    const runtimeOverrides = {
      browserRunning: true,
      externalCollections: {
        'Google Photos': [{ url: 'picker-photo', title: 'Picker' }]
      }
    };

    const domainState = buildDomainState(legacyState, collections, runtimeOverrides);
    const snapshot = buildSnapshot(domainState);

    assert.notStrictEqual(domainState.library.collections, collections);
    assert.notStrictEqual(domainState.library.collections['Liminal Spaces'], collections['Liminal Spaces']);
    assert.notStrictEqual(domainState.library.collections['Liminal Spaces'][0], collections['Liminal Spaces'][0]);
    assert.deepStrictEqual(domainState.playback.selectedCategories, ['Liminal Spaces']);
    assert.strictEqual(domainState.runtime.browserRunning, true);
    assert.strictEqual(snapshot.currentFrame.primary?.url, 'portrait');
    assert.strictEqual(snapshot.activePhoto?.url, 'portrait');
    assert.strictEqual(legacyState.currentCategory, 'Liminal Space,Missing');

    const applied = applyDomainState(legacyState, collections, domainState);
    assert.deepStrictEqual(applied, snapshot);
    assert.strictEqual(legacyState.currentCategory, 'Liminal Spaces');
    assert.strictEqual(legacyState.activePhoto?.url, 'portrait');
    assert.strictEqual(collections['Liminal Spaces'][0].category, 'Liminal Spaces');
  });

  assertTest('persistence codec keeps explicit zero-valued crop defaults', () => {
    const normalized = normalizePersistedSnapshot({
      splitCropPercent: 0
    }, {
      defaultCollections: createState().library.collections,
      defaultState: {
        ...createState().config,
        searchKeywords: createState().config.searchKeywords,
        autoLocation: false,
        manualLocation: {},
        excludedKeywords: []
      },
      buildFeedConfigsFromKeywords: () => ({})
    });

    assert.strictEqual(normalized.persistedState.splitCropPercent, 0);
  });

  assertTest('photo timestamps normalize valid values without inventing legacy dates', () => {
    assert.strictEqual(
      normalizePhotoAddedAt('2026-07-31T12:34:56-04:00'),
      '2026-07-31T16:34:56.000Z'
    );
    assert.strictEqual(normalizePhotoAddedAt('not-a-date'), null);
    assert.deepStrictEqual(
      normalizePhotoTimestamp({ url: 'legacy-photo' }),
      { url: 'legacy-photo' }
    );
  });

  assertTest('photo timestamps stamp only newly accepted photos immutably', () => {
    const photos = [
      { url: 'existing', addedAt: '2026-07-01T00:00:00.000Z' },
      { url: 'new' }
    ];
    const stamped = stampNewPhotos('2026-07-31T16:34:56Z')(photos);

    assert.strictEqual(stamped[0], photos[0]);
    assert.strictEqual(stamped[1].addedAt, '2026-07-31T16:34:56.000Z');
    assert.strictEqual(photos[1].addedAt, undefined);
  });

  assertTest('photo timestamp stamping keeps invalid clocks and source records inert', () => {
    const photos = [
      { url: 'legacy' },
      { url: 'dated', addedAt: '2026-07-01T00:00:00.000Z' }
    ];
    const stamped = stampNewPhotos('not-a-date')(photos);

    assert.notStrictEqual(stamped, photos);
    assert.strictEqual(stamped[0], photos[0]);
    assert.strictEqual(stamped[1], photos[1]);
    assert.deepStrictEqual(photos, [
      { url: 'legacy' },
      { url: 'dated', addedAt: '2026-07-01T00:00:00.000Z' }
    ]);
  });

  assertTest('persistence codec preserves valid photo timestamps and drops malformed ones', () => {
    const normalized = normalizePersistedSnapshot({
      feeds: {
        'Scenic Nature': [
          { url: 'dated', addedAt: '2026-07-31T12:00:00-04:00' },
          { url: 'legacy', addedAt: 'unknown' }
        ]
      }
    }, {
      defaultCollections: {},
      defaultState: {
        searchKeywords: {},
        autoLocation: false,
        manualLocation: {},
        excludedKeywords: []
      },
      buildFeedConfigsFromKeywords: () => ({})
    });

    assert.strictEqual(
      normalized.collections['Scenic Nature'][0].addedAt,
      '2026-07-31T16:00:00.000Z'
    );
    assert.strictEqual(normalized.collections['Scenic Nature'][1].addedAt, undefined);
  });
}

module.exports = {
  runDomainTests
};
