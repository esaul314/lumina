// @ts-check

const assert = require('assert');
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
const { reduceDomainCommand } = require('./reducer.js');
const {
  decodeCategorySelectionFromHttp,
  decodeCategorySelectionFromSocket,
  decodePhotoRatingCommand
} = require('./commands.js');
const {
  buildPersistedSnapshot,
  normalizePersistedSnapshot
} = require('../config/collectionsCodec.js');

function createState(overrides = {}) {
  const baseState = {
    config: {
      theme: 'Zen Retreat',
      scaleMode: 'cover',
      splitPortrait: true,
      splitCropPercent: 50,
      widgets: { clock: true },
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
      photosList: [
        { url: 'port-1', title: 'Midnight Hallway', rating: 10, orientation: 'portrait', isNight: true, category: 'Liminal Spaces' },
        { url: 'port-2', title: 'Silent Corridor', rating: 9, orientation: 'portrait', isCloudy: true, category: 'Liminal Spaces' }
      ]
    },
    playback: {
      selectedCategories: ['Liminal Spaces'],
      activePhotoUrl: 'port-1',
      splitSeed: 1,
      lastDirection: 'next'
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

  assertTest('reducer banning the active photo advances playback exactly once', () => {
    const state = createState();
    const result = reduceDomainCommand(state, {
      type: 'rate-photo',
      payload: { url: 'port-1', rating: 1 }
    }, { now: new Date('2026-06-27T02:00:00'), rng: () => 0.1 });

    assert.strictEqual(result.nextState.playback.activePhotoUrl, 'port-2');
    assert.strictEqual(result.nextState.library.photosList.some((photo) => photo.url === 'port-1'), false);
    assert.deepStrictEqual(result.events.map((event) => event.type), ['photo-update', 'state-sync']);
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

  assertTest('REST and socket adapters decode the same category command', () => {
    const httpCommand = decodeCategorySelectionFromHttp({ category: 'Liminal Space,AI Creation' });
    const socketCommand = decodeCategorySelectionFromSocket('Liminal Space,AI Creation');
    assert.deepStrictEqual(httpCommand, socketCommand);

    const httpResult = reduceDomainCommand(createState(), httpCommand, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });
    const socketResult = reduceDomainCommand(createState(), socketCommand, { now: new Date('2026-06-27T12:00:00'), rng: () => 0.1 });
    assert.deepStrictEqual(httpResult.nextState.playback, socketResult.nextState.playback);
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

  assertTest('persistence codec round-trips canonical snapshot fields', () => {
    const persisted = buildPersistedSnapshot(createState().library.collections, {
      searchKeywords: createState().config.searchKeywords,
      feedConfigs: { foo: { enabled: true } },
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
  });
}

module.exports = {
  runDomainTests
};
