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
  buildBooleanFieldPatch,
  buildEnumFieldPatch,
  buildFiniteNumberFieldPatch,
  buildObjectFieldPatch,
  buildPercentFieldPatch,
  buildTrimmedStringFieldPatch,
  buildWidgetPatch,
  decodeActivePhotoCommand,
  createStatePatchCommandDecoder,
  decodeAdvancePhotoCommand,
  decodeAddPoolCommand,
  decodeCategorySelectionFromHttp,
  decodeCategorySelectionFromSocket,
  decodeDeletePoolCommand,
  decodePoolFeedConfigCommand,
  decodePoolKeywordsCommand,
  decodeBrokenPhotoCommand,
  decodePhotoCropCommand,
  decodePhotoMetadataCommand,
  decodePhotoRatingCommand,
  decodePhotoPreventPairingCommand,
  decodeRecrawlCommand,
  decodeScreensaverActiveCommand,
  decodeStatePatchCommand,
  decodeTumblrApiKeyCommand,
  decodeUseApiTokenCommand,
  decodeVisionAnalysisCommand
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

  assertTest('advance-photo command decoder preserves an explicit sequence strategy', () => {
    assert.deepStrictEqual(decodeAdvancePhotoCommand('prev', 'sequence'), {
      type: 'advance-photo',
      payload: {
        direction: 'prev',
        strategy: 'sequence'
      }
    });
  });

  assertTest('photo command decoders normalize prevent-pairing and broken-photo payloads', () => {
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
    assert.deepStrictEqual(decodeBrokenPhotoCommand({ url: 'broken-photo' }), {
      type: 'mark-photo-broken',
      payload: {
        url: 'broken-photo'
      }
    });
    assert.strictEqual(decodePhotoPreventPairingCommand({ preventPairing: true }), null);
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

  assertTest('state patch helper decoders compose shared socket settings commands declaratively', () => {
    const decodeWidgetCommand = createStatePatchCommandDecoder(buildWidgetPatch);
    const decodeThemeCommand = createStatePatchCommandDecoder(buildTrimmedStringFieldPatch('theme'));
    const decodeIntervalCommand = createStatePatchCommandDecoder(buildFiniteNumberFieldPatch('slideshowInterval'));
    const decodeAlignWeatherCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('alignWeather'));
    const decodeManualLocationCommand = createStatePatchCommandDecoder(buildObjectFieldPatch('manualLocation'));

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

  assertTest('state patch helper decoders reject invalid enum and percent socket payloads', () => {
    const decodeScaleModeCommand = createStatePatchCommandDecoder(buildEnumFieldPatch('scaleMode', ['cover', 'contain']));
    const decodeNightPercentageCommand = createStatePatchCommandDecoder(buildPercentFieldPatch('nightPercentage'));

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
}

module.exports = {
  runDomainTests
};
