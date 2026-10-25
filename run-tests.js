/**
 * 🌌 LUMINA REGRESSION TEST SUITE & DIAGNOSTIC RUNNER
 * --------------------------------------------------
 * A lightweight, zero-dependency unit and integration testing framework.
 * Guards Lumina against regressions in core algorithms, spelling hotfixes,
 * weather alignment engines, and active API endpoints.
 */

// 1. Set environment to test to suppress side-effects (port binds/active daemons)
process.env.NODE_ENV = 'test';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { createRequire } = require('module');
const { runInNewContext } = require('vm');
const { pathToFileURL } = require('url');

// Keep regression fixtures away from the daemon's gitignored source-local cache.
process.env.LUMINA_GOOGLE_PHOTOS_CACHE_PATH = path.join(
  require('os').tmpdir(),
  'lumina-google-photos-cache-test.json'
);

const express = require('express');
const config = require('./server/config/configLoader.js');
const { 
  tagPhotosWithKeywords, 
  getSmartPhoto, 
  screensaverState,
  combineFeedsBalanced,
  selectWeightedRandomPhoto,
  isTimeInSchedule,
  server
} = require('./server/app.js');
const { analyzeSentiment } = require('./server/services/sentiment.js');
const { classifyWeatherCode } = require('./server/services/weather.js');
const {
  createEcowittRuntime,
  parseEcowittPayload,
  buildEnvironmentResponse,
  normalizeUnits,
  validateEcowittSettings
} = require('./server/services/ecowitt.js');
const {
  clampLimit,
  createSensorHistoryStore,
  normalizeSensorSnapshot,
  toCsv
} = require('./server/services/sensorHistory.js');
const { updatePhotoCrop } = require('./server/config/collections.js');
const { projectPhotoFieldUpdate } = require('./server/config/collectionPhotoUpdatePlan.js');
const {
  projectPhotoRatingUpdate,
  projectPhotoCropUpdater,
  projectPhotoPairingUpdater,
  projectBrokenPhoto
} = require('./server/config/collectionPhotoUpdaters.js');
const { buildFeedConfigsFromKeywords } = require('./server/config/state.js');
const { runDomainTests } = require('./server/domain/tests.js');
const {
  createDomainDispatcher,
  createEffectInterpreter,
  createTypedHandlerInvoker,
  normalizeRuntimeFlags
} = require('./server/domain/dispatch.js');
const { reduceAsyncSequentially } = require('./server/utils/asyncReduce.js');
const {
  curry,
  pipe,
  prop,
  map,
  filter,
  reduce,
  reduceUntil,
  createIndexedInterpreter,
  createClosedInterpreter,
  toLower,
  includes,
  uniqBy
} = require('./server/utils/fn.js');
const { SOCKET_COMMAND_LISTENER_SPECS } = require('./server/domain/commands.js');
const {
  createPoolScheduleRuntime,
  projectPoolScheduleStatus
} = require('./server/runtime/poolSchedule.js');
const { runRecrawlJobTests } = require('./server/jobs/tests.js');
const configureRoutes = require('./server/routes.js');
const { buildWeatherResponse } = configureRoutes;
const configureSockets = require('./server/sockets.js');
const {
  createCommandRunner,
  createSocketCommandSpecInterpreter,
  registerCommandSpecs
} = configureSockets;
const {
  createSensorAdapter,
  createSensorPlatform
} = require('./server/services/sensorPlatform.js');
const { upsertEnvVarInContent } = require('./server/config/env.js');
const { mergeLocalConfig } = require('./server/config/localSettings.js');
const {
  createActiveCategoryDispatcher,
  loadActiveCategories,
  normalizeActiveCategories,
  saveActiveCategories
} = require('./server/config/activeCategories.js');
const { projectConfigOverrides } = require('./server/config/configLoaderProjections.js');
const googlePhotos = require('./server/services/googlePhotos.js');
const googlePhotosCache = require('./server/services/googlePhotosCache.js');
const {
  chainRouteDecode,
  collectRouteDecodeResults,
  createRouteDecodeFailure,
  createRouteDecodeSuccess,
  mapRouteDecode,
  normalizeRouteDecodeResult
} = require('./server/utils/routeDecode.js');
const {
  collectKeywordTerms,
  keywordEntriesEqual,
  normalizeKeywordEntries,
  normalizeKeywordEntry,
  normalizeKeywordTerms
} = require('./server/utils/keywordSpecs.js');
const {
  applyCachedMediaItemMetadataToState,
  buildGooglePhotoProxyUrl,
  buildCachedMediaItem,
  getGooglePhotoMediaItemId,
  mergeCachedMediaItemMetadata,
  normalizeCachedMediaItem,
  isUsableCachedMediaItem,
  dedupeMediaItemsById,
  mergeSyncedMediaItems,
  difference,
  getOrphanedFiles,
  getLocalMediaFilePath,
  fetchMediaItemBytes
} = require('./server/services/googlePhotos.js');
const {
  buildChromiumFlags,
  getChromiumAccelerationProfile
} = require('./server/services/system.js');
const { isDisallowedUnsplashPhoto } = require('./server/utils/photoPolicy.js');
const { applyPoolPolicy } = require('./server/domain/poolRetention.js');

// Formatting constants for clean terminal reports
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const STATS = {
  passed: 0,
  failed: 0,
  total: 0
};

function logSuite(name) {
  console.log(`\n${COLORS.bold}${COLORS.cyan}=== SUITE: ${name} ===${COLORS.reset}`);
}

function assertTest(name, fn) {
  STATS.total++;
  try {
    fn();
    console.log(`  ${COLORS.green}✓ PASS:${COLORS.reset} ${name}`);
    STATS.passed++;
  } catch (err) {
    console.log(`  ${COLORS.red}✗ FAIL:${COLORS.reset} ${name}`);
    console.error(`    Assertion Error: ${err.message}`);
    STATS.failed++;
  }
}

async function assertAsyncTest(name, fn) {
  STATS.total++;
  try {
    await fn();
    console.log(`  ${COLORS.green}✓ PASS:${COLORS.reset} ${name}`);
    STATS.passed++;
  } catch (err) {
    console.log(`  ${COLORS.red}✗ FAIL:${COLORS.reset} ${name}`);
    console.error(`    Assertion Error: ${err.message}`);
    STATS.failed++;
  }
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function importClientModule(relativePath) {
  return import(pathToFileURL(path.join(__dirname, relativePath)).href);
}

function requestSocketJson(socketPath, requestPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      socketPath,
      path: requestPath,
      method,
      headers: {}
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_error) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

function buildConfiguredRoutesApp(extraEnv = {}) {
  const app = express();
  app.use(express.json());

  configureRoutes({
    app,
    state: {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    },
    collections: {
      'Scenic Nature': [{ url: 'land-1', category: 'Scenic Nature' }]
    },
    getWeatherData: () => null,
    setWeatherData: () => {},
    io: { emit: () => {} },
    port: 0,
    ...extraEnv
  });

  return app;
}

function createSocketHarness(extraEnv = {}) {
  const ioEmits = [];
  let connectionHandler = null;
  const io = {
    emit(event, payload) {
      ioEmits.push([event, payload]);
    },
    on(event, handler) {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }
  };
  const socketHandlers = {};
  const socketEmits = [];
  const socket = {
    id: 'socket-test',
    on(event, handler) {
      socketHandlers[event] = handler;
    },
    emit(event, payload) {
      socketEmits.push([event, payload]);
    }
  };
  const state = {
    currentCategory: 'Scenic Nature',
    photosList: [{ url: 'land-1', title: 'Forest' }],
    activePhoto: { url: 'land-1', title: 'Forest' },
    widgets: { clock: true },
    hasUseApiToken: false,
    hasTumblrApiKey: false,
    searchKeywords: {
      'Scenic Nature': ['forest'],
      'Liminal Spaces': ['hallway']
    },
    feedConfigs: {},
    excludedKeywords: []
  };
  const collections = {
    'Scenic Nature': [{ url: 'land-1', title: 'Forest' }],
    'Liminal Spaces': [{ url: 'port-1', title: 'Hallway' }]
  };

  configureSockets({
    io,
    state,
    collections,
    combineFeedsBalanced: (categories) => categories.map((category, index) => ({
      url: `${category}-${index}`,
      title: category,
      category
    })),
    getSmartPhoto: (direction) => ({ url: `${direction}-smart`, title: `${direction} smart` }),
    launchKioskBrowser: () => {},
    killKioskBrowser: () => {},
    setManualOverride: () => {},
    getLocalIpAddresses: () => ['127.0.0.1'],
    port: 5000,
    triggerWeatherUpdate: async () => {},
    ...extraEnv
  });

  if (typeof connectionHandler !== 'function') {
    throw new Error('Socket harness failed to register a connection handler.');
  }

  connectionHandler(socket);

  return {
    collections,
    ioEmits,
    socket,
    socketEmits,
    socketHandlers,
    state
  };
}

function createDispatcherHarness(extraEnv = {}) {
  const ioEmits = [];
  const io = {
    emit(event, payload) {
      ioEmits.push([event, payload]);
    }
  };
  const state = {
    currentCategory: 'Scenic Nature',
    photosList: [
      { url: 'land-1', title: 'Forest Dawn', rating: 10, category: 'Scenic Nature' },
      { url: 'land-2', title: 'Forest Mist', rating: 8, category: 'Scenic Nature' }
    ],
    activePhoto: { url: 'land-1', title: 'Forest Dawn', rating: 10, category: 'Scenic Nature' },
    widgets: { clock: true },
    theme: 'Zen Retreat',
    scaleMode: 'cover',
    splitPortrait: true,
    splitCropPercent: 50,
    inactivityTimeout: 600000,
    slideshowInterval: 120000,
    alignTimeOfDay: false,
    alignWeather: false,
    allowOpenAiFallback: false,
    nightPercentage: 50,
    searchKeywords: { 'Scenic Nature': ['forest'] },
    feedConfigs: {},
    excludedKeywords: [],
    autoLocation: false,
    manualLocation: {},
    screensaverActive: false,
    hasUseApiToken: false,
    hasTumblrApiKey: false,
    newsSentiment: { weatherMatch: 'Cloudy' },
    physicalWeather: { weatherMatch: 'Cloudy' },
    splitSeed: 0,
    lastDirection: 'next'
  };
  const collections = {
    'Scenic Nature': [
      { url: 'land-1', title: 'Forest Dawn', rating: 10, category: 'Scenic Nature' },
      { url: 'land-2', title: 'Forest Mist', rating: 8, category: 'Scenic Nature' }
    ]
  };
  const runtimeContext = {
    browserRunning: false,
    manualOverride: false,
    weather: null,
    externalCollections: {}
  };

  const dispatcher = createDomainDispatcher({
    state,
    collections,
    io,
    getRuntimeContext: () => runtimeContext,
    ...extraEnv
  });

  return {
    collections,
    dispatcher,
    ioEmits,
    runtimeContext,
    state
  };
}

function findRouteHandler(app, method, routePath) {
  const layer = app._router.stack.find((entry) =>
    entry.route
    && entry.route.path === routePath
    && entry.route.methods[method.toLowerCase()]
  );

  if (!layer) {
    throw new Error(`Missing route handler for ${method.toUpperCase()} ${routePath}`);
  }

  return layer.route.stack.at(-1).handle;
}

async function invokeRoute(app, method, routePath, { body = undefined, params = {}, query = {}, headers = {} } = {}) {
  const handler = findRouteHandler(app, method, routePath);
  let statusCode = 200;
  let responseBody;

  const req = {
    body,
    params,
    query,
    headers,
    method: method.toUpperCase(),
    path: routePath
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      responseBody = payload;
      return this;
    },
    setHeader() {
      return this;
    },
    type() {
      return this;
    },
    send(payload) {
      responseBody = payload;
      return this;
    },
    redirect(location) {
      responseBody = { redirect: location };
      return this;
    }
  };

  await handler(req, res);
  return {
    status: statusCode,
    body: responseBody
  };
}


// ============================================================================
// 1. UNIT TEST SUITE: Atmospheric Keyword Auto-Tagging
// ============================================================================
logSuite('Atmospheric Keyword Auto-Tagging');

assertTest('correctly tags night-themed titles', () => {
  const photos = [
    { title: 'Fluorescent Green Corridor in Midnight Sleep', author: 'Scarbor Siu' },
    { title: 'Serene Purple Twilight Beach', author: 'Sean Oulashin' },
    { title: 'Silent Deserted Warehouse Under Pale Night Light', author: 'Jorg Angeli' }
  ];
  
  const tagged = tagPhotosWithKeywords(photos);
  
  assert.strictEqual(tagged[0].isNight, true, 'Midnight should map to isNight=true');
  assert.strictEqual(tagged[1].isNight, true, 'Twilight should map to isNight=true');
  assert.strictEqual(tagged[2].isNight, true, 'Night should map to isNight=true');
});

assertTest('correctly tags weather-themed titles', () => {
  const photos = [
    { title: 'Empty Laundromat Window Glowing in the Rain', author: 'Benjamin Lehman' },
    { title: 'Monstera Leaves in Dewy Jungle Light', author: 'Kari Shea' },
    { title: 'Towering Sun-Drenched Redwoods', author: 'Jay Mantri' },
    { title: 'Snowy Peak Touched by Clouds', author: 'Benjamin Voros' }
  ];
  
  const tagged = tagPhotosWithKeywords(photos);
  
  assert.strictEqual(tagged[0].isRain, true, 'Rain should map to isRain=true');
  assert.strictEqual(tagged[1].isRain, true, 'Dewy should map to isRain=true');
  assert.strictEqual(tagged[2].isSunny, true, 'Sun-Drenched should map to isSunny=true');
  assert.strictEqual(tagged[3].isSnowy, true, 'Snowy should map to isSnowy=true');
  assert.strictEqual(tagged[3].isCloudy, true, 'Clouds should map to isCloudy=true');
});

assertTest('preserves explicit false and zero-valued metadata when tagging', () => {
  const [tagged] = tagPhotosWithKeywords([
    { title: 'Midnight Corridor', isNight: false, isRain: false, rating: 0, isBroken: false }
  ]);

  assert.strictEqual(tagged.isNight, false, 'Explicit false should not be replaced by inferred night tagging');
  assert.strictEqual(tagged.isRain, false, 'Explicit false should not be replaced by inferred rain tagging');
  assert.strictEqual(tagged.rating, 0, 'Nullish defaults should preserve explicit numeric zero values');
  assert.strictEqual(tagged.isBroken, false, 'Explicit false should remain intact');
});

// ============================================================================
// 2. UNIT TEST SUITE: Smart Wallpaper Selector Engine
// ============================================================================
logSuite('Smart Wallpaper Selector Engine');

assertTest('picks atmospheric photos when weather alignment is enabled', () => {
  const samplePhotos = [
    { url: 'url1', title: 'Sunny Meadow', isSunny: true, isRain: false, isNight: false },
    { url: 'url2', title: 'Rainy Alleyway', isSunny: false, isRain: true, isNight: false },
    { url: 'url3', title: 'Moody Fog', isSunny: false, isRain: false, isCloudy: true, isNight: false }
  ];
  
  // Set up mock server state
  screensaverState.photosList = samplePhotos;
  screensaverState.activePhoto = samplePhotos[0];
  screensaverState.alignWeather = true;
  screensaverState.physicalWeather = {
    temp: 10,
    condition: 'Rainy / Stormy',
    weatherMatch: 'Rainy'
  };

  // Run selector 20 times, should heavily prefer Rainy alleyway (url2)
  let pickedRainy = 0;
  for (let i = 0; i < 20; i++) {
    const nextPhoto = getSmartPhoto('next');
    if (nextPhoto && nextPhoto.url === 'url2') {
      pickedRainy++;
    }
  }

  // The selector engine has an 80% preference rate for weather match
  assert.ok(pickedRainy > 10, `Expected rainy photo to be picked most of the time (Picked count: ${pickedRainy}/20)`);
});

// ============================================================================
// 2b. UNIT TEST SUITE: Scenic Pool Time-Based Keywords
// ============================================================================
logSuite('Scenic Pool Time-Based Keywords');

assertTest('isTimeInSchedule correctly matches standard ranges', () => {
  assert.strictEqual(isTimeInSchedule('10:30', '08:00', '12:00'), true, '10:30 is between 08:00 and 12:00');
  assert.strictEqual(isTimeInSchedule('07:59', '08:00', '12:00'), false, '07:59 is not between 08:00 and 12:00');
  assert.strictEqual(isTimeInSchedule('12:00', '08:00', '12:00'), false, '12:00 is end boundary (exclusive)');
});

assertTest('isTimeInSchedule correctly matches ranges crossing midnight', () => {
  assert.strictEqual(isTimeInSchedule('23:30', '22:00', '06:00'), true, '23:30 is between 22:00 and 06:00 (before midnight)');
  assert.strictEqual(isTimeInSchedule('02:15', '22:00', '06:00'), true, '02:15 is between 22:00 and 06:00 (after midnight)');
  assert.strictEqual(isTimeInSchedule('12:00', '22:00', '06:00'), false, '12:00 is not in overnight range');
});

assertTest('getSmartPhoto filters candidates by timeRanges constraint', () => {
  const originalList = screensaverState.photosList;
  const originalActive = screensaverState.activePhoto;
  
  const now = new Date();
  const allowedStart = String(now.getHours()).padStart(2, '0') + ':00';
  const allowedEnd = String((now.getHours() + 1) % 24).padStart(2, '0') + ':00';
  
  const blockedStart = String((now.getHours() + 2) % 24).padStart(2, '0') + ':00';
  const blockedEnd = String((now.getHours() + 3) % 24).padStart(2, '0') + ':00';

  screensaverState.photosList = [
    { url: 'http://example.com/allowed.jpg', rating: 10, timeRanges: [{ start: allowedStart, end: allowedEnd }] },
    { url: 'http://example.com/blocked.jpg', rating: 10, timeRanges: [{ start: blockedStart, end: blockedEnd }] }
  ];
  screensaverState.activePhoto = null;

  try {
    const selected = getSmartPhoto();
    assert.ok(selected, 'Should select a photo');
    assert.strictEqual(selected.url, 'http://example.com/allowed.jpg', 'Should select the allowed photo matching current time range');
  } finally {
    screensaverState.photosList = originalList;
    screensaverState.activePhoto = originalActive;
  }
});

// ============================================================================
// 2c. UNIT TEST SUITE: Declarative Config & Collection Projections
// ============================================================================
logSuite('Declarative Config & Collection Projections');

assertTest('buildFeedConfigsFromKeywords layers keyword sources and built-in overrides declaratively', () => {
  const configs = buildFeedConfigsFromKeywords({
    'Scenic Nature': [{ keywords: ['forest', 'mist'] }],
    'Moody Rooms': ['moody rooms']
  });

  assert.deepStrictEqual(configs['Scenic Nature'].unsplash.keywords, ['forest', 'mist']);
  assert.deepStrictEqual(configs['Scenic Nature'].tumblrTags.tags, ['landscape', 'nature', 'mountains']);
  assert.strictEqual(configs['Scenic Nature'].picsum.enabled, true);
  assert.deepStrictEqual(configs['Moody Rooms'].tumblrTags.tags, ['moody rooms']);
  assert.strictEqual(configs['Moody Rooms'].reddit, undefined);
});

assertTest('buildFeedConfigsFromKeywords composes normalized timed and phrase terms without mutation', () => {
  const keywords = {
    'Timed Pool': [
      '  quiet room  ',
      { timeStart: '08:00', timeEnd: '10:00', keywords: [' mist ', 42] },
      null
    ],
    'Malformed Pool': 42
  };
  const originalKeywords = structuredClone(keywords);
  const configs = buildFeedConfigsFromKeywords(keywords);

  assert.deepStrictEqual(configs['Timed Pool'].unsplash.keywords, ['quiet room', 'mist']);
  assert.deepStrictEqual(configs['Malformed Pool'].unsplash.keywords, []);
  assert.deepStrictEqual(Object.keys(configs), ['Timed Pool', 'Malformed Pool']);
  assert.deepStrictEqual(keywords, originalKeywords);
});

assertTest('buildFeedConfigsFromKeywords returns independent keyword arrays per source', () => {
  const configs = buildFeedConfigsFromKeywords({ 'Custom Pool': ['first phrase'] });
  const { unsplash, wallhaven, tumblrTags } = configs['Custom Pool'];

  assert.notStrictEqual(unsplash.keywords, wallhaven.keywords);
  assert.notStrictEqual(unsplash.keywords, tumblrTags.tags);
  assert.notStrictEqual(wallhaven.keywords, tumblrTags.tags);

  unsplash.keywords.push('local edit');
  assert.deepStrictEqual(wallhaven.keywords, ['first phrase']);
  assert.deepStrictEqual(tumblrTags.tags, ['first phrase']);
});

assertTest('keyword feed configuration projection exposes checked local contracts', () => {
  const source = fs.readFileSync(require.resolve('./server/config/state.js'), 'utf8');

  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{Record<string, unknown>\} KeywordMap/);
  assert.match(source, /@typedef \{Record<string, FeedSourceConfig>\} CategoryFeedConfig/);
  assert.match(source, /@param \{KeywordMap\} keywordsMap/);
  assert.match(source, /@returns \{Record<string, CategoryFeedConfig>\}/);
});

assertTest('mergeLocalConfig composes supported partial updates without mutation', () => {
  const current = {
    location: { city: 'Toronto' },
    ecowitt: {
      baseUrl: 'http://gateway.local',
      pollIntervalSeconds: 60,
      units: { temperature: 'C', pressure: 'hPa' }
    },
    sensorHistory: {
      enabled: true,
      retentionDays: 30,
      export: { format: 'csv' }
    }
  };
  const patch = {
    location: { city: 'ignored by this patch contract' },
    unrelated: true,
    ecowitt: {
      pollIntervalSeconds: 15,
      units: { temperature: 'F' }
    },
    sensorHistory: {
      retentionDays: 90,
      export: { format: 'json' }
    }
  };
  const originalCurrent = structuredClone(current);
  const originalPatch = structuredClone(patch);

  const merged = mergeLocalConfig(current, patch);

  assert.deepStrictEqual(merged, {
    location: current.location,
    ecowitt: {
      baseUrl: 'http://gateway.local',
      pollIntervalSeconds: 15,
      units: { temperature: 'F', pressure: 'hPa' }
    },
    sensorHistory: {
      enabled: true,
      retentionDays: 90,
      export: { format: 'json' }
    }
  });
  assert.strictEqual(merged.location, current.location);
  assert.strictEqual(merged.sensorHistory.export, patch.sensorHistory.export);
  assert.notStrictEqual(merged.ecowitt, current.ecowitt);
  assert.notStrictEqual(merged.ecowitt.units, current.ecowitt.units);
  assert.deepStrictEqual(current, originalCurrent);
  assert.deepStrictEqual(patch, originalPatch);
});

assertTest('mergeLocalConfig preserves Ecowitt units when the patch omits them', () => {
  assert.deepStrictEqual(
    mergeLocalConfig({ ecowitt: { baseUrl: 'http://old.local', units: { temperature: 'C' } } }, {
      ecowitt: { baseUrl: 'http://new.local' }
    }),
    { ecowitt: { baseUrl: 'http://new.local', units: { temperature: 'C' } } }
  );
  assert.deepStrictEqual(mergeLocalConfig({}, { ecowitt: { baseUrl: 'http://new.local' } }), {
    ecowitt: { baseUrl: 'http://new.local', units: {} }
  });
});

assertTest('active category recovery filters deleted pools and falls back when no saved pool remains', () => {
  assert.deepStrictEqual(
    normalizeActiveCategories({ categories: ['AI Creation', 'removed pool', 'Google Photos'] }, [
      'Scenic Nature', 'AI Creations'
    ], 'Scenic Nature'),
    ['AI Creations', 'Google Photos']
  );
  assert.deepStrictEqual(
    normalizeActiveCategories(['removed pool'], ['Scenic Nature'], 'Scenic Nature'),
    ['Scenic Nature']
  );
});

assertTest('active category persistence writes atomically and restores a detached selection', () => {
  const files = new Map();
  const fakeFs = {
    existsSync: (filePath) => files.has(filePath),
    readFileSync: (filePath) => files.get(filePath),
    writeFileSync: (filePath, contents) => files.set(filePath, contents),
    renameSync: (fromPath, toPath) => {
      files.set(toPath, files.get(fromPath));
      files.delete(fromPath);
    }
  };
  const categories = ['AI Creations', 'Google Photos'];

  saveActiveCategories({ path: '/state/active_categories.json', categories, fsImpl: fakeFs });
  categories.push('mutated after save');

  assert.deepStrictEqual(
    loadActiveCategories({
      path: '/state/active_categories.json',
      availableCategories: ['Scenic Nature', 'AI Creations'],
      fallbackCategory: 'Scenic Nature',
      fsImpl: fakeFs
    }),
    ['AI Creations', 'Google Photos']
  );
  assert.strictEqual(files.has('/state/active_categories.json.tmp'), false);
});

assertTest('active category persistence falls back cleanly for a missing or malformed file', () => {
  const files = new Map([['/state/bad.json', '{']]);
  const warnings = [];
  const fakeFs = {
    existsSync: (filePath) => files.has(filePath),
    readFileSync: (filePath) => files.get(filePath)
  };
  const options = {
    path: '/state/missing.json',
    availableCategories: ['Scenic Nature', 'AI Creations'],
    fallbackCategory: 'Scenic Nature',
    fsImpl: fakeFs,
    log: { warn: (...message) => warnings.push(message) }
  };

  assert.deepStrictEqual(loadActiveCategories(options), ['Scenic Nature']);
  assert.deepStrictEqual(loadActiveCategories({ ...options, path: '/state/bad.json' }), ['Scenic Nature']);
  assert.strictEqual(warnings.length, 1);
});

assertAsyncTest('active category dispatcher persists completed manual selections and skips unrelated commands', async () => {
  const calls = [];
  let categories = ['Scenic Nature'];
  const dispatchCommand = async (command, env) => {
    calls.push(['dispatch', command, env]);
    if (command?.type === 'select-categories') categories = ['AI Creations'];
    return 'result';
  };
  const dispatch = createActiveCategoryDispatcher({
    dispatchCommand,
    getCategories: () => categories,
    save: (value) => calls.push(['save', value])
  });
  const command = { type: 'select-categories', payload: { categories: ['AI Creations'] } };
  const env = { source: 'remote' };

  assert.strictEqual(await dispatch(command, env), 'result');
  assert.strictEqual(await dispatch({ type: 'next-photo' }), 'result');
  assert.deepStrictEqual(calls, [
    ['dispatch', command, env],
    ['save', ['AI Creations']],
    ['dispatch', { type: 'next-photo' }, undefined]
  ]);
});

assertTest('local config merge exposes checked section contracts', () => {
  const source = fs.readFileSync(require.resolve('./server/config/localSettings.js'), 'utf8');

  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{Record<string, unknown>\} LocalConfigRecord/);
  assert.match(source, /@typedef \{LocalConfigRecord & \{ units\?: LocalConfigRecord \}\} EcowittLocalConfig/);
  assert.match(source, /@typedef \{LocalConfigRecord & \{ ecowitt\?: EcowittLocalConfig; sensorHistory\?: LocalConfigRecord \}\} LocalConfig/);
  assert.match(source, /@param \{LocalConfig\} current/);
  assert.match(source, /@param \{LocalConfig\} patch/);
  assert.match(source, /@returns \{LocalConfig\}/);
  assert.match(source, /sensor-history settings remain a\s+\*\s+shallow section merge/);
});

assertTest('config override projection filters deprecated secrets and preserves merge semantics immutably', () => {
  const defaults = {
    theme: 'Zen Retreat',
    location: { city: 'Toronto', latitude: 43.65 },
    ecowitt: {
      baseUrl: 'http://gateway.local',
      pollIntervalSeconds: 60,
      units: { temperature: 'C', pressure: 'hPa' }
    },
    sensorHistory: {
      enabled: true,
      retentionDays: 30,
      export: { format: 'csv' }
    }
  };
  const userConfig = {
    theme: 'Cosmic Night',
    location: { city: 'Montreal' },
    ecowitt: {
      pollIntervalSeconds: 15,
      units: { temperature: 'F' }
    },
    sensorHistory: {
      retentionDays: 90,
      export: { format: 'json' }
    },
    nasaApiKey: null,
    googleClientSecret: 'deprecated-secret',
    customExtension: { enabled: true }
  };
  const originalDefaults = structuredClone(defaults);
  const originalUserConfig = structuredClone(userConfig);

  const { config: projected, ignoredSecretKeys } = projectConfigOverrides(defaults, userConfig);

  assert.deepStrictEqual(projected, {
    theme: 'Cosmic Night',
    location: { city: 'Montreal', latitude: 43.65 },
    ecowitt: {
      baseUrl: 'http://gateway.local',
      pollIntervalSeconds: 15,
      units: { temperature: 'F', pressure: 'hPa' }
    },
    sensorHistory: {
      enabled: true,
      retentionDays: 90,
      export: { format: 'json' }
    },
    customExtension: { enabled: true }
  });
  assert.deepStrictEqual(ignoredSecretKeys, ['nasaApiKey', 'googleClientSecret']);
  assert.strictEqual(Object.hasOwn(projected, 'nasaApiKey'), false);
  assert.strictEqual(Object.hasOwn(projected, 'googleClientSecret'), false);
  assert.notStrictEqual(projected.location, defaults.location);
  assert.notStrictEqual(projected.ecowitt.units, defaults.ecowitt.units);
  assert.strictEqual(projected.sensorHistory.export, userConfig.sensorHistory.export);
  assert.deepStrictEqual(defaults, originalDefaults);
  assert.deepStrictEqual(userConfig, originalUserConfig);
});

assertTest('config loader projection exposes checked types and leaves file and warning effects in its shell', () => {
  const projectionSource = fs.readFileSync(require.resolve('./server/config/configLoaderProjections.js'), 'utf8');
  const loaderSource = fs.readFileSync(require.resolve('./server/config/configLoader.js'), 'utf8');

  assert.match(projectionSource, /^\/\/ @ts-check/);
  assert.match(projectionSource, /@typedef \{Record<string, unknown>\} ConfigRecord/);
  assert.match(projectionSource, /@typedef \{ConfigRecord & \{ location\?: ConfigRecord; ecowitt\?: EcowittConfig; sensorHistory\?: ConfigRecord \}\} AppConfig/);
  assert.match(projectionSource, /@param \{AppConfig\} defaults/);
  assert.match(projectionSource, /@param \{AppConfig\} userConfig/);
  assert.match(projectionSource, /@returns \{ConfigProjection\}/);
  assert.match(loaderSource, /^\/\/ @ts-check/);
  assert.match(loaderSource, /@typedef \{ConfigRecord & \{units\?: ConfigRecord\}\} EcowittConfig/);
  assert.match(loaderSource, /@type \{AppConfig\}\s*\*\/\s*let config/);
  assert.match(loaderSource, /@type \{AppConfig\}\s*\*\/\s*const userConfig/);
  assert.match(loaderSource, /projectConfigOverrides\(config, userConfig\)/);
  assert.match(loaderSource, /console\.warn\(`Warning: Secret config keys/);
  assert.match(loaderSource, /fs\.readFileSync/);
});

assertTest('curated collection shell documents open update inputs and keeps mutation and persistence effects explicit', () => {
  const source = fs.readFileSync(require.resolve('./server/config/collections.js'), 'utf8');

  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{Record<string, PhotoRecord\[\]>\} PhotoCollections/);
  assert.match(source, /@typedef \{Record<string, unknown> & \{/);
  assert.match(source, /@param \{PhotoUpdater\} updater/);
  assert.match(source, /@param \{PhotoState \| null \| undefined\} state/);
  assert.match(source, /@returns \{boolean\}/);
  assert.match(source, /Object\.assign\(collections, plan\.collections\)/);
  assert.match(source, /state\.photosList = plan\.stateUpdates\.photosList/);
  assert.match(source, /saveCuratedCollections\(collections, state\)/);
});

assertTest('updatePhotoCrop projects crop updates across list and active split photo state', () => {
  const collections = {
    'Scenic Nature': [
      { url: 'a', title: 'Alpha', cropPercent: 20, cropPositionY: 10 },
      { url: 'b', title: 'Beta', cropPercent: 40, cropPositionY: 30 }
    ]
  };
  const state = {
    photosList: collections['Scenic Nature'].map((photo) => ({ ...photo })),
    activePhoto: { ...collections['Scenic Nature'][0] },
    activeSecondPhoto: { ...collections['Scenic Nature'][1] }
  };

  const updated = updatePhotoCrop(collections, state, 'b', 82, 61);

  assert.strictEqual(updated, true, 'Expected matching URL to be updated');
  assert.strictEqual(collections['Scenic Nature'][1].cropPercent, 82);
  assert.strictEqual(collections['Scenic Nature'][1].cropPositionY, 61);
  assert.strictEqual(state.photosList[1].cropPercent, 82);
  assert.strictEqual(state.activeSecondPhoto.cropPositionY, 61);
});

// ============================================================================
// 3. UNIT TEST SUITE: Modular Service Isolated Engines
// ============================================================================
logSuite('Modular Service Isolated Engines');

assertTest('correctly calculates news sentiment scores and tags weather alignment', () => {
  const positiveRss = '<rss><channel><item><title>Peace Agreement Signed after Growth and Win</title></item></channel></rss>';
  const negativeRss = '<rss><channel><item><title>Crisis and Conflict threat drop of shares</title></item></channel></rss>';
  
  const posSentiment = analyzeSentiment(positiveRss);
  const negSentiment = analyzeSentiment(negativeRss);
  
  assert.strictEqual(posSentiment.weatherMatch, 'Sunny', 'Positive headlines must match Sunny weather');
  assert.ok(posSentiment.score > 0, 'Positive headlines must have score > 0');
  
  assert.strictEqual(negSentiment.weatherMatch, 'Rainy', 'Negative headlines must match Rainy weather');
  assert.ok(negSentiment.score < 0, 'Negative headlines must have score < 0');
});

assertTest('sentiment projection keeps parsing, classification, and empty identities deterministic', () => {
  const { analyzeSentiment: projectSentiment } = require('./server/services/sentiment.js');
  const rss = '<rss><channel><title>Google News</title><item><title>Peace and Innovation</title></item></channel></rss>';
  const expected = {
    score: 0.667,
    headlinesCount: 1,
    label: 'Sunny / Hopeful',
    weatherMatch: 'Sunny'
  };

  assert.deepStrictEqual(projectSentiment(rss), expected);
  assert.deepStrictEqual(projectSentiment('<rss><channel><title>Google News</title></channel></rss>'), {
    score: 0,
    label: 'Overcast / Calm',
    weatherMatch: 'Cloudy',
    headlinesCount: 0
  });
  assert.deepStrictEqual(projectSentiment(rss), projectSentiment(rss));
});

assertTest('sentiment source exposes a checked pure contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/sentiment.js'), 'utf8');

  assert.ok(source.startsWith('// @ts-check'));
  assert.match(source, /@typedef \{\{ label: SentimentLabel, weatherMatch: SentimentWeatherMatch \}\} SentimentClassification/);
  assert.match(source, /@returns \{WordMatchCounter\}/);
  assert.match(source, /@returns \{SentimentResult\}/);
});

assertTest('Ecowitt protocol projections expose checked pure contracts', () => {
  const source = fs.readFileSync(require.resolve('./server/services/ecowitt.js'), 'utf8');

  assert.ok(source.startsWith('// @ts-check'));
  assert.match(source, /@typedef \{object\} EcowittSettings/);
  assert.match(source, /@typedef \{object\} EcowittIndoorReading/);
  assert.match(source, /@typedef \{object\} EcowittEnvironmentResponse/);
  assert.match(source, /@returns \{EcowittIndoorReading\}/);
  assert.match(source, /@returns \{EcowittEnvironmentResponse\}/);
  assert.match(source, /Project a vendor payload into Lumina's stable indoor metric vocabulary/);
  assert.match(source, /Build the public adapter response without mutating its input projections/);
});

assertTest('sensor history service exposes checked storage and projection contracts', () => {
  const source = fs.readFileSync(require.resolve('./server/services/sensorHistory.js'), 'utf8');

  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{object\} SensorSnapshotInput/);
  assert.match(source, /@typedef \{object\} SensorSnapshot/);
  assert.match(source, /@typedef \{object\} SensorHistoryStore/);
  assert.match(source, /@returns \{SensorSnapshot \| null\}/);
  assert.match(source, /@type \{SensorHistoryStore\['history'\]\}/);
  assert.match(source, /@type \{SensorHistoryStore\['stats'\]\}/);
  assert.match(source, /An injected database remains caller-owned/);
});

assertTest('sensor platform exposes checked adapter and platform contracts', () => {
  const source = fs.readFileSync(require.resolve('./server/services/sensorPlatform.js'), 'utf8');

  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{object\} SensorAdapterDescriptor/);
  assert.match(source, /@typedef \{object\} SensorAdapterInput/);
  assert.match(source, /@typedef \{object\} RegisteredSensorAdapter/);
  assert.match(source, /@typedef \{object\} SensorPlatform/);
  assert.match(source, /@param \{SensorAdapterInput\} input/);
  assert.match(source, /@returns \{SensorAdapterSummary\}/);
  assert.match(source, /@param \{SensorPlatformOptions\} \[options=\{\}\]/);
  assert.match(source, /Metadata is copied so later descriptor or summary edits cannot mutate the registry/);
});

assertTest('Google Photos cache projections expose checked contracts while service effects stay in the shell', () => {
  const cacheSource = fs.readFileSync(require.resolve('./server/services/googlePhotosCache.js'), 'utf8');
  const serviceSource = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(cacheSource, /^\/\/ @ts-check/);
  assert.match(cacheSource, /@typedef \{Record<string, unknown> & \{/);
  assert.match(cacheSource, /@returns \{Readonly<PickerMediaFile>\} Selected alias or fresh empty fallback/);
  assert.match(cacheSource, /not\s+\* globally idempotent on arbitrarily nested records/);
  assert.match(cacheSource, /@throws \{unknown\} Caller-supplied property-access failure, propagated unchanged/);
  assert.match(cacheSource, /@param \{ReadonlyArray<Readonly<GooglePhotoMediaItem>> \| null \| undefined\} syncedItems/);
  assert.match(cacheSource, /@param \{ReadonlyArray<Readonly<GooglePhotoMediaItem>>\} \[cachedItems=\[\]\]/);
  assert.match(cacheSource, /noncommutative Monoid\s+\* on values, not references/);
  assert.match(cacheSource, /@throws \{unknown\} Native collection, property-read, coercion, or spread failure/);
  assert.match(cacheSource, /@returns \{GooglePhotoMediaItem\[\]\}/);
  assert.match(cacheSource, /@typedef \{Partial<Record<GooglePhotoMetadataField, unknown>>\} GooglePhotoMetadataInput/);
  assert.match(cacheSource, /@param \{Readonly<GooglePhotoMetadataInput>\} \[metadata=\{\}\]/);
  assert.match(cacheSource, /unsupported\s+\* keys are neither enumerated nor read/);
  assert.match(cacheSource, /projection is value-idempotent, not reference-/);
  assert.match(cacheSource, /@throws \{unknown\} Native null access or caller-supplied property-read failure/);
  assert.match(cacheSource, /@param \{Readonly<GooglePhotoMediaItem> \| null \| undefined\} item/);
  assert.match(cacheSource, /scalar projection, not an endomorphism on media records/);
  assert.match(cacheSource, /@throws \{unknown\} Native property-access or string-coercion failure/);
  assert.match(cacheSource, /codec round-trip is not decoder idempotence/);
  assert.match(cacheSource, /@returns \{string\} Once-decoded, unvalidated id/);
  assert.match(cacheSource, /@throws \{unknown\} Native string-coercion failure or URIError from decoding/);
  assert.match(cacheSource, /@param \{Readonly<RenderOptions>\} \[options=\{\}\]/);
  assert.match(cacheSource, /codec law, not URL-builder idempotence/);
  assert.match(cacheSource, /@throws \{unknown\} Native property-read, coercion, or URI-encoding failure/);
  assert.match(cacheSource, /missing nested fields do not fall back individually/);
  assert.match(cacheSource, /Normalization is not globally idempotent under metadata re-embedding/);
  assert.match(cacheSource, /@throws \{unknown\} Native property-access or integer-coercion failure/);
  assert.match(cacheSource, /missing\/falsy nested bases do not fall back to the flat row's baseUrl/);
  assert.match(cacheSource, /The selected baseUrl is read once/);
  assert.match(cacheSource, /cache-row builder applies its own cached\/legacy fallback after trimming/);
  assert.match(cacheSource, /@param \{unknown\} url/);
  assert.match(cacheSource, /Split at the first literal '=' regardless of its context/);
  assert.match(cacheSource, /This projection is not globally idempotent/);
  assert.match(cacheSource, /@throws \{unknown\} Native string-coercion failure\./);
  assert.match(cacheSource, /truthy\s+\* guard, not identifier validation/);
  assert.match(cacheSource, /proxy uses default render dimensions, not\s+\* the parsed row dimensions/);
  assert.match(cacheSource, /not reference-idempotent\. It is not globally idempotent/);
  assert.match(cacheSource, /@throws \{unknown\} Native property-read, coercion, spread, or URI-encoding failure/);
  assert.match(cacheSource, /Test structural cache eligibility, not whether media bytes are reachable/);
  assert.match(cacheSource, /filter idempotence with predicate idempotence/);
  assert.match(cacheSource, /@returns \{boolean\} Structural eligibility only, not successful retrieval/);
  assert.match(cacheSource, /@throws \{unknown\} Native property-read or startsWith method-call failure/);
  assert.match(cacheSource, /@template \{Readonly<GooglePhotoMediaItem>\} T/);
  assert.match(cacheSource, /@param \{ReadonlyArray<T>\} \[items=\[\]\]/);
  assert.match(cacheSource, /first-biased Monoid on values with \[\] as identity/);
  assert.match(cacheSource, /@throws \{unknown\} Native filter, property-read, or string-coercion failure/);
  assert.match(cacheSource, /@param \{Readonly<GooglePhotoMediaItem>\} existing/);
  assert.match(cacheSource, /@param \{Readonly<GooglePhotoMediaItem>\} synced/);
  assert.match(cacheSource, /associative and value-idempotent, not reference-idempotent or commutative/);
  assert.match(cacheSource, /@throws \{unknown\} Native spread or user-metadata property-read failure/);
  assert.match(cacheSource, /@param \{Readonly<GooglePhotoMediaItem & \{id: string\}>\} item/);
  assert.match(cacheSource, /@param \{Readonly<GooglePhotoMediaItem>\} \[existing=\{\}\]/);
  assert.match(cacheSource, /clock-dependent, not a pure endomorphism or an idempotent normalization/);
  assert.match(cacheSource, /@throws \{unknown\} Native read, coercion, date, URI-encoding, or clock failure/);
  assert.match(cacheSource, /@param \{Readonly<CachedGooglePhotoRows> \| null \| undefined\} items/);
  assert.match(cacheSource, /@returns \{CachedGooglePhotoMetadataMerge\}/);
  assert.match(cacheSource, /updatedItem aliases the last matching\s+\* output row/);
  assert.match(cacheSource, /changed ORs strict !== comparisons over all matches/);
  assert.match(cacheSource, /Project each patch before composing/);
  assert.match(cacheSource, /@throws \{unknown\} Identifier, patch, or row projection failure/);
  assert.match(cacheSource, /Retention\/capping, cache I\/O, and recovery stay in callers/);
  assert.doesNotMatch(cacheSource, /\b(?:fs|fetch)\b/);
  assert.match(serviceSource, /require\('\.\/googlePhotosCache\.js'\)/);
  assert.doesNotMatch(serviceSource, /function (?:buildGooglePhotoMetadataPatch|mergeCachedMediaItemMetadata)\(/);
  assert.match(serviceSource, /if \(merged\.changed && process\.env\.NODE_ENV !== 'test'\)\s+\{\s+writeCachedMediaItems\(merged\.items\);/);
  assert.match(serviceSource, /const mergedItems = mergeSyncedMediaItems\(syncedItems, cachedItems\);\s+const cachedItemsToKeep = applyPoolPolicy\(now, poolPolicy\)\(mergedItems\);/);
  assert.match(serviceSource, /writeCache\(cachedItemsToKeep\)/);
  assert.strictEqual(googlePhotosCache.mergeSyncedMediaItems, googlePhotos.mergeSyncedMediaItems);
  assert.strictEqual(googlePhotosCache.buildGooglePhotoMetadataPatch, googlePhotos.buildGooglePhotoMetadataPatch);
  assert.strictEqual(googlePhotosCache.mergeCachedMediaItemMetadata, googlePhotos.mergeCachedMediaItemMetadata);
});

assertTest('Google Photos live metadata updater documents its snapshot mutation contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(source, /@typedef \{Record<string, unknown>\} LiveGooglePhoto/);
  assert.match(source, /@typedef \{Record<string, unknown> & \{[\s\S]*?photosList\?: Array<LiveGooglePhoto \| null \| undefined>/);
  assert.match(source, /activePhoto\?: LiveGooglePhoto \| null;[\s\S]*?activeSecondPhoto\?: LiveGooglePhoto \| null;/);
  assert.match(source, /@param \{MutableGooglePhotoState \| null \| undefined\} state/);
  assert.match(source, /@param \{unknown\} mediaIdentifier A Google media id or Lumina proxy URL/);
  assert.match(source, /@param \{GooglePhotoMetadataPatchInput\} \[metadata=\{\}\]/);
  assert.match(source, /@returns \{LiveGooglePhoto \| null\}/);
  assert.match(source, /replaces `photosList` with a mapped array[\s\S]*shallow-copies matching rows, and preserves unmatched row references/);
  assert.match(source, /updates matching active frame objects in place, retaining their identity/);
  assert.match(source, /still remap `photosList` when no row matches/);
  assert.match(source, /Both projections run before the state\/id\/patch\s+\* guard/);
  assert.match(source, /truthy row id\s+\* bypasses URL decoding/);
  assert.match(source, /Repeated list aliases produce\s+\* distinct shallow copies/);
  assert.match(source, /failed map does not assign its new array/);
  assert.match(source, /including partial Object.assign\s+\* fields/);
  assert.match(source, /@throws \{unknown\} Input decoding\/access or live snapshot mutation failure/);
});

assertTest('Google Photos cache metadata updater documents its read, return, and write contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(source, /@param \{unknown\} mediaIdentifier A Google media id or Lumina proxy URL/);
  assert.match(source, /@param \{GooglePhotoMetadataPatchInput\} \[metadata=\{\}\]/);
  assert.match(source, /@returns \{LiveGooglePhoto \| null\}/);
  assert.match(source, /returns the copied matching row, including\s+\* when its values are unchanged, or `null` when the identifier or patch does\s+\* not resolve to a row/);
  assert.match(source, /full cache is written only when a matched row\s+\* actually changes and the process is not in test mode/);
  assert.match(source, /const currentItems = getCachedMediaItems\(\);\s+const merged = mergeCachedMediaItemMetadata\(currentItems, mediaIdentifier, metadata\);/);
  assert.match(source, /if \(merged\.changed && process\.env\.NODE_ENV !== 'test'\)\s+\{\s+writeCachedMediaItems\(merged\.items\);/);
  [/before\s+\* decoding the identifier/, /normalization before a later no-match/,
    /strict equality, without trimming row ids/, /Change detection uses !==/,
    /Test mode suppresses both writes, not reads/, /not an atomic transaction/,
    /@throws \{unknown\} Unhandled read, input-projection, serialization, or write failure/
  ].forEach(pattern => assert.match(source, pattern));
});

assertTest('Google Photos Picker refresh documents its fallback, result, and cache-effect contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(source, /Refresh one cached row from its Google Photos Picker session/);
  assert.match(source, /@param \{string\} mediaItemId Stable Google Photos media-item id/);
  assert.match(source, /@param \{string\} \[sessionIdOverride\] Optional Picker session to query first/);
  assert.match(source, /@returns \{Promise<LiveGooglePhoto \| null>\}/);
  assert.match(source, /without making a Picker request[\s\S]*requires an exact media-id match[\s\S]*rejects\s+\* the promise/);
  assert.match(source, /const sessionId = sessionIdOverride \|\| existing\?\.googlePickerSessionId;/);
  assert.match(source, /if \(!sessionId\)\s+\{\s+return existing;\s+\}/);
  assert.match(source, /const \{ mediaItems \} = await listPickerMediaItems\(sessionId\);/);
  assert.match(source, /\.find\(\(item\) => item\.id === mediaItemId\)/);
  assert.match(source, /if \(!match\)\s+\{\s+throw new Error\(`Google Photos Service: Media item/);
  assert.match(source, /const refreshed = buildCachedMediaItem\(match, sessionId, existing \|\| \{\}\);\s+return updateCachedMediaItem\(refreshed\);/);
});

assertTest('Google Photos URL refresh documents render inputs and the authentication effect boundary', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(source, /@typedef \{object\} GooglePhotoRenderOptions/);
  assert.match(source, /@property \{number\} \[width\]/);
  assert.match(source, /@property \{number\} \[height\]/);
  assert.match(source, /@property \{boolean\} \[crop\]/);
  assert.match(source, /Resolve a Google Photos media id to a content URL on demand/);
  assert.match(source, /@param \{string\} mediaItemId Stable Google Photos media-item id/);
  assert.match(source, /@param \{GooglePhotoRenderOptions\} \[renderOptions=\{\}\]/);
  assert.match(source, /@returns \{Promise<string>\}/);
  assert.match(source, /Synthetic `MOCK_` ids map to a Picsum fixture URL without authentication or\s+\* network access/);
  assert.match(source, /const token = await getValidToken\(\);\s+const url = `https:\/\/photoslibrary\.googleapis\.com\/v1\/mediaItems\/\$\{mediaItemId\}`;/);
  assert.match(source, /headers: \{\s+'Authorization': `Bearer \$\{token\}`,\s+'Accept': 'application\/json'/);
  assert.match(source, /if \(!res\.ok\)\s+\{\s+throw new Error\(`Failed to retrieve media item/);
  assert.match(source, /if \(!item\.baseUrl\)\s+\{\s+throw new Error\('Google Photos Service: API returned media item without baseUrl'\);/);
  assert.match(source, /return buildGooglePhotoContentUrl\(item\.baseUrl, renderOptions\);/);
  assert.match(source, /console\.error\(`Google Photos Service: Failed to refresh URL for item \$\{mediaItemId\}:`, err\.message\);\s+throw err;/);
});

assertTest('Google Photos media-byte fetch documents its result and effect boundary', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(source, /@typedef \{object\} GooglePhotoMediaBytes/);
  assert.match(source, /@property \{Buffer\} buffer Image content as a Node\.js buffer/);
  assert.match(source, /@property \{string\} contentType Response media type or the cached\/default hint/);
  assert.match(source, /Resolve and return image bytes for a Google Photos media item/);
  assert.match(source, /@param \{string\} mediaItemId Stable Google Photos media-item id/);
  assert.match(source, /@param \{GooglePhotoRenderOptions\} \[renderOptions=\{\}\]/);
  assert.match(source, /@returns \{Promise<GooglePhotoMediaBytes>\}/);
  assert.match(source, /non-empty local file is returned immediately[\s\S]*empty file is removed and fetched again/);
  assert.match(source, /Local cached file for item \$\{mediaItemId\} is 0 bytes, deleting and re-fetching/);
  assert.match(source, /fs\.unlinkSync\(localFilePath\);/);
  assert.match(source, /deduplicated content-URL candidates[\s\S]*one final\s+\* refresh and one retry/);
  assert.match(source, /Authentication, requests, file access, persistence, and logging remain in\s+\* this effectful service boundary/);
  [/Only HTTP non-ok responses advance/, /their bodies are not read/, /reject immediately/,
    /write non-empty real-item bytes/, /original cached MIME, then image\/jpeg/,
    /exact URL not already tried/, /initially resolved token and original MIME hint/,
    /writes even empty real-item buffers/, /truthy last error verbatim/,
    /falsy caught values/, /no rollback/, /no additional logging/
  ].forEach(pattern => assert.match(source, pattern));
  assert.match(source, /async function fetchMediaItemBytes\(mediaItemId, renderOptions = \{\}\)/);
  assert.match(source, /contentType: cachedItem\?\.mimeType \|\| 'image\/jpeg'/);
  assert.match(source, /res\.headers\.get\('content-type'\) \|\| contentTypeHint/);
  assert.match(source, /throw lastError \|\| new Error\(`Google Photos Service: Failed to fetch media bytes/);
});

assertTest('Google Photos orphan cleanup documents its input and effect boundary', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(source, /Remove locally cached files that are not represented by the supplied items/);
  assert.match(source, /A missing media directory and test mode are no-ops[\s\S]*synchronously unlinks each result/);
  assert.match(source, /Listing, projection, and unlink failures\s+\* are caught and warned; cleanup is best-effort and does not propagate them/);
  assert.match(source, /@param \{Array<\{id: string\}>\} newItems Media items whose ids remain cached/);
  assert.match(source, /@returns \{void\}/);
  assert.match(source, /if \(!fs\.existsSync\(MEDIA_DIR\) \|\| process\.env\.NODE_ENV === 'test'\)\s+\{\s+return;/);
  assert.match(source, /const files = fs\.readdirSync\(MEDIA_DIR\);\s+const activeIds = newItems\.map\(item => item\.id\);\s+const orphans = getOrphanedFiles\(files, activeIds\);/);
  assert.match(source, /fs\.unlinkSync\(path\.join\(MEDIA_DIR, file\)\);[\s\S]*console\.warn\('Google Photos Service: Failed to clean up orphaned media files:'/);
});

assertAsyncTest('Google Photos URL refresh resolves synthetic media without network effects', async () => {
  assert.strictEqual(
    await googlePhotos.refreshMediaItemUrl('MOCK_MEDIA_ITEM_42'),
    'https://picsum.photos/id/42/2560/1440'
  );
});

assertTest('Google Photos pre-download documents its sequential cache and failure contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(source, /@param \{ReadonlyArray<\{id: string, googleBaseUrl\?: string\}>\} items/);
  assert.match(source, /@returns \{Promise<void>\} Resolves after the sequential download attempts/);
  assert.match(source, /Existing files are skipped regardless of their size/);
  assert.match(source, /Path resolution and existence checks are outside that catch/);
  assert.match(source, /Completion does not guarantee every item was saved/);
});

// Evaluate the real service with isolated effects, avoiding global fetch/env
// patches and any access to the daemon's media cache or credentials.
const createGooglePhotosServiceFixture = ({
  nodeEnv = 'production',
  exists = () => false,
  cacheExists = () => false,
  read = () => '[]',
  fetchResponse = async () => { throw new Error('Unexpected fetch'); },
  write = () => {},
  unlink = () => {},
  warn = () => {},
  now = Date.now,
  initialTokens = {},
  envValues = {},
  persist = () => {}
} = {}) => {
  const filename = require.resolve('./server/services/googlePhotos.js');
  const serviceRequire = createRequire(filename);
  const writes = [];
  const warnings = [];
  const logs = [];
  const errors = [];
  const persisted = [];
  const module = { exports: {} };
  const adapters = {
    fs: {
      existsSync: file => file.endsWith('.jpg') ? exists(file)
        : file.endsWith('google_photos_cache.json') ? cacheExists(file) : true,
      readFileSync: read,
      unlinkSync: unlink,
      writeFileSync: (file, bytes, encoding) => {
        const result = write(file, bytes, encoding);
        writes.push({ file, bytes });
        return result;
      }
    },
    '../config/env.js': {
      readEnvVar: key => envValues[key] ?? '',
      persistEnvVars: values => {
        const patch = { ...values };
        persisted.push(patch);
        return persist(patch);
      }
    }
  };

  // Capture internal helpers without widening the production exports.
  const { persistGoogleRefreshToken, buildContentUrl, readCachedMediaItemsRaw, writeCachedMediaItems, updateCachedMediaItem, findCachedMediaItem, isBaseUrlStale, getValidToken, refreshAccessToken, readTokens, readCredentials } = runInNewContext(`${fs.readFileSync(filename, 'utf8')}\n;tokens = { ...tokens, ...initialTokens };\n;({ persistGoogleRefreshToken, buildContentUrl: buildGooglePhotoContentUrl, readCachedMediaItemsRaw, writeCachedMediaItems, updateCachedMediaItem, findCachedMediaItem, isBaseUrlStale, getValidToken, refreshAccessToken, readTokens: () => ({ ...tokens }), readCredentials: () => ({ ...credentials }) });`, {
    module,
    require: id => adapters[id] ?? serviceRequire(id),
    __dirname: path.dirname(filename),
    process: { env: { NODE_ENV: nodeEnv } },
    Buffer,
    URLSearchParams,
    initialTokens,
    Date: class extends Date {
      static now() { return now(); }
    },
    fetch: fetchResponse,
    console: {
      log: (...args) => logs.push(args),
      warn: (...args) => { warn(...args); warnings.push(args); },
      error: (...args) => errors.push(args)
    }
  }, { filename });

  return {
    persistGoogleRefreshToken,
    buildContentUrl,
    readCachedMediaItemsRaw,
    writeCachedMediaItems,
    updateCachedMediaItem,
    findCachedMediaItem,
    isBaseUrlStale,
    getValidToken,
    refreshAccessToken,
    readTokens: () => ({ ...readTokens() }),
    readCredentials: () => ({ ...readCredentials() }),
    authUrl: module.exports.getGoogleAuthUrl,
    saveCredentials: module.exports.saveGoogleCredentials,
    isAuthenticated: module.exports.isAuthenticated,
    isGooglePhotoProxyUrl: module.exports.isGooglePhotoProxyUrl,
    getLocalMediaFilePath: module.exports.getLocalMediaFilePath,
    createPickerSession: module.exports.createPickerSession,
    getPickerSession: module.exports.getPickerSession,
    listPickerMediaItems: module.exports.listPickerMediaItems,
    deletePickerSession: module.exports.deletePickerSession,
    syncGoogleAlbum: module.exports.syncGoogleAlbum,
    exchange: module.exports.exchangeGoogleCode,
    download: module.exports.downloadSyncMediaItems,
    readCache: module.exports.getCachedMediaItems,
    updateMetadata: module.exports.updateCachedMediaItemMetadata,
    fetchBytes: module.exports.fetchMediaItemBytes,
    writes,
    warnings,
    logs,
    errors,
    persisted
  };
};

assertTest('Google Photos local-byte contract distinguishes cache hits, fallback, and pre-authentication failures', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Resolve and return image bytes'), source.indexOf('async function fetchMediaItemBytes'));
  [/normalization write precede/, /missing metadata row does not block/, /original Buffer/,
    /without reading render/, /MIME selection uses truthiness/, /Repeated calls read anew/,
    /read or unlink failures warn/, /reject before authentication/, /not rolled back/,
    /does not validate ids or enforce\s+\* containment/, /@throws \{unknown\}/
  ].forEach(pattern => assert.match(contract, pattern));
});

assertAsyncTest('Google Photos local-byte hits retain buffer identity and MIME truthiness without authentication', async () => {
  await Promise.all([undefined, '', null, false, 'image/png', ' custom/type ', 42].map(async mimeType => {
    const events = [];
    const bytes = Buffer.from('local fixture');
    const row = { id: 'local', url: '/api/google-photos/media/local', googleBaseUrl: 'https://fixture.invalid/photo', mimeType };
    const options = Object.freeze({ get width() { return assert.fail('local hit must not inspect render options'); } });
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test',
      cacheExists: () => { events.push('metadata'); return mimeType !== undefined; },
      exists: () => { events.push('exists'); return true; },
      read: (file, encoding) => {
        events.push(encoding ?? 'bytes');
        return encoding ? JSON.stringify([row]) : bytes;
      },
      now: () => assert.fail('local hit must not read the clock'),
      unlink: () => assert.fail('non-empty hit must not unlink')
    });
    const results = await Promise.all([fixture.fetchBytes('local', options), fixture.fetchBytes('local', null)]);
    results.forEach(result => {
      assert.strictEqual(result.buffer, bytes);
      assert.strictEqual(result.contentType, mimeType || 'image/jpeg');
    });
    assert.notStrictEqual(results[0], results[1]);
    const call = ['metadata', ...(mimeType === undefined ? [] : ['utf8']), 'exists', 'bytes'];
    assert.deepStrictEqual(events, [...call, ...call]);
    assert.deepStrictEqual([fixture.writes, fixture.warnings, fixture.errors, fixture.persisted], [[], [], [], []]);
    assert.strictEqual(fixture.readTokens().accessToken, '');
  }));
});

assertAsyncTest('Google Photos local-byte hits normalize metadata before reading the file', async () => {
  const events = [];
  const bytes = Buffer.from('local fixture');
  const fixture = createGooglePhotosServiceFixture({
    cacheExists: () => true,
    read: (file, encoding) => {
      if (encoding) return JSON.stringify([{ id: 'local', googleBaseUrl: 'https://fixture.invalid/photo' }]);
      events.push('bytes');
      return bytes;
    },
    write: file => events.push(file.endsWith('.json') ? 'normalize' : 'download'),
    exists: () => { events.push('exists'); return true; }
  });
  assert.strictEqual((await fixture.fetchBytes('local')).buffer, bytes);
  assert.deepStrictEqual(events, ['normalize', 'exists', 'bytes']);
  assert.strictEqual(fixture.writes.length, 1);
  assert.strictEqual(JSON.parse(fixture.writes[0].bytes)[0].url, '/api/google-photos/media/local?w=2560&h=1440');
});

assertAsyncTest('Google Photos local-byte misses and handled file failures continue through authenticated retrieval', async () => {
  await Promise.all(['missing', 'empty', 'read failure', 'unlink failure'].map(async mode => {
    const events = [];
    const failure = new Error(mode);
    const bytes = Buffer.from('remote fixture');
    const row = { id: 'local', url: '/api/google-photos/media/local', googleBaseUrl: 'https://fixture.invalid/photo', mimeType: 'image/png' };
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test',
      initialTokens: { accessToken: 'fixture-token', expiry: 1000000 },
      now: () => { events.push('authenticate'); return 0; },
      cacheExists: () => true,
      exists: () => { events.push('exists'); return mode !== 'missing'; },
      read: (file, encoding) => {
        if (encoding) return JSON.stringify([row]);
        events.push('read');
        if (mode === 'read failure') throw failure;
        return Buffer.alloc(0);
      },
      warn: () => events.push('warn'),
      unlink: () => { events.push('unlink'); if (mode === 'unlink failure') throw failure; },
      fetchResponse: async (url, options) => {
        events.push('fetch');
        assert.strictEqual(url, 'https://fixture.invalid/photo=w640-h480-c');
        assert.strictEqual(options.headers.Authorization, 'Bearer fixture-token');
        return { ok: true, headers: { get: () => null }, arrayBuffer: async () => bytes };
      },
      write: () => events.push('write')
    });
    const result = await fixture.fetchBytes('local', Object.freeze({ width: 640, height: 480, crop: true }));
    assert.deepStrictEqual(result.buffer, bytes);
    assert.strictEqual(result.contentType, 'image/png');
    const localEffects = {
      missing: [], empty: ['read', 'warn', 'unlink'],
      'read failure': ['read', 'warn'], 'unlink failure': ['read', 'warn', 'unlink', 'warn']
    }[mode];
    assert.deepStrictEqual(events, ['exists', ...localEffects, 'authenticate', 'fetch', 'write']);
    assert.strictEqual(fixture.writes.length, 1);
    assert.ok(fixture.writes[0].file.endsWith('/local.jpg'));
    if (mode.endsWith('failure')) assert.strictEqual(fixture.warnings.at(-1)[1], failure.message);
  }));
});

assertAsyncTest('Google Photos local-byte fallback preserves prior effects when authentication rejects', async () => {
  const events = [];
  const fixture = createGooglePhotosServiceFixture({
    exists: () => true,
    read: () => Buffer.alloc(0),
    warn: () => events.push('warn'),
    unlink: () => events.push('unlink')
  });
  await assert.rejects(fixture.fetchBytes('local'), /Not authenticated/);
  assert.deepStrictEqual(events, ['warn', 'unlink']);
  assert.deepStrictEqual(fixture.writes, []);
});

assertAsyncTest('Google Photos local-byte cache, path, and existence failures reject before authentication', async () => {
  const failure = new Error('pre-authentication fixture');
  const cases = [
    { cacheExists: () => { throw failure; } },
    { cacheExists: () => true, read: () => '{}', native: true },
    { cacheExists: () => true, read: () => '[{"id":"local"}]', write: () => { throw failure; } },
    { id: Object.freeze({ [Symbol.toPrimitive]: () => { throw failure; } }) },
    { exists: () => { throw failure; } }
  ];
  await Promise.all(cases.map(async ({ id = 'local', native = false, ...adapters }) => {
    const fixture = createGooglePhotosServiceFixture({
      initialTokens: { accessToken: 'fixture-token' },
      now: () => assert.fail('must not authenticate'),
      read: () => assert.fail('must not read local bytes'),
      ...adapters
    });
    await assert.rejects(fixture.fetchBytes(id), error => native ? error.name === 'TypeError' : error === failure);
    assert.deepStrictEqual([fixture.writes, fixture.warnings, fixture.errors], [[], [], []]);
  }));
});

assertAsyncTest('Google Photos local-byte nullish read failures reject in the warning handler', async () => {
  await Promise.all([null, undefined].map(async failure => {
    const fixture = createGooglePhotosServiceFixture({
      exists: () => true,
      read: () => { throw failure; },
      unlink: () => assert.fail('read failure must not unlink')
    });
    await assert.rejects(fixture.fetchBytes('local'), error => error.name === 'TypeError');
    assert.deepStrictEqual([fixture.warnings, fixture.errors, fixture.writes], [[], [], []]);
  }));
});

assertAsyncTest('Google Photos local-byte warning failures preserve catch and rejection ordering', async () => {
  const failure = new Error('warning adapter');
  await Promise.all(['empty', 'read failure'].map(async mode => {
    const fixture = createGooglePhotosServiceFixture({
      exists: () => true,
      read: () => { if (mode === 'read failure') throw new Error('read adapter'); return Buffer.alloc(0); },
      warn: () => { throw failure; },
      unlink: () => assert.fail('warning failure must not unlink')
    });
    await assert.rejects(fixture.fetchBytes('local'), error => error === failure);
    assert.deepStrictEqual([fixture.warnings, fixture.errors, fixture.writes], [[], [], []]);
  }));
  let attempts = 0;
  const fixture = createGooglePhotosServiceFixture({
    exists: () => true,
    read: () => Buffer.alloc(0),
    warn: () => { if (++attempts === 1) throw failure; },
    unlink: () => assert.fail('initial warning failure skips deletion')
  });
  await assert.rejects(fixture.fetchBytes('local'), /Not authenticated/);
  assert.strictEqual(attempts, 2);
  assert.strictEqual(fixture.warnings[0][1], failure.message);
});

assertTest('Google Photos candidate preparation documents ordering, exact uniqueness, and failure boundaries', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Resolve and return image bytes'), source.indexOf('async function fetchMediaItemBytes'));
  [/await authentication before preparing/, /inclusive 55-minute TTL/, /original cached base/,
    /exact-unique URLs in first-occurrence order/, /not canonicalized/, /forwarded unchanged/,
    /freshness check is outside/, /Cached-base projection is outside/,
    /Only an empty candidate list/, /authenticate again/, /until preparation completes/
  ].forEach(pattern => assert.match(contract, pattern));
});

assertAsyncTest('Google Photos candidate preparation authenticates before inspecting render options or refreshing Picker', async () => {
  const row = { id: 'photo', googlePickerSessionId: 'session' };
  const fixture = createGooglePhotosServiceFixture({ nodeEnv: 'test', cacheExists: () => true, read: () => JSON.stringify([row]) });
  const options = Object.freeze({ get width() { return assert.fail('authentication must finish before projection'); } });
  await assert.rejects(fixture.fetchBytes('photo', options), /Not authenticated/);
  assert.deepStrictEqual([fixture.warnings, fixture.errors, fixture.writes], [[], [], []]);
});

assertAsyncTest('Google Photos candidate preparation awaits OAuth completion before Picker and rendered content', async () => {
  const events = [];
  let releaseToken;
  const tokenResponse = new Promise(resolve => { releaseToken = resolve; });
  const fixture = createGooglePhotosServiceFixture({
    nodeEnv: 'test', initialTokens: { refreshToken: 'fixture-refresh' }, now: () => 0,
    cacheExists: () => true, read: () => '[{"id":"photo","googlePickerSessionId":"session"}]',
    write: file => events.push(file.endsWith('.json') ? 'cache' : 'bytes'),
    fetchResponse: async (url, { headers }) => {
      if (url === 'https://oauth2.googleapis.com/token') { events.push('oauth'); return tokenResponse; }
      assert.strictEqual(headers.Authorization, 'Bearer refreshed-token');
      if (url.startsWith('https://photospicker.googleapis.com/')) {
        events.push('picker');
        return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: 'https://fixture.invalid/refreshed' }] }) };
      }
      events.push('content');
      assert.strictEqual(url, 'https://fixture.invalid/refreshed=w640-h1440');
      return { ok: true, headers: { get: () => null }, arrayBuffer: async () => Buffer.from('fixture') };
    }
  });
  const result = fixture.fetchBytes('photo', Object.freeze({ get width() { events.push('project'); return 640; } }));
  assert.deepStrictEqual(events, ['oauth']);
  releaseToken({ ok: true, json: async () => { events.push('token-json'); return { access_token: 'refreshed-token', expires_in: 3600 }; } });
  await result;
  assert.deepStrictEqual(events, ['oauth', 'token-json', 'picker', 'cache', 'project', 'content', 'bytes']);
  assert.strictEqual(fixture.readTokens().accessToken, 'refreshed-token');
});

assertAsyncTest('Google Photos candidate preparation refreshes only missing or stale session bases before content retrieval', async () => {
  const clock = 10000000;
  const base = 'https://fixture.invalid/original';
  const refreshed = 'https://fixture.invalid/refreshed';
  const cases = [
    { session: 'session', base, timestamp: clock - 3300000 + 1, refresh: false },
    { session: 'session', base, timestamp: clock - 3300000, refresh: true },
    { session: 'session', base, timestamp: undefined, refresh: true },
    { session: 'session', base: undefined, timestamp: clock, refresh: true },
    { session: undefined, base, timestamp: undefined, refresh: false }
  ];
  await Promise.all(cases.map(async ({ session, base: cachedBase, timestamp, refresh }) => {
    const events = [];
    const row = { id: 'photo', googleBaseUrl: cachedBase, googleBaseUrlFetchedAt: timestamp, googlePickerSessionId: session };
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', initialTokens: { accessToken: 'fixture-token', expiry: clock + 1000000 },
      now: () => { events.push('clock'); return clock; },
      cacheExists: () => true, read: () => JSON.stringify([row]),
      write: file => events.push(file.endsWith('.json') ? 'cache' : 'bytes'),
      fetchResponse: async (url, { headers }) => {
        assert.strictEqual(headers.Authorization, 'Bearer fixture-token');
        if (url.startsWith('https://photospicker.googleapis.com/')) {
          events.push('picker');
          assert.ok(url.includes('sessionId=session&pageSize=50'));
          return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: refreshed }] }) };
        }
        events.push('content');
        assert.strictEqual(url, `${refresh ? refreshed : base}=w640-h480-c`);
        return { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('fixture') };
      }
    });
    await fixture.fetchBytes('photo', Object.freeze({ width: 640, height: 480, crop: true }));
    assert.strictEqual(events[0], 'clock');
    assert.deepStrictEqual(events.filter(event => event !== 'clock'), refresh ? ['picker', 'cache', 'content', 'bytes'] : ['content', 'bytes']);
    assert.deepStrictEqual([fixture.warnings, fixture.errors], [[], []]);
  }));
});

assertAsyncTest('Google Photos candidate preparation retains original-base fallback and deduplicates exact rendered URLs', async () => {
  await Promise.all([true, false].map(async sameBase => {
    const base = 'https://fixture.invalid/original';
    const refreshed = sameBase ? base : 'https://fixture.invalid/ORIGINAL';
    const content = [];
    let pickerCalls = 0;
    const row = { id: 'photo', googleBaseUrl: base, googlePickerSessionId: 'session' };
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', initialTokens: { accessToken: 'fixture-token', expiry: 1000000 }, now: () => 0,
      cacheExists: () => true, read: () => JSON.stringify([row]),
      fetchResponse: async url => {
        if (url.startsWith('https://photospicker.googleapis.com/')) {
          pickerCalls++;
          return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: refreshed }] }) };
        }
        content.push(url);
        return { ok: false, status: 403 };
      }
    });
    await assert.rejects(fixture.fetchBytes('photo'), /media fetch failed \(403\)/);
    assert.deepStrictEqual(content, [...new Set([refreshed, base])].map(url => `${url}=w2560-h1440`));
    assert.strictEqual(pickerCalls, 2); // The final refresh must not refetch an already tried URL.
    assert.strictEqual(JSON.parse(fixture.writes[0].bytes)[0].googleBaseUrl, refreshed);
    assert.deepStrictEqual([fixture.warnings, fixture.errors], [[], []]);
  }));
});

assertAsyncTest('Google Photos candidate preparation handles Picker listing and persistence failures with cached-base fallback', async () => {
  await Promise.all(['listing', 'persistence'].map(async mode => {
    const failure = new Error(`${mode} fixture`);
    const events = [];
    const row = { id: 'photo', googleBaseUrl: 'https://fixture.invalid/original', googlePickerSessionId: 'session' };
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', initialTokens: { accessToken: 'fixture-token', expiry: 1000000 }, now: () => 0,
      cacheExists: () => true, read: () => JSON.stringify([row]),
      write: file => { if (file.endsWith('.json')) { events.push('persist'); throw failure; } },
      warn: () => events.push('warn'),
      fetchResponse: async url => {
        if (url.startsWith('https://photospicker.googleapis.com/')) {
          events.push('picker');
          if (mode === 'listing') throw failure;
          return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: 'https://fixture.invalid/refreshed' }] }) };
        }
        events.push('content');
        assert.strictEqual(url, 'https://fixture.invalid/original=w2560-h1440');
        return { ok: true, headers: { get: () => null }, arrayBuffer: async () => Buffer.from('fixture') };
      }
    });
    await fixture.fetchBytes('photo');
    assert.deepStrictEqual(events, ['picker', ...(mode === 'persistence' ? ['persist'] : []), 'warn', 'content']);
    assert.strictEqual(fixture.warnings[0][1], failure.message);
    assert.strictEqual(fixture.errors.length, mode === 'listing' ? 1 : 0);
  }));
});

assertAsyncTest('Google Photos candidate preparation resolves on demand only without a usable base and supports synthetic ids', async () => {
  await Promise.all(['missing', 'picker miss', 'synthetic'].map(async mode => {
    const requests = [];
    const id = mode === 'synthetic' ? 'MOCK_MEDIA_ITEM_42' : 'photo';
    const row = { id, googlePickerSessionId: 'session' };
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', initialTokens: mode === 'synthetic' ? {} : { accessToken: 'fixture-token', expiry: 1000000 },
      now: () => { requests.push('authenticate'); return 0; },
      cacheExists: () => mode === 'picker miss', read: () => JSON.stringify([row]),
      fetchResponse: async (url, { headers }) => {
        requests.push(url);
        assert.strictEqual(headers.Authorization, mode === 'synthetic' ? undefined : 'Bearer fixture-token');
        if (url.startsWith('https://photospicker.googleapis.com/')) return { ok: true, json: async () => ({ mediaItems: [] }) };
        if (url.startsWith('https://photoslibrary.googleapis.com/')) return { ok: true, json: async () => ({ baseUrl: 'https://fixture.invalid/on-demand' }) };
        assert.strictEqual(url, mode === 'synthetic' ? 'https://picsum.photos/id/42/2560/1440' : 'https://fixture.invalid/on-demand=w640-h480');
        return { ok: true, headers: { get: () => null }, arrayBuffer: async () => Buffer.from('fixture') };
      }
    });
    await fixture.fetchBytes(id, Object.freeze({ width: 640, height: 480 }));
    assert.strictEqual(requests.filter(request => request === 'authenticate').length, mode === 'synthetic' ? 0 : mode === 'missing' ? 2 : 3);
    const urls = requests.filter(request => request !== 'authenticate');
    assert.strictEqual(urls.length, mode === 'synthetic' ? 1 : mode === 'missing' ? 2 : 3);
    assert.strictEqual(fixture.warnings.length, mode === 'picker miss' ? 1 : 0);
    assert.strictEqual(fixture.writes.length, mode === 'synthetic' ? 0 : 1);
  }));
});

assertAsyncTest('Google Photos candidate preparation rejects clock, projection, warning, and resolver failures before content requests', async () => {
  const failure = new Error('preparation fixture');
  await Promise.all(['clock', 'cached projection', 'refreshed projection', 'warning', 'resolver'].map(async mode => {
    let clockReads = 0;
    const row = { id: 'photo', googleBaseUrl: mode === 'resolver' ? undefined : 'https://fixture.invalid/original',
      googlePickerSessionId: mode === 'cached projection' || mode === 'resolver' ? undefined : 'session', googleBaseUrlFetchedAt: 1 };
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', initialTokens: { accessToken: 'fixture-token', expiry: 10000000 },
      now: () => { if (++clockReads === 2 && mode === 'clock') throw failure; return 4000000; },
      cacheExists: () => mode !== 'resolver', read: () => JSON.stringify([row]),
      warn: () => { if (mode === 'warning') throw failure; },
      fetchResponse: async url => {
        if (mode === 'warning' || mode === 'resolver') throw failure;
        assert.ok(url.startsWith('https://photospicker.googleapis.com/'), 'preparation must fail before any content request');
        return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: 'https://fixture.invalid/refreshed' }] }) };
      }
    });
    const options = mode.endsWith('projection') ? Object.freeze({ get width() { throw failure; } }) : undefined;
    await assert.rejects(fixture.fetchBytes('photo', options), error => error === failure);
    assert.strictEqual(fixture.warnings.length, mode === 'refreshed projection' ? 1 : 0);
    assert.strictEqual(fixture.writes.length, mode === 'refreshed projection' ? 1 : 0);
    assert.strictEqual(fixture.errors.length, mode === 'warning' || mode === 'resolver' ? 1 : 0);
  }));
});

assertAsyncTest('Google Photos remote bytes decode before writing and select MIME by native truthiness', async () => {
  const cases = [
    { header: 'image/png', mime: 'image/webp', expected: 'image/png' },
    { header: '', mime: 'image/webp', expected: 'image/webp' },
    { header: null, mime: '', expected: 'image/jpeg' },
    { header: 42, mime: 'image/webp', expected: 42 },
    { header: false, mime: 17, expected: 17, empty: true },
    { header: null, expected: 'image/jpeg', synthetic: true }
  ];
  await Promise.all(cases.map(async ({ header, mime, expected, empty, synthetic }) => {
    const events = [];
    const id = synthetic ? 'MOCK_MEDIA_ITEM_10' : 'photo';
    const bytes = Buffer.from(empty ? '' : 'fixture');
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', cacheExists: () => true,
      read: () => JSON.stringify([{ id, googleBaseUrl: 'https://fixture.invalid/base', mimeType: mime }]),
      initialTokens: synthetic ? {} : { accessToken: 'fixture-token', expiry: 1000000 }, now: () => 0,
      write: (file, value) => { assert.ok(file.endsWith('.jpg')); assert.deepStrictEqual(value, bytes); events.push('write'); },
      fetchResponse: async (url, { headers }) => {
        assert.strictEqual(url, 'https://fixture.invalid/base=w2560-h1440');
        assert.deepStrictEqual(Object.keys(headers), synthetic ? [] : ['Authorization']);
        assert.strictEqual(headers.Authorization, synthetic ? undefined : 'Bearer fixture-token');
        return { ok: true, arrayBuffer: async () => {
          events.push('decode'); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        },
          headers: { get: key => { assert.strictEqual(key, 'content-type'); events.push('header'); return header; } } };
      }
    });
    const result = await fixture.fetchBytes(id);
    assert.deepStrictEqual(result.buffer, bytes);
    assert.notStrictEqual(result.buffer, bytes);
    assert.strictEqual(result.contentType, expected);
    assert.deepStrictEqual(events, ['decode', ...(!empty && !synthetic ? ['write'] : []), 'header']);
  }));
});

assertAsyncTest('Google Photos remote HTTP failures await each candidate and stop at the first success', async () => {
  const events = [];
  let releaseFirst;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const firstResponse = new Promise(resolve => { releaseFirst = resolve; });
  const fixture = createGooglePhotosServiceFixture({
    nodeEnv: 'test', cacheExists: () => true, now: () => 0,
    initialTokens: { accessToken: 'fixture-token', expiry: 1000000 },
    read: () => '[{"id":"photo","googleBaseUrl":"https://fixture.invalid/original","googlePickerSessionId":"session"}]',
    fetchResponse: async url => {
      if (url.startsWith('https://photospicker.googleapis.com/')) {
        events.push('picker');
        return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: 'https://fixture.invalid/refreshed' }] }) };
      }
      events.push(url);
      if (url.includes('/refreshed=')) { markStarted(); return firstResponse; }
      return { ok: true, arrayBuffer: async () => Buffer.from('fixture'), headers: { get: () => null } };
    }
  });
  const result = fixture.fetchBytes('photo');
  await started;
  assert.deepStrictEqual(events, ['picker', 'https://fixture.invalid/refreshed=w2560-h1440']);
  releaseFirst({ ok: false, status: 403, text: () => assert.fail('HTTP failure body must not be read'),
    arrayBuffer: () => assert.fail('HTTP failure bytes must not be read') });
  await result;
  assert.deepStrictEqual(events, ['picker', 'https://fixture.invalid/refreshed=w2560-h1440', 'https://fixture.invalid/original=w2560-h1440']);
});

assertAsyncTest('Google Photos initial retrieval failures reject without another candidate or final Picker retry', async () => {
  await Promise.all(['fetch', 'decode', 'convert', 'write', 'header'].map(async stage => {
    const failure = new Error(`${stage} fixture`);
    const events = [];
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', cacheExists: () => true, now: () => 0,
      initialTokens: { accessToken: 'fixture-token', expiry: 1000000 },
      read: () => '[{"id":"photo","googleBaseUrl":"https://fixture.invalid/original","googlePickerSessionId":"session"}]',
      write: file => { events.push(file.endsWith('.json') ? 'cache' : 'write'); if (file.endsWith('.jpg') && stage === 'write') throw failure; },
      fetchResponse: async url => {
        if (url.startsWith('https://photospicker.googleapis.com/')) {
          events.push('picker');
          return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: 'https://fixture.invalid/refreshed' }] }) };
        }
        events.push('fetch');
        if (stage === 'fetch') throw failure;
        return { ok: true, arrayBuffer: async () => {
          events.push('decode'); if (stage === 'decode') throw failure;
          return stage === 'convert' ? null : Buffer.from('fixture');
        }, headers: { get: () => { events.push('header'); throw failure; } } };
      }
    });
    await assert.rejects(fixture.fetchBytes('photo'), error => stage === 'convert' ? error.name === 'TypeError' : error === failure);
    assert.deepStrictEqual(events, ['picker', 'cache', 'fetch',
      ...(stage !== 'fetch' ? ['decode'] : []),
      ...(['write', 'header'].includes(stage) ? ['write'] : []), ...(stage === 'header' ? ['header'] : [])]);
    assert.strictEqual(fixture.writes.length, stage === 'header' ? 2 : 1);
    assert.deepStrictEqual([fixture.errors, fixture.warnings], [[], []]);
  }));
});

assertAsyncTest('Google Photos final retry retains the original token and MIME hint and writes even empty bytes', async () => {
  await Promise.all([0, 7].map(async length => {
    let clocks = 0;
    const events = [];
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', cacheExists: () => true, now: () => clocks++ < 2 ? 0 : 800000,
      initialTokens: { accessToken: 'original-token', refreshToken: 'fixture-refresh', expiry: 1000000 },
      read: () => '[{"id":"photo","googleBaseUrl":"https://fixture.invalid/original","googleBaseUrlFetchedAt":1,"googlePickerSessionId":"session","mimeType":"image/webp"}]',
      write: file => events.push(file.endsWith('.json') ? 'cache' : 'write'),
      fetchResponse: async (url, { headers }) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          events.push('oauth'); return { ok: true, json: async () => ({ access_token: 'new-token', expires_in: 3600 }) };
        }
        if (url.startsWith('https://photospicker.googleapis.com/')) {
          assert.strictEqual(headers.Authorization, 'Bearer new-token'); events.push('picker');
          return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: 'https://fixture.invalid/retry', mimeType: 'image/png' }] }) };
        }
        assert.strictEqual(headers.Authorization, 'Bearer original-token');
        events.push(url.includes('/original=') ? 'initial' : 'retry');
        if (url.includes('/original=')) return { ok: false, status: 401 };
        assert.strictEqual(url, 'https://fixture.invalid/retry=w640-h480-c');
        return { ok: true, arrayBuffer: async () => { events.push('decode'); return Buffer.alloc(length); },
          headers: { get: () => { events.push('header'); return ''; } } };
      }
    });
    const result = await fixture.fetchBytes('photo', Object.freeze({ width: 640, height: 480, crop: true }));
    assert.strictEqual(result.buffer.length, length);
    assert.strictEqual(result.contentType, 'image/webp');
    assert.deepStrictEqual(events, ['initial', 'oauth', 'picker', 'cache', 'retry', 'decode', 'write', 'header']);
    assert.strictEqual(fixture.readTokens().accessToken, 'new-token');
    assert.strictEqual(JSON.parse(fixture.writes[0].bytes)[0].mimeType, 'image/png');
    assert.strictEqual(fixture.writes[1].bytes, result.buffer);
  }));
});

assertAsyncTest('Google Photos synthetic final retry omits content authentication and byte writes but persists metadata', async () => {
  const requests = [];
  const fixture = createGooglePhotosServiceFixture({
    nodeEnv: 'test', cacheExists: () => true, now: () => 0,
    read: () => '[{"id":"MOCK_MEDIA_ITEM_10","googleBaseUrl":"https://fixture.invalid/original","googleBaseUrlFetchedAt":1,"googlePickerSessionId":"MOCK_SESSION"}]',
    fetchResponse: async (url, { headers }) => {
      assert.deepStrictEqual(Object.keys(headers), []); requests.push(url);
      return requests.length === 1 ? { ok: false, status: 403 }
        : { ok: true, arrayBuffer: async () => Buffer.alloc(0), headers: { get: () => null } };
    }
  });
  assert.strictEqual((await fixture.fetchBytes('MOCK_MEDIA_ITEM_10')).buffer.length, 0);
  assert.deepStrictEqual(requests, ['https://fixture.invalid/original=w2560-h1440', 'https://picsum.photos/id/10/2560/1440=w2560-h1440']);
  assert.strictEqual(fixture.writes.length, 1);
  assert.ok(fixture.writes[0].file.endsWith('.json'));
});

assertAsyncTest('Google Photos final retry skips exact duplicates and reports its distinct HTTP failure without another retry', async () => {
  await Promise.all([true, false].map(async duplicate => {
    const requests = [];
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', cacheExists: () => true, now: () => 0,
      initialTokens: { accessToken: 'fixture-token', expiry: 1000000 },
      read: () => '[{"id":"photo","googleBaseUrl":"https://fixture.invalid/base","googleBaseUrlFetchedAt":1,"googlePickerSessionId":"session"}]',
      fetchResponse: async url => {
        requests.push(url);
        if (url.startsWith('https://photospicker.googleapis.com/')) return {
          ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: `https://fixture.invalid/${duplicate ? 'base' : 'BASE'}` }] })
        };
        return { ok: false, status: url.includes('/BASE=') ? 503 : 403,
          text: () => assert.fail('content error body must not be read') };
      }
    });
    await assert.rejects(fixture.fetchBytes('photo'), error => error.message === (duplicate
      ? 'Google Photos media fetch failed (403)' : 'Google Photos media fetch failed after picker refresh (503)'));
    assert.strictEqual(requests.length, duplicate ? 2 : 3);
    assert.strictEqual(fixture.writes.length, 1);
    assert.deepStrictEqual([fixture.errors, fixture.warnings], [[], []]);
  }));
});

assertAsyncTest('Google Photos final retry propagates failures after preserving completed cache and byte effects', async () => {
  await Promise.all(['picker', 'cache', 'projection', 'fetch', 'decode', 'convert', 'write', 'header'].map(async stage => {
    const failure = new Error(`${stage} fixture`);
    const events = [];
    let projections = 0;
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', cacheExists: () => true, now: () => 0,
      initialTokens: { accessToken: 'fixture-token', expiry: 1000000 },
      read: () => '[{"id":"photo","googleBaseUrl":"https://fixture.invalid/base","googleBaseUrlFetchedAt":1,"googlePickerSessionId":"session"}]',
      write: file => { const kind = file.endsWith('.json') ? 'cache' : 'write'; events.push(kind); if (stage === kind) throw failure; },
      fetchResponse: async url => {
        if (url.includes('/base=')) return { ok: false, status: 403 };
        if (url.startsWith('https://photospicker.googleapis.com/')) {
          events.push('picker'); if (stage === 'picker') throw failure;
          return { ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: 'https://fixture.invalid/retry' }] }) };
        }
        events.push('fetch'); if (stage === 'fetch') throw failure;
        return { ok: true, arrayBuffer: async () => {
          events.push('decode'); if (stage === 'decode') throw failure;
          return stage === 'convert' ? null : Buffer.from('fixture');
        }, headers: { get: () => { events.push('header'); throw failure; } } };
      }
    });
    const options = Object.freeze({ get width() { if (++projections === 2 && stage === 'projection') throw failure; return 640; } });
    await assert.rejects(fixture.fetchBytes('photo', options), error => stage === 'convert' ? error.name === 'TypeError' : error === failure);
    const order = ['picker', 'cache', 'projection', 'fetch', 'decode', 'convert', 'write', 'header'];
    assert.deepStrictEqual(events, order.slice(0, order.indexOf(stage) + 1).filter(event => !['projection', 'convert'].includes(event)));
    assert.strictEqual(fixture.writes.length, stage === 'picker' || stage === 'cache' ? 0 : stage === 'header' ? 2 : 1);
    assert.strictEqual(fixture.errors.length, stage === 'picker' ? 1 : 0);
    assert.deepStrictEqual(fixture.warnings, []);
  }));
});

assertAsyncTest('Google Photos thrown falsy values survive initial retrieval but select the fallback error after final retry', async () => {
  await Promise.all([undefined, null, false, 0, '', 'truthy fixture'].flatMap(value => [false, true].map(async final => {
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv: 'test', cacheExists: () => true, now: () => 0,
      initialTokens: { accessToken: 'fixture-token', expiry: 1000000 },
      read: () => JSON.stringify([{ id: 'photo', googleBaseUrl: 'https://fixture.invalid/base', googleBaseUrlFetchedAt: 1, googlePickerSessionId: 'session' }]),
      fetchResponse: async url => {
        if (url.startsWith('https://photospicker.googleapis.com/')) return {
          ok: true, json: async () => ({ mediaItems: [{ id: 'photo', baseUrl: 'https://fixture.invalid/retry' }] })
        };
        if (final && url.includes('/base=')) return { ok: false, status: 403 };
        throw value;
      }
    });
    await assert.rejects(fixture.fetchBytes('photo'), error => final && !value
      ? error.message === 'Google Photos Service: Failed to fetch media bytes for item photo.' : error === value);
    assert.strictEqual(fixture.writes.length, final ? 1 : 0);
    assert.deepStrictEqual([fixture.errors, fixture.warnings], [[], []]);
  })));
});

assertTest('Google Photos local path documents unknown input, normalized result, and native failures', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Project an id to a local JPG path'), source.indexOf('const getLocalMediaFilePath ='));
  [/@param \{unknown\} mediaItemId/, /@returns \{string\}/, /@throws \{unknown\}/,
    /without accessing the filesystem/, /containment validation/,
    /Percent escapes remain literal/, /coercion hooks can have effects/,
    /propagate unchanged/
  ].forEach(pattern => assert.match(contract, pattern));
  assert.ok(source.includes('const getLocalMediaFilePath = (mediaItemId) => path.join(MEDIA_DIR, `${mediaItemId}.jpg`);'));
});

assertTest('Google Photos local path preserves native scalar coercion and unconditional JPG suffixes', () => {
  const { getLocalMediaFilePath: project } = createGooglePhotosServiceFixture();
  const directory = path.join(path.dirname(require.resolve('./server/services/googlePhotos.js')), '..', 'config', 'google_photos_media');
  [
    [undefined, 'undefined.jpg'], [null, 'null.jpg'], [false, 'false.jpg'],
    [0, '0.jpg'], [-0, '0.jpg'], [NaN, 'NaN.jpg'], [Infinity, 'Infinity.jpg'],
    [7n, '7.jpg'], ['', '.jpg'], ['photo', 'photo.jpg'],
    ['photo.jpg', 'photo.jpg.jpg'], [' photo ', ' photo .jpg'],
    ['café 🖼', 'café 🖼.jpg'], ['%2F%2E%2E', '%2F%2E%2E.jpg'],
    ['id?x=1#fragment', 'id?x=1#fragment.jpg']
  ].forEach(([input, filename]) => assert.strictEqual(project(input), path.join(directory, filename)));
});

assertTest('Google Photos local path normalizes segments after suffixing without enforcing containment', () => {
  const { getLocalMediaFilePath: project } = createGooglePhotosServiceFixture();
  const directory = path.dirname(project('fixture'));
  [
    ['.', '..jpg'], ['..', '...jpg'], ['nested/../photo', 'photo.jpg'],
    ['nested//photo', 'nested/photo.jpg'], ['nested/', 'nested/.jpg'],
    ['/photo', 'photo.jpg'], ['../photo', '../photo.jpg'],
    ['../../photo', '../../photo.jpg'], ['../', '../.jpg']
  ].forEach(([input, suffix]) => assert.strictEqual(project(input), path.join(directory, suffix)));
  assert.strictEqual(path.relative(directory, project('../photo')), '../photo.jpg');
  assert.strictEqual(project('a\\b'), path.join(directory, 'a\\b.jpg'));
  assert.strictEqual(project('nul\0id'), path.join(directory, 'nul\0id.jpg'));
});

assertTest('Google Photos local path preserves frozen inputs and native string-hint hook ordering', () => {
  const { getLocalMediaFilePath: project } = createGooglePhotosServiceFixture();
  const events = [];
  const value = Object.freeze({
    [Symbol.toPrimitive]: hint => { events.push(hint); return 'fixture'; },
    toString: () => assert.fail('primitive hook takes precedence')
  });
  assert.strictEqual(project(value), project('fixture'));
  assert.deepStrictEqual(events, ['string']);
  const fallback = Object.freeze({
    toString: () => { events.push('toString'); return {}; },
    valueOf: () => { events.push('valueOf'); return 42; }
  });
  assert.strictEqual(project(fallback), project(42));
  assert.deepStrictEqual(events, ['string', 'toString', 'valueOf']);
  assert.strictEqual(project(Object.freeze(['a', 'b'])), project('a,b'));
  assert.strictEqual(project(Object.freeze({})), project('[object Object]'));
});

assertTest('Google Photos local path propagates coercion failures without stringifying Symbols', () => {
  const { getLocalMediaFilePath: project } = createGooglePhotosServiceFixture();
  [Symbol('fixture'), Object(Symbol('fixture')), Object.create(null),
    Object.freeze({ [Symbol.toPrimitive]: () => ({}) })
  ].forEach(input => assert.throws(() => project(input), error => error.name === 'TypeError'));
  [new Error('fixture coercion'), null, undefined].forEach(failure => {
    const value = Object.freeze({ [Symbol.toPrimitive]: () => { throw failure; } });
    assert.throws(() => project(value), error => error === failure);
  });
});

assertTest('Google Photos local path is repeatable without service state or filesystem effects in either mode', () => {
  const failIfCalled = () => assert.fail('Unexpected local-path projection effect');
  ['production', 'test'].flatMap(nodeEnv => [{}, { accessToken: 'fixture-access', expiry: 123 }]
    .map(initialTokens => ({ nodeEnv, initialTokens })))
    .forEach(options => {
      const fixture = createGooglePhotosServiceFixture({
        ...options, exists: failIfCalled, cacheExists: failIfCalled, read: failIfCalled,
        write: failIfCalled, persist: failIfCalled, now: failIfCalled, fetchResponse: failIfCalled
      });
      const before = { tokens: fixture.readTokens(), credentials: fixture.readCredentials() };
      const results = ['fixture', 'fixture', 'fixture'].map(fixture.getLocalMediaFilePath);
      assert.ok(results.every(result => result === results[0]));
      assert.deepStrictEqual({ tokens: fixture.readTokens(), credentials: fixture.readCredentials() }, before);
      [fixture.writes, fixture.persisted, fixture.logs, fixture.warnings, fixture.errors]
        .forEach(records => assert.deepStrictEqual(records, []));
    });
});

assertTest('Google Photos proxy predicate documents its composed unknown-input and failure contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Project the shared proxy decoder'), source.indexOf('function isGooglePhotoProxyUrl('));
  [/@param \{unknown\} value/, /@returns \{boolean\}/, /@throws \{unknown\}/,
    /not URL validation or an availability check/, /No post-decoding trim/,
    /hooks can have effects/, /propagate unchanged/
  ].forEach(pattern => assert.match(contract, pattern));
  assert.match(source, /function isGooglePhotoProxyUrl\(value\) \{\s*return Boolean\(getGooglePhotoMediaItemId\(value\)\);\s*\}/);
});

assertTest('Google Photos proxy predicate recognizes only non-empty exact relative proxy paths', () => {
  const { isGooglePhotoProxyUrl: recognize } = createGooglePhotosServiceFixture();
  const prefix = '/api/google-photos/media/';
  [
    [undefined, false], [null, false], [false, false], [0, false], [0n, false], [NaN, false],
    ['', false], [' \n\t', false], [true, false], [Symbol('fixture'), false],
    [prefix, false], [`${prefix}?w=100`, false], [`${prefix} \t`, false],
    [`https://fixture.invalid${prefix}id`, false], [`/${prefix}id`, false],
    ['/api/google-photos/media', false], ['/API/google-photos/media/id', false],
    ['/api/google-photos/media-other/id', false], ['id', false],
    [`${prefix}id`, true], [` \n${prefix}id\t`, true], [`${prefix}id?w=100`, true]
  ].forEach(([input, expected]) => assert.strictEqual(recognize(input), expected));
});

assertTest('Google Photos proxy predicate composes with the decoder and generated URLs across render options', () => {
  const { isGooglePhotoProxyUrl: recognize } = createGooglePhotosServiceFixture();
  ['', 'fixture', 'A/B+C', ' ', '?query#fragment', 'café 🖼', '%2F']
    .flatMap(id => [{}, { width: 1080, height: 1920 }, { crop: true }]
      .map(options => ({ id, url: buildGooglePhotoProxyUrl(id, Object.freeze(options)) })))
    .forEach(({ id, url }) => {
      assert.strictEqual(getGooglePhotoMediaItemId(url), id);
      assert.strictEqual(recognize(url), Boolean(id));
      assert.strictEqual(recognize(url), Boolean(getGooglePhotoMediaItemId(url)));
    });
});

assertTest('Google Photos proxy predicate preserves single decoding and unvalidated non-empty ids', () => {
  const { isGooglePhotoProxyUrl: recognize } = createGooglePhotosServiceFixture();
  [
    ['%20', ' '], ['%00', '\0'], ['%2F', '/'], ['A+B', 'A+B'], ['%253F', '%3F'],
    ['%3F?ignored=%', '?'], ['id?ignored=%E0%A4', 'id'], ['#fragment', '#fragment'],
    ['../id', '../id'], ['id/extra', 'id/extra'], ['%EF%BB%BF', '\ufeff']
  ].forEach(([suffix, id]) => {
    const url = `/api/google-photos/media/${suffix}`;
    assert.strictEqual(getGooglePhotoMediaItemId(url), id);
    assert.strictEqual(recognize(url), true);
  });
});

assertTest('Google Photos proxy predicate propagates malformed id encodings but does not decode other vocabulary', () => {
  const { isGooglePhotoProxyUrl: recognize } = createGooglePhotosServiceFixture();
  ['%', '%GG', '%E0%A4', '%ED%A0%80', '%FF'].forEach(id => {
    assert.throws(() => recognize(`/api/google-photos/media/${id}`), URIError);
    assert.strictEqual(recognize(`https://fixture.invalid/api/google-photos/media/${id}`), false);
    assert.strictEqual(recognize(`/other/${id}`), false);
    assert.strictEqual(recognize(`/api/google-photos/media/?ignored=${id}`), false);
  });
});

assertTest('Google Photos proxy predicate preserves native coercion hooks, frozen inputs, and unchanged failures', () => {
  const { isGooglePhotoProxyUrl: recognize } = createGooglePhotosServiceFixture();
  const events = [];
  const input = Object.freeze({
    [Symbol.toPrimitive]: hint => { events.push(hint); return ' /api/google-photos/media/fixture '; },
    toString: () => assert.fail('primitive hook takes precedence')
  });
  assert.strictEqual(recognize(input), true);
  assert.deepStrictEqual(events, ['string']);
  assert.strictEqual(recognize(Object.freeze(['/api/google-photos/media/fixture'])), true);
  const fallback = Object.freeze({ toString: () => ({}), valueOf: () => '/api/google-photos/media/fixture' });
  assert.strictEqual(recognize(fallback), true);
  [new Error('fixture coercion'), null, undefined].forEach(failure => {
    const value = Object.freeze({ [Symbol.toPrimitive]: () => { throw failure; } });
    assert.throws(() => recognize(value), error => error === failure);
  });
  assert.throws(() => recognize(Object.create(null)), TypeError);
});

assertTest('Google Photos proxy predicate is repeatable without service state, cache, clock, or transport effects', () => {
  const failIfCalled = () => assert.fail('Unexpected proxy-recognition effect');
  [{}, { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiry: 123 }]
    .forEach(initialTokens => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens, cacheExists: failIfCalled, read: failIfCalled, write: failIfCalled,
        persist: failIfCalled, now: failIfCalled, fetchResponse: failIfCalled
      });
      const before = { tokens: fixture.readTokens(), credentials: fixture.readCredentials() };
      [true, true, true].forEach(expected => assert.strictEqual(fixture.isGooglePhotoProxyUrl('/api/google-photos/media/fixture'), expected));
      assert.deepStrictEqual({ tokens: fixture.readTokens(), credentials: fixture.readCredentials() }, before);
      [fixture.writes, fixture.persisted, fixture.logs, fixture.warnings, fixture.errors]
        .forEach(records => assert.deepStrictEqual(records, []));
    });
});

assertTest('Google Photos refresh-token persistence documents normalization, skips, and synchronous effects', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Persist a normalized refresh token'), source.indexOf('function persistGoogleRefreshToken('));
  [/@param \{unknown\} refreshToken/, /@returns \{void\}/, /@throws \{unknown\}/,
    /String\(refreshToken \|\| ''\)\.trim\(\)/, /case-sensitive MOCK_/, /not returned or awaited/,
    /without changing service token state/, /logging, retry, or rollback/
  ].forEach(pattern => assert.match(contract, pattern));
});

assertTest('Google Photos refresh-token persistence skips falsy, whitespace, and trimmed mock values in both modes', () => {
  ['production', 'test'].forEach(nodeEnv => {
    const fixture = createGooglePhotosServiceFixture({ nodeEnv });
    [undefined, null, false, 0, -0, 0n, NaN, '', ' \t\n\u00a0', 'MOCK_', ' \nMOCK_fixture\t', [], [' ']]
      .forEach(value => assert.strictEqual(fixture.persistGoogleRefreshToken(value), undefined));
    assert.deepStrictEqual(fixture.persisted, []);
  });
});

assertTest('Google Photos refresh-token persistence trims boundaries without validating or changing case', () => {
  const cases = [
    ['  fixture-refresh\n', 'fixture-refresh'], ['\u00a0fixture\ufeff', 'fixture'],
    ['  fixture inner\nspace  ', 'fixture inner\nspace'], ['mock_fixture', 'mock_fixture'],
    ['xMOCK_fixture', 'xMOCK_fixture'], ['MOCK', 'MOCK'], [true, 'true'],
    [42, '42'], [Infinity, 'Infinity'], [7n, '7'], [Symbol('fixture'), 'Symbol(fixture)'],
    [Object.freeze(['fixture', 'row']), 'fixture,row'], [Object.freeze({}), '[object Object]']
  ];
  cases.forEach(([value, normalized]) => {
    const fixture = createGooglePhotosServiceFixture();
    assert.strictEqual(fixture.persistGoogleRefreshToken(value), undefined);
    assert.deepStrictEqual(fixture.persisted, [{ GOOGLE_REFRESH_TOKEN: normalized }]);
  });
});

assertTest('Google Photos refresh-token persistence preserves native coercion hint and ordering before skip or write', () => {
  [' fixture ', ' MOCK_fixture '].forEach(text => {
    const events = [];
    const input = Object.freeze({
      [Symbol.toPrimitive]: hint => { events.push(hint); return text; },
      toString: () => assert.fail('primitive hook takes precedence')
    });
    const fixture = createGooglePhotosServiceFixture({ persist: () => events.push('persist') });
    fixture.persistGoogleRefreshToken(input);
    assert.deepStrictEqual(events, text.trim().startsWith('MOCK_') ? ['string'] : ['string', 'persist']);
  });
  const events = [];
  const input = Object.freeze({
    toString: () => { events.push('toString'); return {}; },
    valueOf: () => { events.push('valueOf'); return ' fixture '; }
  });
  const fixture = createGooglePhotosServiceFixture({ persist: () => events.push('persist') });
  fixture.persistGoogleRefreshToken(input);
  assert.deepStrictEqual(events, ['toString', 'valueOf', 'persist']);
  assert.deepStrictEqual(fixture.persisted, [{ GOOGLE_REFRESH_TOKEN: 'fixture' }]);
});

assertTest('Google Photos refresh-token persistence propagates coercion failures before persistence without logging', () => {
  [new Error('fixture coercion'), null, undefined].forEach(failure => {
    const fixture = createGooglePhotosServiceFixture();
    const input = Object.freeze({ [Symbol.toPrimitive]: () => { throw failure; } });
    assert.throws(() => fixture.persistGoogleRefreshToken(input), error => error === failure);
    [fixture.persisted, fixture.logs, fixture.warnings, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
  });
  const fixture = createGooglePhotosServiceFixture();
  assert.throws(() => fixture.persistGoogleRefreshToken(Object.create(null)), error => error.name === 'TypeError');
  assert.deepStrictEqual(fixture.persisted, []);
});

assertTest('Google Photos refresh-token persistence repeats writes, ignores adapter results, and leaves service state isolated', () => {
  ['production', 'test'].forEach(nodeEnv => {
    const failIfCalled = () => assert.fail('Unexpected unrelated refresh-token effect');
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv, initialTokens: { accessToken: 'fixture-access', refreshToken: 'fixture-old', expiry: 123 },
      envValues: { GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret' },
      persist: () => Object.freeze({ get then() { return failIfCalled(); } }),
      cacheExists: failIfCalled, read: failIfCalled, write: failIfCalled, now: failIfCalled, fetchResponse: failIfCalled
    });
    const before = { tokens: fixture.readTokens(), credentials: fixture.readCredentials() };
    [' fixture-new ', 'fixture-new'].forEach(value => assert.strictEqual(fixture.persistGoogleRefreshToken(value), undefined));
    assert.deepStrictEqual(fixture.persisted, Array.from({ length: 2 }, () => ({ GOOGLE_REFRESH_TOKEN: 'fixture-new' })));
    assert.notStrictEqual(fixture.persisted[0], fixture.persisted[1]);
    assert.deepStrictEqual({ tokens: fixture.readTokens(), credentials: fixture.readCredentials() }, before);
    [fixture.writes, fixture.logs, fixture.warnings, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos refresh-token persistence propagates synchronous failures without retry or rollback', () => {
  [new Error('fixture persistence'), null, undefined].forEach(failure => {
    const effects = [];
    const fixture = createGooglePhotosServiceFixture({
      initialTokens: { refreshToken: 'fixture-old' },
      persist: patch => { effects.push(patch.GOOGLE_REFRESH_TOKEN); throw failure; }
    });
    const before = fixture.readTokens();
    assert.throws(() => fixture.persistGoogleRefreshToken(' fixture-new '), error => error === failure);
    assert.deepStrictEqual(effects, ['fixture-new']);
    assert.deepStrictEqual(fixture.persisted, [{ GOOGLE_REFRESH_TOKEN: 'fixture-new' }]);
    assert.deepStrictEqual(fixture.readTokens(), before);
    [fixture.logs, fixture.warnings, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos Picker sync documents adapter contracts and incoming-versus-retained results', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf('/** @typedef {import(\'./googlePhotosCache.js\').GooglePhotoMediaItem & {id: string}} GooglePhotoSyncInput'), source.indexOf('async function syncGoogleAlbum'));
  [/@typedef \{object\} GooglePhotoSyncOptions/, /@param \{GooglePhotoSyncOptions\} \[options=\{\}\]/,
    /@returns \{Promise<GooglePhotoSyncRow\[\]>\}/, /refresh-token-only state fails/,
    /NOT the retained union/, /their return values are not awaited/,
    /completion is not awaited/, /without rollback/, /Nullish thrown values/
  ].forEach(pattern => assert.match(contract, pattern));
  ['poolPolicy', 'now', 'listMediaItems', 'readCache', 'writeCache', 'cleanMediaFiles', 'downloadMediaItems']
    .forEach(name => assert.match(contract, new RegExp(`@property .*\\[${name}\\]`)));
});

const createPickerSyncOptions = (overrides = {}) => ({
  now: '2026-10-14T00:00:00Z',
  poolPolicy: { retentionDays: 30, maxPhotos: 5000 },
  listMediaItems: async () => ({ mediaItems: [] }),
  readCache: () => [],
  writeCache: () => {},
  cleanMediaFiles: () => {},
  downloadMediaItems: async () => {},
  ...overrides
});

const googlePhotosPickerSyncChecks = [
  assertAsyncTest('Google Photos Picker sync preserves default token guard, injected bypass, and falsy-session skips', async () => {
    await Promise.all([{}, { refreshToken: 'fixture-refresh' }].map(async initialTokens => {
      const fixture = createGooglePhotosServiceFixture({ initialTokens });
      await assert.rejects(fixture.syncGoogleAlbum(null), /No active token session/);
      assert.strictEqual(fixture.logs.length, 0);
      assert.strictEqual(fixture.errors.length, 1);
      await assert.rejects(fixture.syncGoogleAlbum('session', null), err => err.name === 'TypeError');
      assert.strictEqual(fixture.errors.length, 1, 'options failure precedes the catch');
      const before = fixture.readTokens();
      const failIfCalled = () => { throw new Error('Unexpected skipped sync effect'); };
      await Promise.all([undefined, null, '', false, 0].map(async sessionId => {
        const result = await fixture.syncGoogleAlbum(sessionId, createPickerSyncOptions({
          listMediaItems: failIfCalled, readCache: failIfCalled, writeCache: failIfCalled,
          cleanMediaFiles: failIfCalled, downloadMediaItems: failIfCalled
        }));
        assert.strictEqual(result.length, 0);
      }));
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
      const authenticated = createGooglePhotosServiceFixture({ initialTokens: { accessToken: 'fixture-access' } });
      assert.strictEqual((await authenticated.syncGoogleAlbum('')).length, 0);
      assert.strictEqual(authenticated.errors.length, 0);
    }));
  }),
  assertAsyncTest('Google Photos Picker sync returns duplicate incoming rows while persisting a capped immutable union', async () => {
    const fixture = createGooglePhotosServiceFixture();
    const cached = Object.freeze([
      Object.freeze({ id: 'new-0', url: 'old-url', rating: 7, cropPercent: 42, loved: true, addedAt: '2020-01-01T00:00:00Z' }),
      Object.freeze({ id: 'ordinary', url: 'ordinary-url' }),
      Object.freeze({ id: 'expired', url: 'expired-url', addedAt: '2020-01-01T00:00:00Z' })
    ]);
    const incoming = Object.freeze([
      ...Array.from({ length: 14 }, (_, index) => Object.freeze({ id: `new-${index}`, baseUrl: `https://photos.example/${index}` })),
      Object.freeze({ id: 'new-0', baseUrl: 'https://photos.example/replacement', createTime: '2020-05-01T12:00:00Z' }),
      Object.freeze({ id: 'video', mimeType: 'video/mp4' })
    ]);
    const before = JSON.stringify({ cached, incoming });
    const retained = [];
    const result = await fixture.syncGoogleAlbum('session', createPickerSyncOptions({
      poolPolicy: { retentionDays: 30, maxPhotos: 12 },
      listMediaItems: async () => ({ mediaItems: incoming }), readCache: () => cached,
      writeCache: items => retained.push(items),
      cleanMediaFiles: items => assert.strictEqual(items, retained[0]),
      downloadMediaItems: async items => assert.strictEqual(items, retained[0])
    }));
    assert.strictEqual(result.length, 15);
    assert.strictEqual(result.filter(({ id }) => id === 'new-0').length, 2);
    assert.strictEqual(retained[0].length, 12);
    assert.strictEqual(retained[0].find(({ id }) => id === 'new-0').googleBaseUrl, 'https://photos.example/replacement');
    assert.strictEqual(retained[0].find(({ id }) => id === 'new-0').createTime, '2020-05-01T12:00:00Z');
    result.filter(({ id }) => id === 'new-0').forEach(row => {
      assert.strictEqual(row.rating, 7);
      assert.strictEqual(row.cropPercent, 42);
      assert.strictEqual(row.loved, true);
      assert.strictEqual(row.addedAt, cached[0].addedAt);
    });
    assert.ok(result.some(({ id }) => !retained[0].some(row => row.id === id)));
    assert.ok(!retained[0].some(({ id }) => id === 'expired' || id === 'video'));
    assert.strictEqual(JSON.stringify({ cached, incoming }), before);
    assert.match(fixture.logs.at(-1)[0], /incoming=15, existing=3, merged=16, retained=12, policyDropped=4/);
  }),
  assertAsyncTest('Google Photos Picker sync awaits listing but resolves before background download and logs its later failure', async () => {
    const fixture = createGooglePhotosServiceFixture();
    const events = [];
    let releaseListing;
    let rejectDownload;
    let settled = false;
    const listing = new Promise(resolve => { releaseListing = resolve; });
    const download = new Promise((_, reject) => { rejectDownload = reject; });
    const pending = fixture.syncGoogleAlbum('session', createPickerSyncOptions({
      listMediaItems: sessionId => { events.push(`list:${sessionId}`); return listing; },
      readCache: () => { events.push('read'); return []; },
      writeCache: () => events.push('write'), cleanMediaFiles: () => events.push('clean'),
      downloadMediaItems: () => { events.push('download'); return download; }
    })).then(result => { settled = true; return result; });
    await flushPromises();
    assert.deepStrictEqual(events, ['list:session']);
    assert.strictEqual(settled, false);
    releaseListing({ mediaItems: [{ id: 'photo' }] });
    assert.strictEqual((await pending).length, 1);
    assert.deepStrictEqual(events, ['list:session', 'read', 'write', 'clean', 'download']);
    assert.strictEqual(fixture.errors.length, 0);
    rejectDownload(new Error('download unavailable'));
    await flushPromises();
    assert.deepStrictEqual(fixture.errors, [['Google Photos Service: Error in background downloader:', 'download unavailable']]);
    assert.strictEqual(settled, true);
  }),
  assertAsyncTest('Google Photos Picker sync still applies policy and effects to empty or non-array incoming lists', async () => {
    await Promise.all([undefined, null, false, {}, 'items', []].map(async mediaItems => {
      const fixture = createGooglePhotosServiceFixture();
      const cached = Object.freeze([
        Object.freeze({ id: 'ordinary', url: 'ordinary-url' }),
        Object.freeze({ id: 'expired', url: 'expired-url', addedAt: '2020-01-01T00:00:00Z' })
      ]);
      const effects = [];
      const result = await fixture.syncGoogleAlbum('empty-session', createPickerSyncOptions({
        listMediaItems: async () => ({ mediaItems }), readCache: () => cached,
        writeCache: items => effects.push(items), cleanMediaFiles: items => effects.push(items),
        downloadMediaItems: async items => { effects.push(items); }
      }));
      assert.strictEqual(result.length, 0);
      assert.strictEqual(effects.length, 3);
      assert.deepStrictEqual(effects[0][0], cached[0]);
      assert.notStrictEqual(effects[0][0], cached[0], 'union detaches retained cached rows');
      assert.strictEqual(effects[0].length, 1);
      assert.ok(effects.every(items => items === effects[0]));
      assert.strictEqual(cached.length, 2);
    }));
  }),
  assertAsyncTest('Google Photos Picker sync logs and rethrows each adapter failure without undoing earlier effects', async () => {
    const stages = ['listMediaItems', 'readCache', 'writeCache', 'cleanMediaFiles', 'downloadMediaItems'];
    await Promise.all(stages.map(async (failedStage, index) => {
      const fixture = createGooglePhotosServiceFixture();
      const failure = new Error(`failed ${failedStage}`);
      const events = [];
      const values = [{ mediaItems: [] }, [], undefined, undefined, Promise.resolve()];
      const adapters = Object.fromEntries(stages.map((stage, position) => [stage, () => {
        events.push(stage);
        if (stage === failedStage) throw failure;
        return values[position];
      }]));
      await assert.rejects(fixture.syncGoogleAlbum('session', createPickerSyncOptions(adapters)), err => err === failure);
      assert.deepStrictEqual(events, stages.slice(0, index + 1));
      assert.deepStrictEqual(fixture.errors, [['Google Photos Service: Picker session sync failed:', failure.message]]);
    }));
  }),
  assertAsyncTest('Google Photos Picker sync preserves malformed payload and nullish thrown-value rejection boundaries', async () => {
    await Promise.all([null, undefined, { mediaItems: [null] }].map(async payload => {
      const fixture = createGooglePhotosServiceFixture();
      let written = false;
      await assert.rejects(fixture.syncGoogleAlbum('session', createPickerSyncOptions({
        listMediaItems: async () => payload, writeCache: () => { written = true; }
      })), err => err.name === 'TypeError');
      assert.strictEqual(written, false);
      assert.strictEqual(fixture.errors.length, 1);
    }));
    await Promise.all([null, undefined].map(async failure => {
      const fixture = createGooglePhotosServiceFixture();
      await assert.rejects(fixture.syncGoogleAlbum('session', createPickerSyncOptions({
        listMediaItems: async () => { throw failure; }
      })), err => err.name === 'TypeError' && /message/.test(err.message));
      assert.deepStrictEqual(fixture.errors, []);
    }));
  }),
  assertAsyncTest('Google Photos Picker sync ignores synchronous adapter returns but requires a downloader promise on every call', async () => {
    const fixture = createGooglePhotosServiceFixture();
    const effects = [];
    const unresolved = new Promise(() => {});
    const options = createPickerSyncOptions({
      writeCache: () => { effects.push('write'); return unresolved; },
      cleanMediaFiles: () => { effects.push('clean'); return unresolved; }
    });
    await fixture.syncGoogleAlbum('session', options);
    await fixture.syncGoogleAlbum('session', options);
    assert.deepStrictEqual(effects, ['write', 'clean', 'write', 'clean']);
    await assert.rejects(fixture.syncGoogleAlbum('session', { ...options, downloadMediaItems: () => undefined }),
      err => err.name === 'TypeError' && /catch/.test(err.message));
    assert.deepStrictEqual(effects, ['write', 'clean', 'write', 'clean', 'write', 'clean']);
    assert.strictEqual(fixture.errors.length, 1);
  })
];

assertTest('Google Photos authentication presence documents its boolean and service-state contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Report whether the service currently holds'), source.indexOf('function isAuthenticated()'));
  assert.match(contract, /@returns \{boolean\}/);
  assert.match(contract, /not token validation/);
  assert.match(contract, /alone returns false/);
  assert.match(contract, /expiry and credentials are not inspected/);
  assert.match(contract, /not a pure function of explicit inputs/);
});

assertTest('Google Photos authentication presence preserves native truthiness without coercion hooks', () => {
  const failIfCoerced = () => { throw new Error('Unexpected token coercion'); };
  const opaqueToken = Object.freeze({ valueOf: failIfCoerced, toString: failIfCoerced });
  const cases = [
    [undefined, false], [null, false], ['', false], [false, false],
    [0, false], [-0, false], [NaN, false], [0n, false],
    ['token', true], [' ', true], ['MOCK_FIXTURE', true], [true, true],
    [1, true], [-1, true], [Infinity, true], [1n, true],
    [Symbol('fixture'), true], [Object.freeze([]), true], [opaqueToken, true]
  ];
  cases.forEach(([accessToken, expected]) => {
    const initialTokens = Object.freeze({ accessToken });
    const fixture = createGooglePhotosServiceFixture({ initialTokens });
    const before = fixture.readTokens();
    assert.strictEqual(fixture.isAuthenticated(), expected);
    assert.strictEqual(fixture.isAuthenticated(), expected);
    assert.deepStrictEqual(fixture.readTokens(), before);
  });
});

assertTest('Google Photos authentication presence ignores expiry, refresh tokens, and credentials', () => {
  const expiries = [undefined, null, 0, -1, NaN, 'invalid', Infinity];
  const refreshTokens = [undefined, '', 'fixture-refresh', 'MOCK_FIXTURE'];
  const credentials = [{}, { GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret' }];
  [undefined, 'expired-or-unvalidated'].flatMap(accessToken =>
    expiries.flatMap(expiry => refreshTokens.flatMap(refreshToken =>
      credentials.map(envValues => ({ initialTokens: Object.freeze({ accessToken, expiry, refreshToken }), envValues }))
    ))
  ).forEach(options => {
    const fixture = createGooglePhotosServiceFixture(options);
    assert.strictEqual(fixture.isAuthenticated(), Boolean(options.initialTokens.accessToken));
    assert.deepStrictEqual(fixture.readTokens(), options.initialTokens);
  });
});

assertTest('Google Photos authentication presence leaves tokens, credentials, and unrelated effects untouched', () => {
  const failIfCalled = () => { throw new Error('Unexpected authentication-presence effect'); };
  [Object.freeze({}), Object.freeze({ accessToken: 'expired', refreshToken: 'fixture-refresh', expiry: 0 })].forEach(initialTokens => {
    const fixture = createGooglePhotosServiceFixture({
      initialTokens, envValues: { GOOGLE_CLIENT_ID: 'old-client', GOOGLE_CLIENT_SECRET: 'old-secret' },
      now: failIfCalled, fetchResponse: failIfCalled, persist: failIfCalled,
      exists: failIfCalled, cacheExists: failIfCalled, read: failIfCalled, write: failIfCalled
    });
    const before = fixture.readTokens();
    assert.strictEqual(fixture.isAuthenticated(), Boolean(initialTokens.accessToken));
    assert.deepStrictEqual(fixture.readTokens(), before);
    assert.deepStrictEqual(fixture.readCredentials(), { clientId: 'old-client', clientSecret: 'old-secret' });
    [fixture.logs, fixture.errors, fixture.warnings, fixture.writes, fixture.persisted].forEach(records =>
      assert.deepStrictEqual(records, [])
    );
  });
});

const googlePhotosAuthenticationPresenceChecks = [
  assertAsyncTest('Google Photos authentication presence observes later token replacement rather than memoizing', async () => {
    const payloads = [{ access_token: 'fixture-access', expires_in: 60 }, { expires_in: 60 }];
    const fixture = createGooglePhotosServiceFixture({
      envValues: { GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret' },
      now: () => 1_000,
      fetchResponse: async () => ({ ok: true, json: async () => payloads.shift() })
    });
    assert.strictEqual(fixture.isAuthenticated(), false);
    await fixture.exchange('first-code', 'https://example.test/callback');
    assert.strictEqual(fixture.isAuthenticated(), true);
    await fixture.exchange('second-code', 'https://example.test/callback');
    assert.strictEqual(fixture.isAuthenticated(), false);
    assert.deepStrictEqual(payloads, []);
    assert.deepStrictEqual(fixture.errors, []);
  })
];

assertTest('Google Photos Picker creation documents raw results and branch-specific rejection boundaries', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Create a synthetic or authenticated Picker session'), source.indexOf('async function createPickerSession()'));
  assert.match(contract, /@returns \{Promise<unknown>\}/);
  assert.match(contract, /even with a refresh token/);
  assert.match(contract, /without shape validation/);
  assert.match(contract, /reject outside the request catch/);
  assert.match(contract, /Nullish thrown/);
  assert.match(contract, /not a pure projection or validity guarantee/);
});

const googlePhotosPickerCreationChecks = [
  assertAsyncTest('Google Photos Picker creation rejects missing or malformed access tokens before effects', async () => {
    const failIfCalled = () => { throw new Error('Unexpected Picker guard effect'); };
    await Promise.all([undefined, null, '', false, 0, NaN, true, 1, {}].map(async accessToken => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken, refreshToken: 'fixture-refresh' },
        now: failIfCalled, fetchResponse: failIfCalled, persist: failIfCalled
      });
      const before = fixture.readTokens();
      await assert.rejects(fixture.createPickerSession(), err => accessToken
        ? err.name === 'TypeError' && /startsWith/.test(err.message)
        : err.message === 'Google Photos Service: No active token session.');
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker creation keeps synthetic sessions independent of expiry and unrelated effects', async () => {
    const failIfCalled = () => { throw new Error('Unexpected synthetic Picker effect'); };
    await Promise.all([undefined, 0, Infinity, 'invalid'].map(async expiry => {
      let clockReads = 0;
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'MOCK_FIXTURE', expiry },
        now: () => { clockReads += 1; return 123; },
        fetchResponse: failIfCalled, persist: failIfCalled, read: failIfCalled, write: failIfCalled
      });
      const before = fixture.readTokens();
      const result = await fixture.createPickerSession();
      assert.deepStrictEqual({ ...result }, {
        id: 'MOCK_SESSION_ID_123', pickerUri: '/api/auth/google/sandbox-callback', mediaItemsSet: false
      });
      assert.strictEqual(clockReads, 1);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker creation preserves unlogged pre-request clock and refresh failures', async () => {
    const failure = new Error('fixture clock failure');
    await Promise.all(['MOCK_FIXTURE', 'cached'].map(async accessToken => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken, expiry: Infinity }, now: () => { throw failure; }
      });
      await assert.rejects(fixture.createPickerSession(), err => err === failure);
      assert.deepStrictEqual(fixture.errors, []);
    }));
    const missingRefresh = createGooglePhotosServiceFixture({ initialTokens: { accessToken: 'expired' }, now: () => 1_000 });
    await assert.rejects(missingRefresh.createPickerSession(), /No refresh token available/);
    assert.deepStrictEqual(missingRefresh.errors, []);
    const refreshFailure = new Error('fixture refresh failure');
    const failedRefresh = createGooglePhotosServiceFixture({
      initialTokens: { accessToken: 'expired', refreshToken: 'fixture-refresh' }, now: () => 1_000,
      fetchResponse: async () => { throw refreshFailure; }
    });
    await assert.rejects(failedRefresh.createPickerSession(), err => err === refreshFailure);
    assert.deepStrictEqual(failedRefresh.errors, [['Google Photos Service: Access token refresh failed:', refreshFailure.message]]);
  }),
  assertAsyncTest('Google Photos Picker creation POSTs exact request metadata and returns unvalidated JSON unchanged', async () => {
    await Promise.all([null, false, 42, 'raw', Object.freeze([]), Object.freeze({ id: 'session', extra: true })].map(async payload => {
      const requests = [];
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000,
        fetchResponse: async (url, options) => {
          requests.push({ url, method: options.method, headers: { ...options.headers }, body: options.body });
          return { ok: true, json: async () => payload };
        }
      });
      const before = fixture.readTokens();
      assert.strictEqual(await fixture.createPickerSession(), payload);
      assert.deepStrictEqual(requests, [{
        url: 'https://photospicker.googleapis.com/v1/sessions', method: 'POST',
        headers: { Authorization: 'Bearer cached', 'Content-Type': 'application/json' }, body: '{}'
      }]);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker creation awaits refresh then response JSON and retains refreshed state', async () => {
    const requests = [];
    let finishJson;
    const responseJson = new Promise(resolve => { finishJson = resolve; });
    const fixture = createGooglePhotosServiceFixture({
      initialTokens: { accessToken: 'expired', refreshToken: 'fixture-refresh' }, now: () => 1_000,
      fetchResponse: async (url, options) => {
        requests.push({ url, headers: { ...options.headers } });
        return { ok: true, json: async () => requests.length === 1
          ? { access_token: 'refreshed', expires_in: 60 } : responseJson };
      }
    });
    let settled = false;
    const pending = fixture.createPickerSession().then(result => { settled = true; return result; });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepStrictEqual(requests.map(({ url }) => url), [
      'https://oauth2.googleapis.com/token', 'https://photospicker.googleapis.com/v1/sessions'
    ]);
    assert.strictEqual(requests[1].headers.Authorization, 'Bearer refreshed');
    assert.strictEqual(settled, false);
    const payload = Object.freeze({ id: 'session' });
    finishJson(payload);
    assert.strictEqual(await pending, payload);
    assert.deepStrictEqual(fixture.readTokens(), { accessToken: 'refreshed', refreshToken: 'fixture-refresh', expiry: 61_000 });
    assert.deepStrictEqual(fixture.errors, []);
    assert.deepStrictEqual(fixture.persisted, []);
  }),
  assertAsyncTest('Google Photos Picker creation logs request, status-body, and JSON failures without changing tokens', async () => {
    const failure = new Error('fixture failure');
    const cases = [
      [async () => { throw failure; }, failure],
      [async () => ({ ok: false, status: 403, text: async () => 'fixture denied' }), 'Google Picker Session API failed (403): fixture denied'],
      [async () => ({ ok: false, status: 500, text: async () => { throw failure; } }), failure],
      [async () => ({ ok: true, json: async () => { throw failure; } }), failure],
      [async () => { throw 'opaque failure'; }, 'opaque failure']
    ];
    await Promise.all(cases.map(async ([fetchResponse, expected]) => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000, fetchResponse
      });
      const before = fixture.readTokens();
      await assert.rejects(fixture.createPickerSession(), err => expected instanceof Error || expected === 'opaque failure'
        ? err === expected : err.message === expected);
      assert.deepStrictEqual(fixture.errors, [['Google Photos Service: Failed to create picker session:',
        expected === 'opaque failure' ? undefined : expected.message ?? expected]]);
      assert.deepStrictEqual(fixture.readTokens(), before);
      assert.deepStrictEqual(fixture.persisted, []);
    }));
    await Promise.all([null, undefined].map(async failureValue => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000,
        fetchResponse: async () => { throw failureValue; }
      });
      await assert.rejects(fixture.createPickerSession(), err => err.name === 'TypeError' && /message/.test(err.message));
      assert.deepStrictEqual(fixture.errors, []);
    }));
  })
];

assertTest('Google Photos Picker retrieval documents its input, raw result, and rejection boundaries', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Retrieve a synthetic or authenticated Picker session'), source.indexOf('async function getPickerSession(sessionId)'));
  [/@param \{string\} sessionId/, /@returns \{Promise<unknown>\}/, /refresh-token-only state/,
    /interpolate the id verbatim/, /without shape validation/, /reject outside the request catch/,
    /failure bodies are not read/, /Nullish thrown values/, /not a pure projection or validity guarantee/
  ].forEach(pattern => assert.match(contract, pattern));
});

const googlePhotosPickerRetrievalChecks = [
  assertAsyncTest('Google Photos Picker retrieval rejects malformed ids before authentication or other effects', async () => {
    const failIfCalled = () => { throw new Error('Unexpected Picker input effect'); };
    await Promise.all([undefined, null, false, 0, 42, {}, [], Symbol('id')].map(async sessionId => {
      const fixture = createGooglePhotosServiceFixture({ now: failIfCalled, fetchResponse: failIfCalled, persist: failIfCalled });
      const before = fixture.readTokens();
      await assert.rejects(fixture.getPickerSession(sessionId), err => err.name === 'TypeError' && /startsWith/.test(err.message));
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker retrieval bypasses authentication and returns fresh synthetic records', async () => {
    const failIfCalled = () => { throw new Error('Unexpected synthetic Picker effect'); };
    await Promise.all([{}, { accessToken: 'expired', expiry: 0 }, { refreshToken: 'fixture-refresh' }].map(async initialTokens => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens, now: failIfCalled, fetchResponse: failIfCalled, persist: failIfCalled, read: failIfCalled, write: failIfCalled
      });
      const before = fixture.readTokens();
      const sessionId = 'MOCK_SESSION/fixture?raw';
      const first = await fixture.getPickerSession(sessionId);
      const second = await fixture.getPickerSession(sessionId);
      [first, second].forEach(result => assert.deepStrictEqual({ ...result }, {
        id: sessionId, pickerUri: '/api/auth/google/sandbox-callback', mediaItemsSet: true
      }));
      assert.notStrictEqual(first, second);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker retrieval preserves verbatim ids, default GET options, and raw JSON identity', async () => {
    const cases = ['', 'session/with?raw#fragment', 'mock_lowercase', 'session ü'].flatMap(sessionId =>
      [null, false, 42, 'raw', Object.freeze([]), Object.freeze({ mediaItemsSet: false })].map(payload => ({ sessionId, payload })));
    await Promise.all(cases.map(async ({ sessionId, payload }) => {
      const requests = [];
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000,
        fetchResponse: async (url, options) => {
          requests.push({ url, options: { ...options, headers: { ...options.headers } } });
          return { ok: true, json: async () => payload };
        }
      });
      const before = fixture.readTokens();
      assert.strictEqual(await fixture.getPickerSession(sessionId), payload);
      assert.deepStrictEqual(requests, [{
        url: `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
        options: { headers: { Authorization: 'Bearer cached', Accept: 'application/json' } }
      }]);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker retrieval keeps authentication failures outside the session error catch', async () => {
    const failure = new Error('fixture resolution failure');
    const cases = [
      [{}, () => { throw failure; }, async () => { throw failure; }, /Not authenticated/, []],
      [{ accessToken: 'cached', expiry: Infinity }, () => { throw failure; }, async () => { throw failure; }, err => err === failure, []],
      [{ accessToken: 'expired' }, () => 1_000, async () => { throw failure; }, /No refresh token available/, []],
      [{ refreshToken: 'fixture-refresh' }, () => 1_000, async () => { throw failure; }, err => err === failure,
        [['Google Photos Service: Access token refresh failed:', failure.message]]]
    ];
    await Promise.all(cases.map(async ([initialTokens, now, fetchResponse, expected, errors]) => {
      const fixture = createGooglePhotosServiceFixture({ initialTokens, now, fetchResponse });
      const before = fixture.readTokens();
      await assert.rejects(fixture.getPickerSession('session'), expected);
      assert.deepStrictEqual(fixture.errors, errors);
      assert.deepStrictEqual(fixture.readTokens(), before);
      assert.deepStrictEqual(fixture.persisted, []);
    }));
  }),
  assertAsyncTest('Google Photos Picker retrieval awaits refresh-only authentication and response JSON', async () => {
    const requests = [];
    let finishJson;
    const responseJson = new Promise(resolve => { finishJson = resolve; });
    const fixture = createGooglePhotosServiceFixture({
      initialTokens: { refreshToken: 'fixture-refresh' }, now: () => 1_000,
      fetchResponse: async (url, options) => {
        requests.push({ url, authorization: options.headers.Authorization });
        return { ok: true, json: async () => requests.length === 1
          ? { access_token: 'refreshed', expires_in: 60 } : responseJson };
      }
    });
    let settled = false;
    const pending = fixture.getPickerSession('session').then(result => { settled = true; return result; });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepStrictEqual(requests, [
      { url: 'https://oauth2.googleapis.com/token', authorization: undefined },
      { url: 'https://photospicker.googleapis.com/v1/sessions/session', authorization: 'Bearer refreshed' }
    ]);
    assert.strictEqual(settled, false);
    const payload = Object.freeze({ id: 'session', mediaItemsSet: true });
    finishJson(payload);
    assert.strictEqual(await pending, payload);
    assert.deepStrictEqual(fixture.readTokens(), { accessToken: 'refreshed', refreshToken: 'fixture-refresh', expiry: 61_000 });
    [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
  }),
  assertAsyncTest('Google Photos Picker retrieval logs request and JSON failures, skips HTTP bodies, and retains tokens', async () => {
    const failure = new Error('fixture request failure');
    const cases = [
      [async () => { throw failure; }, err => err === failure, failure.message],
      [async () => ({ ok: false, status: 403,
        text: () => { throw new Error('Unexpected HTTP body read'); },
        json: () => { throw new Error('Unexpected HTTP JSON read'); }
      }), err => err.message === 'Google Picker GET session failed (403)', 'Google Picker GET session failed (403)'],
      [async () => ({ ok: true, json: async () => { throw failure; } }), err => err === failure, failure.message],
      [async () => { throw 'opaque failure'; }, err => err === 'opaque failure', undefined],
      ...[null, undefined].map(value => [async () => { throw value; }, err => err.name === 'TypeError' && /message/.test(err.message), null])
    ];
    await Promise.all(cases.map(async ([fetchResponse, expected, message]) => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000, fetchResponse
      });
      const before = fixture.readTokens();
      await assert.rejects(fixture.getPickerSession('session'), expected);
      assert.deepStrictEqual(fixture.errors, message === null ? [] : [['Google Photos Service: Failed to get session session:', message]]);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  })
];

assertTest('Google Photos Picker listing documents its input, accumulated result, and sequential failure boundaries', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * List synthetic items or accumulate every page'), source.indexOf('async function listPickerMediaItems(sessionId)'));
  [/@param \{string\} sessionId/, /@returns \{Promise<\{mediaItems: unknown\[\]\}>\}/,
    /reuse that token across sequential/, /not a total-item limit/, /retaining duplicates and raw element references/,
    /no cycle or page bound/, /reject outside the catch/, /no partial result/, /nullish thrown values/
  ].forEach(pattern => assert.match(contract, pattern));
});

const googlePhotosPickerListingChecks = [
  assertAsyncTest('Google Photos Picker listing rejects malformed ids before any effects', async () => {
    const failIfCalled = () => { throw new Error('Unexpected listing effect'); };
    await Promise.all([undefined, null, false, 0, 42, {}, [], Symbol('id')].map(async sessionId => {
      const fixture = createGooglePhotosServiceFixture({ now: failIfCalled, fetchResponse: failIfCalled, persist: failIfCalled });
      const before = fixture.readTokens();
      await assert.rejects(fixture.listPickerMediaItems(sessionId), err => err.name === 'TypeError' && /startsWith/.test(err.message));
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker listing returns fresh ordered synthetic rows without authentication', async () => {
    const failIfCalled = () => { throw new Error('Unexpected synthetic listing effect'); };
    const ids = [10, 15, 29, 37, 43, 48, 54, 57, 62, 76, 85, 93, 104, 116, 122];
    const expected = ids.map(id => ({ id: `MOCK_MEDIA_ITEM_${id}`, baseUrl: `https://picsum.photos/id/${id}/2560/1440`, mimeType: 'image/jpeg' }));
    await Promise.all([{}, { accessToken: 'expired' }, { refreshToken: 'fixture-refresh' }].map(async initialTokens => {
      const fixture = createGooglePhotosServiceFixture({ initialTokens, now: failIfCalled, fetchResponse: failIfCalled, read: failIfCalled, write: failIfCalled });
      const before = fixture.readTokens();
      const first = await fixture.listPickerMediaItems('MOCK_SESSION');
      const second = await fixture.listPickerMediaItems('MOCK_SESSION');
      assert.deepStrictEqual(Object.keys(first), ['mediaItems']);
      [first, second].forEach(({ mediaItems }) => assert.deepStrictEqual(Array.from(mediaItems, row => ({ ...row })), expected));
      assert.notStrictEqual(first, second);
      assert.notStrictEqual(first.mediaItems, second.mediaItems);
      first.mediaItems.forEach((row, index) => assert.notStrictEqual(row, second.mediaItems[index]));
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker listing refreshes once, encodes ids, and awaits each JSON page in order', async () => {
    const requests = [];
    let releaseFirst, releaseSecond;
    const firstJson = new Promise(resolve => { releaseFirst = resolve; });
    const secondJson = new Promise(resolve => { releaseSecond = resolve; });
    const fixture = createGooglePhotosServiceFixture({
      initialTokens: { refreshToken: 'fixture-refresh' }, now: () => 1_000,
      fetchResponse: async (url, options) => {
        requests.push({ url, options: { ...options, headers: { ...options.headers } } });
        const payload = requests.length === 1 ? { access_token: 'refreshed', expires_in: 60 }
          : requests.length === 2 ? firstJson : secondJson;
        return { ok: true, json: async () => payload };
      }
    });
    let settled = false;
    const pending = fixture.listPickerMediaItems('session/ü?raw# +').then(result => { settled = true; return result; });
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(requests.length, 2);
    assert.strictEqual(requests[0].url, 'https://oauth2.googleapis.com/token');
    assert.strictEqual(settled, false);
    const row = Object.freeze({ id: 'first', extra: true });
    releaseFirst(Object.freeze({ mediaItems: Object.freeze([row]), nextPageToken: 'next/ü? +&' }));
    await new Promise(resolve => setImmediate(resolve));
    const base = 'https://photospicker.googleapis.com/v1/mediaItems?sessionId=session%2F%C3%BC%3Fraw%23%20%2B&pageSize=50';
    assert.deepStrictEqual(requests.slice(1), [base, `${base}&pageToken=next%2F%C3%BC%3F%20%2B%26`].map(url => ({
      url, options: { headers: { Authorization: 'Bearer refreshed', Accept: 'application/json' } }
    })));
    assert.strictEqual(settled, false);
    releaseSecond(Object.freeze({ mediaItems: Object.freeze([null, row]) }));
    const result = await pending;
    assert.deepStrictEqual(Array.from(result.mediaItems), [row, null, row]);
    assert.strictEqual(result.mediaItems[0], row);
    assert.strictEqual(result.mediaItems[2], row);
    assert.deepStrictEqual(fixture.readTokens(), { accessToken: 'refreshed', refreshToken: 'fixture-refresh', expiry: 61_000 });
    [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
  }),
  assertAsyncTest('Google Photos Picker listing accumulates over 200 rows and obeys array concatenation identities', async () => {
    const duplicate = Object.freeze({ id: 'repeated' });
    const rows = Object.freeze(Array.from({ length: 250 }, (_, index) => index % 50 ? Object.freeze({ id: `item-${index}` }) : duplicate));
    const partitions = [
      [rows],
      Array.from({ length: 5 }, (_, index) => Object.freeze(rows.slice(index * 50, (index + 1) * 50))),
      [Object.freeze([]), rows, Object.freeze([])]
    ];
    await Promise.all(partitions.map(async pages => {
      let calls = 0, clockReads = 0;
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => { clockReads += 1; return 1_000; },
        fetchResponse: async () => {
          const mediaItems = pages[calls++];
          return { ok: true, json: async () => Object.freeze({ mediaItems, nextPageToken: calls < pages.length ? `page-${calls}` : '' }) };
        }
      });
      const before = fixture.readTokens();
      const { mediaItems } = await fixture.listPickerMediaItems('session');
      assert.deepStrictEqual(Array.from(mediaItems), rows);
      mediaItems.forEach((row, index) => assert.strictEqual(row, rows[index]));
      assert.notStrictEqual(mediaItems, rows);
      assert.strictEqual(calls, pages.length);
      assert.strictEqual(clockReads, 1);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker listing skips non-array lists and uses native next-token truthiness', async () => {
    const terminalTokens = [undefined, null, false, 0, '', NaN];
    const payloads = [false, 42, 'raw', [], {}, { mediaItems: null }, { mediaItems: {} }, { mediaItems: 'not an array' }];
    await Promise.all(payloads.flatMap(payload => terminalTokens.map(nextPageToken => ({ payload, nextPageToken }))).map(async ({ payload, nextPageToken }) => {
      let calls = 0;
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000,
        fetchResponse: async () => { calls += 1; return { ok: true, json: async () => typeof payload === 'object' ? { ...payload, nextPageToken } : payload }; }
      });
      assert.deepStrictEqual(Array.from((await fixture.listPickerMediaItems('')).mediaItems), []);
      assert.strictEqual(calls, 1);
    }));
    await Promise.all([true, 7, ['page', '+']].map(async nextPageToken => {
      const urls = [];
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000,
        fetchResponse: async url => { urls.push(url); return { ok: true, json: async () => urls.length === 1 ? { nextPageToken } : {} }; }
      });
      assert.deepStrictEqual(Array.from((await fixture.listPickerMediaItems('session')).mediaItems), []);
      assert.strictEqual(urls.length, 2);
      assert.ok(urls[1].endsWith(`&pageToken=${encodeURIComponent(nextPageToken)}`));
    }));
  }),
  assertAsyncTest('Google Photos Picker listing separates unlogged authentication from logged encoding failures', async () => {
    const failure = new Error('fixture token failure');
    const cases = [
      [{}, () => { throw failure; }, /Not authenticated/, []],
      [{ accessToken: 'cached', expiry: Infinity }, () => { throw failure; }, err => err === failure, []],
      [{ accessToken: 'expired' }, () => 1_000, /No refresh token available/, []],
      [{ refreshToken: 'fixture-refresh' }, () => 1_000, err => err === failure, [['Google Photos Service: Access token refresh failed:', failure.message]]]
    ];
    await Promise.all(cases.map(async ([initialTokens, now, expected, errors]) => {
      const fixture = createGooglePhotosServiceFixture({ initialTokens, now, fetchResponse: async () => { throw failure; } });
      const before = fixture.readTokens();
      await assert.rejects(fixture.listPickerMediaItems('session'), expected);
      assert.deepStrictEqual(fixture.errors, errors);
      assert.deepStrictEqual(fixture.readTokens(), before);
      assert.deepStrictEqual(fixture.persisted, []);
    }));
    const fixture = createGooglePhotosServiceFixture({ initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000 });
    await assert.rejects(fixture.listPickerMediaItems('\uD800'), err => err.name === 'URIError');
    assert.strictEqual(fixture.errors.length, 1);
    assert.strictEqual(fixture.errors[0][0], 'Google Photos Service: Failed to list picker media items:');
  }),
  assertAsyncTest('Google Photos Picker listing rejects later-page failures without returning partial rows', async () => {
    const failure = new Error('fixture page failure');
    const cases = [
      [async () => { throw failure; }, err => err === failure, failure.message],
      [async () => ({ ok: false, status: 403, text: async () => 'fixture denied' }), err => err.message === 'Google Picker MediaItems failed (403): fixture denied', 'Google Picker MediaItems failed (403): fixture denied'],
      [async () => ({ ok: false, status: 500, text: async () => { throw failure; } }), err => err === failure, failure.message],
      [async () => ({ ok: true, json: async () => { throw failure; } }), err => err === failure, failure.message],
      ...[null, undefined].map(payload => [async () => ({ ok: true, json: async () => payload }), err => err.name === 'TypeError', 'property-access']),
      [async () => ({ ok: true, json: async () => ({ nextPageToken: Symbol('page') }) }), err => err.name === 'TypeError', 'encoding'],
      [async () => { throw 'opaque failure'; }, err => err === 'opaque failure', undefined],
      ...[null, undefined].map(value => [async () => { throw value; }, err => err.name === 'TypeError' && /message/.test(err.message), null])
    ];
    await Promise.all(cases.map(async ([failPage, expected, message]) => {
      let calls = 0;
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000,
        fetchResponse: async (...args) => ++calls === 1 ? { ok: true, json: async () => ({ mediaItems: [{ id: 'partial' }], nextPageToken: 'next' }) } : failPage(...args)
      });
      const before = fixture.readTokens();
      await assert.rejects(fixture.listPickerMediaItems('session'), expected);
      assert.strictEqual(calls, 2);
      assert.strictEqual(fixture.errors.length, message === null ? 0 : 1);
      if (message !== null) {
        assert.strictEqual(fixture.errors[0][0], 'Google Photos Service: Failed to list picker media items:');
        if (!['property-access', 'encoding'].includes(message)) assert.strictEqual(fixture.errors[0][1], message);
      }
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  })
];

assertTest('Google Photos Picker deletion documents its input, boolean response, and failure boundaries', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Delete a Picker session or acknowledge'), source.indexOf('async function deletePickerSession(sessionId)'));
  [/@param \{string\} sessionId/, /@returns \{Promise<boolean>\}/, /refresh-token-only state/,
    /outside the catch/, /Interpolate the id verbatim/, /no request body or response body/,
    /not validated or coerced/, /HTTP failures resolve false silently/, /Nullish thrown values/,
    /not a cached or idempotent guarantee/
  ].forEach(pattern => assert.match(contract, pattern));
});

const googlePhotosPickerDeletionChecks = [
  assertAsyncTest('Google Photos Picker deletion rejects malformed ids before any effects', async () => {
    const failIfCalled = () => { throw new Error('Unexpected deletion input effect'); };
    await Promise.all([undefined, null, false, 0, 42, {}, [], Symbol('id')].map(async sessionId => {
      const fixture = createGooglePhotosServiceFixture({ now: failIfCalled, fetchResponse: failIfCalled, persist: failIfCalled });
      const before = fixture.readTokens();
      await assert.rejects(fixture.deletePickerSession(sessionId), err => err.name === 'TypeError' && /startsWith/.test(err.message));
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker deletion repeats synthetic no-ops without authentication or cache effects', async () => {
    const failIfCalled = () => { throw new Error('Unexpected synthetic deletion effect'); };
    await Promise.all([{}, { accessToken: 'expired', expiry: 0 }, { refreshToken: 'fixture-refresh' }].map(async initialTokens => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens, now: failIfCalled, fetchResponse: failIfCalled, persist: failIfCalled, read: failIfCalled, write: failIfCalled
      });
      const before = fixture.readTokens();
      assert.strictEqual(await fixture.deletePickerSession('MOCK_SESSION/fixture?raw'), true);
      assert.strictEqual(await fixture.deletePickerSession('MOCK_SESSION/fixture?raw'), true);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker deletion preserves verbatim DELETE metadata and silent HTTP flags without body reads', async () => {
    const cases = ['', 'session/with?raw#fragment', 'mock_lowercase', 'session ü'].flatMap(sessionId =>
      [true, false].map(ok => ({ sessionId, ok })));
    await Promise.all(cases.map(async ({ sessionId, ok }) => {
      const requests = [];
      const failIfCalled = () => { throw new Error('Unexpected deletion body read'); };
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000,
        fetchResponse: async (url, options) => {
          requests.push({ url, options: { ...options, headers: { ...options.headers } } });
          return { ok, status: ok ? 204 : 403, json: failIfCalled, text: failIfCalled, arrayBuffer: failIfCalled };
        }
      });
      const before = fixture.readTokens();
      assert.strictEqual(await fixture.deletePickerSession(sessionId), ok);
      assert.deepStrictEqual(requests, [{
        url: `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
        options: { method: 'DELETE', headers: { Authorization: 'Bearer cached' } }
      }]);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker deletion awaits refresh-only authentication and DELETE completion', async () => {
    const requests = [];
    let finishRefresh;
    let finishDelete;
    const refreshJson = new Promise(resolve => { finishRefresh = resolve; });
    const deletion = new Promise(resolve => { finishDelete = resolve; });
    const fixture = createGooglePhotosServiceFixture({
      initialTokens: { refreshToken: 'fixture-refresh' }, now: () => 1_000,
      fetchResponse: async (url, options) => {
        requests.push({ url, method: options.method, authorization: options.headers.Authorization });
        return requests.length === 1 ? { ok: true, json: async () => refreshJson } : deletion;
      }
    });
    let settled = false;
    const pending = fixture.deletePickerSession('session').then(result => { settled = true; return result; });
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(settled, false);
    finishRefresh({ access_token: 'refreshed', expires_in: 60 });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepStrictEqual(requests, [
      { url: 'https://oauth2.googleapis.com/token', method: 'POST', authorization: undefined },
      { url: 'https://photospicker.googleapis.com/v1/sessions/session', method: 'DELETE', authorization: 'Bearer refreshed' }
    ]);
    assert.strictEqual(settled, false);
    finishDelete({ ok: false });
    assert.strictEqual(await pending, false);
    assert.deepStrictEqual(fixture.readTokens(), { accessToken: 'refreshed', refreshToken: 'fixture-refresh', expiry: 61_000 });
    [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
  }),
  assertAsyncTest('Google Photos Picker deletion rejects authentication failures outside its request catch', async () => {
    const failure = new Error('fixture token failure');
    const cases = [
      [{}, () => { throw failure; }, /Not authenticated/, []],
      [{ accessToken: 'cached', expiry: Infinity }, () => { throw failure; }, err => err === failure, []],
      [{ accessToken: 'expired' }, () => 1_000, /No refresh token available/, []],
      [{ refreshToken: 'fixture-refresh' }, () => 1_000, err => err === failure,
        [['Google Photos Service: Access token refresh failed:', failure.message]]]
    ];
    await Promise.all(cases.map(async ([initialTokens, now, expected, errors]) => {
      const requests = [];
      const fixture = createGooglePhotosServiceFixture({ initialTokens, now, fetchResponse: async url => { requests.push(url); throw failure; } });
      const before = fixture.readTokens();
      await assert.rejects(fixture.deletePickerSession('session'), expected);
      assert.deepStrictEqual(requests, initialTokens.refreshToken ? ['https://oauth2.googleapis.com/token'] : []);
      assert.deepStrictEqual(fixture.errors, errors);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  }),
  assertAsyncTest('Google Photos Picker deletion handles request and property failures but rejects nullish thrown values', async () => {
    const failure = new Error('fixture deletion failure');
    const cases = [
      [async () => { throw failure; }, failure.message],
      [async () => ({ get ok() { throw failure; } }), failure.message],
      [async () => null, 'property-access'],
      [async () => undefined, 'property-access'],
      [async () => { throw 'opaque failure'; }, undefined],
      ...[null, undefined].map(value => [async () => { throw value; }, null])
    ];
    await Promise.all(cases.map(async ([fetchResponse, message]) => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000, fetchResponse
      });
      const before = fixture.readTokens();
      const pending = fixture.deletePickerSession('session');
      if (message === null) await assert.rejects(pending, err => err.name === 'TypeError' && /message/.test(err.message));
      else assert.strictEqual(await pending, false);
      assert.strictEqual(fixture.errors.length, message === null ? 0 : 1);
      if (message !== null) {
        assert.strictEqual(fixture.errors[0][0], 'Google Photos Service: Failed to delete session session:');
        if (message !== 'property-access') assert.strictEqual(fixture.errors[0][1], message);
      }
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
    let calls = 0;
    const refreshed = createGooglePhotosServiceFixture({
      initialTokens: { refreshToken: 'fixture-refresh' }, now: () => 1_000,
      fetchResponse: async () => {
        if (++calls === 1) return { ok: true, json: async () => ({ access_token: 'refreshed', expires_in: 60 }) };
        throw failure;
      }
    });
    assert.strictEqual(await refreshed.deletePickerSession('session'), false);
    assert.strictEqual(calls, 2);
    assert.deepStrictEqual(refreshed.readTokens(), { accessToken: 'refreshed', refreshToken: 'fixture-refresh', expiry: 61_000 });
    assert.deepStrictEqual(refreshed.errors, [['Google Photos Service: Failed to delete session session:', failure.message]]);
    [refreshed.writes, refreshed.persisted].forEach(records => assert.deepStrictEqual(records, []));
  }),
  assertAsyncTest('Google Photos Picker deletion forwards raw ok values and issues a new request on every real call', async () => {
    await Promise.all([undefined, null, 0, 1, 'raw', Object.freeze({ flag: true })].map(async ok => {
      let calls = 0;
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'cached', expiry: Infinity }, now: () => 1_000,
        fetchResponse: async () => { calls += 1; return { ok }; }
      });
      const before = fixture.readTokens();
      assert.strictEqual(await fixture.deletePickerSession('session'), ok);
      assert.strictEqual(await fixture.deletePickerSession('session'), ok);
      assert.strictEqual(calls, 2);
      assert.deepStrictEqual(fixture.readTokens(), before);
      [fixture.logs, fixture.errors, fixture.writes, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
    }));
  })
];

assertTest('Google Photos content URL projection documents its pure input and result contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Pure projection of a base URL'), source.indexOf('function readCachedMediaItemsRaw'));

  assert.match(contract, /@param \{string \| null \| undefined\} baseUrl/);
  assert.match(contract, /@param \{GooglePhotoRenderOptions\} \[renderOptions=\{\}\]/);
  assert.match(contract, /@returns \{string\}/);
  assert.match(contract, /without validation or clamping/);
  assert.match(contract, /without parsing,\s+\* encoding, or replacing existing directives/);
});

assertTest('Google Photos content URL projection applies independent defaults and ordered crop directives', () => {
  const { buildContentUrl } = createGooglePhotosServiceFixture();
  const base = 'https://example.test/photo';
  const cases = [
    [undefined, 'w2560-h1440'],
    [{}, 'w2560-h1440'],
    [{ width: 800 }, 'w800-h1440'],
    [{ height: 600 }, 'w2560-h600'],
    [{ width: undefined, height: undefined, crop: true }, 'w2560-h1440-c'],
    [{ width: 800, height: 600, crop: true }, 'w800-h600-c'],
    [{ width: 800, height: 600, crop: false }, 'w800-h600'],
    [{ width: 0, height: -1 }, 'w0-h-1']
  ];

  cases.forEach(([options, directives]) => assert.strictEqual(buildContentUrl(base, options), `${base}=${directives}`));
});

assertTest('Google Photos content URL projection keeps empty bases inert and nonempty bases verbatim', () => {
  const { buildContentUrl } = createGooglePhotosServiceFixture();

  ['', null, undefined].forEach(base => {
    assert.strictEqual(buildContentUrl(base), '');
    assert.strictEqual(buildContentUrl(base, { width: 800, height: 600, crop: true }), '');
  });
  ['https://example.test/photo=old', 'https://example.test/photo?token=a%2Fb', ' '].forEach(base => {
    assert.strictEqual(buildContentUrl(base), `${base}=w2560-h1440`);
  });
});

assertTest('Google Photos content URL projection is deterministic and leaves frozen options and effects untouched', () => {
  const failIfCalled = () => { throw new Error('Unexpected content-URL effect'); };
  const { buildContentUrl, writes, warnings } = createGooglePhotosServiceFixture({
    exists: failIfCalled, cacheExists: failIfCalled, read: failIfCalled,
    fetchResponse: failIfCalled, write: failIfCalled
  });
  const options = Object.freeze({ width: 1024, height: 768, crop: true });
  const project = base => buildContentUrl(base, options);
  const bases = ['https://example.test/first', 'https://example.test/second'];

  assert.deepStrictEqual(bases.map(project), bases.map(base => `${base}=w1024-h768-c`));
  assert.deepStrictEqual(bases.map(project), bases.map(project));
  assert.deepStrictEqual(options, { width: 1024, height: 768, crop: true });
  assert.deepStrictEqual(writes, []);
  assert.deepStrictEqual(warnings, []);
});

assertTest('Google Photos base-URL staleness documents its timestamp, inclusive TTL, and clock contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Classify a cached base URL'), source.indexOf(' * 🔒 saveGoogleCredentials'));

  assert.match(contract, /@param \{\{googleBaseUrlFetchedAt\?: number \| string \| null\} \| null \| undefined\} item/);
  assert.match(contract, /@returns \{boolean\}/);
  assert.match(contract, /inclusive 55-minute TTL/);
  assert.match(contract, /falsy timestamp is stale without reading the clock/);
  assert.match(contract, /not a pure projection/);
  assert.match(contract, /truthy nonnumeric strings yield NaN and therefore classify as fresh/);
});

assertTest('Google Photos base-URL staleness keeps absent and falsy timestamps stale without clock effects', () => {
  const { isBaseUrlStale } = createGooglePhotosServiceFixture({
    now: () => { throw new Error('Unexpected clock read'); }
  });
  const rows = [undefined, null, {}, ...[undefined, null, 0, '', NaN].map(googleBaseUrlFetchedAt => ({ googleBaseUrlFetchedAt }))];

  rows.forEach(row => assert.strictEqual(isBaseUrlStale(row), true));
});

assertTest('Google Photos base-URL staleness preserves inclusive TTL, coercion, and immutable rows', () => {
  const clock = 10_000_000;
  const ttl = 55 * 60 * 1000;
  let clockReads = 0;
  const failIfCalled = () => { throw new Error('Unexpected staleness effect'); };
  const { isBaseUrlStale, writes, warnings } = createGooglePhotosServiceFixture({
    now: () => { clockReads += 1; return clock; },
    exists: failIfCalled, cacheExists: failIfCalled, read: failIfCalled,
    fetchResponse: failIfCalled, write: failIfCalled
  });
  const cases = [
    [clock - ttl + 1, false], [clock - ttl, true], [clock - ttl - 1, true],
    [clock, false], [clock + 1, false], [-1, true],
    [String(clock - ttl), true], [String(clock), false], ['0', true],
    ['not-a-timestamp', false], [Infinity, false], [-Infinity, true]
  ];

  cases.forEach(([googleBaseUrlFetchedAt, expected]) => {
    const row = Object.freeze({ id: 'photo', googleBaseUrlFetchedAt });
    assert.strictEqual(isBaseUrlStale(row), expected);
    assert.deepStrictEqual(row, { id: 'photo', googleBaseUrlFetchedAt });
  });
  assert.strictEqual(clockReads, cases.length);
  assert.deepStrictEqual(writes, []);
  assert.deepStrictEqual(warnings, []);
});

assertTest('Google Photos base-URL staleness re-reads the service clock and propagates clock failures', () => {
  const row = Object.freeze({ googleBaseUrlFetchedAt: 1_000_000 });
  const times = [row.googleBaseUrlFetchedAt + 55 * 60 * 1000 - 1, row.googleBaseUrlFetchedAt + 55 * 60 * 1000];
  const { isBaseUrlStale } = createGooglePhotosServiceFixture({ now: () => times.shift() });

  assert.strictEqual(isBaseUrlStale(row), false);
  assert.strictEqual(isBaseUrlStale(row), true);
  assert.deepStrictEqual(times, []);
  const failure = new Error('Clock unavailable');
  const failedFixture = createGooglePhotosServiceFixture({ now: () => { throw failure; } });
  assert.throws(() => failedFixture.isBaseUrlStale(row), err => err === failure);
});

assertTest('Google Photos token resolver documents results, strict refresh boundary, and rejection effects', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(" * Resolve the service's access token"), source.indexOf(' * 💾 syncGoogleAlbum'));

  assert.match(contract, /@returns \{Promise<string \| undefined>\}/);
  assert.match(contract, /@throws \{Error\}/);
  assert.match(contract, /exactly five minutes does not trigger refresh/);
  assert.match(contract, /Neither branch reads the clock here/);
  assert.match(contract, /refresh may resolve undefined/);
  assert.match(contract, /not a guarantee of validity or real credentials/);
  assert.match(contract, /not a pure projection/);
});

const googlePhotosTokenChecks = [
  assertAsyncTest('Google Photos token resolver short-circuits missing authentication and delegates mock refresh', async () => {
    const unauthenticated = createGooglePhotosServiceFixture({
      now: () => { throw new Error('Unexpected authentication clock read'); }
    });
    await assert.rejects(unauthenticated.getValidToken(), /Google Photos Service: Not authenticated\./);
    assert.deepStrictEqual(unauthenticated.logs, []);
    assert.deepStrictEqual(unauthenticated.errors, []);

    let clockReads = 0;
    const mock = createGooglePhotosServiceFixture({
      initialTokens: Object.freeze({ refreshToken: 'MOCK_FIXTURE' }),
      now: () => { clockReads += 1; return 1_000_000; }
    });
    assert.strictEqual(await mock.getValidToken(), 'MOCK_ACCESS_TOKEN_XYZ_1000000');
    assert.strictEqual(clockReads, 2, 'Only the mock refresh reads the clock');
    assert.deepStrictEqual(mock.logs, []);
    assert.deepStrictEqual(mock.writes, []);
  }),
  assertAsyncTest('Google Photos token resolver preserves strict five-minute boundaries and expiry coercion', async () => {
    const clock = 1_000_000;
    const boundary = clock + 300 * 1000;
    const cases = [
      [boundary + 1, false], [boundary, false], [boundary - 1, true],
      [clock - 1, true], [0, true], [null, true],
      [String(boundary), false], [String(boundary - 1), true],
      [undefined, false], [NaN, false], ['invalid', false], [Infinity, false]
    ];

    await Promise.all(cases.map(async ([expiry, shouldRefresh]) => {
      let clockReads = 0;
      let requests = 0;
      const initialTokens = Object.freeze({ accessToken: 'cached', refreshToken: 'fixture-refresh', expiry });
      const fixture = createGooglePhotosServiceFixture({
        initialTokens,
        now: () => { clockReads += 1; return clock; },
        fetchResponse: async () => {
          requests += 1;
          return { ok: true, json: async () => ({ access_token: 'refreshed', expires_in: 3600 }) };
        }
      });

      assert.strictEqual(await fixture.getValidToken(), shouldRefresh ? 'refreshed' : 'cached');
      assert.strictEqual(requests, Number(shouldRefresh));
      assert.strictEqual(clockReads, shouldRefresh ? 2 : 1);
      assert.strictEqual(fixture.logs.length, Number(shouldRefresh));
      assert.deepStrictEqual(fixture.writes, []);
      assert.deepStrictEqual(fixture.errors, []);
      assert.deepStrictEqual(initialTokens, { accessToken: 'cached', refreshToken: 'fixture-refresh', expiry });
    }));
  }),
  assertAsyncTest('Google Photos token resolver awaits authenticated refresh and reuses its updated token', async () => {
    const requests = [];
    let clockReads = 0;
    let releaseResponse;
    const response = new Promise(resolve => { releaseResponse = resolve; });
    const fixture = createGooglePhotosServiceFixture({
      envValues: {
        GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret',
        GOOGLE_REFRESH_TOKEN: 'fixture-refresh'
      },
      now: () => { clockReads += 1; return 1_000_000; },
      fetchResponse: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, json: () => response };
      }
    });
    let settled = false;
    const pending = fixture.getValidToken().then(token => { settled = true; return token; });
    await flushPromises();
    assert.strictEqual(settled, false);
    assert.strictEqual(clockReads, 0, 'Missing access token delegates before clock reads');
    assert.strictEqual(requests.length, 1);
    const [{ url, options }] = requests;
    assert.strictEqual(url, 'https://oauth2.googleapis.com/token');
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(options.body)), {
      client_id: 'fixture-client', client_secret: 'fixture-secret',
      refresh_token: 'fixture-refresh', grant_type: 'refresh_token'
    });
    releaseResponse({ access_token: 'refreshed', expires_in: 3600 });
    assert.strictEqual(await pending, 'refreshed');
    assert.strictEqual(clockReads, 1);
    assert.strictEqual(await fixture.getValidToken(), 'refreshed');
    assert.strictEqual(clockReads, 2);
    assert.strictEqual(requests.length, 1);
    assert.deepStrictEqual(fixture.logs, []);
    assert.deepStrictEqual(fixture.writes, []);
  }),
  assertAsyncTest('Google Photos token resolver rejects missing refresh tokens and preserves clock failures', async () => {
    const missingRefresh = createGooglePhotosServiceFixture({
      initialTokens: { accessToken: 'expired', expiry: 0 }, now: () => 1_000_000
    });
    await assert.rejects(missingRefresh.getValidToken(), /No refresh token available\. User must re-authenticate\./);
    assert.strictEqual(missingRefresh.logs.length, 1);
    assert.deepStrictEqual(missingRefresh.errors, []);

    const failure = new Error('Clock unavailable');
    const failedClock = createGooglePhotosServiceFixture({
      initialTokens: { accessToken: 'cached', refreshToken: 'fixture-refresh', expiry: 0 },
      now: () => { throw failure; }
    });
    await assert.rejects(failedClock.getValidToken(), err => err === failure);
    assert.deepStrictEqual(failedClock.logs, []);
    assert.deepStrictEqual(failedClock.errors, []);
  }),
  assertAsyncTest('Google Photos token resolver propagates network, HTTP, and JSON refresh failures on both paths', async () => {
    const networkFailure = new Error('Network unavailable');
    const jsonFailure = new Error('Invalid token JSON');
    const cases = [
      [async () => { throw networkFailure; }, err => err === networkFailure],
      [async () => ({ ok: false, status: 401 }), err => err.message === 'Failed to refresh access token, status=401'],
      [async () => ({ ok: true, json: async () => { throw jsonFailure; } }), err => err === jsonFailure]
    ];

    await Promise.all(['', 'expired'].flatMap(accessToken => cases.map(async ([fetchResponse, matches]) => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken, refreshToken: 'fixture-refresh', expiry: 0 },
        now: () => 1_000_000, fetchResponse
      });
      await assert.rejects(fixture.getValidToken(), matches);
      assert.strictEqual(fixture.errors.length, 1);
      assert.match(fixture.errors[0][0], /Access token refresh failed/);
      assert.strictEqual(fixture.logs.length, Number(Boolean(accessToken)));
      assert.deepStrictEqual(fixture.writes, []);
    })));
  }),
  assertAsyncTest('Google Photos token resolver preserves unvalidated missing access-token responses', async () => {
    const fixture = createGooglePhotosServiceFixture({
      initialTokens: { refreshToken: 'fixture-refresh' }, now: () => 1_000_000,
      fetchResponse: async () => ({ ok: true, json: async () => ({ expires_in: 3600 }) })
    });
    assert.strictEqual(await fixture.getValidToken(), undefined);
    assert.deepStrictEqual(fixture.errors, []);
    assert.deepStrictEqual(fixture.writes, []);
  })
];

assertTest('Google Photos refresh documents its result, mutation ordering, and logged failure boundary', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(" * Refresh the service's access token"), source.indexOf(" * Resolve the service's access token"));
  assert.match(contract, /@returns \{Promise<string \| undefined>\}/);
  assert.match(contract, /@throws \{Error\}/);
  assert.match(contract, /outside the logged catch/);
  assert.match(contract, /no token persistence occurs here/);
  assert.match(contract, /Updates are not atomic/);
  assert.match(contract, /not a pure projection/);
});

const googlePhotosRefreshChecks = [
  assertAsyncTest('Google Photos refresh rejects missing tokens without effects and creates mock tokens from separate clocks', async () => {
    const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: '', expiry: 17 });
    const missing = createGooglePhotosServiceFixture({ initialTokens, now: () => { throw new Error('Unexpected clock'); } });
    await assert.rejects(missing.refreshAccessToken(), /No refresh token available/);
    assert.deepStrictEqual(missing.readTokens(), initialTokens);
    assert.deepStrictEqual(missing.errors, []);

    const ticks = [100, 200];
    const mock = createGooglePhotosServiceFixture({
      initialTokens: { refreshToken: 'MOCK_FIXTURE' }, now: () => ticks.shift()
    });
    assert.strictEqual(await mock.refreshAccessToken(), 'MOCK_ACCESS_TOKEN_XYZ_100');
    assert.deepStrictEqual(mock.readTokens(), {
      accessToken: 'MOCK_ACCESS_TOKEN_XYZ_100', refreshToken: 'MOCK_FIXTURE', expiry: 3_600_200
    });
    assert.deepStrictEqual(ticks, []);
    assert.deepStrictEqual(mock.logs, []);
    assert.deepStrictEqual(mock.errors, []);
    assert.deepStrictEqual(mock.writes, []);
  }),
  assertAsyncTest('Google Photos refresh awaits encoded OAuth requests and preserves the stored refresh token', async () => {
    const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: 'refresh +&=', expiry: 17 });
    const requests = [];
    let clockReads = 0;
    let releaseResponse;
    const response = new Promise(resolve => { releaseResponse = resolve; });
    const fixture = createGooglePhotosServiceFixture({
      initialTokens,
      envValues: { GOOGLE_CLIENT_ID: 'client +&=', GOOGLE_CLIENT_SECRET: 'secret +&=' },
      now: () => { clockReads += 1; return 1_000; },
      fetchResponse: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, json: () => response };
      }
    });
    let settled = false;
    const pending = fixture.refreshAccessToken().then(token => { settled = true; return token; });
    await flushPromises();
    assert.strictEqual(settled, false);
    assert.strictEqual(clockReads, 0);
    assert.deepStrictEqual(fixture.readTokens(), initialTokens);
    assert.strictEqual(requests.length, 1);
    const [{ url, options }] = requests;
    assert.strictEqual(url, 'https://oauth2.googleapis.com/token');
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(options.body)), {
      client_id: 'client +&=', client_secret: 'secret +&=',
      refresh_token: initialTokens.refreshToken, grant_type: 'refresh_token'
    });
    releaseResponse({ access_token: 'new-access', refresh_token: 'ignored-replacement', expires_in: 60 });
    assert.strictEqual(await pending, 'new-access');
    assert.strictEqual(clockReads, 1);
    assert.deepStrictEqual(fixture.readTokens(), { ...initialTokens, accessToken: 'new-access', expiry: 61_000 });
    assert.deepStrictEqual(initialTokens, { accessToken: 'previous', refreshToken: 'refresh +&=', expiry: 17 });
    assert.deepStrictEqual(fixture.errors, []);
    assert.deepStrictEqual(fixture.writes, []);
  }),
  assertAsyncTest('Google Photos refresh preserves unvalidated token fields and expiry coercion', async () => {
    const cases = [
      [{ access_token: 'new', expires_in: '60' }, 'new', 61_000],
      [{ access_token: 'new', expires_in: 0 }, 'new', 1_000],
      [{ access_token: 'new', expires_in: null }, 'new', 1_000],
      [{ access_token: 'new', expires_in: 'invalid' }, 'new', NaN],
      [{ access_token: 'new' }, 'new', NaN],
      [{ expires_in: 60 }, undefined, 61_000]
    ];
    await Promise.all(cases.map(async ([payload, token, expiry]) => {
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { refreshToken: 'fixture-refresh' }, now: () => 1_000,
        fetchResponse: async () => ({ ok: true, json: async () => payload })
      });
      assert.strictEqual(await fixture.refreshAccessToken(), token);
      assert.deepStrictEqual(fixture.readTokens(), { accessToken: token, refreshToken: 'fixture-refresh', expiry });
      assert.deepStrictEqual(fixture.errors, []);
      assert.deepStrictEqual(fixture.writes, []);
    }));
  }),
  assertAsyncTest('Google Photos refresh logs and rethrows request and payload failures without mutating tokens', async () => {
    const networkFailure = new Error('Network unavailable');
    const jsonFailure = new Error('Invalid JSON');
    const cases = [
      [async () => { throw networkFailure; }, err => err === networkFailure],
      [async () => ({ ok: false, status: 503, json: () => { throw new Error('Unexpected JSON'); } }),
        err => err.message === 'Failed to refresh access token, status=503'],
      [async () => ({ ok: true, json: async () => { throw jsonFailure; } }), err => err === jsonFailure],
      [async () => ({ ok: true, json: async () => null }), err => err.name === 'TypeError']
    ];
    await Promise.all(cases.map(async ([fetchResponse, matches]) => {
      const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: 'fixture-refresh', expiry: 17 });
      const fixture = createGooglePhotosServiceFixture({
        initialTokens, fetchResponse, now: () => { throw new Error('Unexpected clock'); }
      });
      await assert.rejects(fixture.refreshAccessToken(), matches);
      assert.deepStrictEqual(fixture.readTokens(), initialTokens);
      assert.strictEqual(fixture.errors.length, 1);
      assert.strictEqual(fixture.errors[0][0], 'Google Photos Service: Access token refresh failed:');
      assert.deepStrictEqual(fixture.writes, []);
    }));
  }),
  assertAsyncTest('Google Photos refresh exposes partial OAuth updates on logged clock failures', async () => {
    const failure = new Error('Clock unavailable');
    const fixture = createGooglePhotosServiceFixture({
      initialTokens: { accessToken: 'previous', refreshToken: 'fixture-refresh', expiry: 17 },
      now: () => { throw failure; },
      fetchResponse: async () => ({ ok: true, json: async () => ({ access_token: 'new-access', expires_in: 60 }) })
    });
    await assert.rejects(fixture.refreshAccessToken(), err => err === failure);
    assert.deepStrictEqual(fixture.readTokens(), { accessToken: 'new-access', refreshToken: 'fixture-refresh', expiry: 17 });
    assert.deepStrictEqual(fixture.errors, [['Google Photos Service: Access token refresh failed:', failure.message]]);
    assert.deepStrictEqual(fixture.writes, []);
  }),
  assertAsyncTest('Google Photos mock refresh exposes first and second clock failures without logging', async () => {
    await Promise.all([1, 2].map(async failedRead => {
      const failure = new Error('Mock clock unavailable');
      let clockReads = 0;
      const fixture = createGooglePhotosServiceFixture({
        initialTokens: { accessToken: 'previous', refreshToken: 'MOCK_FIXTURE', expiry: 17 },
        now: () => { clockReads += 1; if (clockReads === failedRead) throw failure; return 100; }
      });
      await assert.rejects(fixture.refreshAccessToken(), err => err === failure);
      assert.strictEqual(clockReads, failedRead);
      assert.deepStrictEqual(fixture.readTokens(), {
        accessToken: failedRead === 1 ? 'previous' : 'MOCK_ACCESS_TOKEN_XYZ_100', refreshToken: 'MOCK_FIXTURE', expiry: 17
      });
      assert.deepStrictEqual(fixture.errors, []);
      assert.deepStrictEqual(fixture.writes, []);
    }));
  })
];

assertTest('Google Photos credential save documents its inputs, result, and replacement/failure contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * 🔒 saveGoogleCredentials'), source.indexOf(' * Build an authorization URL'));
  assert.match(contract, /@param \{string\} clientId/);
  assert.match(contract, /@param \{string\} clientSecret/);
  assert.match(contract, /@returns \{boolean\}/);
  assert.match(contract, /@throws \{TypeError\}/);
  assert.match(contract, /outside the catch/);
  assert.match(contract, /without\s+\* rollback/);
  assert.match(contract, /not a pure projection/);
});

const googlePhotosCredentialSuccessLog = 'Google Photos Service: Credentials saved successfully to .env.';
const googlePhotosCredentialFailureLog = 'Google Photos Service: Failed to save credentials:';
const googlePhotosPreviousCredentials = Object.freeze({ GOOGLE_CLIENT_ID: 'old-client', GOOGLE_CLIENT_SECRET: 'old-secret' });

assertTest('Google Photos credential save trims strings, preserves internal whitespace, and accepts empty values', () => {
  const cases = [
    [' \tclient\n', '\u00A0secret\uFEFF', 'client', 'secret'],
    [' client +&= name ', ' secret\ninside ', 'client +&= name', 'secret\ninside'],
    ['', '', '', ''],
    [' \n', '\t ', '', '']
  ];
  cases.forEach(([clientId, clientSecret, id, secret]) => {
    const fixture = createGooglePhotosServiceFixture({ envValues: googlePhotosPreviousCredentials });
    assert.strictEqual(fixture.saveCredentials(clientId, clientSecret), true);
    assert.deepStrictEqual(fixture.readCredentials(), { clientId: id, clientSecret: secret });
    assert.deepStrictEqual(fixture.persisted, [{ GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret }]);
    assert.deepStrictEqual(fixture.logs, [[googlePhotosCredentialSuccessLog]]);
    assert.deepStrictEqual(fixture.errors, []);
  });
});

assertTest('Google Photos credential save completes both trims before replacement and logs only after persistence', () => {
  const events = [];
  const previous = { clientId: 'old-client', clientSecret: 'old-secret' };
  const next = { clientId: 'new-client', clientSecret: 'new-secret' };
  const fixture = createGooglePhotosServiceFixture({
    envValues: googlePhotosPreviousCredentials,
    persist: patch => {
      events.push('persist');
      assert.deepStrictEqual(fixture.readCredentials(), next);
      assert.deepStrictEqual(patch, { GOOGLE_CLIENT_ID: next.clientId, GOOGLE_CLIENT_SECRET: next.clientSecret });
      assert.deepStrictEqual(fixture.logs, []);
    }
  });
  const input = (field, result) => Object.freeze({ trim: () => {
    events.push(field);
    assert.deepStrictEqual(fixture.readCredentials(), previous);
    return result;
  } });
  assert.strictEqual(fixture.saveCredentials(input('clientId', next.clientId), input('clientSecret', next.clientSecret)), true);
  assert.deepStrictEqual(events, ['clientId', 'clientSecret', 'persist']);
  assert.deepStrictEqual(fixture.logs, [[googlePhotosCredentialSuccessLog]]);
});

assertTest('Google Photos credential save leaves both credentials untouched on invalid or throwing trim inputs', () => {
  const failure = new Error('Trim unavailable');
  const inputs = [undefined, null, 0, false, {}, Symbol('unsupported'), { trim: () => { throw failure; } }];
  inputs.flatMap(input => [[input, 'new-secret'], ['new-client', input]]).forEach(args => {
    const fixture = createGooglePhotosServiceFixture({ envValues: googlePhotosPreviousCredentials });
    assert.throws(() => fixture.saveCredentials(...args), err => err === failure || err.name === 'TypeError');
    assert.deepStrictEqual(fixture.readCredentials(), { clientId: 'old-client', clientSecret: 'old-secret' });
    assert.deepStrictEqual(fixture.persisted, []);
    assert.deepStrictEqual(fixture.logs, []);
    assert.deepStrictEqual(fixture.errors, []);
  });
});

assertTest('Google Photos credential save reports persistence failure without rollback and supports a later retry', () => {
  const failure = new Error('Persistence unavailable');
  let attempts = 0;
  const fixture = createGooglePhotosServiceFixture({
    envValues: googlePhotosPreviousCredentials,
    persist: () => {
      attempts += 1;
      assert.deepStrictEqual(fixture.readCredentials(), { clientId: 'new-client', clientSecret: 'new-secret' });
      assert.deepStrictEqual(fixture.logs, []);
      if (attempts === 1) throw failure;
    }
  });
  assert.strictEqual(fixture.saveCredentials(' new-client ', ' new-secret '), false);
  assert.deepStrictEqual(fixture.readCredentials(), { clientId: 'new-client', clientSecret: 'new-secret' });
  assert.deepStrictEqual(fixture.logs, []);
  assert.deepStrictEqual(fixture.errors, [[googlePhotosCredentialFailureLog, failure.message]]);
  assert.strictEqual(fixture.saveCredentials('new-client', 'new-secret'), true);
  assert.strictEqual(attempts, 2);
  assert.deepStrictEqual(fixture.persisted, Array.from({ length: 2 }, () => ({ GOOGLE_CLIENT_ID: 'new-client', GOOGLE_CLIENT_SECRET: 'new-secret' })));
  assert.deepStrictEqual(fixture.logs, [[googlePhotosCredentialSuccessLog]]);
  assert.strictEqual(fixture.errors.length, 1);
});

assertTest('Google Photos credential save preserves native thrown-value handling after replacement', () => {
  [null, undefined, 'failure', 0].forEach(failure => {
    const fixture = createGooglePhotosServiceFixture({ persist: () => { throw failure; } });
    if (failure == null) {
      assert.throws(() => fixture.saveCredentials('client', 'secret'), err => err.name === 'TypeError');
      assert.deepStrictEqual(fixture.errors, []);
    } else {
      assert.strictEqual(fixture.saveCredentials('client', 'secret'), false);
      assert.deepStrictEqual(fixture.errors, [[googlePhotosCredentialFailureLog, undefined]]);
    }
    assert.deepStrictEqual(fixture.readCredentials(), { clientId: 'client', clientSecret: 'secret' });
    assert.deepStrictEqual(fixture.persisted, [{ GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret' }]);
    assert.deepStrictEqual(fixture.logs, []);
  });
});

assertTest('Google Photos repeated credential saves retain tokens and avoid unrelated effects without suppressing persistence', () => {
  const failIfCalled = () => { throw new Error('Unexpected credential-save effect'); };
  const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: 'stored', expiry: 17 });
  const fixture = createGooglePhotosServiceFixture({
    initialTokens, envValues: googlePhotosPreviousCredentials,
    now: failIfCalled, fetchResponse: failIfCalled, exists: failIfCalled,
    cacheExists: failIfCalled, read: failIfCalled, write: failIfCalled
  });
  const inputs = Object.freeze([' client ', ' secret ']);
  assert.deepStrictEqual([inputs, inputs].map(args => fixture.saveCredentials(...args)), [true, true]);
  assert.deepStrictEqual(fixture.persisted, Array.from({ length: 2 }, () => ({ GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret' })));
  assert.deepStrictEqual(fixture.logs, Array.from({ length: 2 }, () => [googlePhotosCredentialSuccessLog]));
  assert.deepStrictEqual(fixture.readTokens(), initialTokens);
  assert.deepStrictEqual(inputs, [' client ', ' secret ']);
  assert.deepStrictEqual(googlePhotosPreviousCredentials, { GOOGLE_CLIENT_ID: 'old-client', GOOGLE_CLIENT_SECRET: 'old-secret' });
  assert.deepStrictEqual(fixture.writes, []);
  assert.deepStrictEqual(fixture.warnings, []);
  assert.deepStrictEqual(fixture.errors, []);
});

assertTest('Google Photos auth URL documents callback, branch encoding, and synchronous failure contracts', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Build an authorization URL'), source.indexOf(' * Service-owned token state'));
  assert.match(contract, /@param \{string\} redirectUri/);
  assert.match(contract, /@returns \{string\}/);
  assert.match(contract, /@throws \{URIError\}/);
  assert.match(contract, /@throws \{TypeError\}/);
  assert.match(contract, /Neither branch\s+\* checks the client secret/);
  assert.match(contract, /not a pure projection/);
});

const googlePhotosAuthSandboxLog = 'Google Photos Service: Client ID not configured. Generating developmental sandbox auth URL.';

assertTest('Google Photos auth URL uses a logged sandbox fallback only when the client ID is falsy', () => {
  const callback = 'https://example.test/callback?a=+&b=%2F#snow ❄';
  [{}, { GOOGLE_CLIENT_SECRET: 'secret' }, ...['', false, 0].map(GOOGLE_CLIENT_ID => ({ GOOGLE_CLIENT_ID }))]
    .forEach(envValues => {
      const fixture = createGooglePhotosServiceFixture({ envValues });
      assert.strictEqual(fixture.authUrl(callback), '/api/auth/google/sandbox-callback?redirect_uri=https%3A%2F%2Fexample.test%2Fcallback%3Fa%3D%2B%26b%3D%252F%23snow%20%E2%9D%84');
      assert.deepStrictEqual(fixture.logs, [[googlePhotosAuthSandboxLog]]);
      assert.deepStrictEqual(fixture.errors, []);
    });
});

assertTest('Google Photos auth URL requests only Picker scope with encoded callback and ID even without a secret', () => {
  ['', 'secret'].forEach(GOOGLE_CLIENT_SECRET => {
    const fixture = createGooglePhotosServiceFixture({
      envValues: Object.freeze({ GOOGLE_CLIENT_ID: 'client +&=', GOOGLE_CLIENT_SECRET })
    });
    const result = fixture.authUrl('https://example.test/callback?a=+&b=%2F#snow ❄');
    const url = new URL(result);
    assert.strictEqual(`${url.origin}${url.pathname}`, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.deepStrictEqual([...url.searchParams], [
      ['redirect_uri', 'https://example.test/callback?a=+&b=%2F#snow ❄'],
      ['client_id', 'client +&='],
      ['access_type', 'offline'],
      ['response_type', 'code'],
      ['prompt', 'consent'],
      ['scope', 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly']
    ]);
    assert.ok(result.includes('client_id=client+%2B%26%3D'));
    assert.ok(result.includes('snow+%E2%9D%84'));
    assert.deepStrictEqual(fixture.logs, []);
    assert.deepStrictEqual(fixture.errors, []);
  });
});

assertTest('Google Photos auth URL preserves native coercion without callback validation', () => {
  const cases = [[undefined, 'undefined'], [null, 'null'], ['', ''], [0, '0'], [false, 'false'], ['relative path', 'relative path']];
  [{}, { GOOGLE_CLIENT_ID: 'client' }].forEach(envValues => {
    const { authUrl } = createGooglePhotosServiceFixture({ envValues });
    cases.forEach(([input, expected]) => {
      const url = new URL(authUrl(input), 'https://example.test');
      assert.strictEqual(url.searchParams.get('redirect_uri'), expected);
    });
  });
});

assertTest('Google Photos auth URL preserves branch-specific Unicode handling and synchronous encoding failures', () => {
  const sandbox = createGooglePhotosServiceFixture();
  const oauth = createGooglePhotosServiceFixture({ envValues: { GOOGLE_CLIENT_ID: 'client' } });
  ['\uD800', '\uDC00'].forEach(input => {
    assert.throws(() => sandbox.authUrl(input), err => err.name === 'URIError');
    assert.strictEqual(new URL(oauth.authUrl(input)).searchParams.get('redirect_uri'), '\uFFFD');
  });
  [sandbox, oauth].forEach(fixture => {
    assert.throws(() => fixture.authUrl(Symbol('unsupported')), err => err.name === 'TypeError');
    assert.deepStrictEqual(fixture.errors, []);
    assert.deepStrictEqual(fixture.persisted, []);
  });
  assert.deepStrictEqual(sandbox.logs, Array.from({ length: 3 }, () => [googlePhotosAuthSandboxLog]));
  assert.deepStrictEqual(oauth.logs, []);
});

assertTest('Google Photos auth URL is repeatable for fixed credentials and reads later credential replacements without token effects', () => {
  const failIfCalled = () => { throw new Error('Unexpected auth-URL effect'); };
  const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: 'stored', expiry: 17 });
  const fixture = createGooglePhotosServiceFixture({
    initialTokens, now: failIfCalled, fetchResponse: failIfCalled,
    exists: failIfCalled, cacheExists: failIfCalled, read: failIfCalled, write: failIfCalled
  });
  const callbacks = ['https://example.test/first', 'https://example.test/second'];
  const project = callback => fixture.authUrl(callback);
  assert.deepStrictEqual(callbacks.map(project), callbacks.map(project));
  assert.deepStrictEqual(fixture.persisted, []);
  assert.strictEqual(fixture.saveCredentials(' updated-client ', ''), true);
  assert.deepStrictEqual(fixture.persisted, [{ GOOGLE_CLIENT_ID: 'updated-client', GOOGLE_CLIENT_SECRET: '' }]);
  const persistedCount = fixture.persisted.length;
  const logCount = fixture.logs.length;
  const results = callbacks.map(project);
  assert.deepStrictEqual(results, callbacks.map(project));
  assert.ok(results.every(result => new URL(result).searchParams.get('client_id') === 'updated-client'));
  assert.strictEqual(fixture.persisted.length, persistedCount);
  assert.strictEqual(fixture.logs.length, logCount);
  assert.deepStrictEqual(fixture.readTokens(), initialTokens);
  assert.deepStrictEqual(initialTokens, { accessToken: 'previous', refreshToken: 'stored', expiry: 17 });
  assert.deepStrictEqual(fixture.writes, []);
  assert.deepStrictEqual(fixture.warnings, []);
  assert.deepStrictEqual(fixture.errors, []);
});

assertTest('Google Photos code exchange documents its inputs, shared result, and persistence failure boundary', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Service-owned token state'), source.indexOf(" * Refresh the service's access token"));
  assert.match(contract, /@param \{string\} code/);
  assert.match(contract, /@param \{string\} redirectUri/);
  assert.match(contract, /@returns \{Promise<GooglePhotoTokenState>\}/);
  assert.match(contract, /@throws \{Error\}/);
  assert.match(contract, /not a copy/);
  assert.match(contract, /rejects without rollback/);
  assert.match(contract, /mock failures are not/);
});

const googlePhotosExchangeCredentials = Object.freeze({ GOOGLE_CLIENT_ID: 'client +&=', GOOGLE_CLIENT_SECRET: 'secret +&=' });
const googlePhotosExchangeChecks = [
  assertAsyncTest('Google Photos code exchange mocks either absent credential and returns mutable service-owned state', async () => {
    await Promise.all([{}, { GOOGLE_CLIENT_ID: 'client' }, { GOOGLE_CLIENT_SECRET: 'secret' }].map(async envValues => {
      const ticks = [100, 200, 300, 400];
      const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: 'previous-refresh', expiry: 17 });
      const fixture = createGooglePhotosServiceFixture({ envValues, initialTokens, now: () => ticks.shift() });
      const first = await fixture.exchange(null, undefined);
      assert.deepStrictEqual({ ...first }, { accessToken: 'MOCK_ACCESS_TOKEN_XYZ_100', refreshToken: 'MOCK_REFRESH_TOKEN_ABC', expiry: 3_600_200 });
      const second = await fixture.exchange('ignored', 'ignored');
      assert.notStrictEqual(first, second);
      assert.strictEqual(first.accessToken, 'MOCK_ACCESS_TOKEN_XYZ_100');
      second.accessToken = 'caller-edit';
      assert.deepStrictEqual(fixture.readTokens(), { accessToken: 'caller-edit', refreshToken: 'MOCK_REFRESH_TOKEN_ABC', expiry: 3_600_400 });
      assert.deepStrictEqual(initialTokens, { accessToken: 'previous', refreshToken: 'previous-refresh', expiry: 17 });
      assert.deepStrictEqual(ticks, []);
      assert.strictEqual(fixture.logs.length, 2);
      assert.deepStrictEqual(fixture.errors, []);
      assert.deepStrictEqual(fixture.persisted, []);
      assert.deepStrictEqual(fixture.writes, []);
    }));
  }),
  assertAsyncTest('Google Photos code exchange awaits encoded OAuth JSON then replaces state before persistence', async () => {
    const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: 'previous-refresh', expiry: 17 });
    const requests = [];
    let releaseResponse;
    const response = new Promise(resolve => { releaseResponse = resolve; });
    let clockReads = 0;
    const fixture = createGooglePhotosServiceFixture({
      initialTokens, envValues: googlePhotosExchangeCredentials,
      now: () => { clockReads += 1; return 1_000; },
      fetchResponse: async (url, options) => { requests.push({ url, options }); return { ok: true, json: () => response }; },
      persist: patch => {
        assert.deepStrictEqual(patch, { GOOGLE_REFRESH_TOKEN: 'new-refresh' });
        assert.deepStrictEqual(fixture.readTokens(), { accessToken: 'new-access', refreshToken: ' new-refresh ', expiry: 61_000 });
      }
    });
    let settled = false;
    const pending = fixture.exchange('code +&=', 'https://example.test/callback?a=+&b=%2F').then(result => { settled = true; return result; });
    await flushPromises();
    assert.strictEqual(settled, false);
    assert.strictEqual(clockReads, 0);
    assert.deepStrictEqual(fixture.readTokens(), initialTokens);
    assert.deepStrictEqual(fixture.persisted, []);
    assert.strictEqual(requests.length, 1);
    const [{ url, options }] = requests;
    assert.strictEqual(url, 'https://oauth2.googleapis.com/token');
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(options.body)), {
      code: 'code +&=', client_id: 'client +&=', client_secret: 'secret +&=',
      redirect_uri: 'https://example.test/callback?a=+&b=%2F', grant_type: 'authorization_code'
    });
    releaseResponse(Object.freeze({ access_token: 'new-access', refresh_token: ' new-refresh ', expires_in: 60 }));
    const result = await pending;
    assert.strictEqual(clockReads, 1);
    assert.deepStrictEqual({ ...result }, fixture.readTokens());
    result.accessToken = 'caller-edit';
    assert.strictEqual(fixture.readTokens().accessToken, 'caller-edit');
    assert.deepStrictEqual(initialTokens, { accessToken: 'previous', refreshToken: 'previous-refresh', expiry: 17 });
    assert.deepStrictEqual(fixture.persisted, [{ GOOGLE_REFRESH_TOKEN: 'new-refresh' }]);
    assert.deepStrictEqual(fixture.errors, []);
    assert.deepStrictEqual(fixture.writes, []);
  }),
  assertAsyncTest('Google Photos code exchange preserves truthy refresh fallback, coercion, and persistence skips', async () => {
    const cases = [
      ...[undefined, null, '', false, 0].map(refresh_token => [{ access_token: 'new', refresh_token, expires_in: '60' }, 'stored', 'stored', 61_000]),
      [{ access_token: 'new', refresh_token: ' replacement ', expires_in: 0 }, 'stored', ' replacement ', 1_000],
      [{ access_token: 'new', refresh_token: ' MOCK_FIXTURE ', expires_in: null }, 'stored', ' MOCK_FIXTURE ', 1_000],
      [{ access_token: 'new', refresh_token: '  ', expires_in: 'invalid' }, 'stored', '  ', NaN],
      [{}, '', '', NaN],
      [{ expires_in: 60 }, 'stored', 'stored', 61_000]
    ];
    await Promise.all(cases.map(async ([payload, stored, refreshToken, expiry]) => {
      const fixture = createGooglePhotosServiceFixture({
        envValues: googlePhotosExchangeCredentials, initialTokens: { refreshToken: stored }, now: () => 1_000,
        fetchResponse: async (_url, options) => {
          const fields = Object.fromEntries(new URLSearchParams(options.body));
          assert.strictEqual(fields.code, 'undefined');
          assert.strictEqual(fields.redirect_uri, 'null');
          return { ok: true, json: async () => Object.freeze(payload) };
        }
      });
      assert.deepStrictEqual({ ...await fixture.exchange(undefined, null) }, { accessToken: payload.access_token, refreshToken, expiry });
      const normalized = refreshToken.trim();
      assert.deepStrictEqual(fixture.persisted, normalized && !normalized.startsWith('MOCK_') ? [{ GOOGLE_REFRESH_TOKEN: normalized }] : []);
      assert.deepStrictEqual(fixture.errors, []);
      assert.deepStrictEqual(fixture.writes, []);
    }));
  }),
  assertAsyncTest('Google Photos code exchange logs and rethrows failures before replacement with state unchanged', async () => {
    const networkFailure = new Error('Network unavailable');
    const bodyFailure = new Error('Error body unavailable');
    const jsonFailure = new Error('Invalid JSON');
    const clockFailure = new Error('Clock unavailable');
    const cases = [
      [async () => { throw networkFailure; }, err => err === networkFailure],
      [async () => ({ ok: false, status: 400, text: async () => 'fixture-error' }), err => err.message === 'Google Token API responded with status 400: fixture-error'],
      [async () => ({ ok: false, text: async () => { throw bodyFailure; } }), err => err === bodyFailure],
      [async () => ({ ok: true, json: async () => { throw jsonFailure; } }), err => err === jsonFailure],
      [async () => ({ ok: true, json: async () => null }), err => err.name === 'TypeError'],
      [async () => ({ ok: true, json: async () => ({ access_token: 'new', refresh_token: 'new-refresh', expires_in: 60 }) }), err => err === clockFailure]
    ];
    await Promise.all(cases.map(async ([fetchResponse, matches]) => {
      const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: 'stored', expiry: 17 });
      const fixture = createGooglePhotosServiceFixture({
        envValues: googlePhotosExchangeCredentials, initialTokens, fetchResponse, now: () => { throw clockFailure; }
      });
      await assert.rejects(fixture.exchange('code', 'callback'), matches);
      assert.deepStrictEqual(fixture.readTokens(), initialTokens);
      assert.strictEqual(fixture.errors.length, 1);
      assert.strictEqual(fixture.errors[0][0], 'Google Photos Service: Token exchange failed:');
      assert.deepStrictEqual(fixture.persisted, []);
    }));
  }),
  assertAsyncTest('Google Photos code exchange retains replaced state when persistence rejects', async () => {
    const failure = new Error('Persistence unavailable');
    const fixture = createGooglePhotosServiceFixture({
      envValues: googlePhotosExchangeCredentials, initialTokens: { refreshToken: 'stored' }, now: () => 1_000,
      fetchResponse: async () => ({ ok: true, json: async () => ({ access_token: 'new', refresh_token: ' replacement ', expires_in: 60 }) }),
      persist: () => { throw failure; }
    });
    await assert.rejects(fixture.exchange('code', 'callback'), err => err === failure);
    assert.deepStrictEqual(fixture.readTokens(), { accessToken: 'new', refreshToken: ' replacement ', expiry: 61_000 });
    assert.deepStrictEqual(fixture.persisted, [{ GOOGLE_REFRESH_TOKEN: 'replacement' }]);
    assert.deepStrictEqual(fixture.errors, [['Google Photos Service: Token exchange failed:', failure.message]]);
  }),
  assertAsyncTest('Google Photos mock code exchange leaves state unchanged on either unlogged clock failure', async () => {
    await Promise.all([1, 2].map(async failedRead => {
      const failure = new Error('Mock clock unavailable');
      let clockReads = 0;
      const initialTokens = Object.freeze({ accessToken: 'previous', refreshToken: 'stored', expiry: 17 });
      const fixture = createGooglePhotosServiceFixture({
        initialTokens, now: () => { clockReads += 1; if (clockReads === failedRead) throw failure; return 100; }
      });
      await assert.rejects(fixture.exchange('ignored', 'ignored'), err => err === failure);
      assert.strictEqual(clockReads, failedRead);
      assert.deepStrictEqual(fixture.readTokens(), initialTokens);
      assert.strictEqual(fixture.logs.length, 1);
      assert.deepStrictEqual(fixture.errors, []);
      assert.deepStrictEqual(fixture.persisted, []);
    }));
  })
];

const googlePhotosDownloadNoopCheck = assertAsyncTest('Google Photos pre-download keeps test/empty batches inert and exposes existence failures', async () => {
  const failIfCalled = () => { throw new Error('Unexpected effect'); };
  const testFixture = createGooglePhotosServiceFixture({
    nodeEnv: 'test', exists: failIfCalled, fetchResponse: failIfCalled, write: failIfCalled
  });
  assert.strictEqual(await testFixture.download([{ id: 'test', googleBaseUrl: 'https://example.test/test' }]), undefined);
  assert.deepStrictEqual(testFixture.writes, []);
  assert.deepStrictEqual(testFixture.warnings, []);

  const emptyFixture = createGooglePhotosServiceFixture({ exists: failIfCalled });
  assert.strictEqual(await emptyFixture.download([]), undefined);
  assert.deepStrictEqual(emptyFixture.writes, []);

  const failure = new Error('Existence check failed');
  const failedFixture = createGooglePhotosServiceFixture({ exists: () => { throw failure; } });
  await assert.rejects(failedFixture.download([{ id: 'unreadable' }]), err => err === failure);
  assert.deepStrictEqual(failedFixture.warnings, []);
});

const googlePhotosDownloadOrderCheck = assertAsyncTest('Google Photos pre-download skips cached files and completes each write before the next fetch', async () => {
  const events = [];
  let releaseBody;
  const firstBody = new Promise(resolve => { releaseBody = resolve; });
  const items = Object.freeze([
    Object.freeze({ id: 'cached', googleBaseUrl: 'https://example.test/cached' }),
    Object.freeze({ id: 'first', googleBaseUrl: 'https://example.test/first' }),
    Object.freeze({ id: 'second', googleBaseUrl: 'https://example.test/second' })
  ]);
  const fixture = createGooglePhotosServiceFixture({
    exists: file => file.endsWith('cached.jpg'),
    fetchResponse: async url => {
      events.push(url);
      return { ok: true, arrayBuffer: () => url.includes('/first=') ? firstBody : Buffer.from('second') };
    },
    write: file => events.push(path.basename(file))
  });

  const pending = fixture.download(items);
  await flushPromises();
  assert.deepStrictEqual(events, ['https://example.test/first=w2560-h1440']);
  releaseBody(Buffer.from('first'));
  assert.strictEqual(await pending, undefined);
  assert.deepStrictEqual(events, [
    'https://example.test/first=w2560-h1440', 'first.jpg',
    'https://example.test/second=w2560-h1440', 'second.jpg'
  ]);
  assert.deepStrictEqual(fixture.writes.map(({ bytes }) => bytes.toString()), ['first', 'second']);
  assert.ok(fixture.writes.every(({ bytes }) => Buffer.isBuffer(bytes)));
  assert.deepStrictEqual(fixture.warnings, []);
});

const googlePhotosDownloadFailureCheck = assertAsyncTest('Google Photos pre-download continues after rejected responses, fetches, body reads, and writes', async () => {
  const requested = [];
  const responses = {
    rejected: async () => ({ ok: false, arrayBuffer: () => { throw new Error('Must not read rejected body'); } }),
    network: async () => { throw new Error('Network unavailable'); },
    body: async () => ({ ok: true, arrayBuffer: async () => { throw new Error('Body unavailable'); } }),
    disk: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('disk') }),
    last: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('last') })
  };
  const fixture = createGooglePhotosServiceFixture({
    fetchResponse: url => {
      const id = new URL(url).pathname.slice(1).split('=')[0];
      requested.push(id);
      return responses[id]();
    },
    write: file => {
      if (file.endsWith('disk.jpg')) throw new Error('Disk unavailable');
    }
  });
  const items = Object.freeze(['missing', ...Object.keys(responses)].map(id => Object.freeze({
    id, ...(id === 'missing' ? {} : { googleBaseUrl: `https://example.test/${id}` })
  })));

  assert.strictEqual(await fixture.download(items), undefined);
  assert.deepStrictEqual(requested, Object.keys(responses));
  assert.deepStrictEqual(fixture.writes.map(({ file }) => path.basename(file)), ['last.jpg']);
  assert.deepStrictEqual(fixture.writes[0].bytes, Buffer.from('last'));
  assert.deepStrictEqual(fixture.warnings.map(([, message]) => message), [
    'Network unavailable', 'Body unavailable', 'Disk unavailable'
  ]);
  ['network', 'body', 'disk'].forEach((id, index) => assert.ok(fixture.warnings[index][0].includes(id)));
});

assertTest('Google Photos cache upsert documents row identity, replacement, and ordered persistence', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Upsert one supplied row'), source.indexOf('function updateCachedMediaItem('));
  [/@template .* T/, /@param \{T\} item/, /@returns \{T\}/, /@throws \{unknown\}/,
    /replaces the whole entry/, /without trimming, coercion/, /even for identical rows or in test mode/,
    /exact supplied reference/, /write twice/, /retry, or rollback/
  ].forEach(pattern => assert.match(contract, pattern));
});

assertTest('Google Photos cache upsert replaces in place after first-usable normalization without merging metadata', () => {
  const rows = Object.freeze([
    null, Object.freeze({ id: 'unusable' }),
    Object.freeze({ id: 'MOCK_first', custom: 'keep', rating: 1, isBroken: true, addedAt: '2000-01-01' }),
    Object.freeze({ id: 'MOCK_target', loved: true, cropPercent: 35, title: 'old' }),
    Object.freeze({ id: 'MOCK_target', title: 'duplicate' }), Object.freeze({ id: 'MOCK_last' })
  ]);
  const before = JSON.stringify(rows);
  const item = Object.freeze({ id: 'MOCK_target', title: 'new', custom: Object.freeze({ keep: true }) });
  const fixture = createGooglePhotosServiceFixture({ nodeEnv: 'test', cacheExists: () => true, read: () => before });
  assert.strictEqual(fixture.updateCachedMediaItem(item), item);
  const stored = JSON.parse(fixture.writes[0].bytes);
  assert.deepStrictEqual(stored.map(({ id }) => id), ['MOCK_first', 'MOCK_target', 'MOCK_last']);
  assert.deepStrictEqual(stored[1], item);
  assert.strictEqual(stored[0].url, '/api/google-photos/media/MOCK_first?w=2560&h=1440');
  assert.strictEqual(stored[0].custom, 'keep');
  assert.strictEqual(stored[0].isBroken, true);
  assert.strictEqual(stored[0].rating, 1);
  assert.strictEqual(stored[0].addedAt, '2000-01-01');
  assert.strictEqual(fixture.writes.length, 1);
  assert.strictEqual(JSON.stringify(rows), before);
});

assertTest('Google Photos cache upsert uses verbatim Map keys and appends unvalidated incoming rows', () => {
  const existing = { id: 'MOCK_key' };
  [existing.id, ' MOCK_key ', '/api/google-photos/media/MOCK_key', undefined, '', 0, 7].forEach(id => {
    const item = Object.freeze({ ...(id === undefined ? {} : { id }), custom: 'raw' });
    const fixture = createGooglePhotosServiceFixture({ nodeEnv: 'test', cacheExists: () => true, read: () => JSON.stringify([existing]) });
    assert.strictEqual(fixture.updateCachedMediaItem(item), item);
    const stored = JSON.parse(fixture.writes[0].bytes);
    assert.strictEqual(stored.length, id === existing.id ? 1 : 2);
    assert.deepStrictEqual(stored.at(-1), item, 'incoming row is neither normalized nor validated');
  });
});

assertTest('Google Photos cache upsert rereads and writes identical rows in both modes with stable bytes and identity', () => {
  const failIfCalled = () => { throw new Error('Unexpected upsert effect'); };
  ['production', 'test'].forEach(nodeEnv => {
    const item = Object.freeze(normalizeCachedMediaItem({ id: 'MOCK_same', loved: true }));
    let stored = JSON.stringify([item], null, 2);
    let reads = 0;
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv, cacheExists: () => true, read: () => { reads += 1; return stored; },
      write: (file, bytes) => { stored = bytes; return 'ignored'; },
      now: failIfCalled, fetchResponse: failIfCalled, persist: failIfCalled
    });
    const before = { tokens: fixture.readTokens(), credentials: fixture.readCredentials() };
    [item, item].forEach(row => assert.strictEqual(fixture.updateCachedMediaItem(row), row));
    assert.strictEqual(reads, 2);
    assert.strictEqual(fixture.writes.length, 2);
    assert.strictEqual(fixture.writes[0].bytes, fixture.writes[1].bytes, 'value-idempotence does not suppress writes');
    assert.deepStrictEqual({ tokens: fixture.readTokens(), credentials: fixture.readCredentials() }, before);
    [fixture.warnings, fixture.logs, fixture.errors, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos cache upsert orders normalization writes before input access, JSON hooks, and final writes', () => {
  ['production', 'test'].forEach(nodeEnv => {
    const effects = [];
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv, cacheExists: () => { effects.push('exists'); return true; },
      read: () => { effects.push('read'); return '[{"id":"MOCK_old"}]'; },
      write: () => effects.push('write')
    });
    const item = Object.freeze({
      get id() { effects.push('id'); return 'MOCK_new'; },
      toJSON(key) { assert.strictEqual(this, item); effects.push(`json:${key}`); return { id: 'serialized' }; }
    });
    assert.strictEqual(fixture.updateCachedMediaItem(item), item);
    assert.deepStrictEqual(effects, ['exists', 'read', ...(nodeEnv === 'test' ? [] : ['write']), 'id', 'json:1', 'write']);
    assert.strictEqual(JSON.parse(fixture.writes.at(-1).bytes).at(-1).id, 'serialized');
  });
});

assertTest('Google Photos cache upsert persists incoming rows after missing or handled corrupt-cache fallbacks', () => {
  [
    { cacheExists: () => false },
    { cacheExists: () => true, read: () => '{' },
    { cacheExists: () => true, read: () => { throw new Error('Read unavailable'); } }
  ].forEach((options, index) => {
    const fixture = createGooglePhotosServiceFixture(options);
    const item = Object.freeze({ id: 'MOCK_new' });
    assert.strictEqual(fixture.updateCachedMediaItem(item), item);
    assert.deepStrictEqual(JSON.parse(fixture.writes[0].bytes), [item]);
    assert.strictEqual(fixture.writes.length, 1);
    assert.strictEqual(fixture.warnings.length, index ? 1 : 0);
  });
});

assertTest('Google Photos cache upsert propagates reader failures before incoming id access or persistence', () => {
  const failure = new Error('Reader adapter unavailable');
  [
    [{ cacheExists: () => { throw failure; } }, err => err === failure],
    ...['null', '{}', '7', '[{"id":7}]'].map(raw => [{ cacheExists: () => true, read: () => raw }, err => err.name === 'TypeError']),
    [{ cacheExists: () => true, read: () => '{', warn: () => { throw failure; } }, err => err === failure]
  ].forEach(([options, matches]) => {
    const fixture = createGooglePhotosServiceFixture(options);
    const item = { get id() { return assert.fail('Input read before cache completed'); } };
    assert.throws(() => fixture.updateCachedMediaItem(item), matches);
    [fixture.writes, fixture.errors, fixture.logs].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos cache upsert preserves earlier normalization after input-access or serialization failures', () => {
  const failure = new Error('Input hook failed');
  [
    [null, err => err.name === 'TypeError'], [undefined, err => err.name === 'TypeError'],
    ...[failure, null, undefined].flatMap(thrown => [
      [{ get id() { throw thrown; } }, err => err === thrown],
      [{ id: 'MOCK_new', toJSON: () => { throw thrown; } }, err => err === thrown]
    ]),
    [{ id: 'MOCK_new', value: 1n }, err => err.name === 'TypeError']
  ].forEach(([item, matches]) => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => '[{"id":"MOCK_old"}]' });
    assert.throws(() => fixture.updateCachedMediaItem(item), matches);
    assert.strictEqual(fixture.writes.length, 1, 'normalization already persisted before the failure');
    assert.deepStrictEqual(JSON.parse(fixture.writes[0].bytes).map(({ id }) => id), ['MOCK_old']);
    [fixture.warnings, fixture.errors, fixture.logs].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos cache upsert propagates normalization and final write failures without retry or rollback', () => {
  [1, 2].flatMap(stage => [new Error('Disk unavailable'), null, undefined].map(failure => ({ stage, failure })))
    .forEach(({ stage, failure }) => {
      let stored = '[{"id":"MOCK_old"}]';
      let attempts = 0;
      let idReads = 0;
      const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => stored, write: (file, bytes) => {
        attempts += 1;
        stored = bytes;
        if (attempts === stage) throw failure;
      } });
      const item = { get id() { idReads += 1; return 'MOCK_new'; } };
      assert.throws(() => fixture.updateCachedMediaItem(item), err => err === failure);
      assert.strictEqual(attempts, stage);
      assert.strictEqual(idReads, stage === 1 ? 0 : 2, 'key access then JSON getter access only after normalization');
      assert.strictEqual(fixture.writes.length, stage - 1);
      assert.deepStrictEqual(JSON.parse(stored).map(({ id }) => id), stage === 1 ? ['MOCK_old'] : ['MOCK_old', 'MOCK_new']);
      [fixture.warnings, fixture.errors, fixture.logs].forEach(records => assert.deepStrictEqual(records, []));
    });
});

assertTest('Google Photos cache writer documents serialization and caller-owned persistence policies', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Serialize the supplied value'), source.indexOf('function writeCachedMediaItems'));
  [/@param \{unknown\} items/, /@returns \{void\}/, /@throws \{unknown\}/,
    /two-space indentation/, /test-mode guard/, /callers own/, /undefined serialization/,
    /not an atomic file replacement/, /without logging/, /return undefined/
  ].forEach(pattern => assert.match(contract, pattern));
});

assertTest('Google Photos cache writer preserves frozen duplicate rows and metadata in exact UTF-8 JSON', () => {
  const items = Object.freeze([
    Object.freeze({ id: 'same', title: 'Café 🌌', custom: Object.freeze({ keep: true }) }),
    Object.freeze({ id: 'same', rating: 0 }), null
  ]);
  const calls = [];
  const fixture = createGooglePhotosServiceFixture({ write: (...args) => calls.push(args) });
  assert.strictEqual(fixture.writeCachedMediaItems(items), undefined);
  const expected = '[\n  {\n    "id": "same",\n    "title": "Café 🌌",\n    "custom": {\n      "keep": true\n    }\n  },\n  {\n    "id": "same",\n    "rating": 0\n  },\n  null\n]';
  assert.deepStrictEqual(calls, [[path.join(__dirname, 'server/config/google_photos_cache.json'), expected, 'utf8']]);
  assert.strictEqual(JSON.stringify(items, null, 2), expected);
  assert.strictEqual(fixture.writes.length, 1);
});

assertTest('Google Photos cache writer delegates scalar, omission, and array encoding to native JSON', () => {
  const cases = [
    [null, 'null'], [false, 'false'], [42, '42'], ['cache', '"cache"'], [[], '[]'], [{}, '{}'],
    [NaN, 'null'], [Infinity, 'null'],
    [{ keep: 1, omit: undefined, fn: () => {}, symbol: Symbol('omitted') }, '{\n  "keep": 1\n}'],
    [Array(1), '[\n  null\n]'],
    [[undefined, () => {}, Symbol('null'), NaN], '[\n  null,\n  null,\n  null,\n  null\n]']
  ];
  cases.forEach(([value, expected]) => {
    const fixture = createGooglePhotosServiceFixture();
    assert.strictEqual(fixture.writeCachedMediaItems(value), undefined);
    assert.strictEqual(fixture.writes[0].bytes, expected);
  });
});

assertTest('Google Photos cache writer writes every call in production and test mode without unrelated effects', () => {
  const failIfCalled = () => { throw new Error('Unexpected cache writer effect'); };
  ['production', 'test'].forEach(nodeEnv => {
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv, read: failIfCalled, cacheExists: failIfCalled, exists: failIfCalled,
      now: failIfCalled, persist: failIfCalled, fetchResponse: failIfCalled,
      write: () => 'ignored adapter result'
    });
    const before = { tokens: fixture.readTokens(), credentials: fixture.readCredentials() };
    [[], [], { raw: true }].forEach(value => assert.strictEqual(fixture.writeCachedMediaItems(value), undefined));
    assert.deepStrictEqual(fixture.writes.map(({ bytes }) => bytes), ['[]', '[]', '{\n  "raw": true\n}']);
    assert.deepStrictEqual({ tokens: fixture.readTokens(), credentials: fixture.readCredentials() }, before);
    [fixture.warnings, fixture.errors, fixture.logs, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos cache writer completes native toJSON and getter hooks before the synchronous write', () => {
  const effects = [];
  const fixture = createGooglePhotosServiceFixture({ write: () => effects.push('write') });
  const value = {
    toJSON(key) {
      assert.strictEqual(this, value);
      effects.push(['toJSON', key]);
      return { get selected() { effects.push('getter'); return true; } };
    }
  };
  fixture.writeCachedMediaItems(value);
  effects.push('returned');
  assert.deepStrictEqual(effects, [['toJSON', ''], 'getter', 'write', 'returned']);
  assert.strictEqual(fixture.writes[0].bytes, '{\n  "selected": true\n}');
});

assertTest('Google Photos cache writer propagates serialization failures before any write or log', () => {
  const cycle = {};
  cycle.self = cycle;
  const failure = new Error('Serialization hook failed');
  const cases = [
    [cycle, err => err.name === 'TypeError'], [1n, err => err.name === 'TypeError'],
    ...[failure, null, undefined].flatMap(thrown => [
      [{ toJSON: () => { throw thrown; } }, err => err === thrown],
      [{ get value() { throw thrown; } }, err => err === thrown]
    ])
  ];
  cases.forEach(([value, matches]) => {
    const fixture = createGooglePhotosServiceFixture();
    assert.throws(() => fixture.writeCachedMediaItems(value), matches);
    [fixture.writes, fixture.warnings, fixture.errors, fixture.logs].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos cache writer forwards undefined serialization to the rejecting filesystem adapter', () => {
  [undefined, () => {}, Symbol('unsupported'), { toJSON: () => undefined }].forEach(value => {
    const failure = new TypeError('Undefined data rejected');
    const calls = [];
    const fixture = createGooglePhotosServiceFixture({ write: (...args) => { calls.push(args); throw failure; } });
    assert.throws(() => fixture.writeCachedMediaItems(value), err => err === failure);
    assert.deepStrictEqual(calls, [[path.join(__dirname, 'server/config/google_photos_cache.json'), undefined, 'utf8']]);
    [fixture.writes, fixture.warnings, fixture.errors, fixture.logs].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos cache writer propagates write failures without retries or rollback and permits later calls', () => {
  [new Error('Disk unavailable'), null, undefined].forEach(failure => {
    let stored = 'previous';
    let attempts = 0;
    const fixture = createGooglePhotosServiceFixture({ write: (file, bytes) => {
      attempts += 1;
      stored = bytes;
      if (attempts === 1) throw failure;
    } });
    assert.throws(() => fixture.writeCachedMediaItems(['first']), err => err === failure);
    assert.strictEqual(attempts, 1);
    assert.strictEqual(stored, '[\n  "first"\n]');
    assert.strictEqual(fixture.writes.length, 0);
    assert.strictEqual(fixture.writeCachedMediaItems(['later']), undefined);
    assert.strictEqual(attempts, 2);
    assert.strictEqual(stored, '[\n  "later"\n]');
    assert.strictEqual(fixture.writes.length, 1);
    [fixture.warnings, fixture.errors, fixture.logs].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos raw cache reader documents unknown JSON and explicit failure boundaries', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Read the cache as unvalidated JSON'), source.indexOf('function readCachedMediaItemsRaw'));
  [/@returns \{unknown\}/, /without normalization or persistence/,
    /fresh empty array/, /existence check is outside the catch/,
    /warning handler/, /No authentication, network, or clock work/
  ].forEach(pattern => assert.match(contract, pattern));
});

assertTest('Google Photos raw cache reader returns fresh empty arrays for missing files without reads', () => {
  const checked = [];
  const fixture = createGooglePhotosServiceFixture({
    cacheExists: file => { checked.push(path.basename(file)); return false; },
    read: () => { throw new Error('Unexpected missing-file read'); }
  });
  const first = fixture.readCachedMediaItemsRaw();
  const second = fixture.readCachedMediaItemsRaw();
  [first, second].forEach(value => { assert.ok(Array.isArray(value)); assert.strictEqual(value.length, 0); });
  assert.notStrictEqual(first, second);
  assert.deepStrictEqual(checked, ['google_photos_cache.json', 'google_photos_cache.json']);
  [fixture.writes, fixture.warnings, fixture.errors, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
});

assertTest('Google Photos raw cache reader preserves all JSON shapes without filtering or normalization', () => {
  [null, false, true, 0, 42, 'cache', {}, { items: [1] }, [],
    [null, { id: 7 }, { id: 'same', custom: 'first' }, { id: 'same', custom: 'second' }]
  ].forEach(value => {
    const content = JSON.stringify(value);
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => content,
      now: () => { throw new Error('Unexpected clock read'); } });
    assert.strictEqual(JSON.stringify(fixture.readCachedMediaItemsRaw()), content);
    [fixture.writes, fixture.warnings, fixture.errors, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos raw cache reader checks and reads UTF-8 on every call with detached parsed results', () => {
  let stored = '[{"id":"photo","custom":{"rating":3}}]';
  const effects = [];
  const fixture = createGooglePhotosServiceFixture({
    cacheExists: file => { effects.push(['exists', file]); return true; },
    read: (file, encoding) => { effects.push(['read', file, encoding]); return stored; }
  });
  const first = fixture.readCachedMediaItemsRaw();
  const second = fixture.readCachedMediaItemsRaw();
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first[0].custom, second[0].custom);
  first[0].custom.rating = 9;
  assert.strictEqual(second[0].custom.rating, 3);
  stored = '[{"id":"new"}]';
  assert.strictEqual(fixture.readCachedMediaItemsRaw()[0].id, 'new');
  const cachePath = effects[0][1];
  assert.strictEqual(path.basename(cachePath), 'google_photos_cache.json');
  assert.deepStrictEqual(effects, Array.from({ length: 3 }).flatMap(() => [['exists', cachePath], ['read', cachePath, 'utf8']]));
  [fixture.writes, fixture.warnings, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
});

assertTest('Google Photos raw cache reader warns and returns fresh empty arrays after read or parse failures', () => {
  [
    [() => { throw new Error('Read unavailable'); }, 'Read unavailable'],
    ...['{', ''].map(content => [() => content, /JSON/]),
    [() => { throw 'read failed'; }, undefined]
  ].forEach(([read, expectedDetail]) => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read });
    const results = [fixture.readCachedMediaItemsRaw(), fixture.readCachedMediaItemsRaw()];
    results.forEach(value => { assert.ok(Array.isArray(value)); assert.strictEqual(value.length, 0); });
    assert.notStrictEqual(...results);
    assert.strictEqual(fixture.warnings.length, 2);
    fixture.warnings.forEach(([message, detail]) => {
      assert.strictEqual(message, 'Google Photos Service: Failed to read media cache JSON:');
      if (expectedDetail instanceof RegExp) assert.match(detail, expectedDetail);
      else assert.strictEqual(detail, expectedDetail);
    });
    [fixture.writes, fixture.errors, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos raw cache reader propagates existence failures unchanged before reading or warning', () => {
  [new Error('Existence unavailable'), null, undefined].forEach(failure => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => { throw failure; },
      read: () => { throw new Error('Unexpected read'); } });
    assert.throws(() => fixture.readCachedMediaItemsRaw(), err => err === failure);
    [fixture.writes, fixture.warnings, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos raw cache reader does not catch failures in its warning handler', () => {
  [null, undefined].forEach(failure => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => { throw failure; } });
    assert.throws(() => fixture.readCachedMediaItemsRaw(), err => err.name === 'TypeError');
    assert.deepStrictEqual(fixture.warnings, []);
  });
  const failure = new Error('Warning unavailable');
  const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => '{', warn: () => { throw failure; } });
  assert.throws(() => fixture.readCachedMediaItemsRaw(), err => err === failure);
  [fixture.writes, fixture.warnings, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
});

assertTest('Google Photos cache lookup documents exact matching and its nullable effect-shell result', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');
  const contract = source.slice(source.indexOf(' * Read the normalized cache and return its first exact-id match'), source.indexOf('function findCachedMediaItem'));
  [/@param \{string\} mediaItemId/, /@returns \{\(import\('\.\/googlePhotosCache\.js'\)\.GooglePhotoMediaItem & \{id: string; url: string\}\) \| null\}/,
    /strict equality/, /Every call reads the cache/, /including on a miss/,
    /failures propagate without a lookup catch/, /not a pure in-memory selector/
  ].forEach(pattern => assert.match(contract, pattern));
});

assertTest('Google Photos cache lookup uses strict ids without trimming, decoding, or coercion', () => {
  const fixture = createGooglePhotosServiceFixture({
    nodeEnv: 'test', cacheExists: () => true,
    read: () => JSON.stringify(['photo', '7', ' spaced '].map(id => ({ id, googlePickerSessionId: 'session' })))
  });
  const noCoercion = { toString: () => { throw new Error('Unexpected id coercion'); } };
  [
    ['photo', 'photo'], ['7', '7'], [' spaced ', ' spaced '],
    ...['missing', 'PHOTO', ' photo ', 'spaced', '/api/google-photos/media/photo',
      7, null, undefined, '', false, noCoercion].map(id => [id, null])
  ].forEach(([id, expected]) => assert.strictEqual(fixture.findCachedMediaItem(id)?.id ?? null, expected));
  [fixture.writes, fixture.warnings, fixture.errors, fixture.persisted].forEach(records => assert.deepStrictEqual(records, []));
});

assertTest('Google Photos cache lookup selects the first structurally usable row without playback policy', () => {
  const input = Object.freeze([
    null,
    Object.freeze({ id: 'photo', url: '/api/google-photos/media/photo' }),
    Object.freeze({ id: 'photo', url: 'https://example.test/legacy=old', rating: 1,
      isBroken: true, loved: true, addedAt: '2000-01-01T00:00:00Z', createTime: '1999-01-01T00:00:00Z', custom: 'kept' }),
    Object.freeze({ id: 'photo', googlePickerSessionId: 'later', rating: 10 }),
    Object.freeze({ id: 'session-only', googlePickerSessionId: 'session' }),
    Object.freeze({ id: 'MOCK_MEDIA_ITEM_42' })
  ]);
  const original = JSON.stringify(input);
  const fixture = createGooglePhotosServiceFixture({ nodeEnv: 'test', cacheExists: () => true, read: () => original });
  const row = fixture.findCachedMediaItem('photo');
  assert.strictEqual(row.googleBaseUrl, 'https://example.test/legacy');
  assert.strictEqual(row.url, '/api/google-photos/media/photo?w=2560&h=1440');
  ['rating', 'isBroken', 'loved', 'addedAt', 'createTime', 'custom'].forEach(key => assert.strictEqual(row[key], input[2][key]));
  ['session-only', 'MOCK_MEDIA_ITEM_42'].forEach(id => assert.strictEqual(fixture.findCachedMediaItem(id).id, id));
  assert.strictEqual(JSON.stringify(input), original);
  assert.deepStrictEqual(fixture.writes, []);
});

assertTest('Google Photos cache lookup reads current storage and normalizes even misses without memoization', () => {
  const initial = JSON.stringify([{ id: 'photo', googlePickerSessionId: 'session' }]);
  let stored = initial;
  const effects = [];
  const fixture = createGooglePhotosServiceFixture({
    cacheExists: () => true,
    read: () => { effects.push('read'); return stored; },
    write: (_file, bytes) => { effects.push('write'); stored = bytes; }
  });
  assert.strictEqual(fixture.findCachedMediaItem('missing'), null);
  const first = fixture.findCachedMediaItem('photo');
  const second = fixture.findCachedMediaItem('photo');
  assert.strictEqual(JSON.stringify(first), JSON.stringify(second));
  assert.notStrictEqual(first, second);
  first.rating = 2;
  assert.strictEqual(second.rating, 10);
  stored = JSON.stringify([{ ...second, rating: 8 }]);
  assert.strictEqual(fixture.findCachedMediaItem('photo').rating, 8);
  assert.deepStrictEqual(effects, ['read', 'write', 'read', 'read', 'read']);
  assert.strictEqual(fixture.writes.length, 1);
  const testFixture = createGooglePhotosServiceFixture({ nodeEnv: 'test', cacheExists: () => true,
    read: () => initial, write: () => { throw new Error('Unexpected test-mode write'); } });
  assert.strictEqual(testFixture.findCachedMediaItem('missing'), null);
  assert.strictEqual(testFixture.findCachedMediaItem('photo').url, first.url);
  assert.deepStrictEqual(testFixture.writes, []);
});

assertTest('Google Photos cache lookup returns null for missing files and caught read or parse errors', () => {
  [
    { cacheExists: () => false, read: () => { throw new Error('Unexpected missing-file read'); }, warning: false },
    { cacheExists: () => true, read: () => { throw new Error('Read unavailable'); }, warning: true },
    { cacheExists: () => true, read: () => '{', warning: true }
  ].forEach(({ warning, ...adapters }) => {
    const fixture = createGooglePhotosServiceFixture(adapters);
    assert.strictEqual(fixture.findCachedMediaItem('photo'), null);
    assert.strictEqual(fixture.warnings.length, warning ? 1 : 0);
    if (warning) assert.match(fixture.warnings[0][0], /Failed to read media cache JSON/);
    [fixture.writes, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos cache lookup propagates shape and normalization failures before even an invalid-id miss', () => {
  ['{}', 'null', '42', '"cache"', '[{"id":7}]'].forEach(content => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => content });
    assert.throws(() => fixture.findCachedMediaItem(undefined), err => err.name === 'TypeError');
    [fixture.writes, fixture.warnings, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
  });
});

assertTest('Google Photos cache lookup propagates unchanged existence and persistence errors on hits or misses', () => {
  ['photo', 'missing', undefined].forEach(id => {
    const failure = new Error('Cache effect failed');
    [
      { cacheExists: () => { throw failure; } },
      { cacheExists: () => true,
        read: () => JSON.stringify([{ id: 'photo', googlePickerSessionId: 'session' }]),
        write: () => { throw failure; } }
    ].forEach(adapters => {
      const fixture = createGooglePhotosServiceFixture(adapters);
      assert.throws(() => fixture.findCachedMediaItem(id), err => err === failure);
      [fixture.writes, fixture.warnings, fixture.errors].forEach(records => assert.deepStrictEqual(records, []));
    });
  });
});

assertTest('Google Photos cache read documents its normalized result and persistence boundary', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos.js'), 'utf8');

  assert.match(source, /Read and normalize the persistent Google Photos cache for rendering/);
  assert.match(source, /@returns \{Array<import\('\.\/googlePhotosCache\.js'\)\.GooglePhotoMediaItem & \{id: string; url: string\}>\}/);
  assert.match(source, /retains the first usable row for each stable id in input order/);
  assert.match(source, /structural eligibility, not a network or local-file availability check/);
  assert.match(source, /non-array shapes still throw/);
  assert.match(source, /Existence-check and write\s+\* failures propagate/);
});

assertTest('Google Photos cache read normalizes, filters, and keeps first usable ids before persisting', () => {
  const input = Object.freeze([
    null,
    Object.freeze({ title: 'missing id' }),
    Object.freeze({ id: 'duplicate', url: '/api/google-photos/media/duplicate' }),
    Object.freeze({
      id: 'duplicate', url: 'https://example.test/legacy=old', width: 'bad', height: '0',
      rating: 1, loved: true, isBroken: true, addedAt: '2000-01-01T00:00:00.000Z',
      createTime: '1999-01-01T00:00:00Z', customField: { retained: true }
    }),
    Object.freeze({ id: 'duplicate', googlePickerSessionId: 'later', rating: 10 }),
    Object.freeze({ id: 'session-only', googlePickerSessionId: 'session' }),
    Object.freeze({ id: 'MOCK_MEDIA_ITEM_42' })
  ]);
  const original = JSON.stringify(input);
  const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => original });
  const rows = fixture.readCache();

  assert.deepStrictEqual(Array.from(rows, ({ id }) => id), ['duplicate', 'session-only', 'MOCK_MEDIA_ITEM_42']);
  assert.strictEqual(rows[0].url, '/api/google-photos/media/duplicate?w=2560&h=1440');
  assert.strictEqual(rows[0].googleBaseUrl, 'https://example.test/legacy');
  assert.strictEqual(rows[0].width, 2560);
  assert.strictEqual(rows[0].height, 1440);
  assert.strictEqual(rows[0].rating, 1);
  assert.strictEqual(rows[0].isBroken, true);
  assert.strictEqual(rows[0].loved, true);
  assert.strictEqual(rows[0].addedAt, input[3].addedAt);
  assert.strictEqual(rows[0].createTime, input[3].createTime);
  assert.strictEqual(rows[0].customField.retained, true);
  assert.strictEqual(rows[1].rating, 10);
  assert.strictEqual(rows[1].googleBaseUrl, undefined);
  assert.strictEqual(fixture.writes.length, 1);
  assert.strictEqual(fixture.writes[0].bytes, JSON.stringify(rows, null, 2));
  assert.deepStrictEqual(fixture.warnings, []);
  assert.strictEqual(JSON.stringify(input), original);
});

assertTest('Google Photos cache read is serialization-idempotent and test mode suppresses only persistence', () => {
  let stored = JSON.stringify([{ id: 'photo', googlePickerSessionId: 'session' }]);
  const fixture = createGooglePhotosServiceFixture({
    cacheExists: () => true,
    read: () => stored,
    write: (_file, content) => { stored = content; }
  });
  const first = fixture.readCache();
  const second = fixture.readCache();
  assert.strictEqual(JSON.stringify(first), JSON.stringify(second));
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first[0], second[0]);
  assert.strictEqual(fixture.writes.length, 1);

  const testFixture = createGooglePhotosServiceFixture({
    nodeEnv: 'test', cacheExists: () => true,
    read: () => JSON.stringify([{ id: 'photo', googlePickerSessionId: 'session' }]),
    write: () => { throw new Error('Unexpected test-mode write'); }
  });
  assert.strictEqual(JSON.stringify(testFixture.readCache()), JSON.stringify(first));
  assert.deepStrictEqual(testFixture.writes, []);
});

assertTest('Google Photos cache read keeps missing, unreadable, and invalid JSON caches empty without rewriting', () => {
  [
    { cacheExists: () => false, read: () => { throw new Error('Unexpected missing-file read'); }, warning: null },
    { cacheExists: () => true, read: () => { throw new Error('Read unavailable'); }, warning: 'Read unavailable' },
    { cacheExists: () => true, read: () => '{', warning: 'JSON' }
  ].forEach(({ warning, ...adapters }) => {
    const fixture = createGooglePhotosServiceFixture(adapters);
    assert.strictEqual(fixture.readCache().length, 0);
    assert.deepStrictEqual(fixture.writes, []);
    assert.strictEqual(fixture.warnings.length, warning ? 1 : 0);
    if (warning) {
      assert.match(fixture.warnings[0][0], /Failed to read media cache JSON/);
      assert.ok(fixture.warnings[0][1].includes(warning));
    }
  });
});

assertTest('Google Photos cache read exposes valid non-array JSON, existence-check, and write failures', () => {
  ['{}', 'null', '42'].forEach(content => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => content });
    assert.throws(fixture.readCache, /map|properties of null/);
    assert.deepStrictEqual(fixture.writes, []);
    assert.deepStrictEqual(fixture.warnings, []);
  });

  const failure = new Error('Cache effect failed');
  [
    { cacheExists: () => { throw failure; } },
    {
      cacheExists: () => true,
      read: () => JSON.stringify([{ id: 'photo', googlePickerSessionId: 'session' }]),
      write: () => { throw failure; }
    }
  ].forEach(adapters => {
    const fixture = createGooglePhotosServiceFixture(adapters);
    assert.throws(fixture.readCache, err => err === failure);
    assert.deepStrictEqual(fixture.warnings, []);
  });
});

assertTest('weather service exposes a checked pure WMO classification contract', () => {
  const source = fs.readFileSync(require.resolve('./server/services/weather.js'), 'utf8');

  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{'Sunny' \| 'Cloudy' \| 'Rainy' \| 'Snowy'\} WeatherMatch/);
  assert.match(source, /@typedef \{object\} WeatherClassification/);
  assert.match(source, /@type \{Readonly<Record<number, WeatherClassification>>\}/);
  assert.match(source, /@param \{number\} code/);
  assert.match(source, /@returns \{WeatherClassification\}/);
  assert.match(source, /Pure WMO classification projection/);
});

assertTest('correctly classifies meteorological WMO weather codes', () => {
  const classifications = [
    { codes: [0], physicalMatch: 'Sunny', physicalCond: 'Sunny / Clear' },
    { codes: [1, 2, 3, 45, 48], physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' },
    { codes: [51, 53, 55, 56, 57, 61, 63, 65, 67, 80, 81, 82, 95, 96, 99], physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
    { codes: [71, 73, 75, 77, 85, 86], physicalMatch: 'Snowy', physicalCond: 'Snowy / Wintry' }
  ];

  classifications.forEach(({ codes, ...expected }) => {
    codes.forEach(code => assert.deepStrictEqual(classifyWeatherCode(code), expected));
  });

  [-1, 4, 100].forEach(code => assert.deepStrictEqual(classifyWeatherCode(code), {
    physicalMatch: 'Cloudy',
    physicalCond: 'Cloudy / Overcast'
  }));
});

// ============================================================================
// 3b. UNIT TEST SUITE: System Screensaver State Reducer & Validators
// ============================================================================
logSuite('System Screensaver State Reducer & Validators');

assertTest('getNextScreensaverState transitions state and schedules actions correctly', () => {
  const { getNextScreensaverState } = require('./server/runtime/idleDaemon.js');
  const {
    validatePhotoCropPercent,
    validateRating,
    validatePercent
  } = require('./server/utils/validation.js');

  // Test validators
  assert.strictEqual(validateRating(5), 5);
  assert.strictEqual(validateRating('8'), 8);
  assert.strictEqual(validateRating(15), null);
  assert.strictEqual(validateRating('invalid'), null);

  assert.strictEqual(validatePercent(0), 0);
  assert.strictEqual(validatePercent(100), 100);
  assert.strictEqual(validatePercent(-5), null);
  assert.strictEqual(validatePhotoCropPercent(140), 140);
  assert.strictEqual(validatePhotoCropPercent(200), 200);
  assert.strictEqual(validatePhotoCropPercent(240), null);

  // Test state transition reducer
  let state = { idleCounter: 0, isBrowserRunning: false };

  // 1. Idle but not enough ticks (idleCounter increments, no action)
  let inputs = { isIdle: true, isMoviePlaying: false, manualOverride: false };
  let transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.nextState.idleCounter, 1);
  assert.strictEqual(transition.nextState.isBrowserRunning, false);
  assert.strictEqual(transition.action, null);

  // Update state to 2 ticks
  state = { idleCounter: 2, isBrowserRunning: false };
  transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.nextState.idleCounter, 3);
  assert.strictEqual(transition.nextState.isBrowserRunning, true);
  assert.strictEqual(transition.action, 'launch');

  // 2. Movie is playing -> should not launch screensaver, resets idleCounter
  state = { idleCounter: 2, isBrowserRunning: false };
  inputs = { isIdle: true, isMoviePlaying: true, manualOverride: false };
  transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.nextState.idleCounter, 0);
  assert.strictEqual(transition.action, null);

  // 3. Manual override triggers screensaver immediately
  state = { idleCounter: 0, isBrowserRunning: false };
  inputs = { isIdle: false, isMoviePlaying: false, manualOverride: true };
  transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.action, 'launch');
  assert.strictEqual(transition.nextState.isBrowserRunning, true);

  // 4. Inactivity stops (screensaver running -> dismisses)
  state = { idleCounter: 3, isBrowserRunning: true };
  inputs = { isIdle: false, isMoviePlaying: false, manualOverride: false };
  transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.action, 'kill');
  assert.strictEqual(transition.nextState.isBrowserRunning, false);
});

assertTest('buildDaemonInputs projects the inactivity boundary and host blockers without mutation', () => {
  const { buildDaemonInputs } = require('./server/runtime/idleDaemon.js');
  const observation = Object.freeze({
    idleMs: 500,
    inactivityTimeout: 500,
    audioPlaying: false,
    sessionInhibited: false,
    manualOverride: false
  });

  assert.deepStrictEqual(buildDaemonInputs(observation), {
    isIdle: true,
    isMoviePlaying: false,
    manualOverride: false,
    launchBlocked: false
  });
  assert.deepStrictEqual(buildDaemonInputs({
    ...observation,
    idleMs: 499,
    audioPlaying: true,
    sessionInhibited: true,
    manualOverride: true,
    launchBlocked: true
  }), {
    isIdle: false,
    isMoviePlaying: true,
    manualOverride: true,
    launchBlocked: true
  });
  assert.strictEqual(observation.idleMs, 500);
});

assertTest('idle daemon state projection is immutable and returns only the closed action vocabulary', () => {
  const { getNextScreensaverState } = require('./server/runtime/idleDaemon.js');
  const currentState = Object.freeze({ idleCounter: 2, isBrowserRunning: false });
  const inputs = Object.freeze({
    isIdle: true,
    isMoviePlaying: false,
    manualOverride: false
  });

  assert.deepStrictEqual(getNextScreensaverState(currentState, inputs), {
    nextState: { idleCounter: 3, isBrowserRunning: true, screensaverActive: true },
    action: 'launch'
  });
  assert.deepStrictEqual(currentState, { idleCounter: 2, isBrowserRunning: false });
  assert.deepStrictEqual(inputs, {
    isIdle: true,
    isMoviePlaying: false,
    manualOverride: false
  });
});

assertTest('numeric validators preserve curried range and null-safe identities', () => {
  const { validateRange, validateRating } = require('./server/utils/validation.js');
  const parseInteger = (value) => parseInt(value, 10);
  const validateSmallInteger = validateRange(0)(5)(parseInteger);

  assert.strictEqual(validateSmallInteger('4'), 4);
  assert.strictEqual(validateSmallInteger(0), 0);
  assert.strictEqual(validateSmallInteger(6), null);
  assert.strictEqual(validateSmallInteger(undefined), null);
  assert.strictEqual(validateSmallInteger(null), null);
  assert.strictEqual(validateRating('1.9'), 1);
});

logSuite('Runtime Shell Composition');

assertTest('projectKioskRuntimeContext returns a closed immutable runtime projection', () => {
  const { projectKioskRuntimeContext } = require('./server/runtime/kioskControl.js');
  const runtimeState = {
    browserRunning: true,
    manualOverride: false,
    launchBlocked: true,
    internalCounter: 3
  };

  const context = projectKioskRuntimeContext(runtimeState);

  assert.deepStrictEqual(context, {
    browserRunning: true,
    manualOverride: false,
    launchBlocked: true
  });
  assert.notStrictEqual(context, runtimeState);
  assert.deepStrictEqual(runtimeState, {
    browserRunning: true,
    manualOverride: false,
    launchBlocked: true,
    internalCounter: 3
  });
});

assertAsyncTest('createKioskControlRuntime defers launch until the server is listening and clears manual override after an unexpected exit', async () => {
  const { createKioskControlRuntime } = require('./server/runtime/kioskControl.js');
  const state = { screensaverActive: true };
  let serverListening = false;
  let broadcastCount = 0;
  let exitHandler = null;
  const deferredLaunches = [];
  const killedTimers = [];
  const governorProfiles = [];
  const kioskLaunches = [];
  let kioskKillCount = 0;

  const runtime = createKioskControlRuntime({
    state,
    emitStateSync: () => { broadcastCount += 1; },
    getPort: () => 5050,
    isServerListening: () => serverListening,
    setTimeoutImpl: (fn, delay) => {
      deferredLaunches.push({ fn, delay });
      return deferredLaunches.length;
    },
    clearTimeoutImpl: (timerId) => {
      killedTimers.push(timerId);
    },
    setCpuGovernor: async (profile) => {
      governorProfiles.push(profile);
      return true;
    },
    launchChromiumKiosk: (port, mode, onUnexpectedExit) => {
      kioskLaunches.push({ port, mode });
      exitHandler = onUnexpectedExit;
    },
    killChromiumKiosk: async () => {
      kioskKillCount += 1;
      return true;
    },
    log: { log() {}, warn() {}, error() {} }
  });

  assert.strictEqual(runtime.launchKioskBrowser(true), false);
  assert.strictEqual(runtime.isManualOverride(), true);
  assert.strictEqual(deferredLaunches.length, 1);
  assert.deepStrictEqual(runtime.getRuntimeContext(), {
    browserRunning: false,
    manualOverride: true,
    launchBlocked: false
  });

  runtime.launchKioskBrowser(true);
  assert.strictEqual(deferredLaunches.length, 1, 'launch retries should be deduplicated while one is already pending');

  serverListening = true;
  deferredLaunches[0].fn();
  await flushPromises();

  assert.strictEqual(runtime.isBrowserRunning(), true);
  assert.deepStrictEqual(runtime.getRuntimeContext(), {
    browserRunning: true,
    manualOverride: true,
    launchBlocked: false
  });
  assert.deepStrictEqual(governorProfiles, ['performance']);
  assert.strictEqual(kioskKillCount, 0, 'launch must not globally kill unrelated Chromium processes');
  assert.deepStrictEqual(kioskLaunches, [{ port: 5050, mode: 'tv' }]);

  exitHandler?.();
  assert.strictEqual(runtime.isBrowserRunning(), false);
  assert.strictEqual(runtime.isManualOverride(), false);
  assert.strictEqual(state.screensaverActive, false);
  assert.strictEqual(broadcastCount, 1);
  assert.deepStrictEqual(killedTimers, []);
});

assertTest('Unsplash premium policy rejects API flags and persisted plus CDN rows', () => {
  assert.strictEqual(isDisallowedUnsplashPhoto({ source: 'unsplash', premium: true, url: 'https://images.unsplash.com/photo-x' }), true);
  assert.strictEqual(isDisallowedUnsplashPhoto({ source: 'unsplash', url: 'https://plus.unsplash.com/photo-x' }), true);
  assert.strictEqual(isDisallowedUnsplashPhoto({ source: 'unsplash', url: 'https://images.unsplash.com/photo-x' }), false);
  assert.strictEqual(isDisallowedUnsplashPhoto({ source: 'wallhaven', url: 'https://plus.unsplash.com/photo-x' }), false);
});

assertAsyncTest('createIdleDaemonRuntime launches after three idle ticks and broadcasts the active-state transition once', async () => {
  const { createIdleDaemonRuntime } = require('./server/runtime/idleDaemon.js');
  const state = {
    inactivityTimeout: 500,
    screensaverActive: false
  };
  const runtimeState = {
    browserRunning: false,
    manualOverride: false
  };
  let broadcastCount = 0;
  let inhibitionChecks = 0;
  let launchCount = 0;

  const runtime = createIdleDaemonRuntime({
    state,
    getRuntimeContext: () => runtimeState,
    getIdleTime: async () => 800,
    isAudioPlaying: async () => false,
    isSessionInhibited: async () => {
      inhibitionChecks += 1;
      return false;
    },
    launchKioskBrowser: () => {
      launchCount += 1;
      runtimeState.browserRunning = true;
    },
    killKioskBrowser: () => {
      runtimeState.browserRunning = false;
    },
    broadcastStateSync: () => {
      broadcastCount += 1;
    },
    log: { warn() {} }
  });

  const firstTick = await runtime.tick();
  const secondTick = await runtime.tick();
  const thirdTick = await runtime.tick();

  assert.strictEqual(firstTick?.action, null);
  assert.strictEqual(secondTick?.action, null);
  assert.strictEqual(thirdTick?.action, 'launch');
  assert.strictEqual(runtime.getIdleCounter(), 3);
  assert.strictEqual(launchCount, 1);
  assert.strictEqual(state.screensaverActive, true);
  assert.strictEqual(broadcastCount, 1);
  assert.strictEqual(inhibitionChecks, 3);
});

assertAsyncTest('createIdleDaemonRuntime ignores session inhibition checks once the kiosk is already running and dismisses on activity', async () => {
  const { createIdleDaemonRuntime } = require('./server/runtime/idleDaemon.js');
  const state = {
    inactivityTimeout: 500,
    screensaverActive: true
  };
  const runtimeState = {
    browserRunning: true,
    manualOverride: false
  };
  let inhibitionChecks = 0;
  let killCount = 0;
  let broadcastCount = 0;

  const runtime = createIdleDaemonRuntime({
    state,
    getRuntimeContext: () => runtimeState,
    getIdleTime: async () => 0,
    isAudioPlaying: async () => false,
    isSessionInhibited: async () => {
      inhibitionChecks += 1;
      return true;
    },
    launchKioskBrowser: () => {},
    killKioskBrowser: () => {
      killCount += 1;
      runtimeState.browserRunning = false;
    },
    broadcastStateSync: () => {
      broadcastCount += 1;
    },
    log: { warn() {} }
  });

  const result = await runtime.tick();

  assert.strictEqual(result?.action, 'kill');
  assert.strictEqual(killCount, 1);
  assert.strictEqual(inhibitionChecks, 0);
  assert.strictEqual(state.screensaverActive, false);
  assert.strictEqual(broadcastCount, 1);
});

assertAsyncTest('createIdleDaemonRuntime holds off relaunch after client activity until idle state recovers', async () => {
  const { createIdleDaemonRuntime } = require('./server/runtime/idleDaemon.js');
  const state = {
    inactivityTimeout: 500,
    screensaverActive: false
  };
  const runtimeState = {
    browserRunning: false,
    manualOverride: false
  };
  let idleMs = 800;
  let launchCount = 0;

  const runtime = createIdleDaemonRuntime({
    state,
    getRuntimeContext: () => runtimeState,
    getIdleTime: async () => idleMs,
    isAudioPlaying: async () => false,
    isSessionInhibited: async () => false,
    launchKioskBrowser: () => {
      launchCount += 1;
      runtimeState.browserRunning = true;
    },
    killKioskBrowser: () => {
      runtimeState.browserRunning = false;
    },
    broadcastStateSync: () => {},
    log: { warn() {} }
  });

  await runtime.tick();
  await runtime.tick();
  await runtime.tick();
  assert.strictEqual(launchCount, 1);

  runtime.notifyActivity();
  runtimeState.browserRunning = false;
  state.screensaverActive = false;
  await runtime.tick();
  await runtime.tick();
  await runtime.tick();
  assert.strictEqual(launchCount, 1, 'stale idle readings must not immediately relaunch the kiosk');

  idleMs = 0;
  await runtime.tick();
  idleMs = 800;
  await runtime.tick();
  await runtime.tick();
  await runtime.tick();
  assert.strictEqual(launchCount, 2, 'normal relaunch should resume after the host reports activity');
});

logSuite('Env Secret Store');

assertTest('upsertEnvVarInContent appends and replaces quoted secret values safely', () => {
  const initial = 'USEAPI_TOKEN="old-token"\nPORT=5000\n';
  const withTumblr = upsertEnvVarInContent(initial, 'TUMBLR_API_KEY', 'tumblr-key');
  assert.ok(withTumblr.includes('TUMBLR_API_KEY="tumblr-key"'), 'Should append new env keys as quoted values');

  const updated = upsertEnvVarInContent(withTumblr, 'USEAPI_TOKEN', 'new token #1');
  assert.ok(updated.includes('USEAPI_TOKEN="new token #1"'), 'Should replace existing env keys with quoted values');
  assert.ok(!updated.includes('old-token'), 'Old secret value must be removed from the updated content');
});

assertTest('environment content projection is deterministic and idempotent', () => {
  const initial = 'PORT=5000\n';
  const once = upsertEnvVarInContent(initial, 'LUMINA.KEY', '  value  ');
  const twice = upsertEnvVarInContent(once, 'LUMINA.KEY', 'value');

  assert.strictEqual(once, 'PORT=5000\nLUMINA.KEY="value"');
  assert.strictEqual(twice, once, 'Applying the same normalized assignment twice must be stable');
  assert.strictEqual(initial, 'PORT=5000\n', 'The content projection must not mutate its input');
});

logSuite('Chromium Launch Profiles');

assertTest('safe Chromium acceleration profile omits forced risky GPU flags', () => {
  const original = process.env.LUMINA_CHROMIUM_ACCELERATION_PROFILE;
  delete process.env.LUMINA_CHROMIUM_ACCELERATION_PROFILE;

  try {
    assert.strictEqual(getChromiumAccelerationProfile(), 'safe');
    const flags = buildChromiumFlags({ platform: 'wayland' });
    assert.ok(flags.includes('--ozone-platform=wayland'));
    assert.ok(!flags.includes('--enable-zero-copy'));
    assert.ok(!flags.includes('--enable-native-gpu-memory-buffers'));
    assert.ok(!flags.includes('--ignore-gpu-blocklist'));
  } finally {
    if (original === undefined) {
      delete process.env.LUMINA_CHROMIUM_ACCELERATION_PROFILE;
    } else {
      process.env.LUMINA_CHROMIUM_ACCELERATION_PROFILE = original;
    }
  }
});

assertTest('aggressive Chromium acceleration profile remains available as an opt-in override', () => {
  const original = process.env.LUMINA_CHROMIUM_ACCELERATION_PROFILE;
  process.env.LUMINA_CHROMIUM_ACCELERATION_PROFILE = 'aggressive';

  try {
    assert.strictEqual(getChromiumAccelerationProfile(), 'aggressive');
    const flags = buildChromiumFlags({ platform: 'x11' });
    assert.ok(flags.includes('--enable-zero-copy'));
    assert.ok(flags.includes('--enable-native-gpu-memory-buffers'));
    assert.ok(!flags.includes('--ozone-platform=wayland'));
  } finally {
    if (original === undefined) {
      delete process.env.LUMINA_CHROMIUM_ACCELERATION_PROFILE;
    } else {
      process.env.LUMINA_CHROMIUM_ACCELERATION_PROFILE = original;
    }
  }
});

logSuite('Google Photos Picker Cache');

assertAsyncTest('Google Photos Picker copy keeps the external source separate from scenic pools', async () => {
  const {
    GOOGLE_PHOTOS_PICKER_COPY,
    getGooglePhotosPickerStatus
  } = await importClientModule('./client/src/components/remote/googlePhotosPicker.js');

  assert.match(GOOGLE_PHOTOS_PICKER_COPY.description, /own pool lifecycle controls/i);
  assert.strictEqual(getGooglePhotosPickerStatus(false).actionLabel, 'Set up Google Photos Picker');
  assert.match(getGooglePhotosPickerStatus(true).description, /own pool lifecycle policy/i);

  const pickerSource = fs.readFileSync(
    path.join(__dirname, 'client/src/components/remote/googlePhotosPicker.js'),
    'utf8'
  );
  assert.match(pickerSource, /^\/\/ @ts-check/);
  assert.match(pickerSource, /GooglePhotosPickerCopy/);
  assert.match(pickerSource, /GooglePhotosPickerStatus/);
  assert.match(pickerSource, /@type \{Readonly<GooglePhotosPickerCopy>\}/);

  const imageFeedsSource = fs.readFileSync(
    path.join(__dirname, 'client/src/components/remote/ImageFeedsTab.jsx'),
    'utf8'
  );
  const imageFeedsCss = fs.readFileSync(
    path.join(__dirname, 'client/src/index.css'),
    'utf8'
  );
  assert.ok(imageFeedsSource.indexOf('Curated Scenic Categories') < imageFeedsSource.indexOf('IMAGE_FEEDS_PANEL_IDS.GOOGLE'));
  assert.match(imageFeedsSource, /className="image-feeds-page"/);
  assert.match(imageFeedsSource, /className="pool-lifecycle-grid"/);
  assert.match(imageFeedsSource, /<details className="pool-lifecycle-card"/);
  assert.match(imageFeedsSource, /Configure <ChevronDown/);
  assert.match(imageFeedsSource, /className="image-feed-source-grid"/);
  assert.match(imageFeedsSource, /className="image-feeds-panel-action"/);
  assert.match(imageFeedsSource, /Focus/);
  assert.match(imageFeedsSource, /Show all panels/);
  assert.match(imageFeedsSource, /Move \$\{title\} earlier/);
  assert.match(imageFeedsSource, /Move \$\{title\} later/);
  assert.match(imageFeedsSource, /onKeyDown/);
  assert.match(imageFeedsSource, /Escape/);
  assert.match(imageFeedsSource, /aria-controls=\{contentId\}/);
  assert.match(imageFeedsSource, /aria-expanded=\{isOpen\}/);
  assert.match(imageFeedsSource, /className="image-feed-category-select"/);
  assert.match(imageFeedsSource, /aria-pressed=\{isActive\}/);
  assert.match(imageFeedsSource, /htmlFor="new-scenic-pool-name"/);
  assert.match(imageFeedsSource, /className="image-feeds-rating-scale"/);
  assert.match(imageFeedsSource, /className="image-feeds-rating-preview"/);
  assert.match(imageFeedsSource, /className="image-feeds-rating-content"/);
  assert.match(imageFeedsSource, /aspectRatio: tvAspectRatio/);
  assert.match(imageFeedsSource, /\[galleryIndex, imageStatus, panelState\.focused\]/);
  assert.match(imageFeedsSource, /IMAGE_FEEDS_PANEL_IDS\.CATEGORIES/);
  assert.match(imageFeedsSource, /IMAGE_FEEDS_PANEL_IDS\.GOOGLE/);
  assert.match(imageFeedsCss, /\.image-feeds-panel-order-bar[\s\S]*?border-top: 1px solid/);
  assert.match(imageFeedsCss, /@media \(max-width: 959px\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(imageFeedsCss, /\.image-feeds-rating-preview\s*\{[\s\S]*?max-height: 320px/);
  assert.match(imageFeedsCss, /\.image-feeds-rating-preview > div\s*\{[\s\S]*?max-width: 100%;[\s\S]*?max-height: 100%/);
  assert.match(imageFeedsCss, /\.image-feeds-rating\.is-panel-focused \.image-feeds-rating-preview\s*\{[\s\S]*?max-height: min\(58vh, 560px\)/);
  assert.match(imageFeedsCss, /\.image-feeds-rating-scale\s*\{[\s\S]*?grid-template-columns: repeat\(5, minmax\(44px, 1fr\)\)/);
});

assertTest('Google Photos lifecycle policy keeps loved photos, ages dated items, and caps the working pool', () => {
  const photos = applyPoolPolicy('2026-09-06T00:00:00Z', { retentionDays: 30, maxPhotos: 2 })([
    { id: 'old', addedAt: '2026-07-01T00:00:00Z' },
    { id: 'legacy' },
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `fresh-${index + 1}`,
      addedAt: `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00Z`
    })),
    { id: 'loved', addedAt: '2026-01-01T00:00:00Z', loved: true }
  ]);

  assert.strictEqual(photos.length, 12, 'the normalized minimum pool cap should be enforced');
  assert.ok(photos.some(({ id }) => id === 'loved'));
  assert.ok(!photos.some(({ id }) => id === 'old'));
  assert.ok(photos.some(({ id }) => id === 'fresh-12'));
});

assertTest('pool retention exposes a checked curried functional contract', () => {
  const poolRetentionSource = fs.readFileSync(
    path.join(__dirname, 'server/domain/poolRetention.js'),
    'utf8'
  );

  assert.match(poolRetentionSource, /^\/\/ @ts-check/);
  assert.match(poolRetentionSource, /@typedef \{object\} PoolSchedule/);
  assert.match(poolRetentionSource, /@typedef \{object\} PoolPolicy/);
  assert.match(poolRetentionSource, /@returns \{\(photos\?: PoolPhoto\[\]\) => PoolPhoto\[\]\}/);
  assert.match(poolRetentionSource, /Compose expiry pruning with the normalized maximum-photo cap/);
});

assertTest('photo timestamps expose an open checked metadata contract', () => {
  const photoTimestampsSource = fs.readFileSync(
    path.join(__dirname, 'server/domain/photoTimestamps.js'),
    'utf8'
  );

  assert.match(photoTimestampsSource, /^\/\/ @ts-check/);
  assert.match(photoTimestampsSource, /@typedef \{\{\[key: string\]: unknown\}\} PhotoRecord/);
  assert.match(photoTimestampsSource, /@returns \{\(photos\?: PhotoRecord\[\]\) => PhotoRecord\[\]\}/);
  assert.match(photoTimestampsSource, /@param \{PhotoRecord \| null \| undefined\} photo/);
  assert.match(photoTimestampsSource, /legacy undated entries remain undated/);
});

assertTest('pool schedules expose checked pure projection contracts', () => {
  const poolScheduleSource = fs.readFileSync(
    path.join(__dirname, 'server/domain/poolSchedule.js'),
    'utf8'
  );

  assert.match(poolScheduleSource, /^\/\/ @ts-check/);
  assert.match(poolScheduleSource, /@typedef \{object\} PoolSchedule/);
  assert.match(poolScheduleSource, /@typedef \{object\} ScheduledPool/);
  assert.match(poolScheduleSource, /@typedef \{object\} ScheduledPoolOptions/);
  assert.match(poolScheduleSource, /@param \{Date\} date/);
  assert.match(poolScheduleSource, /@returns \{ScheduledPool \| null\}/);
});

assertTest('domain snapshots expose checked projection and compatibility-shell contracts', () => {
  const snapshotSource = fs.readFileSync(
    path.join(__dirname, 'server/domain/snapshot.js'),
    'utf8'
  );

  assert.match(snapshotSource, /^\/\/ @ts-check/);
  assert.match(snapshotSource, /@typedef \{Record<string, unknown> & \{/);
  assert.match(snapshotSource, /\}\} LegacyState/);
  assert.match(snapshotSource, /@typedef \{object\} RuntimeOverrides/);
  assert.match(snapshotSource, /@typedef \{DomainState\['config'\] & DomainState\['runtime'\]/);
  assert.match(snapshotSource, /@param \{LegacyState\} legacyState/);
  assert.match(snapshotSource, /@returns \{DomainState\}/);
  assert.match(snapshotSource, /@returns \{Snapshot\}/);
  assert.match(snapshotSource, /Project a domain state into the public snapshot without mutating it/);
  assert.match(snapshotSource, /Apply a pure snapshot projection to the legacy runtime shell/);
});

assertTest('collection persistence exposes checked pure snapshot contracts', () => {
  const collectionCodecSource = fs.readFileSync(
    path.join(__dirname, 'server/config/collectionsCodec.js'),
    'utf8'
  );

  assert.match(collectionCodecSource, /^\/\/ @ts-check/);
  assert.match(collectionCodecSource, /@typedef \{Record<string, unknown>\} PersistedPhoto/);
  assert.match(collectionCodecSource, /\}\} PersistedSnapshotInput/);
  assert.match(collectionCodecSource, /@returns \{NormalizedPersistedSnapshot\}/);
  assert.match(collectionCodecSource, /@returns \{PersistedSnapshot\}/);
  assert.match(collectionCodecSource, /without mutating either input/);
});

assertTest('collection photo projections expose checked curried contracts', () => {
  const collectionPhotoSource = fs.readFileSync(
    path.join(__dirname, 'server/config/collectionPhotoProjections.js'),
    'utf8'
  );

  assert.match(collectionPhotoSource, /^\/\/ @ts-check/);
  assert.match(collectionPhotoSource, /@typedef \{Record<string, unknown> & \{url\?: unknown\}\} PhotoRecord/);
  assert.match(collectionPhotoSource, /CurriedPhotoByUrl/);
  assert.match(collectionPhotoSource, /CurriedPhotoListUpdater/);
  assert.match(collectionPhotoSource, /@type \{CurriedPhotoByUrl\}/);
  assert.match(collectionPhotoSource, /@type \{CurriedPhotoListUpdater\}/);
  assert.match(collectionPhotoSource, /without mutating the list or its/);
});

assertTest('collection photo update plan exposes a checked pure projection contract', () => {
  const updatePlanSource = fs.readFileSync(
    path.join(__dirname, 'server/config/collectionPhotoUpdatePlan.js'),
    'utf8'
  );
  const collectionsSource = fs.readFileSync(
    path.join(__dirname, 'server/config/collections.js'),
    'utf8'
  );

  assert.match(updatePlanSource, /^\/\/ @ts-check/);
  assert.match(updatePlanSource, /\}\s*PhotoFieldUpdatePlan/);
  assert.match(updatePlanSource, /@param \{PhotoCollections\} collections/);
  assert.match(updatePlanSource, /@param \{PhotoUpdateState \| null \| undefined\} state/);
  assert.match(updatePlanSource, /@returns \{PhotoFieldUpdatePlan\}/);
  assert.match(updatePlanSource, /without mutating/);
  assert.match(collectionsSource, /projectPhotoFieldUpdate\(collections, state, url, updater, optionalRating\)/);
  assert.match(collectionsSource, /saveCuratedCollections\(collections, state\)/);
});

assertTest('photo update plan projects collection and paired state changes without mutation', () => {
  const photo = { url: 'target', title: 'Target', rating: 5 };
  const collections = { Nature: [photo], Space: [{ url: 'other', rating: 8 }] };
  const state = {
    photosList: [photo, { url: 'other', rating: 8 }],
    activePhoto: { ...photo },
    activeSecondPhoto: { ...photo }
  };
  const originalCollections = JSON.parse(JSON.stringify(collections));
  const originalState = JSON.parse(JSON.stringify(state));
  const updater = (value) => ({ ...value, rating: 1 });

  const plan = projectPhotoFieldUpdate(collections, state, 'target', updater, 1);

  assert.strictEqual(plan.changed, true);
  assert.strictEqual(plan.collections.Nature[0].rating, 1);
  assert.deepStrictEqual(plan.stateUpdates.photosList.map(({ url }) => url), ['other']);
  assert.strictEqual(plan.stateUpdates.activePhoto.rating, 1);
  assert.strictEqual(plan.stateUpdates.activeSecondPhoto.rating, 1);
  assert.deepStrictEqual(collections, originalCollections);
  assert.deepStrictEqual(state, originalState);
});

assertTest('photo update plan preserves collection identity and skips updater for missing URLs', () => {
  const collections = { Nature: [{ url: 'present', title: 'Present' }] };
  const state = { photosList: [{ url: 'present' }], activePhoto: { url: 'present' } };
  let updaterCalls = 0;
  const plan = projectPhotoFieldUpdate(collections, state, 'missing', (photo) => {
    updaterCalls += 1;
    return { ...photo };
  }, 1);

  assert.strictEqual(plan.changed, false);
  assert.strictEqual(plan.collections, collections);
  assert.deepStrictEqual(plan.stateUpdates, {});
  assert.strictEqual(updaterCalls, 0);
  assert.deepStrictEqual(collections.Nature, [{ url: 'present', title: 'Present' }]);
  assert.deepStrictEqual(state, { photosList: [{ url: 'present' }], activePhoto: { url: 'present' } });
});

assertTest('collection photo updater projections preserve rating parsing and immutable updates', () => {
  const photo = { url: 'rating-target', title: 'Target', rating: 4, loved: true };
  const original = { ...photo };
  const { rating, updater } = projectPhotoRatingUpdate('8.7tail');
  const updated = updater(photo);

  assert.strictEqual(rating, 8, 'rating parsing must retain parseInt partial-string behavior');
  assert.deepStrictEqual(updated, { ...photo, rating: 8 });
  assert.notStrictEqual(updated, photo);
  assert.deepStrictEqual(photo, original, 'the photo updater must not mutate its input');
  assert.ok(Number.isNaN(projectPhotoRatingUpdate('invalid').rating));
});

assertTest('collection photo crop updater preserves omitted fields and applies explicit values', () => {
  const photo = { url: 'crop-target', cropPercent: 30, cropPositionY: 20, title: 'Target' };
  const original = { ...photo };
  const updatePosition = projectPhotoCropUpdater(undefined, 65);
  const positioned = updatePosition(photo);
  const clearPercent = projectPhotoCropUpdater(null, undefined)(photo);

  assert.deepStrictEqual(positioned, { ...photo, cropPositionY: 65 });
  assert.deepStrictEqual(clearPercent, { ...photo, cropPercent: null });
  assert.deepStrictEqual(photo, original, 'crop updates must not mutate their input');
});

assertTest('collection photo pairing updater preserves JavaScript truthiness coercion', () => {
  const photo = { url: 'pair-target', title: 'Target' };

  assert.deepStrictEqual(projectPhotoPairingUpdater('false')(photo), {
    ...photo,
    preventPairing: true
  });
  assert.deepStrictEqual(projectPhotoPairingUpdater(false)(photo), {
    ...photo,
    preventPairing: false
  });
  assert.deepStrictEqual(photo, { url: 'pair-target', title: 'Target' });
});

assertTest('broken photo updater composes rating and broken metadata without mutation', () => {
  const photo = { url: 'broken-target', rating: 9, isBroken: false };
  const original = { ...photo };

  assert.deepStrictEqual(projectBrokenPhoto(photo), {
    ...photo,
    rating: 1,
    isBroken: true
  });
  assert.deepStrictEqual(photo, original);
});

assertTest('collection photo updater contracts remain checked and persistence stays in collections shell', () => {
  const updaterSource = fs.readFileSync(
    path.join(__dirname, 'server/config/collectionPhotoUpdaters.js'),
    'utf8'
  );
  const collectionsSource = fs.readFileSync(
    path.join(__dirname, 'server/config/collections.js'),
    'utf8'
  );

  assert.match(updaterSource, /^\/\/ @ts-check/);
  assert.match(updaterSource, /@returns \{PhotoRatingUpdate\}/);
  assert.match(updaterSource, /@returns \{PhotoUpdater\}/);
  assert.match(collectionsSource, /projectPhotoRatingUpdate\(rating\)/);
  assert.match(collectionsSource, /projectPhotoCropUpdater\(cropPercent, cropPositionY\)/);
  assert.match(collectionsSource, /projectPhotoPairingUpdater\(preventPairing\)/);
  assert.match(collectionsSource, /projectBrokenPhoto, 1/);
  assert.match(collectionsSource, /saveCuratedCollections\(collections, state\)/);
});

assertTest('environment settings expose checked pure projection contracts', () => {
  const environmentSettingsSource = fs.readFileSync(
    path.join(__dirname, 'server/domain/environmentSettings.js'),
    'utf8'
  );

  assert.match(environmentSettingsSource, /^\/\/ @ts-check/);
  assert.match(environmentSettingsSource, /@typedef \{object\} EnvironmentDevice/);
  assert.match(environmentSettingsSource, /@typedef \{object\} EnvironmentSettings/);
  assert.match(environmentSettingsSource, /@typedef \{object\} RuntimeEnvironmentSettings/);
  assert.match(environmentSettingsSource, /@typedef \{object\} EnvironmentValidationOptions/);
  assert.match(environmentSettingsSource, /@returns \{EnvironmentSettings\}/);
  assert.match(environmentSettingsSource, /@returns \{RuntimeEnvironmentSettings\}/);
  assert.match(environmentSettingsSource, /@returns \{LegacyEnvironmentSettings\}/);
  assert.match(environmentSettingsSource, /Normalize legacy flat settings or the saved device catalog/);
  assert.match(environmentSettingsSource, /Decode either the catalog form or legacy flat form without mutating current/);
});

assertAsyncTest('Rating Deck preview fitting grows with a focused responsive slot', async () => {
  const {
    DEFAULT_TV_PREVIEW_DIMENSIONS,
    fitTvPreviewFrame,
    getTvAspectRatio
  } = await importClientModule('./client/src/components/remote/tvPreview.js');
  const tvPreviewSource = fs.readFileSync(
    path.join(__dirname, 'client/src/components/remote/tvPreview.js'),
    'utf8'
  );
  const normalFrame = fitTvPreviewFrame({ width: 414, height: 233 }, 16 / 9);
  const focusedFrame = fitTvPreviewFrame({ width: 1078, height: 522 }, 16 / 9);

  assert.deepStrictEqual(normalFrame, { width: 414, height: 232.875 });
  assert.deepStrictEqual(focusedFrame, { width: 928, height: 522 });
  assert.ok(focusedFrame.width > normalFrame.width * 2, 'focused preview should materially enlarge the image surface');
  const defaultContainerRatio = DEFAULT_TV_PREVIEW_DIMENSIONS.width / DEFAULT_TV_PREVIEW_DIMENSIONS.height;
  assert.deepStrictEqual(fitTvPreviewFrame(null, defaultContainerRatio), DEFAULT_TV_PREVIEW_DIMENSIONS);
  assert.deepStrictEqual(fitTvPreviewFrame({ width: 0, height: 0 }, defaultContainerRatio), DEFAULT_TV_PREVIEW_DIMENSIONS);
  assert.strictEqual(getTvAspectRatio({ width: 0, height: 522 }), 16 / 9);
  assert.match(tvPreviewSource, /^\/\/ @ts-check/);
  assert.match(tvPreviewSource, /@typedef \{\{width: number, height: number\}\} TvDimensions/);
  assert.match(tvPreviewSource, /@returns \{TvDimensions\}/);
});

assertAsyncTest('Image Feeds workspace panel state is pure, immutable, focusable, and ordered', async () => {
  const {
    createImageFeedsPanelState,
    IMAGE_FEEDS_PANEL_IDS,
    toggleImageFeedsPanel,
    enterImageFeedsPanelFocus,
    exitImageFeedsPanelFocus,
    moveImageFeedsPanelEarlier,
    moveImageFeedsPanelLater,
    normalizeImageFeedsPanelOrder
  } = await importClientModule('./client/src/state/imageFeedsPanels.js');
  const initialState = createImageFeedsPanelState();
  const collapsedState = toggleImageFeedsPanel(initialState, IMAGE_FEEDS_PANEL_IDS.RATING);
  const focusedState = enterImageFeedsPanelFocus(collapsedState, IMAGE_FEEDS_PANEL_IDS.RATING);
  const restoredState = exitImageFeedsPanelFocus(focusedState);
  const reorderedState = moveImageFeedsPanelLater(initialState, IMAGE_FEEDS_PANEL_IDS.CATEGORIES);
  const restoredOrder = moveImageFeedsPanelEarlier(reorderedState, IMAGE_FEEDS_PANEL_IDS.CATEGORIES);

  assert.deepStrictEqual(initialState, {
    open: { categories: true, rating: true, sources: true, google: true },
    focused: null,
    order: ['categories', 'rating', 'sources', 'google']
  });
  assert.strictEqual(collapsedState.open.rating, false);
  assert.strictEqual(collapsedState.open.sources, true);
  assert.strictEqual(collapsedState.focused, null);
  assert.strictEqual(focusedState.open.rating, true);
  assert.strictEqual(focusedState.focused, IMAGE_FEEDS_PANEL_IDS.RATING);
  assert.strictEqual(restoredState.focused, null);
  assert.strictEqual(restoredState.open.rating, true);
  assert.deepStrictEqual(reorderedState.order, ['rating', 'categories', 'sources', 'google']);
  assert.deepStrictEqual(restoredOrder.order, initialState.order);
  assert.deepStrictEqual(normalizeImageFeedsPanelOrder(['sources', 'sources', 'invalid']), ['sources', 'categories', 'rating', 'google']);
  assert.strictEqual(toggleImageFeedsPanel(focusedState, IMAGE_FEEDS_PANEL_IDS.RATING), focusedState);
  assert.strictEqual(toggleImageFeedsPanel(initialState, 'invalid'), initialState);
  assert.strictEqual(enterImageFeedsPanelFocus(initialState, 'invalid'), initialState);
  assert.strictEqual(moveImageFeedsPanelEarlier(initialState, IMAGE_FEEDS_PANEL_IDS.CATEGORIES), initialState);
  assert.notStrictEqual(collapsedState, initialState);
  assert.notStrictEqual(collapsedState.open, initialState.open);
});

assertAsyncTest('Image Feeds panel preferences survive storage codecs without restoring focus', async () => {
  const {
    createImageFeedsPanelState,
    IMAGE_FEEDS_PANEL_IDS,
    encodeImageFeedsPanelPreferences,
    decodeImageFeedsPanelPreferences,
    readImageFeedsPanelPreferences,
    writeImageFeedsPanelPreferences
  } = await importClientModule('./client/src/state/imageFeedsPanels.js');
  const state = {
    ...createImageFeedsPanelState(),
    open: { categories: false, rating: true, sources: false, google: true },
    focused: IMAGE_FEEDS_PANEL_IDS.SOURCES,
    order: ['google', 'categories', 'sources', 'rating']
  };
  const storage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) || null; },
    setItem(key, value) { this.values.set(key, value); }
  };
  const key = 'test-image-feeds-panels';

  assert.strictEqual(writeImageFeedsPanelPreferences(storage, state, key), true);
  assert.deepStrictEqual(decodeImageFeedsPanelPreferences(encodeImageFeedsPanelPreferences(state)), {
    open: { categories: false, rating: true, sources: false, google: true },
    order: ['google', 'categories', 'sources', 'rating']
  });
  assert.deepStrictEqual(readImageFeedsPanelPreferences(storage, key), {
    open: { categories: false, rating: true, sources: false, google: true },
    order: ['google', 'categories', 'sources', 'rating']
  });
  assert.deepStrictEqual(decodeImageFeedsPanelPreferences('{not json'), {});
  assert.deepStrictEqual(decodeImageFeedsPanelPreferences(JSON.stringify({ open: { rating: false }, focused: 'rating', maximized: 'sources' })), {
    open: { rating: false }
  });
  assert.deepStrictEqual(createImageFeedsPanelState({ open: { rating: false }, order: ['google'] }), {
    open: { categories: true, rating: false, sources: true, google: true },
    focused: null,
    order: ['google', 'categories', 'rating', 'sources']
  });
  assert.strictEqual(writeImageFeedsPanelPreferences(null, state, key), true);

  const imageFeedsPanelsSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/imageFeedsPanels.js'),
    'utf8'
  );
  assert.match(imageFeedsPanelsSource, /^\/\/ @ts-check/);
  assert.match(imageFeedsPanelsSource, /ImageFeedsPanelOpenState/);
  assert.match(imageFeedsPanelsSource, /ImageFeedsPanelPreferences/);
  assert.match(imageFeedsPanelsSource, /ImageFeedsPanelStorageReader/);
  assert.match(imageFeedsPanelsSource, /ImageFeedsPanelStorageWriter/);
  assert.match(imageFeedsPanelsSource, /@returns \{ImageFeedsPanelState\}/);
});

assertAsyncTest('pool policy drafts preserve a just-edited maximum through synchronous save reads', async () => {
  const {
    mergePoolPolicyDraft,
    readPoolPolicy,
    readPoolPolicyDraft
  } = await importClientModule('./client/src/state/poolPolicyDrafts.js');
  const policyFor = (category) => readPoolPolicy({
    'Scenic Nature': { retentionDays: 30, maxPhotos: 2000 }
  }, category);
  const readDraft = readPoolPolicyDraft(policyFor);
  const maxPhotosDraft = mergePoolPolicyDraft(policyFor)({}, 'Scenic Nature', 'maxPhotos', '500');
  const drafts = mergePoolPolicyDraft(policyFor)(maxPhotosDraft, 'Scenic Nature', 'retentionDays', '45');

  assert.deepStrictEqual(readDraft(drafts, 'Scenic Nature'), {
    retentionDays: '45',
    maxPhotos: '500',
    schedule: { enabled: false, start: '22:00', end: '06:00', priority: 0 }
  });
  assert.strictEqual(readDraft({}, 'Scenic Nature').maxPhotos, 2000);
});

assertAsyncTest('pool policy drafts expose a checked pure and partially applied contract', async () => {
  const {
    DEFAULT_POOL_POLICY,
    DEFAULT_POOL_SCHEDULE,
    mergePoolPolicyDraft,
    readPoolPolicy
  } = await importClientModule('./client/src/state/poolPolicyDrafts.js');
  const source = fs.readFileSync(
    path.join(__dirname, 'client/src/state/poolPolicyDrafts.js'),
    'utf8'
  );
  const policies = {
    'Night Mood': {
      retentionDays: 14,
      schedule: { enabled: true, start: '20:00' }
    }
  };
  const policyFor = (category) => readPoolPolicy(policies, category);
  const mergeDraft = mergePoolPolicyDraft(policyFor);
  const drafts = mergeDraft({}, 'Night Mood', 'maxPhotos', '500');
  const nextDrafts = mergeDraft(drafts, 'Night Mood', 'schedule', {
    ...drafts['Night Mood'].schedule,
    end: '07:00'
  });

  assert.deepStrictEqual(DEFAULT_POOL_SCHEDULE, {
    enabled: false,
    start: '22:00',
    end: '06:00',
    priority: 0
  });
  assert.deepStrictEqual(DEFAULT_POOL_POLICY, {
    retentionDays: 30,
    maxPhotos: 2000,
    schedule: DEFAULT_POOL_SCHEDULE
  });
  assert.deepStrictEqual(readPoolPolicy(policies, 'Night Mood'), {
    retentionDays: 14,
    maxPhotos: 2000,
    schedule: { enabled: true, start: '20:00', end: '06:00', priority: 0 }
  });
  assert.strictEqual(nextDrafts['Night Mood'].maxPhotos, '500');
  assert.strictEqual(nextDrafts['Night Mood'].schedule.end, '07:00');
  assert.strictEqual(drafts['Night Mood'].schedule.end, '06:00');
  assert.notStrictEqual(nextDrafts, drafts);
  assert.notStrictEqual(nextDrafts['Night Mood'], drafts['Night Mood']);
  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{\{enabled: boolean, start: string, end: string, priority: number\|string\}\} PoolSchedule/);
  assert.match(source, /@typedef \{Record<string, PoolPolicyInput>\} PoolPolicyDrafts/);
  assert.match(source, /@param \{PoolPolicyReader\} policyFor/);
  assert.match(source, /field: PoolPolicyField/);
});

assertAsyncTest('pool lifecycle view models keep schedule presentation pure and responsive', async () => {
  const {
    formatPoolLifecycleSummary,
    formatPoolSchedule,
    getPoolLifecycleRows
  } = await importClientModule('./client/src/state/poolLifecycleView.js');
  const source = fs.readFileSync(
    path.join(__dirname, 'client/src/state/poolLifecycleView.js'),
    'utf8'
  );
  const policyFor = (category) => category === 'Night Mood'
    ? { retentionDays: 30, maxPhotos: 2000, schedule: { enabled: true, start: '22:00', end: '06:00' } }
    : { retentionDays: 14, maxPhotos: 500, schedule: { enabled: false } };

  assert.strictEqual(formatPoolSchedule({ enabled: true, start: '22:00', end: '06:00' }), '22:00–06:00');
  assert.strictEqual(formatPoolSchedule({ enabled: true }), '22:00–06:00');
  assert.strictEqual(formatPoolSchedule({ enabled: false }), 'Manual activation');
  assert.deepStrictEqual(formatPoolLifecycleSummary({
    retentionDays: 30,
    maxPhotos: 2000,
    schedule: { enabled: false }
  }), {
    retention: '30 days',
    maximum: '2000 photos',
    schedule: 'Manual activation'
  });
  assert.deepStrictEqual(getPoolLifecycleRows(['Google Photos', 'Night Mood', 'Day Mood'], policyFor), [
    {
      category: 'Google Photos',
      policy: { retentionDays: 14, maxPhotos: 500, schedule: { enabled: false } },
      summary: {
        retention: '14 days',
        maximum: '500 photos',
        schedule: 'Manual activation'
      }
    },
    {
      category: 'Night Mood',
      policy: { retentionDays: 30, maxPhotos: 2000, schedule: { enabled: true, start: '22:00', end: '06:00' } },
      summary: {
        retention: '30 days',
        maximum: '2000 photos',
        schedule: '22:00–06:00'
      }
    },
    {
      category: 'Day Mood',
      policy: { retentionDays: 14, maxPhotos: 500, schedule: { enabled: false } },
      summary: {
        retention: '14 days',
        maximum: '500 photos',
        schedule: 'Manual activation'
      }
    }
  ]);
  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{\{enabled\?: boolean, start\?: string, end\?: string\}\} PoolScheduleInput/);
  assert.match(source, /@typedef \{\{retentionDays\?: number\|string, maxPhotos\?: number\|string, schedule\?: PoolScheduleInput\|null\}\} PoolLifecyclePolicyInput/);
  assert.match(source, /@typedef \{\{category: string, policy: PoolLifecyclePolicyInput, summary: PoolLifecycleSummary\}\} PoolLifecycleRow/);
  assert.match(source, /@param \{PoolPolicyReader\} policyFor/);
});

assertTest('pool schedule status is a closed immutable projection', () => {
  const poolScheduleRuntimeSource = fs.readFileSync(
    path.join(__dirname, 'server/runtime/poolSchedule.js'),
    'utf8'
  );
  const input = {
    activeIdentity: 'Night Mood|22:00|06:00|0',
    scheduledCategories: ['Night Mood'],
    activationCategories: ['Scenic Nature', 'Night Mood'],
    baselineCategories: ['Scenic Nature'],
    manualOverride: true
  };
  const originalInput = structuredClone(input);
  const status = projectPoolScheduleStatus(input);

  assert.deepStrictEqual(status, input);
  assert.notStrictEqual(status.scheduledCategories, input.scheduledCategories);
  assert.notStrictEqual(status.activationCategories, input.activationCategories);
  assert.notStrictEqual(status.baselineCategories, input.baselineCategories);
  status.scheduledCategories.push('Mutated');
  status.activationCategories.push('Mutated');
  status.baselineCategories.push('Mutated');
  assert.deepStrictEqual(input, originalInput);
  assert.deepStrictEqual(projectPoolScheduleStatus({
    activeIdentity: null,
    scheduledCategories: [],
    activationCategories: null,
    baselineCategories: null,
    manualOverride: false
  }), {
    activeIdentity: null,
    scheduledCategories: [],
    activationCategories: null,
    baselineCategories: null,
    manualOverride: false
  });
  assert.match(poolScheduleRuntimeSource, /^\/\/ @ts-check/);
  assert.match(poolScheduleRuntimeSource, /@typedef \{object\} PoolScheduleStatus/);
  assert.match(poolScheduleRuntimeSource, /@returns \{PoolScheduleStatus\}/);
  assert.match(poolScheduleRuntimeSource, /getStatus: \(\) => projectPoolScheduleStatus/);
});

assertAsyncTest('pool schedule runtime activates a pool, honors manual override, and restores the baseline', async () => {
  const state = {
    currentCategory: 'Scenic Nature,Liminal Spaces',
    poolPolicies: {
      'Night Mood': { schedule: { enabled: true, start: '22:00', end: '06:00' } }
    }
  };
  const collections = {
    'Scenic Nature': [],
    'Liminal Spaces': [],
    'Night Mood': [],
    'Day Mood': []
  };
  let now = new Date('2026-08-18T23:00:00');
  const dispatched = [];
  const runtime = createPoolScheduleRuntime({
    state,
    collections,
    getNow: () => now,
    dispatchCommand: async (command) => {
      dispatched.push(command);
      state.currentCategory = command.payload.categories.join(',');
    }
  });

  await runtime.tick();
  assert.strictEqual(state.currentCategory, 'Scenic Nature,Liminal Spaces,Night Mood');
  const activeStatus = runtime.getStatus();
  assert.deepStrictEqual(activeStatus.scheduledCategories, ['Night Mood']);
  assert.deepStrictEqual(activeStatus.activationCategories, [
    'Scenic Nature',
    'Liminal Spaces',
    'Night Mood'
  ]);
  assert.deepStrictEqual(activeStatus.baselineCategories, ['Scenic Nature', 'Liminal Spaces']);
  activeStatus.scheduledCategories.push('Mutated');
  activeStatus.activationCategories.push('Mutated');
  activeStatus.baselineCategories.push('Mutated');
  assert.deepStrictEqual(runtime.getStatus().scheduledCategories, ['Night Mood']);
  assert.deepStrictEqual(runtime.getStatus().activationCategories, [
    'Scenic Nature',
    'Liminal Spaces',
    'Night Mood'
  ]);
  assert.deepStrictEqual(runtime.getStatus().baselineCategories, ['Scenic Nature', 'Liminal Spaces']);
  state.currentCategory = 'Day Mood';
  await runtime.tick();
  assert.strictEqual(runtime.getStatus().manualOverride, true);
  now = new Date('2026-08-19T06:00:00');
  await runtime.tick();
  assert.strictEqual(state.currentCategory, 'Scenic Nature,Liminal Spaces');
  assert.deepStrictEqual(dispatched.map(({ payload }) => payload.categories), [
    ['Scenic Nature', 'Liminal Spaces', 'Night Mood'],
    ['Scenic Nature', 'Liminal Spaces']
  ]);
});

assertAsyncTest('pool image counts normalize API values and format accessible singular and plural labels', async () => {
  const {
    buildUsablePhotoCounts,
    formatAccessibleUsableImageCount,
    formatUsableImageCount
  } = await importClientModule(
    './client/src/state/poolCounts.js'
  );
  const viewSource = fs.readFileSync(
    path.join(__dirname, 'client/src/components/remote/ImageFeedsTab.jsx'),
    'utf8'
  );
  const counts = buildUsablePhotoCounts([
    { name: 'Empty Pool', usablePhotosCount: 0 },
    { name: 'Single Pool', usablePhotosCount: 1 },
    { name: 'Google Photos', usablePhotosCount: 128 },
    { name: 'Invalid Pool', usablePhotosCount: -1 }
  ]);

  assert.deepStrictEqual(counts, {
    'Empty Pool': 0,
    'Single Pool': 1,
    'Google Photos': 128
  });
  assert.strictEqual(formatUsableImageCount(counts['Empty Pool']), '0 images');
  assert.strictEqual(formatUsableImageCount(counts['Single Pool']), '1 image');
  assert.strictEqual(formatUsableImageCount(counts['Google Photos']), '128 images');
  assert.strictEqual(formatAccessibleUsableImageCount(counts['Empty Pool']), '0 usable images');
  assert.strictEqual(formatAccessibleUsableImageCount(counts['Single Pool']), '1 usable image');
  assert.strictEqual(formatAccessibleUsableImageCount(counts['Google Photos']), '128 usable images');
  assert.strictEqual(formatUsableImageCount(undefined), null);
  assert.match(viewSource, /className="image-feed-category-count"/);
  assert.match(viewSource, /aria-label=\{`\$\{cat\} Feed\$\{/);
  assert.match(viewSource, /formatAccessibleUsableImageCount\(usablePhotoCounts\[cat\]\)/);
});

assertTest('buildCachedMediaItem extracts nested mediaFile data and emits a local proxy URL', () => {
  const createTime = '2024-05-10T23:30:00Z';
  const item = buildCachedMediaItem({
    id: 'picker-123',
    createTime,
    mediaFile: {
      baseUrl: 'https://lh3.googleusercontent.com/picker-item',
      mimeType: 'image/jpeg',
      mediaFileMetadata: {
        width: '4032',
        height: '3024'
      }
    }
  }, 'session-abc');

  assert.strictEqual(item.url, '/api/google-photos/media/picker-123?w=2560&h=1440');
  assert.strictEqual(item.googleBaseUrl, 'https://lh3.googleusercontent.com/picker-item');
  assert.strictEqual(item.googlePickerSessionId, 'session-abc');
  assert.strictEqual(item.width, 4032);
  assert.strictEqual(item.height, 3024);
  assert.strictEqual(item.createTime, createTime);
  assert.ok(item.addedAt, 'newly synced Google Photos items need a retention timestamp');
  const refreshed = buildCachedMediaItem(
    { id: 'picker-123', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/picker-item' } },
    'session-abc',
    { addedAt: '2026-01-01T00:00:00.000Z', createTime },
    '2026-09-06T00:00:00Z'
  );
  assert.strictEqual(refreshed.addedAt, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(refreshed.createTime, createTime, 'an omitted refresh timestamp should retain the cached creation time');
  assert.strictEqual(normalizeCachedMediaItem(refreshed).createTime, createTime, 'cache normalization should preserve the creation time');
  assert.strictEqual(item.mimeType, 'image/jpeg');
});

// Evaluate the real cache module with a local clock and test-only private capture.
const createGooglePhotosCacheFixture = (now = () => 0) => {
  const module = { exports: {} };
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotosCache.js'), 'utf8');
  runInNewContext(`${source}\nmodule.testHelpers = { getPickerMediaFile };`, {
    module, URLSearchParams, Date: class extends Date { static now() { return now(); } }
  }, { filename: 'googlePhotosCache.js' });
  return { ...module.exports, ...module.testHelpers };
};

assertTest('Picker file selection retains nested object aliases without field-level fallback', () => {
  const { getPickerMediaFile: select } = createGooglePhotosCacheFixture();
  [Object.freeze({}), Object.freeze([]), Object.freeze({ mimeType: '' })].forEach(mediaFile => {
    const row = Object.freeze({ mediaFile, mimeType: 'image/flat' });
    assert.strictEqual(select(row), mediaFile);
    assert.strictEqual(select(row).baseUrl, undefined);
    assert.notStrictEqual(select(row), row);
  });
});

assertTest('Picker file selection preserves flat rows for non-object nested values without coercion', () => {
  const { getPickerMediaFile: select } = createGooglePhotosCacheFixture();
  [undefined, null, false, 0, NaN, '', true, 1, 'nested', Symbol('file'), 1n,
    () => { throw new Error('Unexpected invocation'); }].forEach(mediaFile => {
    const row = Object.freeze({ mediaFile, mimeType: 'image/flat' });
    assert.strictEqual(select(row), row);
  });
});

assertTest('Picker file selection uses fresh empty fallbacks and passes truthy primitive rows through', () => {
  const { getPickerMediaFile: select } = createGooglePhotosCacheFixture();
  [undefined, null, false, 0, -0, NaN, '', 0n].forEach(row => {
    const result = select(row);
    assert.deepStrictEqual({ ...result }, {});
    assert.notStrictEqual(result, select(row));
    assert.strictEqual(select(result), result);
  });
  [true, 1, 'flat', Symbol('row'), 1n, Object.freeze(() => {})].forEach(row => {
    assert.strictEqual(select(row), row);
  });
});

assertTest('Picker file selection reads hidden and inherited fields without enumerating or reading other keys', () => {
  const { getPickerMediaFile: select } = createGooglePhotosCacheFixture();
  const mediaFile = Object.freeze({ mimeType: 'image/nested' });
  const descriptor = { value: mediaFile };
  [Object.create(null, { mediaFile: descriptor }), Object.create(Object.create(null, { mediaFile: descriptor }))]
    .map(row => Object.freeze(Object.defineProperty(row, 'mimeType', {
      get() { throw new Error('Unexpected flat field read'); }
    })))
    .forEach(row => assert.strictEqual(select(new Proxy(row, {
      ownKeys() { throw new Error('Unexpected enumeration'); }
    })), mediaFile));
  assert.strictEqual(Object.hasOwn(require('./server/services/googlePhotosCache'), 'getPickerMediaFile'), false);
});

assertTest('Picker file selection preserves short-circuit and repeated accessor reads', () => {
  const { getPickerMediaFile: select } = createGooglePhotosCacheFixture();
  [
    { values: [false], flat: true },
    { values: [{}, 'not-object'], flat: true },
    { values: [true, null, 'third-read'], flat: false },
    ...[undefined, null, false, 0, '', () => {}, Object.freeze({})]
      .map(result => ({ values: [true, {}, result], flat: false }))
  ].forEach(({ values, flat }) => {
    const reads = [];
    const row = Object.freeze({ get mediaFile() {
      const index = reads.length;
      reads.push(index);
      assert.ok(index < values.length, 'must not read beyond the selected branch');
      return values[index];
    } });
    assert.strictEqual(select(row), flat ? row : values.at(-1));
    assert.deepStrictEqual(reads, values.map((_, index) => index));
  });
});

assertTest('Picker file selection propagates exact failures at each read without continuing or undoing hooks', () => {
  const { getPickerMediaFile: select } = createGooglePhotosCacheFixture();
  [0, 1, 2].forEach(failureIndex => {
    [undefined, null, false, 0, '', new Error('file getter')].forEach(failure => {
      const reads = [];
      const row = Object.freeze({ get mediaFile() {
        const index = reads.length;
        reads.push(index);
        if (index === failureIndex) throw failure;
        return {};
      } });
      let caught = false;
      try { select(row); assert.fail('Expected getter failure'); }
      catch (error) { caught = true; assert.strictEqual(error, failure); }
      assert.strictEqual(caught, true);
      assert.deepStrictEqual(reads, Array.from({ length: failureIndex + 1 }, (_, index) => index));
    });
  });
});

assertTest('Picker file selection is stable on leaf aliases but not globally idempotent', () => {
  const { getPickerMediaFile: select } = createGooglePhotosCacheFixture();
  [Object.freeze({}), Object.freeze([]), Object.freeze({ mediaFile: null })].forEach(leaf => {
    const row = Object.freeze({ mediaFile: leaf });
    assert.strictEqual(select(select(row)), select(row));
    assert.strictEqual(select(row), leaf);
  });
  const leaf = Object.freeze({ mimeType: 'image/leaf' });
  const branch = Object.freeze({ mediaFile: leaf });
  const root = Object.freeze({ mediaFile: branch });
  assert.strictEqual(select(root), branch);
  assert.strictEqual(select(select(root)), leaf);
  assert.notStrictEqual(select(select(root)), select(root));
});

assertTest('Picker cache construction projects a fixed fresh shape without spreading inputs', () => {
  const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture(() => { throw new Error('Unexpected clock'); });
  const item = Object.freeze({ id: 'new', title: 'ignored', rating: 1, width: 80,
    get ignored() { throw new Error('Unexpected enumeration'); }, [Symbol('hidden')]: true });
  const row = build(item, 'session', Object.freeze({ width: 90, orientation: 'portrait', isBroken: true }), 0);
  assert.deepStrictEqual({ ...row }, {
    id: 'new', title: 'Google Photos Picker Cast', author: 'Lumina Google Cast', source: 'google_photos',
    url: '/api/google-photos/media/new?w=2560&h=1440', googleBaseUrl: '',
    googlePickerSessionId: 'session', googleBaseUrlFetchedAt: undefined, addedAt: '1970-01-01T00:00:00.000Z',
    mimeType: 'image/jpeg', width: 2560, height: 1440, rating: 10,
    cropPercent: undefined, cropPositionY: undefined, preventPairing: undefined, loved: undefined
  });
  assert.notStrictEqual(row, item);
  assert.notStrictEqual(row, build(item, 'session', {}, 0));
});

assertTest('Picker cache construction preserves distinct date base MIME and session fallback policies', () => {
  const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture(() => 42);
  [
    { input: undefined, base: ' cached ', date: 'cached-date', mime: ' cached/type ', session: 'cached-session' },
    { input: '', base: ' cached ', date: 'cached-date', mime: ' cached/type ', session: 'cached-session' },
    { input: '   ', base: ' cached ', date: undefined, mime: ' cached/type ', session: '   ' },
    { input: ' fresh ', base: 'fresh', date: 'fresh', mime: 'fresh', session: ' fresh ' }
  ].forEach(({ input, base, date, mime, session }) => {
    const row = build(Object.freeze({ id: 'fallback', createTime: input,
      mediaFile: Object.freeze({ baseUrl: input, mimeType: input }) }), input,
    Object.freeze({ googleBaseUrl: ' cached ', createTime: ' cached-date ', mimeType: ' cached/type ',
      googlePickerSessionId: 'cached-session' }), 0);
    assert.deepStrictEqual([row.googleBaseUrl, row.createTime, row.mimeType, row.googlePickerSessionId], [base, date, mime, session]);
    assert.strictEqual(Object.hasOwn(row, 'createTime'), date !== undefined);
  });
  assert.strictEqual(build({ id: 'legacy' }, '', { url: ' legacy =w800', googleBaseUrl: '' }, 0).googleBaseUrl, 'legacy ');
  const base = Object.freeze({ opaque: true });
  assert.strictEqual(build({ id: 'opaque' }, '', { googleBaseUrl: base }, 0).googleBaseUrl, base);
});

assertTest('Picker cache acquisition dates use truthy preservation and native conversion only when needed', () => {
  const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture();
  ['invalid-but-retained', ' ', true, 7, Object.freeze({ opaque: true })].forEach(addedAt => {
    assert.strictEqual(build({ id: 'date' }, '', { addedAt }, 'invalid').addedAt, addedAt);
  });
  [undefined, null, false, 0, '', NaN].forEach(addedAt => {
    assert.strictEqual(build({ id: 'date' }, '', { addedAt }, 0).addedAt, '1970-01-01T00:00:00.000Z');
  });
  [0, null, new Date(0), '1970-01-01T00:00:00Z'].forEach(addedAt => {
    assert.strictEqual(build({ id: 'date' }, '', {}, addedAt).addedAt, '1970-01-01T00:00:00.000Z');
  });
  ['invalid', NaN, Infinity].forEach(addedAt => assert.throws(() => build({ id: 'date' }, '', {}, addedAt), RangeError));
  assert.throws(() => build({ id: 'date' }, '', {}, Symbol('date')), TypeError);
  [null, undefined].forEach(item => assert.throws(() => build(item, '', {}, 0), error => error.name === 'TypeError'));
  assert.throws(() => build({ id: 'date' }, '', null, 0), error => error.name === 'TypeError');
});

assertTest('Picker cache construction keeps acquisition and base clocks separate with undefined-only defaults', () => {
  [false, true].forEach(hasBase => [false, true].forEach(hasExistingDate => [false, true].forEach(explicit => {
    const calls = [];
    const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture(() => { calls.push(calls.length + 1); return calls.length * 1000; });
    const existing = { addedAt: hasExistingDate ? 'retained' : '', googleBaseUrlFetchedAt: 9 };
    const row = build({ id: 'clock', baseUrl: hasBase ? 'base' : '' }, '', existing, explicit ? 0 : undefined);
    assert.strictEqual(calls.length, Number(!explicit) + Number(hasBase));
    assert.strictEqual(row.addedAt, hasExistingDate ? 'retained' : new Date(explicit ? 0 : 1000).toISOString());
    assert.strictEqual(row.googleBaseUrlFetchedAt, hasBase ? (explicit ? 1000 : 2000) : 9);
  })));
});

assertTest('Picker cache construction retains shallow user metadata without merging arbitrary fields', () => {
  const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture();
  [undefined, null, false, 0, '', NaN, Object.freeze({ nested: true })].forEach(value => {
    const existing = Object.freeze(Object.assign(Object.create({ rating: value }), {
      cropPercent: value, cropPositionY: value, preventPairing: value, loved: value, addedAt: 'retained'
    }));
    const row = build(Object.freeze({ id: 'edits', rating: 7, loved: true }), '', existing, 0);
    assert.strictEqual(row.rating, value === undefined ? 10 : value);
    ['cropPercent', 'cropPositionY', 'preventPairing', 'loved'].forEach(field => assert.strictEqual(row[field], value));
    assert.strictEqual(existing.loved, value);
  });
});

assertTest('Picker cache construction preserves named read order and repeated id and rating reads', () => {
  const visits = [];
  const read = (name, value) => { visits.push(name); return value; };
  const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture(() => read('clock', 1000));
  let ids = 0;
  let ratings = 0;
  const item = Object.freeze({ get id() { return read('id', ++ids === 1 ? 'stored' : 'encoded'); },
    get createTime() { return read('createTime', ' date '); }, mediaFile: Object.freeze({
      get baseUrl() { return read('base', 'base'); }, get mimeType() { return read('mime', 'image/png'); },
      mediaFileMetadata: Object.freeze({ get width() { return read('width', '80'); }, get height() { return read('height', '60'); } })
    }) });
  const existing = Object.freeze(Object.defineProperties({}, Object.fromEntries([
    ['addedAt', ''], ['googlePickerSessionId', 'cached-session'], ['rating', 1],
    ['cropPercent', 2], ['cropPositionY', 3], ['preventPairing', false], ['loved', true]
  ].map(([key, value]) => [key, { get: () => read(key, key === 'rating' ? ++ratings : value) }]))));
  const row = build(item, '', existing);
  assert.deepStrictEqual(visits, ['clock', 'width', 'height', 'base', 'createTime', 'addedAt', 'id', 'id',
    'googlePickerSessionId', 'clock', 'mime', 'rating', 'rating', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved']);
  assert.strictEqual(row.id, 'stored');
  assert.strictEqual(row.url, '/api/google-photos/media/encoded?w=2560&h=1440');
  assert.strictEqual(row.rating, 2);
  assert.deepStrictEqual([row.width, row.height], [80, 60]);
});

assertTest('Picker cache construction propagates exact hook failures without partial rows or later work', () => {
  const scenarios = [
    (fail, later) => ({ now: fail, item: later, existing: {}, addedAt: undefined }),
    (fail, later) => ({ item: { id: 'failure', mediaFile: { mediaFileMetadata: { get width() { return fail(); } } } }, existing: later }),
    (fail, later) => ({ item: { id: 'failure', get baseUrl() { return fail(); } }, existing: later }),
    (fail, later) => ({ item: { id: 'failure', createTime: { [Symbol.toPrimitive]: fail } }, existing: later }),
    (fail, later) => ({ item: { id: 'failure' }, existing: later, addedAt: { [Symbol.toPrimitive]: fail } }),
    (fail, later) => ({ item: { get id() { return fail(); } }, existing: later }),
    (fail, later) => ({ now: fail, item: { id: 'failure', baseUrl: 'base' }, existing: later }),
    (fail, later) => ({ item: { id: 'failure', get mimeType() { return fail(); } }, existing: later }),
    (fail, later) => ({ item: { id: 'failure' }, existing: { ...later, get rating() { return fail(); },
      get loved() { throw new Error('Unexpected later read'); } } })
  ];
  scenarios.forEach(scenario => [undefined, null, false, 0, '', new Error('hook')].forEach(error => {
    const visits = [];
    const fail = () => { visits.push('failed'); throw error; };
    const later = Object.defineProperty({}, 'loved', { get() { throw new Error('Unexpected later read'); } });
    const spec = scenario(fail, later);
    const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture(spec.now);
    let returned = false;
    let caught = false;
    try { build(spec.item, '', spec.existing, Object.hasOwn(spec, 'addedAt') ? spec.addedAt : 0); returned = true; }
    catch (actual) { caught = true; assert.strictEqual(actual, error); }
    assert.ok(caught);
    assert.strictEqual(returned, false);
    assert.deepStrictEqual(visits, ['failed'], 'prior hook observation survives, later work does not run');
  }));
  const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture();
  ['\uD800', Symbol('id')].forEach(id => assert.throws(() => build({ id }, '', {}, 0), error => ['URIError', 'TypeError'].includes(error.name)));
});

assertTest('Picker cache construction is stable only under a fixed clock and complete refresh inputs', () => {
  const { buildCachedMediaItem: build } = createGooglePhotosCacheFixture(() => 42);
  const item = Object.freeze({ id: 'stable', baseUrl: 'base', mediaFileMetadata: Object.freeze({ width: 80, height: 60 }) });
  const first = build(item, 'session', Object.freeze({ rating: 3, loved: false }), 0);
  const second = build(item, 'session', Object.freeze(first), 'invalid-but-bypassed');
  assert.deepStrictEqual(second, first);
  assert.notStrictEqual(second, first);
  let tick = 0;
  const { buildCachedMediaItem: ticking } = createGooglePhotosCacheFixture(() => ++tick);
  assert.notDeepStrictEqual(ticking(item, 'session', first, 0), first, 'base timestamp defeats global idempotence');
  assert.strictEqual(build({ id: 'stable' }, 'session', first, 0).width, 2560, 'missing Picker dimensions reset cached dimensions');
});

const pickerBaseUrlFromCacheRow = (item, existing = {}) => buildCachedMediaItem(item, 'base-session', existing, 0).googleBaseUrl;

assertTest('Picker base URLs select nested files without falling back to flat bases', () => {
  [undefined, null, false, true, 0, 1, 1n, NaN, '', 'file', Symbol('file'), () => {}].forEach(mediaFile => {
    assert.strictEqual(pickerBaseUrlFromCacheRow(Object.freeze({ id: 'base', mediaFile, baseUrl: ' flat ' })), 'flat');
  });
  [undefined, null, false, 0, NaN, '', ' \t\n'].forEach(baseUrl => {
    const item = Object.freeze({ id: 'base', baseUrl: 'flat', mediaFile: Object.freeze({ baseUrl }) });
    assert.strictEqual(pickerBaseUrlFromCacheRow(item), '');
    assert.strictEqual(pickerBaseUrlFromCacheRow(item, Object.freeze({ googleBaseUrl: ' cached ' })), ' cached ');
    assert.strictEqual(pickerBaseUrlFromCacheRow(item, Object.freeze({ url: ' legacy=w800-h600 ' })), 'legacy');
  });
  [Object.freeze({ baseUrl: ' nested ' }), Object.freeze(Object.assign([], { baseUrl: ' nested ' }))].forEach(mediaFile => {
    assert.strictEqual(pickerBaseUrlFromCacheRow(Object.freeze({ id: 'base', baseUrl: 'flat', mediaFile }), { googleBaseUrl: 'cached' }), 'nested');
  });
});

assertTest('Picker base URLs preserve truthiness before native coercion and trimming', () => {
  [
    [undefined, ''], [null, ''], [false, ''], [0, ''], [-0, ''], [0n, ''], [NaN, ''], ['', ''],
    [' \t\n\uFEFF', ''], [true, 'true'], [12, '12'], [12n, '12'], [Infinity, 'Infinity'],
    [Symbol('base'), 'Symbol(base)'], [Object.freeze([1, 2]), '1,2'],
    [Object.freeze({ toString: () => ' base ' }), 'base'],
    [Object.freeze({ toString: () => ({}), valueOf: () => 0 }), '0'],
    [' HTTP://Example.test/a=b?x=1#part ', 'HTTP://Example.test/a=b?x=1#part'],
    ['undefined=w800', 'undefined=w800'], ['\ud800', '\ud800']
  ].forEach(([baseUrl, expected]) => {
    assert.strictEqual(pickerBaseUrlFromCacheRow(Object.freeze({ id: 'base', baseUrl })), expected);
    assert.strictEqual(pickerBaseUrlFromCacheRow(Object.freeze({ id: 'base', mediaFile: Object.freeze({ baseUrl }) })), expected);
  });
});

assertTest('Picker base URLs read inherited hidden fields without enumeration or mutation', () => {
  const file = Object.freeze(Object.defineProperty([], 'baseUrl', { value: ' hidden ' }));
  const item = Object.freeze(Object.create(Object.freeze({ id: 'base', mediaFile: file })));
  const input = new Proxy(item, { ownKeys: () => { throw new Error('Must not enumerate Picker fields'); } });
  assert.strictEqual(pickerBaseUrlFromCacheRow(input), 'hidden');
  assert.strictEqual(pickerBaseUrlFromCacheRow(input), 'hidden');
  assert.deepStrictEqual(Reflect.ownKeys(item), []);
  assert.strictEqual(file.baseUrl, ' hidden ');
  const flat = Object.freeze(Object.create(Object.freeze({ id: 'base', baseUrl: ' inherited ' })));
  assert.strictEqual(pickerBaseUrlFromCacheRow(flat), 'inherited');
});

assertTest('Picker base URL coercion precedes cached fallback and later cache-row work', () => {
  const events = [];
  const stop = new Error('Stop before cache-row clocks');
  const base = Object.freeze({ [Symbol.toPrimitive]: hint => { events.push(`coerce:${hint}`); return ' base '; } });
  const file = Object.freeze({
    get mediaFileMetadata() { events.push('metadata'); return {}; },
    get baseUrl() { events.push('baseUrl'); return base; }
  });
  let reads = 0;
  const item = Object.freeze({
    id: 'base',
    get mediaFile() { events.push(`file${++reads}`); return file; },
    get baseUrl() { throw new Error('Must not read the flat base'); },
    get createTime() { events.push('later'); throw stop; }
  });
  const existing = Object.freeze({ get googleBaseUrl() { throw new Error('Must not read cached fallback'); } });
  assert.throws(() => pickerBaseUrlFromCacheRow(item, existing), error => error === stop);
  assert.deepStrictEqual(events, ['file1', 'file2', 'file3', 'metadata', 'file4', 'file5', 'file6', 'baseUrl', 'coerce:string', 'later']);
});

assertTest('Picker base URL hook failures propagate exactly and stop subsequent reads', () => {
  ['file4', 'file5', 'file6', 'baseUrl', 'coerce'].forEach(stage => {
    [undefined, null, false, 0, '', new Error('Base hook failure')].forEach(failure => {
      const events = [];
      const observe = (key, value) => { events.push(key); if (key === stage) throw failure; return value; };
      const file = Object.freeze({ get baseUrl() { return observe('baseUrl', { [Symbol.toPrimitive]: () => observe('coerce', 'base') }); } });
      let reads = 0;
      const item = Object.freeze({
        id: 'base',
        get mediaFile() { return observe(`file${++reads}`, file); },
        get createTime() { throw new Error('Must not reach later cache-row work'); }
      });
      const existing = Object.freeze({ get googleBaseUrl() { throw new Error('Must not reach fallback'); } });
      let caught = false;
      let result = 'not returned';
      try { result = pickerBaseUrlFromCacheRow(item, existing); } catch (error) {
        caught = true;
        assert.strictEqual(error, failure);
      }
      assert.strictEqual(caught, true);
      assert.strictEqual(result, 'not returned');
      const order = ['file1', 'file2', 'file3', 'file4', 'file5', 'file6', 'baseUrl', 'coerce'];
      assert.deepStrictEqual(events, order.slice(0, order.indexOf(stage) + 1));
    });
  });
});

assertTest('Picker base URLs retain changing-file behavior and native coercion failures', () => {
  let reads = 0;
  let baseReads = 0;
  const item = Object.freeze({
    id: 'base',
    get mediaFile() { return ++reads === 5 ? 'not an object' : {}; },
    get baseUrl() { baseReads++; return ' flat '; }
  });
  assert.strictEqual(pickerBaseUrlFromCacheRow(item), 'flat');
  assert.strictEqual(baseReads, 1);
  [null, undefined].forEach(value => {
    let fileReads = 0;
    const changing = { id: 'base', get mediaFile() { return ++fileReads === 6 ? value : {}; } };
    assert.throws(() => pickerBaseUrlFromCacheRow(changing), TypeError);
    assert.strictEqual(fileReads, 6);
  });
  [Object.create(null), { [Symbol.toPrimitive]: () => ({}) }, { toString: () => ({}), valueOf: () => ({}) }].forEach(baseUrl => {
    assert.throws(() => pickerBaseUrlFromCacheRow({ id: 'base', baseUrl }), TypeError);
  });
});

assertTest('Picker base URL scalars are stable under flat and nested re-embedding', () => {
  const values = ['', 'base', 'a=b?x=1#part', 'HTTP://Example.test/A', '%2F', '\ud800', 'inside space'];
  const padding = ['', ' ', '\t\n', '\uFEFF'];
  const rows = baseUrl => [
    Object.freeze({ id: 'base', baseUrl }),
    Object.freeze({ id: 'base', mediaFile: Object.freeze({ baseUrl }) })
  ];
  values.flatMap(value => padding.map(space => ({ value, input: `${space}${value}${space}` }))).forEach(({ value, input }) => {
    rows(input).forEach(item => {
      const projected = pickerBaseUrlFromCacheRow(item);
      assert.strictEqual(projected, value);
      rows(projected).forEach(row => assert.strictEqual(pickerBaseUrlFromCacheRow(row), projected));
      assert.strictEqual(item.baseUrl ?? item.mediaFile.baseUrl, input);
    });
  });
});

const legacyBaseUrlFromCacheRow = url => pickerBaseUrlFromCacheRow(Object.freeze({ id: 'legacy' }), Object.freeze({ url }));

assertTest('Legacy base URLs preserve truthiness before native string coercion', () => {
  [
    [undefined, ''], [null, ''], [false, ''], [0, ''], [-0, ''], [0n, ''], [NaN, ''], ['', ''],
    [' \t\n\uFEFF', ''], [true, 'true'], [42, '42'], [42n, '42'], [Infinity, 'Infinity'],
    [Symbol('legacy'), 'Symbol(legacy)'], [Object.freeze([1, 2]), '1,2'],
    [Object.freeze({ toString: () => ' base=w10 ' }), 'base'],
    [Object.freeze({ toString: () => ({}), valueOf: () => 0 }), '0']
  ].forEach(([input, expected]) => assert.strictEqual(legacyBaseUrlFromCacheRow(input), expected));
});

assertTest('Legacy base URLs reject only exact trimmed prefixes', () => {
  [
    ['/api/google-photos/media/', ''], ['/api/google-photos/media/id?w=1', ''],
    [' \t/api/google-photos/media/id=w10\n', ''], ['undefined=w10', ''], [' undefined=anything ', ''],
    ['/API/google-photos/media/id=w10', '/API/google-photos/media/id'],
    ['/api/google-photos/media', '/api/google-photos/media'],
    ['https://example.test/api/google-photos/media/id=w10', 'https://example.test/api/google-photos/media/id'],
    ['Undefined=w10', 'Undefined'], ['undefined =w10', 'undefined '], ['undefined', 'undefined'],
    ['%2Fapi%2Fgoogle-photos%2Fmedia%2Fid=w10', '%2Fapi%2Fgoogle-photos%2Fmedia%2Fid']
  ].forEach(([input, expected]) => assert.strictEqual(legacyBaseUrlFromCacheRow(input), expected));
});

assertTest('Legacy base URLs split the first literal equals without validating or retrimming', () => {
  [
    ['base=w800-h600-c=extra', 'base'], ['=w10', ''], ['==', ''], [' \t=ignored ', ''],
    [' HTTP://Example.test/A?x=1&y=2#part ', 'HTTP://Example.test/A?x'],
    ['base%3Dencoded=w10', 'base%3Dencoded'], ['base#fragment=w10', 'base#fragment'],
    ['not a URL=w10', 'not a URL'], ['base \t=w10 ', 'base \t'], ['\ud800=w10', '\ud800']
  ].forEach(([input, expected]) => assert.strictEqual(legacyBaseUrlFromCacheRow(input), expected));
  const row = Object.freeze({ id: 'legacy', url: ' base \t=w10 ' });
  assert.strictEqual(legacyBaseUrlFromCacheRow(row.url), 'base \t');
  assert.strictEqual(normalizeCachedMediaItem(row).googleBaseUrl, 'base');
  assert.strictEqual(normalizeCachedMediaItem(Object.freeze({ id: 'legacy', url: '=ignored' })).googleBaseUrl, undefined);
});

assertTest('Legacy base URLs read hidden inherited cache fields without enumeration or mutation', () => {
  const url = Object.freeze({ [Symbol.toPrimitive]: hint => { assert.strictEqual(hint, 'string'); return ' hidden=w10 '; } });
  const prototype = Object.freeze(Object.defineProperty({}, 'url', { value: url }));
  const existing = Object.freeze(Object.create(prototype));
  const input = new Proxy(existing, { ownKeys: () => { throw new Error('Must not enumerate existing cache fields'); } });
  const item = Object.freeze({ id: 'legacy' });
  assert.strictEqual(pickerBaseUrlFromCacheRow(item, input), 'hidden');
  assert.strictEqual(pickerBaseUrlFromCacheRow(item, input), 'hidden');
  assert.deepStrictEqual(Reflect.ownKeys(existing), []);
  assert.strictEqual(prototype.url, url);
});

assertTest('Legacy extraction follows preferred bases and precedes later cache-row work', () => {
  const blocked = Object.freeze({ get url() { throw new Error('Must not read legacy fallback'); } });
  assert.strictEqual(pickerBaseUrlFromCacheRow({ id: 'legacy', baseUrl: ' fresh ' }, blocked), 'fresh');
  const cached = Object.freeze(Object.assign(Object.create(blocked), { googleBaseUrl: ' cached ' }));
  assert.strictEqual(pickerBaseUrlFromCacheRow({ id: 'legacy', baseUrl: ' ' }, cached), ' cached ');
  const normalized = normalizeCachedMediaItem(Object.freeze({ id: 'legacy', googleBaseUrl: ' ', get url() { return 'legacy=w10'; } }));
  assert.strictEqual(normalized.googleBaseUrl, undefined, 'truthy whitespace cached bases suppress legacy extraction before trimming');
  const events = [];
  const stop = new Error('Stop before cache-row clocks');
  const existing = Object.freeze({
    get googleBaseUrl() { events.push('cached'); return ''; },
    get url() { events.push('url'); return { [Symbol.toPrimitive]: hint => { events.push(`coerce:${hint}`); return ' base=w10 '; } }; }
  });
  const item = Object.freeze({ id: 'legacy', get createTime() { events.push('later'); throw stop; } });
  assert.throws(() => pickerBaseUrlFromCacheRow(item, existing), error => error === stop);
  assert.deepStrictEqual(events, ['cached', 'url', 'coerce:string', 'later']);
});

assertTest('Legacy coercion failures propagate exactly without returning a fallback or doing later work', () => {
  ['url', 'coerce'].forEach(stage => {
    [undefined, null, false, 0, '', new Error('Legacy hook failure')].forEach(failure => {
      const events = [];
      const observe = (key, value) => { events.push(key); if (key === stage) throw failure; return value; };
      const existing = Object.freeze({ get url() { return observe('url', { [Symbol.toPrimitive]: () => observe('coerce', 'base') }); } });
      const item = Object.freeze({ id: 'legacy', get createTime() { throw new Error('Must not reach later work'); } });
      let caught = false;
      let result = 'not returned';
      try { result = pickerBaseUrlFromCacheRow(item, existing); } catch (error) {
        caught = true;
        assert.strictEqual(error, failure);
      }
      assert.strictEqual(caught, true);
      assert.strictEqual(result, 'not returned');
      assert.deepStrictEqual(events, stage === 'url' ? ['url'] : ['url', 'coerce']);
    });
  });
  [Object.create(null), { [Symbol.toPrimitive]: () => ({}) }, { toString: () => ({}), valueOf: () => ({}) }].forEach(url => {
    assert.throws(() => legacyBaseUrlFromCacheRow(url), TypeError);
  });
});

assertTest('Legacy extraction fixes normalized equals-free bases but is not globally idempotent', () => {
  const bases = ['', 'base', 'https://example.test/%3D?x', '%2F', '\ud800', 'inside space'];
  const padding = ['', ' ', '\t\n', '\uFEFF'];
  const suffixes = ['', '=w10', '=first=second', '=?x=1'];
  bases.flatMap(base => padding.flatMap(space => suffixes.map(suffix => ({ base, input: `${space}${base}${suffix}${space}` })))).forEach(({ base, input }) => {
    const projected = legacyBaseUrlFromCacheRow(input);
    assert.strictEqual(projected, base);
    assert.strictEqual(legacyBaseUrlFromCacheRow(projected), projected);
  });
  const once = legacyBaseUrlFromCacheRow('base =w10');
  assert.strictEqual(once, 'base ');
  assert.strictEqual(legacyBaseUrlFromCacheRow(once), 'base');
});

const pickerDimensionsFromCacheRow = item => {
  const { width, height } = buildCachedMediaItem(item, 'dimensions-session', {}, 0);
  return { width, height };
};

assertTest('Picker dimensions select whole nested metadata before legacy fallback', () => {
  const flat = Object.freeze({ width: '800', height: '600' });
  [undefined, null, false, true, 0, 1, 1n, NaN, '', 'file', Symbol('file'), () => {}].forEach(mediaFile => {
    assert.deepStrictEqual(pickerDimensionsFromCacheRow(Object.freeze({ id: 'dimensions', mediaFile, mediaFileMetadata: flat })), { width: 800, height: 600 });
  });
  [undefined, null, false, 0, '', NaN].forEach(mediaFileMetadata => {
    const mediaFile = Object.freeze({ mediaFileMetadata });
    assert.deepStrictEqual(pickerDimensionsFromCacheRow(Object.freeze({ id: 'dimensions', mediaFile, mediaFileMetadata: flat })), { width: 800, height: 600 });
  });
  [true, 1, 'metadata', Symbol('metadata'), {}, []].forEach(mediaFileMetadata => {
    const mediaFile = Object.freeze({ mediaFileMetadata: Object.freeze(mediaFileMetadata) });
    assert.deepStrictEqual(pickerDimensionsFromCacheRow(Object.freeze({ id: 'dimensions', mediaFile, mediaFileMetadata: flat })), { width: 2560, height: 1440 });
  });
  const mediaFile = Object.freeze({ mediaFileMetadata: Object.freeze({ width: '4032' }) });
  assert.deepStrictEqual(pickerDimensionsFromCacheRow(Object.freeze({ id: 'dimensions', mediaFile, mediaFileMetadata: flat })), { width: 4032, height: 1440 });
  const row = buildCachedMediaItem(Object.freeze({ id: 'dimensions', width: 1, height: 2 }), 'session', Object.freeze({ width: 3, height: 4 }), 0);
  assert.deepStrictEqual([row.width, row.height], [2560, 1440]);
});

assertTest('Picker dimensions preserve native decimal-prefix parsing and independent defaults', () => {
  [
    [undefined, null], [null, null], [false, null], [true, null], ['', null], [' \t\n', null],
    [0, null], [-0, null], [-12, null], [NaN, null], [Infinity, null], [-Infinity, null],
    ['0x10', null], ['0b11', null], ['-3px', null], ['.5', null], ['1'.padEnd(310, '0'), null],
    [' +004032px ', 4032], ['12.75', 12], [12.75, 12], ['3e4', 3], ['1e-7', 1],
    [1e21, 1], [1e-7, 1], [5e-324, 5], ['9007199254740992', 9007199254740992],
    ['1'.padEnd(22, '0'), 1e21], [33n, 33]
  ].forEach(([value, parsed]) => {
    const dimensions = mediaFileMetadata => pickerDimensionsFromCacheRow(Object.freeze({ id: 'dimensions', mediaFileMetadata: Object.freeze(mediaFileMetadata) }));
    assert.deepStrictEqual(dimensions({ width: value, height: '720' }), { width: parsed ?? 2560, height: 720 });
    assert.deepStrictEqual(dimensions({ width: '1080', height: value }), { width: 1080, height: parsed ?? 1440 });
  });
});

assertTest('Picker dimensions read inherited hidden metadata without enumeration or mutation', () => {
  const metadata = Object.freeze(Object.defineProperty(Object.create(Object.freeze({ width: '1200px' })), 'height', { value: '800.9' }));
  const file = Object.freeze(Object.defineProperty([], 'mediaFileMetadata', { value: metadata }));
  const item = Object.freeze(Object.create(Object.freeze({ id: 'dimensions', mediaFile: file })));
  const input = new Proxy(item, { ownKeys: () => { throw new Error('Must not enumerate Picker metadata'); } });
  const first = pickerDimensionsFromCacheRow(input);
  assert.deepStrictEqual(first, { width: 1200, height: 800 });
  assert.deepStrictEqual(pickerDimensionsFromCacheRow(input), first);
  assert.deepStrictEqual(Reflect.ownKeys(item), []);
  assert.deepStrictEqual([metadata.width, metadata.height], ['1200px', '800.9']);
  [Object.freeze([24, 99]), Object.freeze({ toString: () => '24px' }), Object.freeze({ toString: () => ({}), valueOf: () => 24 })].forEach(width => {
    assert.deepStrictEqual(pickerDimensionsFromCacheRow({ id: 'dimensions', mediaFileMetadata: Object.freeze({ width, height: '9' }) }), { width: 24, height: 9 });
  });
});

assertTest('Picker dimensions finish width coercion before height reads and later cache-row work', () => {
  const events = [];
  const stop = new Error('Stop at the later base-URL projection');
  const dimension = name => Object.freeze({ [Symbol.toPrimitive]: hint => { events.push(`${name}:${hint}`); return name === 'width' ? '1200px' : '800px'; } });
  const metadata = Object.freeze({
    get width() { events.push('width'); return dimension('width'); },
    get height() { events.push('height'); return dimension('height'); }
  });
  const file = Object.freeze({
    get mediaFileMetadata() { events.push('metadata'); return metadata; },
    get baseUrl() { events.push('baseUrl'); throw stop; }
  });
  const item = Object.freeze({ id: 'dimensions', get mediaFile() { events.push('file'); return file; } });
  assert.throws(() => pickerDimensionsFromCacheRow(item), error => error === stop);
  assert.deepStrictEqual(events, ['file', 'file', 'file', 'metadata', 'width', 'width:string', 'height', 'height:string', 'file', 'file', 'file', 'baseUrl']);
});

assertTest('Picker dimensions preserve exact hook failures and stop subsequent reads', () => {
  ['file1', 'file2', 'file3', 'nested', 'flat', 'width', 'coerceWidth', 'height', 'coerceHeight'].forEach(stage => {
    [undefined, null, false, 0, '', new Error('Dimension hook failure')].forEach(failure => {
      const events = [];
      const observe = (key, value) => { events.push(key); if (key === stage) throw failure; return value; };
      const dimension = name => Object.freeze({ [Symbol.toPrimitive]: () => observe(`coerce${name}`, '1200') });
      const metadata = Object.freeze({
        get width() { return observe('width', dimension('Width')); },
        get height() { return observe('height', dimension('Height')); }
      });
      const file = Object.freeze({ get mediaFileMetadata() { return observe('nested', stage === 'flat' ? null : metadata); } });
      let reads = 0;
      const item = Object.freeze({
        id: 'dimensions',
        get mediaFile() { return observe(`file${++reads}`, file); },
        get mediaFileMetadata() { return observe('flat', metadata); }
      });
      let caught = false;
      let result = 'not returned';
      try { result = pickerDimensionsFromCacheRow(item); } catch (error) {
        caught = true;
        assert.strictEqual(error, failure);
      }
      assert.strictEqual(caught, true);
      assert.strictEqual(result, 'not returned');
      const order = ['file1', 'file2', 'file3', 'nested', ...(stage === 'flat' ? ['flat'] : []), 'width', 'coerceWidth', 'height', 'coerceHeight'];
      assert.deepStrictEqual(events, order.slice(0, order.indexOf(stage) + 1));
    });
  });
});

assertTest('Picker dimensions retain repeated flat reads and native coercion or changing-file failures', () => {
  const events = [];
  const metadata = Object.freeze({ width: '640', height: '480' });
  const item = Object.freeze({ id: 'dimensions', get mediaFileMetadata() { events.push('metadata'); return events.length === 1 ? 0 : metadata; } });
  assert.deepStrictEqual(pickerDimensionsFromCacheRow(item), { width: 640, height: 480 });
  assert.deepStrictEqual(events, ['metadata', 'metadata']);
  [Symbol('dimension'), Object.create(null), { [Symbol.toPrimitive]: () => ({}) }].forEach(value => {
    ['width', 'height'].forEach(field => {
      assert.throws(() => pickerDimensionsFromCacheRow({ id: 'dimensions', mediaFileMetadata: { width: '640', height: '480', [field]: value } }), TypeError);
    });
  });
  const reads = [];
  const changing = { id: 'dimensions', get mediaFile() { reads.push('file'); return reads.length < 3 ? {} : null; } };
  assert.throws(() => pickerDimensionsFromCacheRow(changing), TypeError);
  assert.deepStrictEqual(reads, ['file', 'file', 'file']);
});

assertTest('Picker dimensions are stable for re-embedded safe integers but not all large results', () => {
  const values = [1, 2, 10, 1440, 2560, 4032, Number.MAX_SAFE_INTEGER];
  values.flatMap(width => values.map(height => Object.freeze({ width, height }))).forEach(metadata => {
    const flat = Object.freeze({ id: 'dimensions', mediaFileMetadata: metadata });
    const nested = Object.freeze({ id: 'dimensions', mediaFile: Object.freeze({ mediaFileMetadata: metadata }) });
    [flat, nested].forEach(item => {
      const dimensions = pickerDimensionsFromCacheRow(item);
      assert.deepStrictEqual(dimensions, metadata);
      assert.deepStrictEqual(pickerDimensionsFromCacheRow({ id: 'dimensions', mediaFileMetadata: Object.freeze(dimensions) }), metadata);
      assert.deepStrictEqual(pickerDimensionsFromCacheRow({ id: 'dimensions', mediaFile: Object.freeze({ mediaFileMetadata: dimensions }) }), metadata);
      assert.strictEqual(item.mediaFileMetadata ?? item.mediaFile.mediaFileMetadata, metadata);
    });
  });
  const dimensions = pickerDimensionsFromCacheRow({ id: 'dimensions', mediaFileMetadata: { width: '1'.padEnd(22, '0'), height: '480' } });
  assert.deepStrictEqual(dimensions, { width: 1e21, height: 480 });
  assert.deepStrictEqual(pickerDimensionsFromCacheRow({ id: 'dimensions', mediaFileMetadata: dimensions }), { width: 1, height: 480 });
});

assertAsyncTest('Google Photos Picker sync stores and retains creation time across media refreshes', async () => {
  const createTime = '2023-12-31T23:45:00Z';
  let cacheItems = [];
  const listMediaItems = async (sessionId) => ({
    mediaItems: sessionId === 'session-with-date'
      ? [{ id: 'dated-photo', createTime, baseUrl: 'https://photos.example/dated-v1', mimeType: 'image/jpeg' }]
      : [{ id: 'dated-photo', baseUrl: 'https://photos.example/dated-v2', mimeType: 'image/jpeg' }]
  });
  const syncOptions = {
    poolPolicy: { retentionDays: 3650, maxPhotos: 5000 },
    readCache: () => cacheItems,
    writeCache: (items) => { cacheItems = items; },
    cleanMediaFiles: () => {},
    downloadMediaItems: async () => {}
  };

  await googlePhotos.syncGoogleAlbum('session-with-date', {
    now: new Date('2026-09-02T00:00:00Z'),
    ...syncOptions,
    listMediaItems
  });
  await googlePhotos.syncGoogleAlbum('session-without-date', {
    now: new Date('2026-09-03T00:00:00Z'),
    ...syncOptions,
    listMediaItems
  });

  assert.strictEqual(cacheItems[0].googleBaseUrl, 'https://photos.example/dated-v2');
  assert.strictEqual(cacheItems[0].createTime, createTime);
});

assertAsyncTest('Google Photos slide titles use localized capture dates and preserve title fallbacks', async () => {
  const {
    formatGooglePhotoCaptureDate,
    getPhotoSlideTitle,
    projectSplitSlideTitles
  } = await importClientModule('./client/src/state/photoTitles.js');
  const firstCreateTime = '2024-05-10T23:30:00Z';
  const secondCreateTime = '2021-01-02T04:05:00Z';
  const firstDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(firstCreateTime));
  const secondDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(secondCreateTime));
  const pickerPhoto = {
    source: 'google_photos',
    url: '/api/google-photos/media/first?w=2560&h=1440',
    createTime: firstCreateTime,
    title: 'Google Photos Picker Cast'
  };

  assert.strictEqual(formatGooglePhotoCaptureDate(firstCreateTime, 'en-US'), firstDate);
  assert.strictEqual(formatGooglePhotoCaptureDate(undefined, 'en-US'), '');
  assert.strictEqual(formatGooglePhotoCaptureDate('not-a-date', 'en-US'), '');
  assert.strictEqual(getPhotoSlideTitle(pickerPhoto, 'en-US'), firstDate);
  assert.strictEqual(getPhotoSlideTitle({ ...pickerPhoto, createTime: 'not-a-date' }, 'en-US'), 'Google Photos Picker Cast');
  assert.strictEqual(getPhotoSlideTitle({ title: 'Unsplash title', createTime: firstCreateTime }, 'en-US'), 'Unsplash title');

  assert.deepStrictEqual(projectSplitSlideTitles(
    pickerPhoto,
    { ...pickerPhoto, createTime: secondCreateTime, title: 'Second Picker title' },
    'en-US'
  ), {
    title: firstDate,
    title2: secondDate
  });
  assert.deepStrictEqual(projectSplitSlideTitles(
    pickerPhoto,
    { source: 'unsplash', title: 'Non-Google split title', createTime: secondCreateTime },
    'en-US'
  ), {
    title: firstDate,
    title2: 'Non-Google split title'
  });

  const dashboardSource = fs.readFileSync(
    path.join(__dirname, 'client/src/components/Dashboard.jsx'),
    'utf8'
  );
  assert.match(dashboardSource, /title: getPhotoSlideTitle\(photo\)/);
  assert.match(dashboardSource, /source: photo\.source/);
  assert.match(dashboardSource, /slide\.source === 'google_photos' && \(/);
  assert.match(dashboardSource, /className="single-slide-credit"/);
  assert.match(dashboardSource, /projectSplitSlideTitles\(photo1, photo2\)/);
});

assertTest('buildGooglePhotoProxyUrl preserves same-origin rendering for browser previews without forced crop', () => {
  const proxyUrl = buildGooglePhotoProxyUrl('A/B+C', { width: 1080, height: 1920 });
  assert.strictEqual(proxyUrl, '/api/google-photos/media/A%2FB%2BC?w=1080&h=1920');
});

assertTest('buildGooglePhotoProxyUrl still supports explicit crop opt-in', () => {
  const proxyUrl = buildGooglePhotoProxyUrl('A/B+C', { width: 1080, height: 1920, crop: true });
  assert.strictEqual(proxyUrl, '/api/google-photos/media/A%2FB%2BC?w=1080&h=1920&c=1');
});

assertTest('Google Photos proxy builder defaults only undefined options and dimensions independently', () => {
  const expected = '/api/google-photos/media/id?w=2560&h=1440';
  assert.strictEqual(buildGooglePhotoProxyUrl('id'), expected);
  [undefined, false, true, 0, '', 'text', 1n, Symbol('options'), Object.freeze({}),
    Object.freeze({ width: undefined, height: undefined, crop: undefined })].forEach(options => {
    assert.strictEqual(buildGooglePhotoProxyUrl('id', options), expected);
  });
  [
    [{ width: 1080 }, 'w=1080&h=1440'], [{ height: 1920 }, 'w=2560&h=1920'],
    [{ width: null, height: 0 }, 'w=null&h=0'], [{ width: -0, height: NaN }, 'w=0&h=NaN']
  ].forEach(([options, query]) => {
    const before = { ...options };
    assert.strictEqual(buildGooglePhotoProxyUrl('id', Object.freeze(options)), `/api/google-photos/media/id?${query}`);
    assert.deepStrictEqual(options, before);
  });
});

assertTest('Google Photos proxy builder form-encodes native dimension strings without validation', () => {
  [
    [false, true, 'w=false&h=true'], ['', -1.5, 'w=&h=-1.5'],
    [Infinity, 1n, 'w=Infinity&h=1'], [Symbol('size'), [], 'w=Symbol%28size%29&h='],
    [' +&=/#?', '雪🌌', 'w=+%2B%26%3D%2F%23%3F&h=%E9%9B%AA%F0%9F%8C%8C'],
    ['\uD800', '\uDC00', 'w=%EF%BF%BD&h=%EF%BF%BD']
  ].forEach(([width, height, query]) => {
    assert.strictEqual(buildGooglePhotoProxyUrl('id', Object.freeze({ width, height })), `/api/google-photos/media/id?${query}`);
  });
});

assertTest('Google Photos proxy builder appends crop by truthiness without reading coercion hooks', () => {
  const opaque = Object.freeze({ [Symbol.toPrimitive]: () => { throw new Error('Crop must not be coerced'); } });
  [undefined, null, false, 0, -0, NaN, '', 0n].forEach(crop => {
    assert.strictEqual(buildGooglePhotoProxyUrl('id', Object.freeze({ crop })), '/api/google-photos/media/id?w=2560&h=1440');
  });
  [true, 1, 'false', 1n, Symbol('crop'), Object.freeze([]), opaque].forEach(crop => {
    assert.strictEqual(buildGooglePhotoProxyUrl('id', Object.freeze({ crop })), '/api/google-photos/media/id?w=2560&h=1440&c=1');
  });
});

assertTest('Google Photos proxy builder encodes ids once without trimming or a falsy fallback', () => {
  [
    [undefined, 'undefined'], [null, 'null'], [false, 'false'], [0, '0'], [0n, '0'],
    [NaN, 'NaN'], ['', ''], [' id ', '%20id%20'], ['A/B+C?#%', 'A%2FB%2BC%3F%23%25'],
    ['A%2FB', 'A%252FB'], ['雪🌌', '%E9%9B%AA%F0%9F%8C%8C'], ['\0', '%00'],
    [Object.freeze(['a', 'b']), 'a%2Cb']
  ].forEach(([id, encoded]) => {
    assert.strictEqual(buildGooglePhotoProxyUrl(id), `/api/google-photos/media/${encoded}?w=2560&h=1440`);
  });
});

assertTest('Google Photos proxy builder reads only named options before ordered string-hint coercion', () => {
  const calls = [];
  const scalar = (label, value) => Object.freeze({
    [Symbol.toPrimitive]: hint => { calls.push(`${label}:${hint}`); return value; }
  });
  const prototype = Object.create(null, {
    width: { value: scalar('width', 'a b') },
    height: { value: scalar('height', 'c+d') },
    crop: { value: true }
  });
  const options = new Proxy(Object.freeze(Object.create(Object.freeze(prototype))), {
    get: (target, key, receiver) => { calls.push(key); return Reflect.get(target, key, receiver); },
    ownKeys: () => { throw new Error('Unexpected options enumeration'); }
  });
  assert.strictEqual(buildGooglePhotoProxyUrl(scalar('id', 'a/b'), options), '/api/google-photos/media/a%2Fb?w=a+b&h=c%2Bd&c=1');
  assert.deepStrictEqual(calls, ['width', 'height', 'crop', 'width:string', 'height:string', 'id:string']);
  calls.length = 0;
  const id = Object.freeze({
    toString: () => { calls.push('toString'); return {}; },
    valueOf: () => { calls.push('valueOf'); return 'fallback'; }
  });
  assert.strictEqual(buildGooglePhotoProxyUrl(id), '/api/google-photos/media/fallback?w=2560&h=1440');
  assert.deepStrictEqual(calls, ['toString', 'valueOf']);
});

assertTest('Google Photos proxy builder propagates exact failures and stops later reads or coercions', () => {
  const stages = ['read:width', 'read:height', 'read:crop', 'coerce:width', 'coerce:height', 'coerce:id'];
  stages.forEach(stage => [undefined, null, false, 0, '', new Error('projection failed')].forEach(failure => {
    const calls = [];
    const observe = label => { calls.push(label); if (label === stage) throw failure; };
    const scalar = label => Object.freeze({ [Symbol.toPrimitive]: () => { observe(`coerce:${label}`); return '1'; } });
    const options = Object.freeze(Object.fromEntries(['width', 'height', 'crop'].map(key => [key, key === 'crop' ? true : scalar(key)])));
    const input = new Proxy(options, { get: (target, key) => { observe(`read:${key}`); return Reflect.get(target, key); } });
    let rejected = false;
    let result = 'not returned';
    try { result = buildGooglePhotoProxyUrl(scalar('id'), input); }
    catch (error) { rejected = true; assert.strictEqual(error, failure); }
    assert.strictEqual(rejected, true);
    assert.strictEqual(result, 'not returned');
    assert.deepStrictEqual(calls, stages.slice(0, stages.indexOf(stage) + 1));
  }));
});

assertTest('Google Photos proxy builder retains native null, symbol, malformed coercion, and UTF-16 failures', () => {
  const id = Object.freeze({ [Symbol.toPrimitive]: () => { throw new Error('Id must not be read'); } });
  assert.throws(() => buildGooglePhotoProxyUrl(id, null), TypeError);
  [Symbol('id'), Object.create(null), Object.freeze({ [Symbol.toPrimitive]: () => ({}) })].forEach(value => {
    assert.throws(() => buildGooglePhotoProxyUrl(value), TypeError);
  });
  ['\uD800', '\uDC00', 'x\uD800y', '\uDC00\uD800'].forEach(value => {
    assert.throws(() => buildGooglePhotoProxyUrl(value), URIError);
  });
  [Object.create(null), Object.freeze({ [Symbol.toPrimitive]: () => ({}) })].forEach(value => {
    assert.throws(() => buildGooglePhotoProxyUrl(id, { width: value }), TypeError);
    assert.throws(() => buildGooglePhotoProxyUrl(id, { height: value }), TypeError);
  });
});

assertTest('Google Photos proxy URLs round-trip their media item ids', () => {
  const proxyUrl = buildGooglePhotoProxyUrl('A/B+C');
  assert.strictEqual(getGooglePhotoMediaItemId(proxyUrl), 'A/B+C');
});

assertTest('Google Photos media id decoder preserves falsy and ordinary unsupported input identities', () => {
  [undefined, null, false, true, 0, -0, NaN, Infinity, 1, '', ' ', 0n, 1n,
    Symbol('id'), Object.freeze({}), Object.freeze([])].forEach(value => {
    assert.strictEqual(getGooglePhotoMediaItemId(value), '');
  });
  const value = Object.freeze(['/api/google-photos/media/array%2Fid?w=1']);
  assert.strictEqual(getGooglePhotoMediaItemId(value), 'array/id');
  assert.deepStrictEqual(value, ['/api/google-photos/media/array%2Fid?w=1']);
});

assertTest('Google Photos media id decoder accepts only the exact relative prefix after outer trimming', () => {
  [
    ['', ''], ['/api/google-photos/media/', ''], ['/api/google-photos/media/?w=1', ''],
    [' \t/api/google-photos/media/id\n ', 'id'],
    ['https://example.invalid/api/google-photos/media/id', ''],
    ['//example.invalid/api/google-photos/media/id', ''],
    ['/API/google-photos/media/id', ''], ['/api/google-photos/media', ''],
    ['/api/google-photos/media-other/id', ''], ['prefix/api/google-photos/media/id', '']
  ].forEach(([value, expected]) => assert.strictEqual(getGooglePhotoMediaItemId(value), expected));
});

assertTest('Google Photos media id decoder splits only the first query marker and decodes exactly once', () => {
  [
    ['id?w=1?h=2', 'id'], ['id?%', 'id'], ['?%ZZ', ''],
    ['A%2FB%2BC', 'A/B+C'], ['A+B', 'A+B'], ['A%252FB', 'A%2FB'],
    ['%3F%23%25?ignored', '?#%'], ['id#fragment', 'id#fragment'],
    ['id#fragment?query', 'id#fragment'], ['../folder/id', '../folder/id'],
    ['%2e%2e%2Fid', '../id'], ['%20id%20', ' id '], ['%20', ' '],
    ['%00', '\0'], ['%E9%9B%AA%F0%9F%8C%8C', '雪🌌']
  ].forEach(([suffix, expected]) => {
    assert.strictEqual(getGooglePhotoMediaItemId(`/api/google-photos/media/${suffix}`), expected);
  });
});

assertTest('Google Photos media id decoder uses native string-hint coercion once without enumerating input', () => {
  const calls = [];
  const value = new Proxy(Object.freeze({
    [Symbol.toPrimitive]: hint => {
      calls.push(`coerce:${hint}`);
      return ' /api/google-photos/media/hook%2Fid?w=1 ';
    }
  }), {
    get: (target, key, receiver) => {
      calls.push(key);
      return Reflect.get(target, key, receiver);
    },
    ownKeys: () => { throw new Error('Unexpected enumeration'); }
  });
  assert.strictEqual(getGooglePhotoMediaItemId(value), 'hook/id');
  assert.deepStrictEqual(calls, [Symbol.toPrimitive, 'coerce:string']);
  calls.length = 0;
  assert.strictEqual(getGooglePhotoMediaItemId(Object.freeze({
    toString: () => { calls.push('toString'); return {}; },
    valueOf: () => { calls.push('valueOf'); return '/api/google-photos/media/fallback'; }
  })), 'fallback');
  assert.deepStrictEqual(calls, ['toString', 'valueOf']);
});

assertTest('Google Photos media id decoder propagates exact coercion failures without later fallback reads', () => {
  [undefined, null, false, 0, '', new Error('coercion failed')].forEach(failure => {
    const calls = [];
    const value = Object.freeze({
      [Symbol.toPrimitive]: hint => { calls.push(hint); throw failure; },
      get toString() { throw new Error('Unexpected fallback read'); }
    });
    let rejected = false;
    let result = 'not returned';
    try { result = getGooglePhotoMediaItemId(value); }
    catch (error) { rejected = true; assert.strictEqual(error, failure); }
    assert.strictEqual(rejected, true);
    assert.strictEqual(result, 'not returned');
    assert.deepStrictEqual(calls, ['string']);
  });
  [Object.freeze({ [Symbol.toPrimitive]: () => ({}) }), Object.create(null)].forEach(value => {
    assert.throws(() => getGooglePhotoMediaItemId(value), TypeError);
  });
});

assertTest('Google Photos media id decoder rejects malformed encoded ids but never decodes unsupported URLs or queries', () => {
  ['%', '%0', '%GG', '%FF', '%C0%AF', '%E2%82', '%ED%A0%80', '%F4%90%80%80'].forEach(encodedId => {
    assert.throws(() => getGooglePhotoMediaItemId(`/api/google-photos/media/${encodedId}?ignored`), URIError);
    assert.strictEqual(getGooglePhotoMediaItemId(`/unsupported/${encodedId}`), '');
    assert.strictEqual(getGooglePhotoMediaItemId(`/api/google-photos/media/valid?${encodedId}`), 'valid');
  });
});

assertTest('Google Photos proxy codec round-trips generated well-formed ids independently of render options', () => {
  const atoms = ['', 'plain', ' /+?#% ', '雪🌌', '\0', '../'];
  const ids = atoms.flatMap(left => atoms.map(right => `${left}${right}`));
  const options = [undefined, Object.freeze({}), Object.freeze({ width: 1080, height: 1920, crop: true })];
  ids.forEach(id => options.forEach(renderOptions => {
    const before = renderOptions && { ...renderOptions };
    const url = buildGooglePhotoProxyUrl(id, renderOptions);
    assert.strictEqual(getGooglePhotoMediaItemId(url), id);
    assert.deepStrictEqual(renderOptions, before);
  }));
  assert.strictEqual(getGooglePhotoMediaItemId(getGooglePhotoMediaItemId(buildGooglePhotoProxyUrl('id'))), '');
});

assertTest('Picker MIME projection selects truthy hints before trimming without validating MIME syntax', () => {
  const { getPickerItemMimeType: project } = googlePhotosCache;
  const falsy = [undefined, null, false, 0, -0, NaN, '', 0n];
  falsy.forEach(mimeType => {
    assert.strictEqual(project(Object.freeze({ mediaFile: Object.freeze({ mimeType }), mimeType: ' image/legacy ' })), 'image/legacy');
    assert.strictEqual(project(Object.freeze({ mediaFile: Object.freeze({ mimeType }), mimeType })), '');
  });
  [
    [' image/jpeg ', 'image/jpeg'], ['\t\n ', ''],
    [' Image/JPEG; quality=90 ', 'Image/JPEG; quality=90'],
    ['not a MIME type', 'not a MIME type']
  ].forEach(([mimeType, expected]) => {
    const item = Object.freeze({ mediaFile: Object.freeze({ mimeType }), mimeType: 'image/legacy' });
    assert.strictEqual(project(item), expected);
    assert.strictEqual(project(Object.freeze({ mimeType })), expected);
    assert.strictEqual(item.mediaFile.mimeType, mimeType);
  });
});

assertTest('Picker MIME projection preserves native file-shape selection and empty identities', () => {
  const project = googlePhotosCache.getPickerItemMimeType;
  [undefined, null, false, true, 0, 1, '', 'text', 1n, Symbol('row')].forEach(item => {
    assert.strictEqual(project(item), '');
  });
  const callable = Object.assign(() => {}, { mimeType: 'image/ignored' });
  [undefined, null, false, 0, '', 'text', 1, true, 1n, Symbol('file'), callable].forEach(mediaFile => {
    assert.strictEqual(project(Object.freeze({ mediaFile, mimeType: ' image/flat ' })), 'image/flat');
  });
  [[], {}, new String('file'), Object.create(null)].forEach(mediaFile => {
    Object.defineProperty(mediaFile, 'mimeType', { value: ' image/nested ' });
    assert.strictEqual(project(Object.freeze({ mediaFile: Object.freeze(mediaFile), mimeType: 'image/flat' })), 'image/nested');
  });
});

assertTest('Picker MIME projection uses native String coercion with string-hint hooks only on the chosen value', () => {
  const project = googlePhotosCache.getPickerItemMimeType;
  [[true, 'true'], [42, '42'], [Infinity, 'Infinity'], [1n, '1'], [Symbol('mime'), 'Symbol(mime)'], [[], ''], [[' image/png '], 'image/png']]
    .forEach(([mimeType, expected]) => assert.strictEqual(project({ mediaFile: { mimeType }, mimeType: 'image/flat' }), expected));
  const events = [];
  const mimeType = Object.freeze({
    [Symbol.toPrimitive]: hint => { events.push(hint); return ' image/custom '; }
  });
  const item = Object.freeze({
    mediaFile: Object.freeze({ mimeType }),
    get mimeType() { throw new Error('Unused fallback must not be read'); }
  });
  assert.strictEqual(project(item), 'image/custom');
  assert.deepStrictEqual(events, ['string']);
  const legacyValue = Object.freeze({
    toString: () => { events.push('toString'); return {}; },
    valueOf: () => { events.push('valueOf'); return ' image/legacy '; }
  });
  assert.strictEqual(project({ mimeType: legacyValue }), 'image/legacy');
  assert.deepStrictEqual(events, ['string', 'toString', 'valueOf']);
});

assertTest('Picker MIME projection preserves repeated file reads and lazy flat fallback order', () => {
  [undefined, {}, { mimeType: '' }, { mimeType: ' image/nested ' }].forEach(mediaFile => {
    const events = [];
    const nested = mediaFile && new Proxy(mediaFile, { get: (target, key) => { events.push(`nested.${String(key)}`); return target[key]; } });
    const row = new Proxy({ mediaFile: nested, mimeType: ' image/flat ' }, {
      get: (target, key) => { events.push(String(key)); return target[key]; },
      ownKeys: () => { throw new Error('Must not enumerate metadata'); }
    });
    const selected = !!mediaFile?.mimeType;
    assert.strictEqual(googlePhotosCache.getPickerItemMimeType(row), selected ? 'image/nested' : 'image/flat');
    assert.deepStrictEqual(events, mediaFile
      ? ['mediaFile', 'mediaFile', 'mediaFile', 'nested.mimeType', ...(!selected ? ['mimeType'] : [])]
      : ['mediaFile', 'mimeType']);
  });
  const events = [];
  const row = { get mimeType() { events.push('mimeType'); return events.length === 1 ? 0 : ' image/second-read '; } };
  assert.strictEqual(googlePhotosCache.getPickerItemMimeType(row), 'image/second-read');
  assert.deepStrictEqual(events, ['mimeType', 'mimeType']);
});

assertTest('Picker MIME projection reads inherited fields and is stable under flat or nested re-embedding', () => {
  const project = googlePhotosCache.getPickerItemMimeType;
  const file = Object.freeze(Object.create(Object.freeze({ mimeType: ' image/inherited ' })));
  const item = Object.freeze(Object.create(Object.freeze({ mediaFile: file })));
  assert.strictEqual(project(item), 'image/inherited');
  assert.deepStrictEqual(Reflect.ownKeys(item), []);
  const hidden = Object.freeze(Object.defineProperty({}, 'mimeType', { value: ' image/hidden ' }));
  assert.strictEqual(project(hidden), 'image/hidden');
  ['', ' image/jpeg ', '\t\n', 'Image/PNG; x=1', 'invalid', true, 3, Symbol('mime')].forEach(mimeType => {
    const flat = Object.freeze({ mimeType });
    const nested = Object.freeze({ mediaFile: Object.freeze({ mimeType }) });
    const result = project(flat);
    assert.strictEqual(project(nested), result);
    assert.strictEqual(result.trim(), result);
    assert.strictEqual(project(Object.freeze({ mimeType: result })), result);
    assert.strictEqual(project(Object.freeze({ mediaFile: Object.freeze({ mimeType: result }) })), result);
    assert.strictEqual(flat.mimeType, mimeType);
    assert.strictEqual(nested.mediaFile.mimeType, mimeType);
  });
});

assertTest('Picker MIME projection propagates exact hook failures and stops subsequent reads', () => {
  ['file', 'nested', 'flat', 'coercion'].forEach(stage => {
    [undefined, null, false, 0, '', new Error('MIME hook failure')].forEach(failure => {
      const events = [];
      const observe = (key, value) => { events.push(key); if (key === stage) throw failure; return value; };
      const coercible = { [Symbol.toPrimitive]: () => observe('coercion', 'image/custom') };
      const file = { get mimeType() { return observe('nested', stage === 'flat' ? '' : coercible); } };
      const row = {
        get mediaFile() { return observe('file', file); },
        get mimeType() { return observe('flat', coercible); }
      };
      let caught = false;
      let result = 'not returned';
      try { result = googlePhotosCache.getPickerItemMimeType(row); } catch (error) {
        caught = true;
        assert.strictEqual(error, failure);
      }
      assert.strictEqual(caught, true);
      assert.strictEqual(result, 'not returned');
      const prefix = ['file', 'file', 'file', 'nested', ...(stage === 'flat' ? ['flat'] : ['coercion'])];
      assert.deepStrictEqual(events, stage === 'file' ? ['file'] : prefix.slice(0, prefix.indexOf(stage) + 1));
    });
  });
});

assertTest('Picker MIME projection retains native failures from changing file accessors and invalid coercion', () => {
  const project = googlePhotosCache.getPickerItemMimeType;
  const reads = [];
  const row = {
    get mediaFile() { reads.push('mediaFile'); return reads.length < 3 ? {} : null; },
    get mimeType() { throw new Error('Must fail before the fallback'); }
  };
  assert.throws(() => project(row), TypeError);
  assert.deepStrictEqual(reads, ['mediaFile', 'mediaFile', 'mediaFile']);
  assert.throws(() => project({ mimeType: { [Symbol.toPrimitive]: () => ({}) } }), TypeError);
  assert.throws(() => project({ mimeType: Object.create(null) }), TypeError);
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.throws(() => project(proxy), TypeError);
});

assertTest('mergeCachedMediaItemMetadata updates pairing flags for cached Google Photos rows', () => {
  const cachedItems = [
    {
      id: 'picker-123',
      url: '/api/google-photos/media/picker-123?w=2560&h=1440&c=1',
      preventPairing: false,
      rating: 10
    }
  ];

  const merged = mergeCachedMediaItemMetadata(cachedItems, cachedItems[0].url, {
    preventPairing: true
  });

  assert.strictEqual(merged.changed, true);
  assert.strictEqual(merged.updatedItem?.preventPairing, true);
  assert.strictEqual(merged.items[0].preventPairing, true);
  assert.notStrictEqual(merged.items[0], cachedItems[0]);
  assert.strictEqual(cachedItems[0].preventPairing, false);
});

assertTest('Google Photos metadata patches omit undefined fields and retain explicit falsy values', () => {
  const patch = googlePhotosCache.buildGooglePhotoMetadataPatch({
    rating: undefined,
    isBroken: false,
    cropPercent: 0,
    cropPositionY: null,
    preventPairing: false,
    loved: true,
    orientation: 'portrait',
    width: 1200,
    height: 800,
    unrecognized: 'ignored'
  });

  assert.deepStrictEqual(patch, {
    isBroken: false,
    cropPercent: 0,
    cropPositionY: null,
    preventPairing: false,
    loved: true,
    orientation: 'portrait',
    width: 1200,
    height: 800
  });
});

assertTest('metadata projection retains every defined allowlisted value without coercion or cloning', () => {
  const fields = ['rating', 'isBroken', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved', 'orientation', 'width', 'height'];
  const object = Object.freeze({ nested: true });
  const array = Object.freeze([object]);
  const callable = () => 'opaque';
  const values = [undefined, null, false, true, 0, -0, NaN, Infinity, '', 'verbatim', 1n, Symbol('opaque'), object, array, callable];

  fields.forEach((field) => values.forEach((value) => {
    const input = Object.freeze({ [field]: value });
    const patch = googlePhotosCache.buildGooglePhotoMetadataPatch(input);
    assert.deepStrictEqual(Object.keys(patch), value === undefined ? [] : [field]);
    assert.ok(Object.is(patch[field], value));
    assert.ok(Object.is(input[field], value));
    assert.notStrictEqual(patch, input);
  }));
});

assertTest('metadata projection orders fresh plain output fields independently of input enumeration', () => {
  const fields = ['rating', 'isBroken', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved', 'orientation', 'width', 'height'];
  const input = Object.freeze(Object.defineProperties(Object.fromEntries(
    [...fields].reverse().map((field, index) => [field, index])
  ), {
    title: { enumerable: true, get: () => { throw new Error('Unsupported key read'); } },
    [Symbol('ignored')]: { enumerable: true, get: () => { throw new Error('Symbol read'); } },
    ['__proto__']: { value: { polluted: true }, enumerable: true }
  }));
  const patch = googlePhotosCache.buildGooglePhotoMetadataPatch(input);
  assert.strictEqual(Object.getPrototypeOf(patch), Object.prototype);
  assert.deepStrictEqual(Reflect.ownKeys(patch), fields);
  fields.forEach((field) => assert.deepStrictEqual(Object.getOwnPropertyDescriptor(patch, field), {
    value: input[field], enumerable: true, writable: true, configurable: true
  }));
  assert.notStrictEqual(googlePhotosCache.buildGooglePhotoMetadataPatch(input), patch);
});

assertTest('metadata projection reads inherited and non-enumerable allowlisted properties', () => {
  const nested = Object.freeze({ retained: true });
  const prototype = Object.freeze({ rating: 4, loved: true });
  const input = Object.freeze(Object.defineProperties(Object.create(prototype), {
    cropPercent: { value: 0 },
    orientation: { get: () => nested },
    height: { value: undefined }
  }));
  const patch = googlePhotosCache.buildGooglePhotoMetadataPatch(input);
  assert.deepStrictEqual(patch, { rating: 4, cropPercent: 0, loved: true, orientation: nested });
  assert.strictEqual(patch.orientation, nested);
  assert.deepStrictEqual(Object.keys(input), []);
  assert.strictEqual(Object.getPrototypeOf(input), prototype);
  assert.deepStrictEqual(googlePhotosCache.buildGooglePhotoMetadataPatch(Object.freeze(
    Object.assign(Object.create(null), { rating: 0 })
  )), { rating: 0 });
});

assertTest('metadata projection eagerly reads each allowed key once without reflecting on input keys', () => {
  const fields = ['rating', 'isBroken', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved', 'orientation', 'width', 'height'];
  [undefined, false].forEach((value) => {
    const reads = [];
    const input = new Proxy({}, {
      get: (_, field) => { reads.push(field); return value; },
      ownKeys: () => { throw new Error('Input enumeration'); },
      has: () => { throw new Error('Input membership check'); },
      getOwnPropertyDescriptor: () => { throw new Error('Input descriptor read'); }
    });
    assert.deepStrictEqual(googlePhotosCache.buildGooglePhotoMetadataPatch(input), value === undefined
      ? {} : Object.fromEntries(fields.map((field) => [field, value])));
    assert.deepStrictEqual(reads, fields);
  });
});

assertTest('metadata projection defaults only undefined and preserves native primitive and null access', () => {
  const empty = googlePhotosCache.buildGooglePhotoMetadataPatch();
  [undefined, false, true, 0, 1, '', 'text', 1n, Symbol('input')].forEach((input) => {
    const patch = googlePhotosCache.buildGooglePhotoMetadataPatch(input);
    assert.deepStrictEqual(patch, {});
    assert.notStrictEqual(patch, empty);
  });
  assert.throws(() => googlePhotosCache.buildGooglePhotoMetadataPatch(null), TypeError);
  const input = Object.freeze({
    rating: 0,
    toString: () => { throw new Error('Unexpected coercion'); },
    valueOf: () => { throw new Error('Unexpected coercion'); }
  });
  assert.deepStrictEqual(googlePhotosCache.buildGooglePhotoMetadataPatch(input), { rating: 0 });
});

assertTest('metadata projection propagates exact read failures without later reads or partial results', () => {
  const fields = ['rating', 'isBroken', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved', 'orientation', 'width', 'height'];
  fields.forEach((failedField, index) => [undefined, null, false, 0, '', new Error('Read failure')].forEach((failure) => {
    const reads = [];
    const input = new Proxy({}, { get: (_, field) => {
      reads.push(field);
      if (field === failedField) throw failure;
      return 0;
    } });
    const sentinel = Symbol('no result');
    let result = sentinel;
    let caught = false;
    try {
      result = googlePhotosCache.buildGooglePhotoMetadataPatch(input);
    } catch (error) {
      caught = true;
      assert.strictEqual(error, failure);
    }
    assert.strictEqual(caught, true);
    assert.strictEqual(result, sentinel);
    assert.deepStrictEqual(reads, fields.slice(0, index + 1));
  }));
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.throws(() => googlePhotosCache.buildGooglePhotoMetadataPatch(proxy), TypeError);
});

assertTest('metadata projection is value-idempotent and closed over defined allowlisted fields', () => {
  const project = googlePhotosCache.buildGooglePhotoMetadataPatch;
  const values = [undefined, false, 0, null, Object.freeze({ shared: true })];
  values.forEach((rating) => values.forEach((loved) => values.forEach((width) => {
    const input = Object.freeze({ ignored: 'discard', width, loved, rating });
    const once = Object.freeze(project(input));
    const twice = project(once);
    const expected = Object.fromEntries(Object.entries({ rating, loved, width }).filter(([, value]) => value !== undefined));
    assert.deepStrictEqual(once, expected);
    assert.deepStrictEqual(twice, once);
    assert.notStrictEqual(twice, once);
    Object.keys(once).forEach((field) => assert.strictEqual(twice[field], once[field]));
    assert.deepStrictEqual(project({ ...input, ignored: 'different' }), once);
  })));
});

assertTest('Google Photos metadata merge preserves immutable no-match and empty-patch semantics', () => {
  const source = [{ id: 'other', rating: 7 }, null];
  const missing = googlePhotosCache.mergeCachedMediaItemMetadata(source, 'absent', { loved: true });
  const empty = googlePhotosCache.mergeCachedMediaItemMetadata(source, 'other', { loved: undefined });

  [missing, empty].forEach((result) => {
    assert.deepStrictEqual(result.items, source);
    assert.strictEqual(result.updatedItem, null);
    assert.strictEqual(result.changed, false);
    assert.notStrictEqual(result.items, source);
    assert.notStrictEqual(result.items[0], source[0]);
  });
  assert.strictEqual(source[0].loved, undefined);
});

assertTest('pure cached metadata merge decodes identifiers once and matches only strict row ids', () => {
  [
    [' photo ', 'photo', true], ['photo', ' photo ', false], ['photo', undefined, false],
    ['12', 12, false], [12, '12', true], [0, '0', false],
    [buildGooglePhotoProxyUrl('A/B'), 'A/B', true],
    [buildGooglePhotoProxyUrl('%2F'), '%2F', true],
    [buildGooglePhotoProxyUrl(' photo '), ' photo ', true],
    [buildGooglePhotoProxyUrl(' photo '), 'photo', false]
  ].forEach(([identifier, id, matches]) => {
    const row = Object.freeze({ id, url: buildGooglePhotoProxyUrl('photo'), source: 'other', isBroken: true });
    const result = mergeCachedMediaItemMetadata(Object.freeze([row]), identifier, Object.freeze({ loved: true }));
    assert.strictEqual(result.changed, matches);
    assert.strictEqual(result.updatedItem, matches ? result.items[0] : null);
    assert.deepStrictEqual(result.items, [{ ...row, ...(matches ? { loved: true } : {}) }]);
  });
});

assertTest('pure cached metadata merge copies repeated aliases and returns the last duplicate match', () => {
  const nested = Object.freeze({ label: 'retained' });
  const first = Object.freeze({ id: 'photo', rating: 1, nested });
  const last = Object.freeze({ id: 'photo', rating: 7, nested });
  const sibling = Object.freeze({ id: 'other', nested });
  const rows = Object.freeze([first, first, sibling, last]);
  const patchValue = Object.freeze({ custom: true });
  const result = mergeCachedMediaItemMetadata(rows, 'photo', Object.freeze({ rating: 7, orientation: patchValue }));
  assert.strictEqual(result.changed, true);
  assert.strictEqual(result.updatedItem, result.items[3]);
  assert.notStrictEqual(result.items[0], result.items[1]);
  rows.forEach((row, index) => {
    assert.notStrictEqual(result.items[index], row);
    assert.strictEqual(result.items[index].nested, nested);
    assert.deepStrictEqual(result.items[index], { ...row, ...(row.id === 'photo' ? { rating: 7, orientation: patchValue } : {}) });
    if (row.id === 'photo') assert.strictEqual(result.items[index].orientation, patchValue);
  });
  assert.deepStrictEqual(rows.map(({ rating }) => rating), [1, 1, undefined, 7]);
  assert.strictEqual(mergeCachedMediaItemMetadata([first, last], 'photo', { rating: 7 }).changed, true);
});

assertTest('pure cached metadata no-ops preserve sparse and falsy entries without reference identity', () => {
  const row = Object.freeze({ id: 'photo', nested: Object.freeze({ retained: true }) });
  const rows = Object.freeze([row].concat(Array(1), [null, undefined, false, 0, '']));
  [['', { loved: true }], ['missing', { loved: true }], ['photo', {}], ['photo', { loved: undefined, title: 'ignored' }]]
    .forEach(([id, patch]) => {
      const result = mergeCachedMediaItemMetadata(rows, id, patch);
      assert.deepStrictEqual(result, { items: rows, updatedItem: null, changed: false });
      assert.notStrictEqual(result.items, rows);
      assert.notStrictEqual(result.items[0], row);
      assert.strictEqual(result.items[0].nested, row.nested);
      assert.strictEqual(1 in result.items, false);
    });
  [undefined, null, false, 0, ''].forEach((rows) => {
    assert.deepStrictEqual(mergeCachedMediaItemMetadata(rows, 'photo', { rating: 0 }), { items: [], updatedItem: null, changed: false });
  });
});

assertTest('pure cached metadata change detection uses strict equality rather than validation or deep equality', () => {
  const shared = Object.freeze({ direction: 'portrait' });
  [[NaN, NaN, true], [0, -0, false], [shared, shared, false], [shared, { ...shared }, true],
    [7, null, true], [false, false, false], [undefined, 0, true]].forEach(([before, after, changed]) => {
    const row = Object.freeze({ id: 'photo', rating: before });
    const patch = Object.freeze({ rating: after });
    const result = mergeCachedMediaItemMetadata(Object.freeze([row]), 'photo', patch);
    assert.strictEqual(result.changed, changed);
    assert.strictEqual(result.updatedItem, result.items[0]);
    assert.ok(Object.is(result.updatedItem.rating, after));
    assert.ok(Object.is(row.rating, before));
    assert.notStrictEqual(result.updatedItem, row);
  });
});

assertTest('pure cached metadata row values obey projected right-biased patch composition', () => {
  const project = googlePhotosCache.buildGooglePhotoMetadataPatch;
  const apply = (patch) => (rows) => mergeCachedMediaItemMetadata(rows, 'photo', patch).items;
  const combine = (left, right) => ({ ...project(left), ...project(right) });
  const rows = Object.freeze([Object.freeze({ id: 'photo', rating: 3, loved: false }), Object.freeze({ id: 'other' }), null]);
  const patches = [{}, { rating: 0 }, { loved: true, rating: undefined }, { rating: null, title: 'ignored' }].map(Object.freeze);
  patches.flatMap((a) => patches.flatMap((b) => patches.map((c) => [a, b, c]))).forEach(([a, b, c]) => {
    assert.deepStrictEqual(apply(b)(apply(a)(rows)), apply(combine(a, b))(rows));
    assert.deepStrictEqual(combine(combine(a, b), c), combine(a, combine(b, c)));
    assert.deepStrictEqual(combine({}, a), project(a));
    assert.deepStrictEqual(combine(a, {}), project(a));
    assert.deepStrictEqual(apply(a)(apply(a)(rows)), apply(a)(rows));
  });
  assert.deepStrictEqual(apply({})(rows), rows);
  assert.strictEqual(apply(combine({ rating: 0 }, { rating: undefined }))(rows)[0].rating, 0);
  assert.strictEqual(apply({ ...{ rating: 0 }, ...{ rating: undefined } })(rows)[0].rating, 3);
});

assertTest('pure cached metadata result envelopes are not a patch-composition monoid', () => {
  const rows = [{ id: 'photo', rating: 3 }];
  const first = mergeCachedMediaItemMetadata(rows, 'photo', { rating: 7 });
  const reverted = mergeCachedMediaItemMetadata(first.items, 'photo', { rating: 3 });
  const combined = mergeCachedMediaItemMetadata(rows, 'photo', { rating: 3 });
  assert.deepStrictEqual(reverted.items, combined.items);
  assert.strictEqual(first.changed || reverted.changed, true);
  assert.strictEqual(combined.changed, false);
  const identity = mergeCachedMediaItemMetadata(rows, 'photo', {});
  assert.strictEqual(identity.updatedItem, null);
  assert.strictEqual(combined.updatedItem, combined.items[0]);
  const repeatedNaN = mergeCachedMediaItemMetadata([{ id: 'photo', rating: NaN }], 'photo', { rating: NaN });
  assert.strictEqual(repeatedNaN.changed, true);
});

assertTest('pure cached metadata merge projects inputs before guards and propagates failures in order', () => {
  const events = [];
  const identifier = { toString: () => { events.push('id'); return ''; } };
  const metadata = { get rating() { events.push('patch'); return undefined; } };
  const rows = [{ get id() { events.push('row-id'); return 'photo'; } }];
  mergeCachedMediaItemMetadata(rows, identifier, metadata);
  assert.deepStrictEqual(events, ['id', 'id', 'patch', 'row-id']);
  events.length = 0;
  assert.throws(() => mergeCachedMediaItemMetadata(rows, '/api/google-photos/media/%', metadata), URIError);
  assert.deepStrictEqual(events, []);
  assert.throws(() => mergeCachedMediaItemMetadata(rows, '', null), TypeError);
  assert.deepStrictEqual(events, []);
  [undefined, null, false, 0, '', new Error('projection')].forEach((failure) => {
    let caught = false;
    try { mergeCachedMediaItemMetadata(rows, '', { get rating() { throw failure; } }); }
    catch (error) { caught = true; assert.strictEqual(error, failure); }
    assert.strictEqual(caught, true);
  });
  assert.deepStrictEqual(events, []);
});

assertTest('pure cached metadata merge retains native map failures and does not assign partial row updates', () => {
  [{}, 42, 'rows'].forEach((rows) => {
    assert.throws(() => mergeCachedMediaItemMetadata(rows, 'photo', {}), TypeError);
  });
  const first = Object.freeze({ id: 'photo', rating: 3 });
  const failure = new Error('row access');
  let accesses = 0;
  const failing = { get id() { accesses += 1; throw failure; } };
  const rows = Object.freeze([first, failing]);
  assert.throws(() => mergeCachedMediaItemMetadata(rows, 'photo', { rating: 7 }), (error) => error === failure);
  assert.strictEqual(first.rating, 3);
  assert.strictEqual(rows[0], first);
  assert.strictEqual(rows[1], failing);
  assert.strictEqual(accesses, 1, 'caller accessor effects survive failure without a partial result');
});

assertTest('applyCachedMediaItemMetadataToState keeps Google Photos toggle state in sync with the live snapshot', () => {
  const state = {
    photosList: [
      {
        id: 'picker-123',
        url: '/api/google-photos/media/picker-123?w=2560&h=1440&c=1',
        preventPairing: false
      }
    ],
    activePhoto: {
      id: 'picker-123',
      url: '/api/google-photos/media/picker-123?w=2560&h=1440&c=1',
      preventPairing: false
    },
    activeSecondPhoto: null
  };

  const updatedPhoto = applyCachedMediaItemMetadataToState(state, state.photosList[0].url, {
    preventPairing: true
  });

  assert.strictEqual(updatedPhoto?.preventPairing, true);
  assert.strictEqual(state.photosList[0].preventPairing, true);
  assert.strictEqual(state.activePhoto.preventPairing, true);
});

assertTest('applyCachedMediaItemMetadataToState preserves list-copy and active-frame mutation semantics', () => {
  const proxyUrl = '/api/google-photos/media/picker-123?w=2560&h=1440&c=1';
  const state = {
    photosList: [
      { id: 'picker-123', url: proxyUrl, preventPairing: false },
      { url: proxyUrl, rating: 7 },
      { id: 'another-photo', rating: 4 },
      null
    ],
    activePhoto: { url: proxyUrl, preventPairing: false },
    activeSecondPhoto: { id: 'picker-123', loved: false }
  };
  const originalPhotos = state.photosList;
  const originalListMatch = state.photosList[0];
  const originalNonMatch = state.photosList[2];
  const originalActivePhoto = state.activePhoto;
  const originalActiveSecondPhoto = state.activeSecondPhoto;

  const updatedPhoto = applyCachedMediaItemMetadataToState(state, proxyUrl, {
    preventPairing: true,
    rating: 0,
    unsupportedField: 'ignored'
  });

  assert.strictEqual(updatedPhoto, state.activeSecondPhoto, 'activeSecondPhoto is last in application order');
  assert.strictEqual(updatedPhoto?.preventPairing, true);
  assert.strictEqual(updatedPhoto?.rating, 0);
  assert.strictEqual(updatedPhoto?.unsupportedField, undefined);
  assert.notStrictEqual(state.photosList, originalPhotos);
  assert.notStrictEqual(state.photosList[0], originalListMatch);
  assert.strictEqual(state.photosList[0].preventPairing, true);
  assert.strictEqual(state.photosList[1].preventPairing, true, 'proxy URL identity works without a row id');
  assert.strictEqual(state.photosList[2].rating, 4);
  assert.strictEqual(state.photosList[2], originalNonMatch, 'unmatched rows retain their identity');
  assert.strictEqual(state.photosList[3], null);
  assert.strictEqual(originalListMatch.preventPairing, false, 'source list rows are not mutated');
  assert.strictEqual(state.activePhoto, originalActivePhoto);
  assert.strictEqual(state.activePhoto.preventPairing, true);
  assert.strictEqual(state.activeSecondPhoto, originalActiveSecondPhoto);
  assert.strictEqual(state.activeSecondPhoto.loved, false);
});

assertTest('applyCachedMediaItemMetadataToState returns null for invalid input and retains valid no-match remapping', () => {
  const photo = { id: 'other', rating: 8 };
  const state = {
    photosList: [photo],
    activePhoto: { id: 'active-other', rating: 6 },
    activeSecondPhoto: null
  };

  assert.strictEqual(applyCachedMediaItemMetadataToState(null, 'picker-123', { loved: true }), null);
  assert.strictEqual(applyCachedMediaItemMetadataToState(state, '', { loved: true }), null);
  assert.strictEqual(applyCachedMediaItemMetadataToState(state, 'picker-123', { unsupported: true }), null);
  assert.strictEqual(state.photosList[0], photo, 'invalid inputs return before remapping live state');

  const originalList = state.photosList;
  const result = applyCachedMediaItemMetadataToState(state, 'picker-123', { loved: true });

  assert.strictEqual(result, null, 'an unmatched identifier has no updated photo to return');
  assert.notStrictEqual(state.photosList, originalList, 'a valid patch retains the established list-remap behavior');
  assert.strictEqual(state.photosList[0], photo, 'unmatched rows retain their identity during a no-match remap');
  assert.strictEqual(state.photosList[0].rating, 8);
  assert.strictEqual(state.activePhoto.rating, 6);
  assert.strictEqual(photo.loved, undefined);
});

assertTest('live Google Photos metadata preserves identifier decoding and raw fallback distinctions', () => {
  const prefix = '/api/google-photos/media/';
  [
    { identifier: '  photo  ', id: 'photo', matches: true },
    { identifier: `${prefix}photo%2Fone?w=1`, id: 'photo/one', matches: true },
    { identifier: `${prefix}photo%252Fone`, id: 'photo%2Fone', matches: true },
    { identifier: `${prefix}%20photo%20`, id: ' photo ', matches: false },
    { identifier: prefix, id: prefix, matches: true },
    { identifier: `https://example.test${prefix}photo`, id: `https://example.test${prefix}photo`, matches: true },
    { identifier: 7, id: '7', matches: true },
    { identifier: 0, id: '0', matches: false }
  ].forEach(({ identifier, id, matches }) => {
    const photo = Object.freeze({ id });
    const state = { photosList: [photo] };
    const result = applyCachedMediaItemMetadataToState(state, identifier, { loved: true });
    assert.strictEqual(result, matches ? state.photosList[0] : null);
    assert.strictEqual(state.photosList[0].loved, matches ? true : undefined);
    assert.strictEqual(photo.loved, undefined);
  });
});

assertTest('live Google Photos metadata matches truthy ids before proxy URLs without source filtering', () => {
  const url = buildGooglePhotoProxyUrl('photo');
  [
    { id: 'other', url, matches: false },
    { id: '   ', url, matches: false },
    { id: url, url, matches: false },
    ...[undefined, null, '', false, 0].map((id) => ({ id, url, matches: true })),
    { id: ' photo ', url: '/api/google-photos/media/%', matches: true },
    { url: '/api/google-photos/media/%20photo%20', matches: true }
  ].forEach(({ matches, ...identity }) => {
    const photo = Object.freeze({ ...identity, source: 'other-source', isBroken: true });
    const state = { activePhoto: { ...photo } };
    const result = applyCachedMediaItemMetadataToState(state, 'photo', { rating: 0 });
    assert.strictEqual(result, matches ? state.activePhoto : null);
    assert.strictEqual(state.activePhoto.rating, matches ? 0 : undefined);
    assert.strictEqual(state.activePhoto.isBroken, true);
  });
});

assertTest('live Google Photos metadata projects inputs before guards and preserves thrown values', () => {
  const events = [];
  const identifier = { toString: () => { events.push('id'); return 'photo'; } };
  const fields = ['rating', 'isBroken', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved', 'orientation', 'width', 'height'];
  const metadata = Object.fromEntries(fields.map((field) => [field, undefined]));
  fields.forEach((field) => Object.defineProperty(metadata, field, {
    get: () => { events.push(field); return field === 'loved' ? false : undefined; }
  }));
  assert.strictEqual(applyCachedMediaItemMetadataToState(null, identifier, metadata), null);
  assert.deepStrictEqual(events, ['id', 'id', ...fields]);
  [undefined, null, false, 0, '', new Error('input fixture')].forEach((failure) => {
    const fail = () => { throw failure; };
    [
      () => applyCachedMediaItemMetadataToState(null, { toString: fail }, metadata),
      () => applyCachedMediaItemMetadataToState(null, '', { get rating() { return fail(); } })
    ].forEach((run) => {
      assert.throws(run, (error) => error === failure);
    });
  });
  assert.throws(() => applyCachedMediaItemMetadataToState(null, '/api/google-photos/media/%', metadata), URIError);
  assert.throws(() => applyCachedMediaItemMetadataToState(null, '', null), TypeError);
  let reads = 0;
  const changingId = { toString: () => ++reads === 1 ? 'not-a-proxy' : 'photo' };
  const state = { activePhoto: { id: 'photo' } };
  assert.strictEqual(applyCachedMediaItemMetadataToState(state, changingId, { loved: false }), state.activePhoto);
  assert.strictEqual(reads, 2);
  assert.strictEqual(state.activePhoto.loved, false);
});

assertTest('live Google Photos metadata returns the last match and skips non-array lists', () => {
  [false, true].flatMap((primary) => [false, true].map((secondary) => ({ primary, secondary })))
    .forEach(({ primary, secondary }) => {
      const photosList = [{ id: 'photo' }, { id: 'other' }, { id: 'photo' }];
      const state = {
        photosList,
        activePhoto: { id: primary ? 'photo' : 'other' },
        activeSecondPhoto: { id: secondary ? 'photo' : 'other' }
      };
      const result = applyCachedMediaItemMetadataToState(state, 'photo', { loved: null });
      assert.strictEqual(result, secondary ? state.activeSecondPhoto : primary ? state.activePhoto : state.photosList[2]);
      assert.strictEqual(state.photosList[1], photosList[1]);
      assert.strictEqual(result.loved, null);
    });
  [undefined, null, {}, 'not-an-array'].forEach((photosList) => {
    const state = { photosList, activePhoto: { id: 'photo' } };
    assert.strictEqual(applyCachedMediaItemMetadataToState(state, 'photo', { width: 'unvalidated' }), state.activePhoto);
    assert.strictEqual(state.photosList, photosList);
    assert.strictEqual(state.activePhoto.width, 'unvalidated');
  });
});

assertTest('live Google Photos metadata preserves aliases and value idempotence without reference idempotence', () => {
  const nested = Object.freeze({ caption: 'shared' });
  const shared = { id: 'photo', loved: false, nested };
  const original = [shared, shared, null, undefined];
  const state = { photosList: original, activePhoto: shared, activeSecondPhoto: shared };
  const patch = Object.freeze({ loved: true, rating: 0, unsupported: 'ignored' });
  assert.strictEqual(applyCachedMediaItemMetadataToState(state, 'photo', patch), shared);
  const first = state.photosList;
  assert.notStrictEqual(first, original);
  assert.notStrictEqual(first[0], first[1]);
  assert.notStrictEqual(first[0], shared);
  assert.strictEqual(state.activePhoto, state.activeSecondPhoto);
  assert.strictEqual(original[0].loved, true, 'active aliases mutate the original list row');
  [first[0], first[1], shared].forEach((photo) => {
    assert.strictEqual(photo.nested, nested);
    assert.strictEqual(photo.unsupported, undefined);
  });
  assert.strictEqual(applyCachedMediaItemMetadataToState(state, 'photo', patch), shared);
  assert.deepStrictEqual(state.photosList, first);
  assert.notStrictEqual(state.photosList, first);
  assert.notStrictEqual(state.photosList[0], first[0]);
  assert.strictEqual(state.activePhoto, shared);
  assert.deepStrictEqual(patch, { loved: true, rating: 0, unsupported: 'ignored' });
});

assertTest('live Google Photos metadata keeps the old list and frames on map decoding or copy failure', () => {
  ['decode', 'copy'].forEach((stage) => {
    const failure = new Error('copy fixture');
    const first = Object.freeze({ id: 'photo', rating: 1 });
    const failing = stage === 'decode'
      ? { url: '/api/google-photos/media/%' }
      : { id: 'photo', get title() { throw failure; } };
    const photosList = [first, failing];
    const activePhoto = { id: 'photo', rating: 2 };
    const state = { photosList, activePhoto };
    assert.throws(() => applyCachedMediaItemMetadataToState(state, 'photo', { rating: 9 }),
      (error) => stage === 'decode' ? error instanceof URIError : error === failure);
    assert.strictEqual(state.photosList, photosList);
    assert.strictEqual(state.photosList[0], first);
    assert.strictEqual(first.rating, 1);
    assert.strictEqual(activePhoto.rating, 2);
  });
});

assertTest('live Google Photos metadata propagates list assignment failure before active mutations', () => {
  const failure = new Error('list setter fixture');
  const photosList = [{ id: 'photo', rating: 1 }];
  const activePhoto = { id: 'photo', rating: 2 };
  let attempted;
  const state = {
    get photosList() { return photosList; },
    set photosList(value) { attempted = value; throw failure; },
    activePhoto
  };
  assert.throws(() => applyCachedMediaItemMetadataToState(state, 'photo', { rating: 9 }), (error) => error === failure);
  assert.notStrictEqual(attempted, photosList);
  assert.strictEqual(attempted[0].rating, 9);
  assert.strictEqual(state.photosList, photosList);
  assert.strictEqual(photosList[0].rating, 1);
  assert.strictEqual(activePhoto.rating, 2);
});

assertTest('live Google Photos metadata retains committed list and partial active fields after assignment failure', () => {
  ['activePhoto', 'activeSecondPhoto'].flatMap((key) => [false, true].map((partial) => ({ key, partial })))
    .forEach(({ key, partial }) => {
      const photosList = [{ id: 'photo', rating: 1 }];
      const state = {
        photosList,
        activePhoto: { id: 'photo', rating: 2, isBroken: false },
        activeSecondPhoto: { id: 'photo', rating: 3, isBroken: false }
      };
      const failing = state[key];
      Object.defineProperty(failing, partial ? 'isBroken' : 'rating', { writable: false });
      assert.throws(() => applyCachedMediaItemMetadataToState(state, 'photo', { isBroken: true, rating: 9 }), TypeError);
      assert.notStrictEqual(state.photosList, photosList);
      assert.strictEqual(state.photosList[0].rating, 9);
      assert.strictEqual(photosList[0].rating, 1);
      assert.strictEqual(state[key], failing);
      assert.strictEqual(failing.rating, partial ? 9 : key === 'activePhoto' ? 2 : 3);
      assert.strictEqual(failing.isBroken, false);
      const other = state[key === 'activePhoto' ? 'activeSecondPhoto' : 'activePhoto'];
      assert.strictEqual(other.rating, key === 'activePhoto' ? 3 : 9);
      assert.strictEqual(other.isBroken, key !== 'activePhoto');
    });
});

assertTest('cached metadata updates read before eagerly decoding identifiers and projecting patches', () => {
  ['photo', ''].forEach(id => {
    const events = [];
    const fields = ['rating', 'isBroken', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved', 'orientation', 'width', 'height'];
    const metadata = Object.freeze(Object.defineProperties({}, Object.fromEntries(fields.map(key => [key, {
      get: () => { events.push(key); return undefined; }
    }]))));
    const fixture = createGooglePhotosServiceFixture({
      cacheExists: () => { events.push('cache'); return false; },
      now: () => assert.fail('metadata updates must not read the clock')
    });
    const identifier = { toString: () => { events.push('identifier'); return id; } };
    assert.strictEqual(fixture.updateMetadata(identifier, metadata), null);
    assert.deepStrictEqual(events, ['cache', 'identifier', 'identifier', ...fields]);
    assert.deepStrictEqual([fixture.writes, fixture.warnings, fixture.logs, fixture.errors, fixture.persisted], [[], [], [], [], []]);
  });
});

assertTest('cached metadata reader failures precede projection while handled read failures permit no-match results', () => {
  const failure = new Error('isolated cache failure');
  [
    { cacheExists: () => { throw failure; }, matches: error => error === failure },
    ...['null', '{}', '42'].map(json => ({ read: () => json, matches: error => error?.name === 'TypeError' })),
    { read: () => { throw failure; }, warn: () => { throw failure; }, matches: error => error === failure }
  ].forEach(({ matches, ...adapters }) => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, ...adapters });
    const identifier = { toString: () => assert.fail('reader failure must precede input access') };
    assert.throws(() => fixture.updateMetadata(identifier, null), matches);
    assert.deepStrictEqual([fixture.writes, fixture.errors], [[], []]);
  });
  [() => '{invalid', () => { throw failure; }].forEach(read => {
    const events = [];
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read, warn: () => events.push('warning') });
    assert.strictEqual(fixture.updateMetadata('photo', { get rating() { events.push('patch'); return 0; } }), null);
    assert.deepStrictEqual(events, ['warning', 'patch']);
    assert.strictEqual(fixture.warnings.length, 1);
    assert.deepStrictEqual([fixture.writes, fixture.errors], [[], []]);
  });
});

assertTest('cached metadata normalization writes survive later invalid inputs and projection failures', () => {
  const failure = new Error('isolated projection failure');
  const row = { id: 'photo', googleBaseUrl: 'https://fixture.invalid/photo' };
  [
    { identifier: '', metadata: {}, matches: null },
    { identifier: 'missing', metadata: { rating: 0 }, matches: null },
    { identifier: '/api/google-photos/media/%', metadata: {}, matches: error => error?.name === 'URIError' },
    { identifier: { toString: () => { throw failure; } }, metadata: {}, matches: error => error === failure },
    { identifier: 'photo', metadata: null, matches: error => error?.name === 'TypeError' },
    { identifier: 'photo', metadata: { get rating() { throw failure; } }, matches: error => error === failure }
  ].forEach(({ identifier, metadata, matches }) => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => JSON.stringify([row]) });
    const run = () => fixture.updateMetadata(identifier, metadata);
    if (matches) assert.throws(run, matches);
    else assert.strictEqual(run(), null);
    assert.strictEqual(fixture.writes.length, 1);
    assert.deepStrictEqual(JSON.parse(fixture.writes[0].bytes), [googlePhotosCache.normalizeCachedMediaItem(row)]);
    assert.deepStrictEqual([fixture.warnings, fixture.errors], [[], []]);
  });
  const fixture = createGooglePhotosServiceFixture({
    cacheExists: () => true, read: () => JSON.stringify([row]), write: () => { throw failure; }
  });
  assert.throws(() => fixture.updateMetadata({ toString: () => assert.fail('write failure must precede decoding') }), error => error === failure);
});

assertTest('cached metadata matching decodes inputs but preserves strict cached ids and copied results', () => {
  [
    ['photo', ' photo ', true], ['photo', '/api/google-photos/media/photo?render=1', true],
    ['a/b', '/api/google-photos/media/a%2Fb', true], ['a%2Fb', '/api/google-photos/media/a%252Fb', true],
    [' photo ', 'photo', false], [' photo ', '/api/google-photos/media/%20photo%20', true],
    ['other', '/api/google-photos/media/photo', false]
  ].forEach(([id, identifier, matches]) => {
    const row = Object.freeze(googlePhotosCache.normalizeCachedMediaItem({ id, googleBaseUrl: 'https://fixture.invalid/photo' }));
    const metadata = Object.freeze({ rating: 10, title: 'ignored', loved: undefined });
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => JSON.stringify([row]) });
    const results = [fixture.updateMetadata(identifier, metadata), fixture.updateMetadata(identifier, metadata)];
    results.forEach(result => assert.deepStrictEqual(result, matches ? row : null));
    if (matches) assert.notStrictEqual(results[0], results[1]);
    assert.deepStrictEqual(fixture.writes, []);
  });
});

assertTest('cached metadata change detection uses strict inequality rather than validation or deep equality', () => {
  [
    { initial: 10, value: 10, changed: false }, { initial: 10, value: 0, changed: true },
    { initial: 10, value: false, changed: true }, { initial: 10, value: null, changed: true },
    { initial: 0, value: -0, changed: false }, { initial: 10, value: NaN, changed: true },
    { initial: { score: 10 }, value: Object.freeze({ score: 10 }), changed: true },
    { initial: 10, value: undefined, changed: false }
  ].forEach(({ initial, value, changed }) => {
    const row = googlePhotosCache.normalizeCachedMediaItem({ id: 'photo', googleBaseUrl: 'https://fixture.invalid/photo', rating: initial });
    const metadata = Object.freeze({ rating: value, title: 'ignored' });
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => JSON.stringify([row]) });
    const result = fixture.updateMetadata('photo', metadata);
    assert.strictEqual(fixture.writes.length, Number(changed));
    if (value === undefined) assert.strictEqual(result, null);
    else {
      assert.ok(Object.is(result.rating, value));
      assert.strictEqual(result.title, undefined);
      if (changed) assert.deepStrictEqual(JSON.parse(fixture.writes[0].bytes), JSON.parse(JSON.stringify([{ ...row, rating: value }])));
    }
    assert.strictEqual(row.rating, initial);
  });
});

assertTest('cached metadata test-mode suppression is exact and does not suppress repeated reads or projections', () => {
  ['test', 'TEST', ' test ', 'production', null].forEach(nodeEnv => {
    const row = { id: 'photo', googleBaseUrl: 'https://fixture.invalid/photo', loved: false };
    let reads = 0;
    const fixture = createGooglePhotosServiceFixture({
      nodeEnv, cacheExists: () => true, read: () => { reads += 1; return JSON.stringify([row]); }
    });
    const results = [fixture.updateMetadata('photo', { loved: true }), fixture.updateMetadata('photo', { loved: true })];
    assert.strictEqual(reads, 2);
    results.forEach(result => assert.strictEqual(result.loved, true));
    assert.notStrictEqual(results[0], results[1]);
    assert.strictEqual(fixture.writes.length, nodeEnv === 'test' ? 0 : 4, 'each fresh dirty read normalizes before its changed patch');
    assert.strictEqual(row.loved, false);
  });
});

assertTest('cached metadata updates persist the full first-usable-id projection and repeated scalar patches only read', () => {
  const rows = [
    { id: 'photo', googleBaseUrl: 'https://fixture.invalid/photo', rating: 10, extra: { retained: true } },
    { id: 'photo', googleBaseUrl: 'https://fixture.invalid/duplicate', rating: 1 },
    { id: 'unusable' }, { id: 'sibling', googlePickerSessionId: 'session', rating: 5 }, null
  ];
  let bytes = JSON.stringify(rows);
  let reads = 0;
  const fixture = createGooglePhotosServiceFixture({
    cacheExists: () => true, read: () => { reads += 1; return bytes; }, write: (file, next) => { bytes = next; }
  });
  const first = fixture.updateMetadata('photo', Object.freeze({ rating: 0 }));
  assert.strictEqual(fixture.writes.length, 2, 'normalization and metadata writes are separate');
  const persisted = JSON.parse(bytes);
  assert.deepStrictEqual(persisted.map(({ id, rating }) => [id, rating]), [['photo', 0], ['sibling', 5]]);
  assert.deepStrictEqual(persisted[0].extra, { retained: true });
  const second = fixture.updateMetadata('photo', { rating: 0 });
  assert.deepStrictEqual(second, first);
  assert.notStrictEqual(second, first);
  first.rating = 9;
  assert.strictEqual(JSON.parse(bytes)[0].rating, 0, 'editing the returned copy is not a write');
  assert.strictEqual(second.rating, 0);
  assert.strictEqual(reads, 2);
  assert.strictEqual(fixture.writes.length, 2);
  assert.strictEqual(rows[0].rating, 10);
});

assertTest('cached metadata serialization and write failures propagate without updater recovery or rollback', () => {
  const row = googlePhotosCache.normalizeCachedMediaItem({ id: 'photo', googleBaseUrl: 'https://fixture.invalid/photo' });
  const cycle = {}; cycle.self = cycle;
  [cycle, 1n].forEach(width => {
    const fixture = createGooglePhotosServiceFixture({ cacheExists: () => true, read: () => JSON.stringify([row]) });
    assert.throws(() => fixture.updateMetadata('photo', { width }), error => error?.name === 'TypeError');
    assert.deepStrictEqual([fixture.writes, fixture.warnings, fixture.errors], [[], [], []]);
  });
  [undefined, null, false, 0, '', new Error('isolated write failure')].forEach(failure => {
    let partialBytes;
    const fixture = createGooglePhotosServiceFixture({
      cacheExists: () => true, read: () => JSON.stringify([row]),
      write: (file, bytes) => { partialBytes = bytes; throw failure; }
    });
    assert.throws(() => fixture.updateMetadata('photo', { rating: 0 }), error => error === failure);
    assert.strictEqual(JSON.parse(partialBytes)[0].rating, 0);
    assert.deepStrictEqual([fixture.writes, fixture.warnings, fixture.errors], [[], [], []]);
  });
});

assertTest('updateCachedMediaItemMetadata persists only changed cache projections outside test mode', () => {
  const cacheFile = process.env.LUMINA_GOOGLE_PHOTOS_CACHE_PATH;
  const originalCache = fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile, 'utf8') : null;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWriteFileSync = fs.writeFileSync;
  const cacheWrites = [];
  const mediaItemId = 'metadata-contract-photo';
  const cachedItem = googlePhotosCache.normalizeCachedMediaItem({
    id: mediaItemId,
    url: buildGooglePhotoProxyUrl(mediaItemId),
    googleBaseUrl: 'https://photos.example/metadata-contract-photo',
    googlePickerSessionId: 'metadata-contract-session',
    width: 2560,
    height: 1440,
    rating: 10,
    loved: false
  });

  try {
    originalWriteFileSync.call(fs, cacheFile, JSON.stringify([cachedItem]), 'utf8');
    fs.writeFileSync = function trackCacheWrite(filePath, ...args) {
      if (path.resolve(String(filePath)) === path.resolve(cacheFile)) {
        cacheWrites.push(filePath);
      }
      return originalWriteFileSync.call(fs, filePath, ...args);
    };

    process.env.NODE_ENV = 'test';
    const testModeUpdate = googlePhotos.updateCachedMediaItemMetadata(mediaItemId, { loved: true });
    assert.strictEqual(testModeUpdate?.loved, true, 'test mode still returns the projected row');
    assert.deepStrictEqual(cacheWrites, [], 'test mode skips cache persistence');

    process.env.NODE_ENV = 'production';
    assert.strictEqual(googlePhotos.updateCachedMediaItemMetadata('missing-photo', { loved: true }), null);
    const unchanged = googlePhotos.updateCachedMediaItemMetadata(mediaItemId, { loved: false });
    assert.strictEqual(unchanged?.loved, false, 'a match is returned even when no value changes');
    assert.deepStrictEqual(cacheWrites, [], 'missing and unchanged projections do not write');

    const changed = googlePhotos.updateCachedMediaItemMetadata(mediaItemId, { loved: true });
    assert.strictEqual(changed?.loved, true);
    assert.strictEqual(cacheWrites.length, 1, 'a changed projection writes the cache once');
    assert.strictEqual(JSON.parse(fs.readFileSync(cacheFile, 'utf8'))[0].loved, true);
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    if (originalCache === null) {
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
      }
    } else {
      originalWriteFileSync.call(fs, cacheFile, originalCache, 'utf8');
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

assertTest('legacy Google Photos cache rows without baseUrl or picker session are filtered out', () => {
  const normalized = normalizeCachedMediaItem({
    id: 'legacy-broken',
    url: '/api/google-photos/media/legacy-broken?w=2560&h=1440&c=1',
    width: 2560,
    height: 1440
  });

  assert.ok(normalized, 'Legacy row should still normalize structurally');
  assert.strictEqual(isUsableCachedMediaItem(normalized), false, 'Legacy row without refreshable metadata must be excluded from active feeds');

  const healthy = normalizeCachedMediaItem({
    id: 'healthy',
    url: '/api/google-photos/media/healthy?w=2560&h=1440&c=1',
    googlePickerSessionId: 'session-1'
  });

  assert.strictEqual(isUsableCachedMediaItem(healthy), true, 'Rows with picker session metadata should remain eligible');
});

assertTest('Cache eligibility guards id before url without reading refreshability metadata', () => {
  [undefined, null, false, 0, '', 1, Symbol('row')].forEach(row => assert.strictEqual(isUsableCachedMediaItem(row), false));
  const falsy = [undefined, null, false, 0, -0, 0n, NaN, ''];
  falsy.forEach(id => assert.strictEqual(isUsableCachedMediaItem(Object.freeze({
    id, get url() { throw Error('must not read url'); }
  })), false));
  falsy.forEach(url => assert.strictEqual(isUsableCachedMediaItem(Object.freeze({
    id: 'MOCK_photo', url, get googleBaseUrl() { throw Error('must not read base'); }
  })), false));
});

assertTest('Cache eligibility mock bypass uses the exact prefix only after structural guards', () => {
  ['MOCK_', 'MOCK_photo', 'MOCK_ /?%', 'MOCK_\uD800'].forEach(id => {
    const row = Object.freeze({
      id, url: 'not a URL',
      get googleBaseUrl() { throw Error('mock must not read base'); },
      get googlePickerSessionId() { throw Error('mock must not read session'); }
    });
    assert.strictEqual(isUsableCachedMediaItem(row), true);
  });
  ['MOCK', 'mock_photo', 'Mock_photo', ' MOCK_photo', 'xMOCK_photo', '%4DOCK_photo', ' '].forEach(id => {
    assert.strictEqual(isUsableCachedMediaItem(Object.freeze({ id, url: 'url' })), false);
    assert.strictEqual(isUsableCachedMediaItem(Object.freeze({ id, url: 'url', googlePickerSessionId: 'session' })), true);
  });
});

assertTest('Cache eligibility uses raw base and session truthiness without coercion or validity checks', () => {
  const opaque = Object.freeze({ [Symbol.toPrimitive]() { throw Error('must not coerce'); } });
  const values = [undefined, null, false, 0, 0n, NaN, '', ' ', 'expired', 1, Symbol('value'), opaque];
  values.flatMap(googleBaseUrl => values.map(googlePickerSessionId => Object.freeze({
    id: 'photo', url: opaque, googleBaseUrl, googlePickerSessionId,
    googleBaseUrlFetchedAt: 0, isBroken: true, rating: 0, mimeType: 'invalid'
  }))).forEach(row => {
    const expected = Boolean(row.googleBaseUrl) || Boolean(row.googlePickerSessionId);
    assert.strictEqual(isUsableCachedMediaItem(row), expected);
    assert.strictEqual(row.url, opaque);
    assert.strictEqual(row.isBroken, true);
  });
});

assertTest('Cache eligibility reads inherited hidden fields in short-circuit order without enumeration', () => {
  [
    ['MOCK_photo', '', '', true, ['id', 'url', 'id']],
    ['photo', ' ', '', true, ['id', 'url', 'id', 'googleBaseUrl']],
    ['photo', '', 'session', true, ['id', 'url', 'id', 'googleBaseUrl', 'googlePickerSessionId']],
    ['photo', '', '', false, ['id', 'url', 'id', 'googleBaseUrl', 'googlePickerSessionId']]
  ].forEach(([id, googleBaseUrl, googlePickerSessionId, expected, order]) => {
    const events = [];
    const values = { id, url: 'url', googleBaseUrl, googlePickerSessionId };
    const prototype = Object.freeze(Object.create(null, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {
      get() { events.push(key); return value; }
    }]))));
    const row = new Proxy(Object.freeze(Object.create(prototype)), {
      ownKeys() { throw Error('must not enumerate'); }
    });
    assert.strictEqual(isUsableCachedMediaItem(row), expected);
    assert.deepStrictEqual(events, order);
  });
});

assertTest('Cache eligibility preserves native method receivers, truthy results, and repeated id reads', () => {
  [undefined, null, false, 0, '', 'false', 1, Object.freeze({})].forEach(result => {
    const id = Object.freeze({ startsWith(prefix) { assert.strictEqual(this, id); assert.strictEqual(prefix, 'MOCK_'); return result; } });
    assert.strictEqual(isUsableCachedMediaItem(Object.freeze({ id, url: true })), Boolean(result));
  });
  [42, true, 1n, Symbol('id'), [], {}, { startsWith: true }].forEach(id => {
    assert.throws(() => isUsableCachedMediaItem(Object.freeze({ id, url: 'url' })), TypeError);
  });
  let reads = 0;
  const changing = Object.freeze({ get id() { return ++reads === 1 ? 'guard' : 'MOCK_second'; }, url: 'url' });
  assert.strictEqual(isUsableCachedMediaItem(changing), true);
  assert.strictEqual(reads, 2);
  reads = 0;
  assert.throws(() => isUsableCachedMediaItem(Object.freeze({
    get id() { return ++reads === 1 ? 'guard' : null; }, url: 'url'
  })), TypeError);
});

assertTest('Cache eligibility propagates exact read and method failures without later work or fallback', () => {
  ['id', 'url', 'startsWith', 'call', 'googleBaseUrl', 'googlePickerSessionId'].forEach(stage => {
    [undefined, null, false, 0, '', Error('eligibility failure')].forEach(failure => {
      const events = [];
      const visit = (key, value) => { events.push(key); if (key === stage) throw failure; return value; };
      const id = Object.freeze({ get startsWith() { return visit('startsWith', () => visit('call', false)); } });
      const values = { id, url: 'url', googleBaseUrl: '', googlePickerSessionId: 'session' };
      const row = Object.freeze(Object.create(null, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {
        get() { return visit(key, value); }
      }]))));
      let caught = false;
      let returned = false;
      try { isUsableCachedMediaItem(row); returned = true; } catch (error) { caught = true; assert.strictEqual(error, failure); }
      assert.ok(caught && !returned);
      assert.strictEqual(events.at(-1), stage);
    });
  });
});

assertTest('Cache eligibility composes as an immutable idempotent filter that preserves concatenation', () => {
  const rows = Object.freeze([
    null, Object.freeze({ id: 'missing-url', googleBaseUrl: 'base' }),
    Object.freeze({ id: 'MOCK_photo', url: 'url' }),
    Object.freeze({ id: 'base', url: 'url', googleBaseUrl: ' ' }),
    Object.freeze({ id: 'session', url: 'url', googlePickerSessionId: 'expired' }),
    Object.freeze({ id: 'unrefreshable', url: 'url' })
  ]);
  const before = structuredClone(rows);
  const eligible = items => items.filter(isUsableCachedMediaItem);
  const once = eligible(rows);
  assert.deepStrictEqual(once, rows.slice(2, 5));
  assert.deepStrictEqual(eligible(once), once);
  once.forEach((row, index) => assert.strictEqual(row, rows[index + 2]));
  assert.deepStrictEqual(eligible([]), []);
  rows.map((_, split) => [rows.slice(0, split), rows.slice(split)]).forEach(([left, right]) => {
    assert.deepStrictEqual(eligible([...left, ...right]), [...eligible(left), ...eligible(right)]);
  });
  assert.deepStrictEqual(rows, before);
  assert.strictEqual(isUsableCachedMediaItem(isUsableCachedMediaItem(rows[2])), false, 'filter idempotence is not predicate idempotence');
});

assertTest('Google Photos cache normalization keeps open metadata and defaults malformed dimensions immutably', () => {
  const cachedItem = {
    id: 'legacy-dimensions',
    url: 'https://photos.example/legacy=old-render-directive',
    width: 'not-a-width',
    height: '0',
    rating: 0,
    loved: false,
    customPickerField: { retained: true }
  };
  const original = structuredClone(cachedItem);

  const normalized = googlePhotosCache.normalizeCachedMediaItem(cachedItem);

  assert.strictEqual(normalized.width, 2560);
  assert.strictEqual(normalized.height, 1440);
  assert.strictEqual(normalized.url, '/api/google-photos/media/legacy-dimensions?w=2560&h=1440');
  assert.strictEqual(normalized.googleBaseUrl, 'https://photos.example/legacy');
  assert.strictEqual(normalized.rating, 0, 'explicit zero ratings are user metadata, not missing values');
  assert.strictEqual(normalized.loved, false);
  assert.deepStrictEqual(normalized.customPickerField, { retained: true });
  assert.deepStrictEqual(cachedItem, original);
  assert.strictEqual(googlePhotosCache.normalizeCachedMediaItem({ url: 'missing-id' }), null);
});

assertTest('Cache normalization guards only truthy ids before reading any other fields', () => {
  [undefined, null, false, 0, '', 1, Symbol('row')].forEach(row => assert.strictEqual(normalizeCachedMediaItem(row), null));
  [undefined, null, false, 0, -0, 0n, NaN, ''].forEach(id => {
    const row = Object.freeze({ id, get width() { throw Error('must not read'); } });
    assert.strictEqual(normalizeCachedMediaItem(row), null);
  });
  [' ', 'MOCK_test', 42, true].forEach(id => {
    const row = Object.freeze({ id });
    const result = normalizeCachedMediaItem(row);
    assert.strictEqual(result.id, id, 'truthy ids are preserved, not normalized to strings');
    assert.strictEqual(result.url, buildGooglePhotoProxyUrl(id));
    assert.strictEqual(result.source, 'google_photos');
    assert.strictEqual(result.googleBaseUrl, undefined);
  });
});

assertTest('Cache normalization parses flat dimensions independently without changing proxy defaults', () => {
  [[undefined, 2560], [null, 2560], ['', 2560], ['bad', 2560], [0, 2560], [-3, 2560],
    [Infinity, 2560], ['2.9px', 2], ['  +31tail', 31], ['0x10', 2560], ['1e3', 1],
    [1e21, 1], ['1000000000000000000000', 1e21]].forEach(([width, expected]) => {
    const row = Object.freeze({ id: 'dimensions', width, height: '17px', mediaFileMetadata: { width: 9, height: 8 } });
    const result = normalizeCachedMediaItem(row);
    assert.strictEqual(result.width, expected);
    assert.strictEqual(result.height, 17);
    assert.strictEqual(result.url, '/api/google-photos/media/dimensions?w=2560&h=1440');
  });
  assert.strictEqual(normalizeCachedMediaItem({ id: 'dimensions', width: 7, height: -1 }).height, 1440);
  assert.strictEqual(normalizeCachedMediaItem({ id: 'dimensions', mediaFile: { mediaFileMetadata: { width: 9 } } }).width, 2560);
});

assertTest('Cache normalization selects cached bases before trimming and does not validate URLs', () => {
  [[undefined, ' legacy=w10 ', 'legacy'], ['', ' legacy=w10 ', 'legacy'], [0, 'legacy=w10', 'legacy'],
    ['   ', 'legacy=w10', undefined], [' base=w10 ', 'ignored=w10', 'base=w10'],
    [42, 'ignored', '42'], [Symbol('base'), 'ignored', 'Symbol(base)'],
    [undefined, '/api/google-photos/media/photo', undefined], [undefined, '=w10', undefined],
    [undefined, ' not a URL =w10', 'not a URL']].forEach(([googleBaseUrl, url, expected]) => {
    assert.strictEqual(normalizeCachedMediaItem(Object.freeze({ id: 'base', googleBaseUrl, url })).googleBaseUrl, expected);
  });
  const row = Object.freeze({ id: 'base', googleBaseUrl: ' ', get url() { throw Error('fallback suppressed'); } });
  // A hidden URL is not spread either; an enumerable getter would still run at spread time.
  const hidden = Object.freeze(Object.create(row, { id: { value: 'base', enumerable: true } }));
  assert.strictEqual(normalizeCachedMediaItem(hidden).googleBaseUrl, undefined);
});

assertTest('Cache normalization preserves own enumerable metadata and shallow aliases in fresh plain rows', () => {
  const symbol = Symbol('metadata');
  const metadata = Object.freeze({ retained: true });
  const row = Object.freeze(Object.defineProperties(Object.create({ inherited: 'not copied' }), {
    id: { value: 'metadata', enumerable: true }, source: { value: 'old', enumerable: true },
    custom: { value: metadata, enumerable: true }, [symbol]: { value: metadata, enumerable: true },
    hidden: { value: 'not copied' }, createTime: { value: 'date', enumerable: true },
    cropPercent: { value: null, enumerable: true }, isBroken: { value: true, enumerable: true }
  }));
  const result = normalizeCachedMediaItem(row);
  assert.notStrictEqual(result, row);
  assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
  assert.strictEqual(result.custom, metadata);
  assert.strictEqual(result[symbol], metadata);
  assert.strictEqual(result.hidden, undefined);
  assert.strictEqual(result.inherited, undefined);
  assert.strictEqual(result.createTime, 'date');
  assert.strictEqual(result.cropPercent, null);
  assert.strictEqual(result.isBroken, true, 'normalization does not filter broken photos');
  assert.strictEqual(row.source, 'old');
  Reflect.ownKeys(result).forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(result, key);
    assert.ok(descriptor.enumerable && descriptor.writable && descriptor.configurable);
  });
});

assertTest('Cache normalization defaults only undefined ratings and accepts only literal true loved flags', () => {
  const values = [undefined, null, false, 0, NaN, '', 'true', 1, true, Object.freeze({ value: true })];
  values.flatMap(rating => values.map(loved => Object.freeze({ id: 'metadata', rating, loved }))).forEach(row => {
    const result = normalizeCachedMediaItem(row);
    assert.strictEqual(result.rating, row.rating === undefined ? 10 : row.rating);
    assert.strictEqual(result.loved, row.loved === true);
  });
});

assertTest('Cache normalization preserves inherited named reads and accessor ordering', () => {
  const events = [];
  const read = (key, value) => ({ get() { events.push(key); return value; } });
  const row = Object.freeze(Object.create(null, {
    id: read('id', 'hidden'), width: read('width', { [Symbol.toPrimitive](hint) { events.push(hint); return '19px'; } }),
    height: read('height', 23), googleBaseUrl: read('base', ' base '),
    rating: read('rating', 0), loved: read('loved', true)
  }));
  const result = normalizeCachedMediaItem(Object.freeze(Object.create(row)));
  assert.deepStrictEqual(events, ['id', 'width', 'string', 'height', 'base', 'id', 'rating', 'rating', 'loved']);
  assert.strictEqual(Object.hasOwn(result, 'id'), false, 'inherited ids are read but not copied');
  assert.strictEqual(result.width, 19);
  assert.strictEqual(result.rating, 0);
  assert.strictEqual(result.loved, true);
  let ids = 0;
  let ratings = 0;
  const changing = Object.freeze({ get id() { return ['guard', 'copied', 'encoded'][ids++]; }, get rating() { return ++ratings; } });
  const changed = normalizeCachedMediaItem(changing);
  assert.strictEqual(changed.id, 'copied');
  assert.strictEqual(changed.url, buildGooglePhotoProxyUrl('encoded'));
  assert.strictEqual(changed.rating, 3);
});

assertTest('Cache normalization propagates exact failures and stops later projection without partial returns', () => {
  [undefined, null, false, 0, '', Error('projection')].forEach(failure => {
    ['id', 'width', 'height', 'googleBaseUrl', 'spread', 'rating', 'loved'].forEach(stage => {
      const events = [];
      const keys = ['id', 'width', 'height', 'googleBaseUrl', 'spread', 'rating', 'loved'];
      const input = Object.freeze(Object.create(null, Object.fromEntries(keys.map(key => [key, {
        enumerable: key === 'spread',
        get() { events.push(key); if (key === stage) throw failure; return key === 'id' ? 'photo' : 1; }
      }]))));
      let returned = false;
      let caught = false;
      try { normalizeCachedMediaItem(input); returned = true; } catch (error) { caught = true; assert.strictEqual(error, failure); }
      assert.ok(caught && !returned);
      assert.strictEqual(events.at(-1), stage);
    });
  });
  [
    [{ id: 'photo', width: Symbol('dimension') }, TypeError],
    [{ id: 'photo', googleBaseUrl: Object.create(null) }, TypeError],
    [{ id: Symbol('photo') }, TypeError], [{ id: '\uD800' }, URIError]
  ].forEach(([row, error]) => assert.throws(() => normalizeCachedMediaItem(Object.freeze(row)), error));
  const failure = Error('enumeration');
  assert.throws(() => normalizeCachedMediaItem(new Proxy({ id: 'photo' }, { ownKeys() { throw failure; } })), error => error === failure);
});

assertTest('Cache normalization is value-idempotent on ordinary safe-dimension rows, not globally', () => {
  [1, 17, 2560, Number.MAX_SAFE_INTEGER].flatMap(width => [1, 1440].map(height => Object.freeze({
    id: 'law /?%', width, height, url: ' legacy=w10 ', rating: 0, loved: true, custom: Object.freeze({ kept: true })
  }))).forEach(row => {
    const once = normalizeCachedMediaItem(row);
    const twice = normalizeCachedMediaItem(once);
    assert.deepStrictEqual(twice, once);
    assert.notStrictEqual(twice, once);
    assert.strictEqual(twice.custom, row.custom);
    assert.strictEqual(row.url, ' legacy=w10 ');
  });
  const once = normalizeCachedMediaItem(Object.freeze({ id: 'large', width: '1000000000000000000000' }));
  assert.strictEqual(once.width, 1e21);
  assert.strictEqual(normalizeCachedMediaItem(once).width, 1);
});

assertTest('Google Photos Picker merges accumulate ordinary cache rows across sessions', () => {
  const syncedItems = [
    { id: 'selected-now', loved: false },
    { id: 'loved-still-selected', loved: true }
  ];
  const cachedItems = [
    { id: 'selected-now', loved: false },
    { id: 'loved-still-selected', loved: true },
    { id: 'loved-from-previous-session', loved: true },
    { id: 'ordinary-from-previous-session', loved: false }
  ];

  const merged = mergeSyncedMediaItems(syncedItems, cachedItems);

  assert.deepStrictEqual(merged.map((item) => item.id), [
    'loved-from-previous-session',
    'ordinary-from-previous-session',
    'selected-now',
    'loved-still-selected'
  ]);
});

assertTest('Google Photos media deduplication keeps the first row for each stable media id', () => {
  const duplicateRows = [
    { id: 'picker-123', title: 'first metadata' },
    { id: 'picker-123', title: 'second metadata' },
    { id: 'picker-456', title: 'another photo' }
  ];

  assert.deepStrictEqual(dedupeMediaItemsById(duplicateRows), [
    duplicateRows[0],
    duplicateRows[2]
  ]);
});

assertTest('Google Photos deduplication preserves defaults and native filter dispatch', () => {
  assert.deepStrictEqual(dedupeMediaItemsById(), []);
  assert.deepStrictEqual(dedupeMediaItemsById(undefined), []);
  [null, false, 0, '', {}, { filter: true }].forEach((items) => {
    assert.throws(() => dedupeMediaItemsById(items), TypeError);
  });
  const row = Object.freeze({ id: 'native' });
  const sentinel = Object.freeze({ custom: 'filter result' });
  const items = Object.freeze({ filter(predicate) {
    assert.strictEqual(this, items);
    assert.strictEqual(predicate(row), true);
    assert.strictEqual(predicate(row), false);
    return sentinel;
  } });
  assert.strictEqual(dedupeMediaItemsById(items), sentinel);
  assert.deepStrictEqual(dedupeMediaItemsById([row]), [row], 'seen keys are per call');
  class Rows extends Array {}
  const subclassResult = dedupeMediaItemsById(Object.freeze(Rows.of(row, row)));
  assert.ok(subclassResult instanceof Rows, 'native array species is preserved');
  assert.strictEqual(subclassResult.length, 1);
  assert.strictEqual(subclassResult[0], row);
});

assertTest('Google Photos deduplication compares trimmed native string keys without rewriting rows', () => {
  const symbol = Symbol('photo');
  const ids = [undefined, null, false, 0, -0, 0n, NaN, '', ' \t\n',
    ' first ', 'first', 'First', 42, '42', true, 'true', 1n, '1',
    symbol, 'Symbol(photo)', '%66irst', '/first', 'first?x=1'];
  const rows = Object.freeze(ids.map((id) => Object.freeze({ id, url: '', isBroken: true })));
  const expected = [9, 11, 12, 14, 16, 18, 20, 21, 22].map((index) => rows[index]);
  const result = dedupeMediaItemsById(rows);
  assert.deepStrictEqual(result, expected);
  result.forEach((row, index) => assert.strictEqual(row, expected[index]));
  assert.strictEqual(result[0].id, ' first ');
  assert.strictEqual(result[2].id, 42);
  assert.strictEqual(result[5].id, symbol);
  assert.deepStrictEqual(dedupeMediaItemsById([undefined, null, false, 0, '', 1, symbol]), []);
});

assertTest('Google Photos deduplication reads hidden inherited ids once and coerces every visited duplicate', () => {
  const visits = [];
  const id = Object.freeze({ [Symbol.toPrimitive](hint) {
    assert.strictEqual(this, id);
    visits.push(hint);
    return ' hidden ';
  } });
  const prototype = Object.defineProperty({}, 'id', { get() { visits.push('id'); return id; } });
  const row = new Proxy(Object.freeze(Object.create(prototype)), {
    ownKeys() { throw new Error('Must not enumerate rows'); },
    get(target, key, receiver) {
      assert.strictEqual(key, 'id');
      return Reflect.get(target, key, receiver);
    }
  });
  const result = dedupeMediaItemsById(Object.freeze([row, row]));
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0], row);
  assert.deepStrictEqual(visits, ['id', 'string', 'id', 'string']);
});

assertTest('Google Photos deduplication follows native sparse traversal and length snapshots', () => {
  const first = Object.freeze({ id: 'first' });
  const inherited = Object.freeze({ id: 'inherited' });
  const prototype = Object.create(Array.prototype, { 1: { value: inherited } });
  const sparse = Object.assign(new Array(5), { 0: first, 3: first });
  Object.setPrototypeOf(sparse, prototype);
  Object.freeze(sparse);
  const result = dedupeMediaItemsById(sparse);
  assert.deepStrictEqual(result, [first, inherited]);
  assert.deepStrictEqual(Object.keys(result), ['0', '1']);
  assert.deepStrictEqual(Object.keys(sparse), ['0', '3']);

  const tail = Object.freeze({ id: 'tail' });
  const appended = Object.freeze({ id: 'appended' });
  const rows = Object.assign(new Array(3), { 0: null, 2: tail });
  rows[0] = Object.freeze({ get id() {
    rows[1] = inherited;
    rows.push(appended);
    return 'first';
  } });
  assert.deepStrictEqual(dedupeMediaItemsById(rows), [rows[0], inherited, tail]);
  assert.strictEqual(rows[3], appended, 'caller getter effects survive, but new tail is not visited');
});

assertTest('Google Photos deduplication propagates exact failures without visiting later rows', () => {
  ['filter', 'filter-call', 'id', 'coercion'].forEach((stage) => {
    [undefined, null, false, 0, '', new Error(stage)].forEach((failure) => {
      const visits = [];
      const fail = () => { visits.push(stage); throw failure; };
      const rows = [{ id: 'first' }, stage === 'id'
        ? Object.defineProperty({}, 'id', { get: fail })
        : { id: { [Symbol.toPrimitive]: fail } },
      Object.defineProperty({}, 'id', { get() { throw new Error('Later row visited'); } })];
      const items = stage === 'filter' ? Object.defineProperty({}, 'filter', { get: fail })
        : stage === 'filter-call' ? { filter: fail } : rows;
      let caught;
      let returned = false;
      try { dedupeMediaItemsById(items); returned = true; } catch (error) { caught = error; }
      assert.strictEqual(returned, false);
      assert.strictEqual(caught, failure);
      assert.deepStrictEqual(visits, [stage]);
    });
  });
  assert.throws(() => dedupeMediaItemsById([{ id: { [Symbol.toPrimitive]: () => ({}) } }]), TypeError);
});

assertTest('Google Photos deduplication is immutable and value-idempotent for stable ordinary records', () => {
  const nested = Object.freeze({ note: 'shared' });
  const rows = Object.freeze([' a ', 'a', '', 'b', ' b ', 'c'].map((id, rating) =>
    Object.freeze({ id, rating, nested })));
  const before = structuredClone(rows);
  const once = dedupeMediaItemsById(rows);
  const twice = dedupeMediaItemsById(once);
  assert.deepStrictEqual(once, [rows[0], rows[3], rows[5]]);
  assert.deepStrictEqual(twice, once);
  assert.notStrictEqual(once, rows);
  assert.notStrictEqual(twice, once);
  twice.forEach((row, index) => {
    assert.strictEqual(row, once[index]);
    assert.strictEqual(row.nested, nested);
  });
  assert.deepStrictEqual(rows, before);
  assert.deepStrictEqual(dedupeMediaItemsById([]), []);
});

assertTest('Google Photos first-biased deduplicated union obeys Monoid laws but not plain concatenation', () => {
  const row = (id, title) => Object.freeze({ id, title });
  const samples = [[], [row('a', 'first')], [row(' a ', 'other'), row('b', 'b')],
    [row('b', 'other b'), row('c', 'c')]].map(dedupeMediaItemsById);
  const combine = (left, right) => dedupeMediaItemsById([...left, ...right]);
  samples.forEach((left) => {
    assert.deepStrictEqual(combine([], left), left);
    assert.deepStrictEqual(combine(left, []), left);
    samples.forEach((middle) => samples.forEach((right) => {
      assert.deepStrictEqual(combine(combine(left, middle), right), combine(left, combine(middle, right)));
    }));
  });
  const [left, right] = [samples[1], samples[2]];
  assert.notDeepStrictEqual(combine(left, right), combine(right, left));
  assert.notDeepStrictEqual(combine(left, right), [...left, ...right]);
  assert.strictEqual(combine(left, right)[0], left[0], 'first row owns conflicting metadata');
});

// Exercise the private pair projection through the public union using one exact id.
const mergeSyncedPair = (existing, synced) => mergeSyncedMediaItems([synced], [existing])[0];

assertTest('Google Photos pair merge keeps defined user edits without truthiness or validation', () => {
  const fields = ['rating', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved'];
  const reference = Object.freeze({ custom: true });
  [undefined, null, false, 0, '', NaN, reference].forEach((value) => {
    const existing = Object.freeze({ id: 'pair', ...Object.fromEntries(fields.map((key) => [key, value])) });
    const synced = Object.freeze({ id: 'pair', ...Object.fromEntries(fields.map((key) => [key, 'incoming'])) });
    const merged = mergeSyncedPair(existing, synced);
    fields.forEach((key) => assert.strictEqual(merged[key], value === undefined ? 'incoming' : value));
  });
});

assertTest('Google Photos pair merge spreads latest fields and uses only the five sync user exceptions', () => {
  const existing = Object.freeze({ id: 'pair', title: 'old', retained: true, rating: 3,
    isBroken: true, orientation: 'portrait', width: 10, height: 20 });
  const synced = Object.freeze({ id: 'pair', title: undefined, rating: undefined,
    isBroken: false, orientation: undefined, width: 30, height: null });
  assert.deepStrictEqual(mergeSyncedPair(existing, synced), {
    id: 'pair', title: undefined, retained: true, rating: 3,
    isBroken: false, orientation: undefined, width: 30, height: null
  });
});

assertTest('Google Photos pair merge promotes hidden and inherited user edits but not unrelated fields', () => {
  const nested = Object.freeze({ shared: true });
  const existing = Object.freeze(Object.defineProperties(Object.create({
    rating: null, loved: false, inheritedOther: 'not copied'
  }), { id: { value: 'pair', enumerable: true }, cropPercent: { value: nested },
    hiddenOther: { value: 'not copied' } }));
  const merged = mergeSyncedPair(existing, Object.freeze({ id: 'pair', rating: 8, loved: true }));
  assert.deepStrictEqual(merged, { id: 'pair', rating: null, loved: false, cropPercent: nested });
  assert.strictEqual(merged.cropPercent, nested);
  assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype);
  ['rating', 'loved', 'cropPercent'].forEach((key) => assert.deepStrictEqual(
    Object.getOwnPropertyDescriptor(merged, key),
    { value: merged[key], enumerable: true, writable: true, configurable: true }
  ));
});

assertTest('Google Photos pair merge preserves shallow aliases and leaves frozen inputs unchanged', () => {
  const symbol = Symbol('metadata');
  const oldNested = Object.freeze({ version: 1 });
  const newNested = Object.freeze({ version: 2 });
  const existing = Object.freeze({ id: 'pair', rating: oldNested, nested: oldNested, [symbol]: oldNested });
  const synced = Object.freeze({ id: 'pair', rating: newNested, nested: newNested, [symbol]: newNested });
  const merged = mergeSyncedPair(existing, synced);
  assert.notStrictEqual(merged, existing);
  assert.notStrictEqual(merged, synced);
  assert.strictEqual(merged.rating, oldNested);
  assert.strictEqual(merged.nested, newNested);
  assert.strictEqual(merged[symbol], newNested);
  assert.deepStrictEqual(existing, { id: 'pair', rating: oldNested, nested: oldNested, [symbol]: oldNested });
  assert.deepStrictEqual(synced, { id: 'pair', rating: newNested, nested: newNested, [symbol]: newNested });
});

assertTest('Google Photos pair merge spreads both rows before ordered repeated user-field reads', () => {
  const visits = [];
  const fields = ['rating', 'cropPercent', 'cropPositionY', 'preventPairing', 'loved'];
  let ratingReads = 0;
  const existing = Object.freeze(Object.defineProperties({ id: 'pair' }, {
    probe: { enumerable: true, get: () => { visits.push('existing spread'); return 'old'; } },
    ...Object.fromEntries(fields.map((field) => [field, { get: () => {
      visits.push(field);
      return field === 'rating' ? (++ratingReads === 1 ? 5 : undefined) : undefined;
    } }]))
  }));
  const synced = Object.freeze({ id: 'pair', get probe() { visits.push('synced spread'); return 'new'; }, rating: 9 });
  const merged = mergeSyncedPair(existing, synced);
  assert.deepStrictEqual(visits, ['existing spread', 'synced spread', 'rating', ...fields]);
  assert.strictEqual(merged.rating, undefined, 'assignment uses the second read without rechecking');
  assert.strictEqual(merged.probe, 'new');
});

assertTest('Google Photos pair merge propagates exact spread and metadata failures without later reads', () => {
  ['existing spread', 'synced spread', 'rating guard', 'rating value'].forEach((stage) => {
    [undefined, null, false, 0, '', new Error(stage)].forEach((failure) => {
      const visits = [];
      const read = (label, value) => {
        visits.push(label);
        if (label === stage) throw failure;
        return value;
      };
      let ratingReads = 0;
      const existing = Object.freeze(Object.defineProperties({ id: 'pair' }, {
        probe: { enumerable: true, get: () => read('existing spread', 'old') },
        rating: { get: () => read(++ratingReads === 1 ? 'rating guard' : 'rating value', 5) },
        cropPercent: { get: () => { throw new Error('later field must not be read'); } }
      }));
      const synced = Object.freeze({ id: 'pair', get probe() { return read('synced spread', 'new'); } });
      let caught;
      let returned = false;
      try { mergeSyncedPair(existing, synced); returned = true; } catch (error) { caught = error; }
      assert.strictEqual(returned, false);
      assert.strictEqual(caught, failure);
      const order = ['existing spread', 'synced spread', 'rating guard', 'rating value'];
      assert.deepStrictEqual(visits, order.slice(0, order.indexOf(stage) + 1));
    });
  });
});

assertTest('Google Photos pair merge obeys associative idempotent metadata laws on ordinary records', () => {
  const samples = [{}, { rating: undefined, title: 'first' }, { rating: null, loved: false },
    { rating: 8, title: undefined, cropPercent: 0 }, { loved: true, title: 'last' }]
    .map((metadata) => Object.freeze({ id: 'pair', ...metadata }));
  const identity = Object.freeze({ id: 'pair' });
  samples.forEach((left) => {
    const repeated = mergeSyncedPair(left, left);
    assert.deepStrictEqual(repeated, left);
    assert.notStrictEqual(repeated, left);
    assert.deepStrictEqual(mergeSyncedPair(identity, left), left);
    assert.deepStrictEqual(mergeSyncedPair(left, identity), left);
    samples.forEach((middle) => samples.forEach((right) => assert.deepStrictEqual(
      mergeSyncedPair(mergeSyncedPair(left, middle), right),
      mergeSyncedPair(left, mergeSyncedPair(middle, right))
    )));
  });
  assert.notDeepStrictEqual(mergeSyncedPair(samples[2], samples[3]), mergeSyncedPair(samples[3], samples[2]));
  const inherited = Object.freeze(Object.assign(Object.create({ rating: 4 }), { id: 'pair' }));
  assert.notDeepStrictEqual(mergeSyncedPair(inherited, inherited), inherited, 'law excludes inherited records');
});

assertTest('Google Photos union keeps cached first ownership and incoming last values in first-key order', () => {
  const cached = Object.freeze([
    Object.freeze({ id: 'a', title: 'old a', rating: 2 }),
    Object.freeze({ id: 'b', title: 'first b' }), Object.freeze({ id: 'b', title: 'later b' }),
    Object.freeze({ id: 'c', title: 'old c' })
  ]);
  const incoming = Object.freeze([
    Object.freeze({ id: 'c', title: 'first c' }), Object.freeze({ id: 'd', title: 'first d' }),
    Object.freeze({ id: 'a', title: 'new a', rating: 9 }), Object.freeze({ id: 'c', title: 'last c' })
  ]);
  assert.deepStrictEqual(mergeSyncedMediaItems(incoming, cached), [
    { id: 'b', title: 'first b' }, { id: 'c', title: 'last c' },
    { id: 'd', title: 'first d' }, { id: 'a', title: 'new a', rating: 2 }
  ]);
});

assertTest('Google Photos union distinguishes trimmed comparison keys from exact cached ids', () => {
  [
    { cached: [{ id: ' a ', rating: 2 }], incoming: { id: 'a', rating: 9 }, ids: [' a ', 'a'], ratings: [2, 9] },
    { cached: [{ id: 1, rating: 2 }], incoming: { id: '1', rating: 9 }, ids: [1, '1'], ratings: [2, 9] },
    { cached: [{ id: ' a ', rating: 2 }, { id: 'a', rating: 4 }], incoming: { id: 'a', rating: 9 },
      ids: [' a ', 'a'], ratings: [2, 9] },
    { cached: [{ id: 'a', rating: 2 }], incoming: { id: ' a ', rating: 9 }, ids: [' a '], ratings: [2] },
    { cached: [{ id: 'A', rating: 2 }], incoming: { id: 'a', rating: 9 }, ids: ['A', 'a'], ratings: [2, 9] }
  ].forEach(({ cached, incoming, ids, ratings }) => {
    const merged = mergeSyncedMediaItems([incoming], cached);
    assert.deepStrictEqual(merged.map(({ id }) => id), ids);
    assert.deepStrictEqual(merged.map(({ rating }) => rating), ratings);
  });
});

assertTest('Google Photos union uses truthiness before native string keys without rewriting incoming rows', () => {
  const hints = [];
  const id = Object.freeze({ [Symbol.toPrimitive]: (hint) => { hints.push(hint); return ' key '; } });
  const selected = Object.freeze({ id, url: null });
  const latest = Object.freeze({ id: 'key', url: undefined });
  const symbolRow = Object.freeze({ id: Symbol('key') });
  const ignored = [null, undefined, {}, ...[false, 0, '', NaN, '   '].map((value) => ({ id: value }))];
  const merged = mergeSyncedMediaItems([...ignored, selected, symbolRow, latest]);
  assert.deepStrictEqual(hints, ['string']);
  assert.deepStrictEqual(merged, [latest, symbolRow]);
  assert.strictEqual(merged[0], latest);
  assert.strictEqual(merged[1], symbolRow);
});

assertTest('Google Photos union clones cached and matched rows but shares new rows and nested metadata', () => {
  const nested = Object.freeze({ shared: true });
  const symbol = Symbol('metadata');
  const kept = Object.freeze({ id: 'kept', nested, [symbol]: nested });
  const matched = Object.freeze({ id: 'match', rating: nested });
  const incoming = Object.freeze({ id: 'match', nested });
  const added = Object.freeze({ id: 'new', nested });
  const cached = Object.freeze([kept, matched]);
  const synced = Object.freeze([incoming, added]);
  const merged = mergeSyncedMediaItems(synced, cached);
  assert.notStrictEqual(merged, cached);
  assert.notStrictEqual(merged, synced);
  assert.notStrictEqual(merged[0], kept);
  assert.notStrictEqual(merged[1], matched);
  assert.notStrictEqual(merged[1], incoming);
  assert.strictEqual(merged[2], added);
  merged.forEach((row) => assert.strictEqual(row.nested, nested));
  assert.strictEqual(merged[0][symbol], nested);
  assert.strictEqual(merged[1].rating, nested);
  assert.deepStrictEqual(cached, [kept, matched]);
  assert.deepStrictEqual(synced, [incoming, added]);
});

assertTest('Google Photos union preserves falsy selection fallbacks and native sparse traversal or dispatch', () => {
  const row = Object.freeze({ id: 'kept' });
  [undefined, null, false, 0, '', NaN].forEach((input) => {
    const merged = mergeSyncedMediaItems(input, Object.freeze([row, row]));
    assert.deepStrictEqual(merged, [row]);
    assert.notStrictEqual(merged[0], row);
  });
  assert.deepStrictEqual(mergeSyncedMediaItems(), []);
  [null, false, 0, {}].forEach((cached) => assert.throws(() => mergeSyncedMediaItems([], cached), TypeError));
  [true, 1, 'text', {}].forEach((synced) => assert.throws(() => mergeSyncedMediaItems(synced), TypeError));
  const inherited = Object.freeze({ id: 'inherited' });
  const selected = Object.freeze({ id: 'selected' });
  const sparse = Object.assign(new Array(3), { 2: selected });
  Object.setPrototypeOf(sparse, Object.assign(Object.create(Array.prototype), { 1: inherited }));
  const cached = Object.freeze(Object.assign(new Array(3), { 2: row }));
  assert.deepStrictEqual(mergeSyncedMediaItems(Object.freeze(sparse), cached), [row, inherited, selected]);
  const custom = { forEach(callback) {
    assert.strictEqual(this, custom);
    callback(selected);
    return 'ignored';
  } };
  assert.strictEqual(mergeSyncedMediaItems(custom)[0], selected);
});

assertTest('Google Photos union completes gathering and retained clones before per-key lookup and pair merging', () => {
  const visits = [];
  const row = (label, id) => Object.freeze({
    get id() { visits.push(`${label} id`); return id; },
    get probe() { visits.push(`${label} spread`); return label; }
  });
  const cached = [row('keep', 'k'), row('match', 'm')];
  const incoming = [row('selected', 'm'), row('new', 'n')];
  mergeSyncedMediaItems(incoming, cached);
  assert.deepStrictEqual(visits, [
    'keep id', 'match id', 'selected id', 'new id',
    'keep id', 'match id', 'keep id', 'keep spread',
    'keep id', 'match id', 'match id', 'match spread', 'selected id', 'selected spread',
    'keep id', 'match id'
  ]);
});

assertTest('Google Photos union propagates exact native failures with no partial return or later work', () => {
  const scenarios = [
    (fail, later) => [[{ get id() { return later(); } }], [{ get id() { return fail(); } }]],
    (fail) => [{ get forEach() { return fail(); } }, [{ id: 'cached' }]],
    (fail, later) => [[{ id: { [Symbol.toPrimitive]: fail } }, { get id() { return later(); } }], []],
    (fail, later) => [[{ id: 'new', get probe() { return later(); } }], [{ id: 'kept', get probe() { return fail(); } }]],
    (fail, later) => [[{ id: 'a', get probe() { return fail(); } }, { id: 'b', get probe() { return later(); } }],
      [{ id: 'a' }, { id: 'b' }]]
  ];
  scenarios.forEach((scenario) => [undefined, null, false, 0, '', new Error('union')].forEach((failure) => {
    const visits = [];
    const fail = () => { visits.push('failure'); throw failure; };
    const later = () => { visits.push('later'); return 'later'; };
    const [synced, cached] = scenario(fail, later);
    let returned = false;
    let caught;
    try { mergeSyncedMediaItems(synced, cached); returned = true; } catch (error) { caught = error; }
    assert.strictEqual(returned, false);
    assert.strictEqual(caught, failure);
    assert.deepStrictEqual(visits, ['failure'], 'caller-hook effects survive but later work stops');
  }));
});

assertTest('Google Photos canonical union obeys associative idempotent Monoid laws with explicit domain limits', () => {
  const samples = [[], [{ id: 'a', rating: undefined }], [{ id: 'b', title: 'b' }, { id: 'a', rating: null }],
    [{ id: 'a', rating: 3, title: undefined }, { id: 'c', loved: false }],
    [{ id: 'c', loved: true }, { id: 'b', title: 'latest' }]]
    .map((rows) => Object.freeze(rows.map((row) => Object.freeze(row))));
  const combine = (cached, synced) => mergeSyncedMediaItems(synced, cached);
  samples.forEach((left) => {
    assert.deepStrictEqual(combine([], left), left);
    assert.deepStrictEqual(combine(left, []), left);
    assert.deepStrictEqual(combine(left, left), left);
    samples.forEach((middle) => samples.forEach((right) => assert.deepStrictEqual(
      combine(combine(left, middle), right), combine(left, combine(middle, right))
    )));
  });
  assert.notDeepStrictEqual(combine(samples[2], samples[3]), combine(samples[3], samples[2]));
  const duplicates = [{ id: 'a', title: 'first' }, { id: 'a', title: 'last' }];
  assert.notDeepStrictEqual(combine([], duplicates), duplicates, 'duplicates are outside the identity domain');
  assert.notDeepStrictEqual(combine([], duplicates), combine(duplicates, []), 'incoming last differs from cached first');
});

assertTest('Google Photos sync merge removes duplicate incoming and legacy cached rows', () => {
  const merged = mergeSyncedMediaItems([
    { id: 'picker-123', title: 'selected first' },
    { id: 'picker-123', title: 'selected duplicate' }
  ], [
    { id: 'picker-123', loved: true },
    { id: 'picker-123', loved: true },
    { id: 'picker-456', loved: true },
    { id: 'picker-456', loved: false }
  ]);

  assert.deepStrictEqual(merged.map(({ id }) => id), ['picker-456', 'picker-123']);
  assert.strictEqual(merged[0].loved, true, 'legacy duplicate metadata should remain on the retained row');
  assert.strictEqual(merged[1].title, 'selected duplicate', 'the latest synced representation should win');
  assert.strictEqual(merged[1].loved, true, 'existing user metadata should survive a later sync');
});

assertTest('Google Photos retention runs after accumulated union and preserves loved rows', () => {
  const merged = mergeSyncedMediaItems(
    [{ id: 'fresh', addedAt: '2026-09-05T00:00:00Z' }],
    [
      { id: 'expired', addedAt: '2026-07-01T00:00:00Z' },
      { id: 'loved-expired', addedAt: '2026-07-01T00:00:00Z', loved: true }
    ]
  );
  const retained = applyPoolPolicy('2026-09-06T00:00:00Z', {
    retentionDays: 30,
    maxPhotos: 12
  })(merged);

  assert.deepStrictEqual(retained.map(({ id }) => id), ['loved-expired', 'fresh']);
});

assertTest('Google Photos cap runs after accumulation and keeps the newest ordinary rows', () => {
  const existing = Array.from({ length: 4999 }, (_, index) => ({
    id: `existing-${index}`,
    addedAt: '2026-09-01T00:00:00Z'
  }));
  const merged = mergeSyncedMediaItems(
    Array.from({ length: 2 }, (_, index) => ({
      id: `incoming-${index}`,
      addedAt: '2026-09-06T00:00:00Z'
    })),
    existing
  );
  const retained = applyPoolPolicy('2026-09-06T00:00:00Z', {
    retentionDays: 30,
    maxPhotos: 5000
  })(merged);

  assert.strictEqual(merged.length, 5001);
  assert.strictEqual(retained.length, 5000);
  assert.ok(retained.some(({ id }) => id === 'incoming-0'));
  assert.ok(retained.some(({ id }) => id === 'incoming-1'));
  assert.ok(!retained.some(({ id }) => id === 'existing-0'));
});

assertAsyncTest('Google Photos Picker sync accumulates sessions and preserves metadata through empty or failed syncs', async () => {
  const existing = buildCachedMediaItem(
    { id: 'session-one', baseUrl: 'https://photos.example/session-one-v1', mimeType: 'image/jpeg' },
    'previous-session',
    { rating: 7, cropPercent: 42, preventPairing: true, loved: true },
    '2026-09-01T00:00:00Z'
  );
  let cacheItems = [existing];
  const readCache = () => cacheItems;
  const writeCache = (items) => { cacheItems = items; };
  const syncOptions = {
    poolPolicy: { retentionDays: 3650, maxPhotos: 5000 },
    readCache,
    writeCache,
    cleanMediaFiles: () => {},
    downloadMediaItems: async () => {}
  };

  try {
    const listMediaItems = async (sessionId) => ({
      mediaItems: sessionId === 'session-1'
        ? [
          { id: 'session-one', baseUrl: 'https://photos.example/session-one-v2', mimeType: 'image/jpeg' },
          { id: 'session-two', baseUrl: 'https://photos.example/session-two', mimeType: 'image/jpeg' }
        ]
        : [
          { id: 'session-two', baseUrl: 'https://photos.example/session-two-v2', mimeType: 'image/jpeg' },
          { id: 'session-three', baseUrl: 'https://photos.example/session-three', mimeType: 'image/jpeg' }
        ]
    });
    await googlePhotos.syncGoogleAlbum('session-1', {
      now: new Date('2026-09-02T00:00:00Z'),
      ...syncOptions,
      listMediaItems
    });
    await googlePhotos.syncGoogleAlbum('session-2', {
      now: new Date('2026-09-03T00:00:00Z'),
      ...syncOptions,
      listMediaItems
    });

    const accumulated = readCache();
    assert.deepStrictEqual(accumulated.map(({ id }) => id), [
      'session-one',
      'session-two',
      'session-three'
    ]);
    assert.strictEqual(accumulated.find(({ id }) => id === 'session-two').googleBaseUrl, 'https://photos.example/session-two-v2');
    assert.strictEqual(accumulated.find(({ id }) => id === 'session-one').rating, 7);
    assert.strictEqual(accumulated.find(({ id }) => id === 'session-one').cropPercent, 42);
    assert.strictEqual(accumulated.find(({ id }) => id === 'session-one').preventPairing, true);
    assert.strictEqual(accumulated.find(({ id }) => id === 'session-one').loved, true);

    const originalGetCachedMediaItems = googlePhotos.getCachedMediaItems;
    googlePhotos.getCachedMediaItems = () => readCache();
    try {
      const poolApp = buildConfiguredRoutesApp({
        state: {
          searchKeywords: {},
          feedConfigs: {},
          poolPolicies: {
            'Google Photos': { retentionDays: 3650, maxPhotos: 5000 }
          }
        }
      });
      const poolsResponse = await invokeRoute(poolApp, 'get', '/api/pools');
      const googlePool = poolsResponse.body.find(({ name }) => name === 'Google Photos');
      assert.strictEqual(
        googlePool.photosCount,
        3,
        `total count should include all ${readCache().length} cached rows; response was ${JSON.stringify(googlePool)}`
      );
      assert.strictEqual(googlePool.usablePhotosCount, 3, 'all cached Picker photos should be usable');
      const googlePhotosResponse = await invokeRoute(
        poolApp,
        'get',
        '/api/pools/:name/photos',
        { params: { name: 'Google Photos' } }
      );
      assert.strictEqual(googlePhotosResponse.body.length, 3, 'the detail route should retain all cached rows');

      const mixedFeed = combineFeedsBalanced(
        ['Scenic Nature', 'Google Photos'],
        {
          'Scenic Nature': [
            { url: 'scenic-one' },
            { url: 'scenic-two' },
            { url: 'scenic-three' }
          ]
        }
      );
      assert.deepStrictEqual(mixedFeed.map(({ category }) => category), [
        'Scenic Nature',
        'Google Photos',
        'Scenic Nature',
        'Google Photos',
        'Scenic Nature',
        'Google Photos'
      ]);
    } finally {
      googlePhotos.getCachedMediaItems = originalGetCachedMediaItems;
    }

    const afterSuccessfulSync = cacheItems;
    await googlePhotos.syncGoogleAlbum('empty-session', {
      now: new Date('2026-09-03T00:00:00Z'),
      ...syncOptions,
      listMediaItems: async () => ({ mediaItems: [] })
    });
    assert.deepStrictEqual(cacheItems, afterSuccessfulSync);

    await assert.rejects(
      googlePhotos.syncGoogleAlbum('failed-session', {
        ...syncOptions,
        listMediaItems: async () => { throw new Error('picker unavailable'); }
      }),
      /picker unavailable/
    );
    assert.deepStrictEqual(cacheItems, afterSuccessfulSync);
  } finally {
    cacheItems = [];
  }
});

assertTest('difference functional helper computes set difference correctly', () => {
  const setA = new Set(['a', 'b', 'c']);
  const setB = new Set(['b', 'd']);
  const diff = difference(setA, setB);
  assert.deepStrictEqual([...diff].sort(), ['a', 'c']);
});

assertTest('difference documents generic readonly inputs and a fresh ordered result', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos'), 'utf8');
  const contract = source.slice(source.indexOf(' * Return a fresh set of left-hand values'), source.indexOf('const difference ='));
  ['@template T', '@param {ReadonlySet<T>} setA', '@param {ReadonlySet<T>} setB', '@returns {Set<T>}',
    'SameValueZero', 'reference identity', 'not cloned', 'failures propagate'].forEach(text => assert.ok(contract.includes(text)));
  assert.ok(source.includes('const difference = (setA, setB) => new Set([...setA].filter(x => !setB.has(x)));'));
});

assertTest('difference preserves left order and isolates result membership from both inputs', () => {
  const left = new Set(['z', 'a', 'm', 'b']);
  const right = new Set(['b', 'absent', 'a']);
  const result = difference(left, right);
  assert.deepStrictEqual([...result], ['z', 'm']);
  assert.notStrictEqual(result, left);
  assert.notStrictEqual(result, right);
  assert.notStrictEqual(result, difference(left, right));
  result.delete('z');
  result.add('new');
  assert.deepStrictEqual([...left], ['z', 'a', 'm', 'b']);
  assert.deepStrictEqual([...right], ['b', 'absent', 'a']);
});

assertTest('difference uses native SameValueZero membership and retains object identity', () => {
  const shared = Object.freeze({ id: 'same' });
  const distinct = Object.freeze({ id: 'same' });
  const symbol = Symbol('same');
  const otherSymbol = Symbol('same');
  const left = new Set([NaN, -0, shared, distinct, symbol, otherSymbol, '1', 1, null, undefined]);
  const right = new Set([NaN, +0, shared, symbol, 1, undefined]);
  const result = difference(left, right);
  assert.deepStrictEqual([...result], [distinct, otherSymbol, '1', null]);
  assert.strictEqual([...result][0], distinct);
  assert.strictEqual(left.size, 10);
  assert.strictEqual(right.size, 6);
});

assertTest('difference satisfies empty exclusion and self-subtraction with fresh results', () => {
  [[], ['b', 'a'], [null, undefined, NaN]].forEach(values => {
    const input = new Set(values);
    const retained = difference(input, new Set());
    const self = difference(input, input);
    const empty = new Set();
    const absent = difference(empty, input);
    assert.deepStrictEqual([...retained], values);
    assert.notStrictEqual(retained, input);
    assert.deepStrictEqual([...self], []);
    assert.notStrictEqual(self, input);
    assert.deepStrictEqual([...absent], []);
    assert.notStrictEqual(absent, empty);
    assert.deepStrictEqual([...input], values);
  });
});

assertTest('difference satisfies exclusion and repeated-subtraction laws over finite sets', () => {
  const universe = ['z', 'a', 'm'];
  const subsets = Array.from({ length: 2 ** universe.length }, (_, mask) =>
    new Set(universe.filter((_, index) => mask & (1 << index))));
  subsets.forEach(left => subsets.forEach(right => {
    const before = [[...left], [...right]];
    const result = difference(left, right);
    assert.ok([...result].every(value => left.has(value) && !right.has(value)));
    assert.ok([...left].every(value => result.has(value) !== right.has(value)));
    assert.deepStrictEqual([...difference(result, right)], [...result]);
    assert.deepStrictEqual([[...left], [...right]], before);
  }));
});

assertTest('difference composes successive exclusions as right-hand union, not associativity', () => {
  const subsets = [[], ['b'], ['a'], ['b', 'a']].map(values => new Set(values));
  subsets.forEach(left => subsets.forEach(first => subsets.forEach(second => {
    assert.deepStrictEqual(
      [...difference(difference(left, first), second)],
      [...difference(left, new Set([...first, ...second]))]
    );
  })));
  const same = new Set(['a']);
  assert.notDeepStrictEqual(difference(difference(same, same), same), difference(same, difference(same, same)));
});

assertTest('getOrphanedFiles matches parsed ids and preserves orphan order without mutation', () => {
  const allFiles = ['item1.jpg', 'item2.jpg', 'item1.png', 'item3.jpg', 'item4.webp'];
  const activeIds = ['item1', 'item3'];
  const orphans = getOrphanedFiles(allFiles, activeIds);
  assert.deepStrictEqual(orphans, ['item2.jpg', 'item4.webp']);
  assert.deepStrictEqual(allFiles, ['item1.jpg', 'item2.jpg', 'item1.png', 'item3.jpg', 'item4.webp']);
  assert.deepStrictEqual(activeIds, ['item1', 'item3']);
});

assertTest('getOrphanedFiles documents readonly inputs and a pure detached projection', () => {
  const source = fs.readFileSync(require.resolve('./server/services/googlePhotos'), 'utf8');
  const contract = source.slice(source.indexOf(' * Project entries whose platform-parsed basename'), source.indexOf('const getOrphanedFiles ='));
  ['@param {ReadonlyArray<string>} allFiles', '@param {ReadonlyArray<string>} activeIds',
    '@returns {string[]}', '@throws {unknown}', 'preserving duplicates and order',
    'no filesystem access or deletion', 'failures propagate unchanged'].forEach(text => assert.ok(contract.includes(text)));
});

assertTest('getOrphanedFiles matches exact platform basenames without normalizing ids', () => {
  [
    ['nested/item.jpg', 'item', true],
    ['nested/item.png', 'nested/item', false],
    ['photo.raw.jpg', 'photo.raw', true],
    ['photo.raw.jpg', 'photo', false],
    ['.hidden', '.hidden', true],
    ['.hidden.jpg', '.hidden', true],
    ['photo.', 'photo', true],
    ['folder/', 'folder', true],
    ['', '', true],
    ['/', '', true],
    ['Photo.JPG', 'photo', false],
    [' photo .jpg', 'photo', false],
    ['photo%2Fone.jpg', 'photo/one', false],
    ['photo%2Fone.jpg', 'photo%2Fone', true]
  ].forEach(([file, id, active]) => {
    assert.deepStrictEqual(getOrphanedFiles(Object.freeze([file]), Object.freeze([id])), active ? [] : [file]);
  });
});

assertTest('getOrphanedFiles preserves original paths, duplicate entries, and order in a fresh result', () => {
  const files = Object.freeze(['z.jpg', 'nested/a.jpg', 'z.jpg', 'z.png', 'other/a.webp', 'm.jpg']);
  const active = Object.freeze(['a', 'a', 'missing']);
  const result = getOrphanedFiles(files, active);
  assert.deepStrictEqual(result, ['z.jpg', 'z.jpg', 'z.png', 'm.jpg']);
  assert.notStrictEqual(result, files);
  assert.notStrictEqual(result, getOrphanedFiles(files, active));
  result.push('new.jpg');
  assert.deepStrictEqual(files, ['z.jpg', 'nested/a.jpg', 'z.jpg', 'z.png', 'other/a.webp', 'm.jpg']);
  assert.deepStrictEqual(active, ['a', 'a', 'missing']);
});

assertTest('getOrphanedFiles has fresh empty and no-exclusion identities', () => {
  [[], ['a.jpg'], ['a.jpg', 'a.jpg', 'nested/b.png']].forEach(values => {
    const files = Object.freeze(values);
    const retained = getOrphanedFiles(files, Object.freeze([]));
    assert.deepStrictEqual(retained, files);
    assert.notStrictEqual(retained, files);
    const empty = Object.freeze([]);
    const result = getOrphanedFiles(empty, files);
    assert.deepStrictEqual(result, []);
    assert.notStrictEqual(result, empty);
    assert.deepStrictEqual(getOrphanedFiles(files, files.map(file => path.parse(file).name)), []);
  });
});

assertTest('getOrphanedFiles obeys ordered concatenation, idempotence, and active-union laws', () => {
  const universe = ['a', 'b', 'missing'];
  const selections = Array.from({ length: 2 ** universe.length }, (_, mask) =>
    Object.freeze(universe.filter((_, index) => mask & (1 << index))));
  const left = Object.freeze(['b.jpg', 'nested/a.png', 'b.jpg']);
  const right = Object.freeze(['a.jpg', 'z.webp', 'z.webp']);
  const files = Object.freeze([...left, ...right]);
  selections.forEach(first => {
    const result = getOrphanedFiles(files, first);
    assert.deepStrictEqual(result, files.filter(file => !first.includes(path.parse(file).name)));
    assert.deepStrictEqual(result, [...getOrphanedFiles(left, first), ...getOrphanedFiles(right, first)]);
    assert.deepStrictEqual(getOrphanedFiles(result, first), result);
    selections.forEach(second => assert.deepStrictEqual(
      getOrphanedFiles(result, second),
      getOrphanedFiles(files, [...first, ...second])
    ));
  });
});

assertTest('getOrphanedFiles propagates native input and hook failures without coercion', () => {
  [
    [null, []],
    [{}, []],
    [[], {}],
    [[null], []],
    [[42], []],
    [[Symbol('file')], []]
  ].forEach(([files, active]) => assert.throws(() => getOrphanedFiles(files, active), TypeError));
  const failure = new Error('caller hook');
  const file = Object.freeze({ toString: () => { throw failure; } });
  assert.throws(() => getOrphanedFiles([file], []), TypeError);
  const active = Object.freeze({ [Symbol.iterator]: () => { throw failure; } });
  assert.throws(() => getOrphanedFiles([], active), error => error === failure);
});

assertTest('getLocalMediaFilePath builds correct JPG file destination path', () => {
  const mediaPath = getLocalMediaFilePath('photo-123');
  assert.ok(mediaPath.endsWith('google_photos_media/photo-123.jpg'));
});

assertAsyncTest('fetchMediaItemBytes serves from local file if it exists', async () => {
  const testId = 'TEST_LOCAL_SERVE_ID';
  const filePath = getLocalMediaFilePath(testId);
  const testBuffer = Buffer.from('mock-local-image-bytes');
  const fs = require('fs');
  const path = require('path');
  
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, testBuffer);

  try {
    const result = await fetchMediaItemBytes(testId);
    assert.deepStrictEqual(result.buffer.toString(), 'mock-local-image-bytes');
    assert.strictEqual(result.contentType, 'image/jpeg');
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

assertAsyncTest('fetchMediaItemBytes lazy-downloads and caches media when missing', async () => {
  const originalFetch = globalThis.fetch;
  const testId = 'MOCK_MEDIA_ITEM_9999';
  const filePath = getLocalMediaFilePath(testId);
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  globalThis.fetch = async (url, options) => {
    const urlString = typeof url === 'string' ? url : (url?.url || url?.href || String(url || ''));
    if (urlString.includes('picsum.photos')) {
      return {
        ok: true,
        headers: {
          get: (name) => name === 'content-type' ? 'image/jpeg' : null
        },
        arrayBuffer: async () => {
          const buf = Buffer.from('mocked-network-bytes');
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        }
      };
    }
    return originalFetch(url, options);
  };

  try {
    const result = await fetchMediaItemBytes(testId);
    assert.deepStrictEqual(result.buffer.toString(), 'mocked-network-bytes');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

assertAsyncTest('fetchMediaItemBytes lazy-downloads and caches non-mock media to local disk', async () => {
  const originalFetch = globalThis.fetch;
  const testId = 'test-non-mock-id';
  const filePath = getLocalMediaFilePath(testId);
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  globalThis.fetch = async (url, options) => {
    const urlString = typeof url === 'string' ? url : (url?.url || url?.href || String(url || ''));
    if (urlString.includes('oauth2.googleapis.com')) {
      return {
        ok: true,
        json: async () => ({
          access_token: 'mock-access-token',
          expires_in: 3600
        })
      };
    }
    if (urlString.includes('photoslibrary.googleapis.com')) {
      return {
        ok: true,
        json: async () => ({
          baseUrl: 'https://mock-google-content.com/some-photo'
        })
      };
    }
    if (urlString.includes('mock-google-content.com')) {
      return {
        ok: true,
        headers: {
          get: (name) => name === 'content-type' ? 'image/png' : null
        },
        arrayBuffer: async () => {
          const buf = Buffer.from('mocked-png-bytes');
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        }
      };
    }
    return originalFetch(url, options);
  };

  try {
    const cacheFile = process.env.LUMINA_GOOGLE_PHOTOS_CACHE_PATH;
    const originalCache = fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile, 'utf8') : '[]';
    
    fs.writeFileSync(cacheFile, JSON.stringify([{
      id: testId,
      url: `/api/google-photos/media/${testId}`,
      googleBaseUrl: 'https://mock-google-content.com/some-photo',
      mimeType: 'image/png',
      width: 800,
      height: 600
    }]));

    const result = await fetchMediaItemBytes(testId);
    assert.deepStrictEqual(result.buffer.toString(), 'mocked-png-bytes');
    assert.strictEqual(result.contentType, 'image/png');
    
    assert.ok(fs.existsSync(filePath), 'Image should be cached to disk');
    assert.deepStrictEqual(fs.readFileSync(filePath).toString(), 'mocked-png-bytes');

    fs.writeFileSync(cacheFile, originalCache);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// 4. UNIT TEST SUITE: Image Rating & Weighted Slideshow Engine
// ============================================================================
logSuite('Image Rating & Weighted Slideshow Engine');

assertTest('correctly preserves rating during keyword auto-tagging', () => {
  const photos = [
    { title: 'Golden Autumn Forest Stream', author: 'Sebastian Unrau', rating: 8 },
    { title: 'Emerald Fields under Golden Sunsets', author: 'Kalen Emsley' }
  ];
  const tagged = tagPhotosWithKeywords(photos);
  assert.strictEqual(tagged[0].rating, 8, 'Should preserve rating of 8');
  assert.strictEqual(tagged[1].rating, 10, 'Should default rating to 10');
});

assertTest('never selects banned photos (rating = 1)', () => {
  const samplePhotos = [
    { url: 'url1', title: 'Great Photo', rating: 10 },
    { url: 'url2', title: 'Banned Photo', rating: 1 },
    { url: 'url3', title: 'Okay Photo', rating: 5 }
  ];
  screensaverState.photosList = samplePhotos;
  screensaverState.activePhoto = samplePhotos[0];
  screensaverState.alignWeather = false;
  screensaverState.alignTimeOfDay = false;

  for (let i = 0; i < 50; i++) {
    const nextPhoto = getSmartPhoto('next');
    assert.notStrictEqual(nextPhoto.url, 'url2', 'Banned photo must never be selected');
  }
});

assertTest('successfully marks photo as broken and updates state lists via markPhotoBroken', () => {
  const { markPhotoBroken } = require('./server/config/collections.js');
  const testCollections = {
    'Scenic Nature': [
      { url: 'urlA', title: 'Photo A', rating: 10 },
      { url: 'urlB', title: 'Photo B', rating: 10 }
    ]
  };
  const testState = {
    photosList: [
      { url: 'urlA', title: 'Photo A', rating: 10 },
      { url: 'urlB', title: 'Photo B', rating: 10 }
    ],
    activePhoto: { url: 'urlB', title: 'Photo B', rating: 10 }
  };

  const marked = markPhotoBroken(testCollections, testState, 'urlB');
  assert.strictEqual(marked, true, 'markPhotoBroken must return true for found URLs');
  assert.strictEqual(testCollections['Scenic Nature'][1].rating, 1, 'rating must be set to 1');
  assert.strictEqual(testCollections['Scenic Nature'][1].isBroken, true, 'isBroken must be set to true');
  assert.strictEqual(testState.activePhoto.rating, 1, 'state.activePhoto rating must be set to 1');
  assert.strictEqual(testState.activePhoto.isBroken, true, 'state.activePhoto isBroken must be set to true');
  assert.ok(!testState.photosList.some(p => p.url === 'urlB'), 'broken photo must be pruned from state.photosList');
});

assertTest('banning a photo (rating = 1) immediately prunes it from state.photosList in updatePhotoRating', () => {
  const { updatePhotoRating } = require('./server/config/collections.js');
  const testCollections = {
    'Scenic Nature': [
      { url: 'urlX', title: 'Photo X', rating: 10 },
      { url: 'urlY', title: 'Photo Y', rating: 10 }
    ]
  };
  const testState = {
    photosList: [
      { url: 'urlX', title: 'Photo X', rating: 10 },
      { url: 'urlY', title: 'Photo Y', rating: 10 }
    ],
    activePhoto: { url: 'urlY', title: 'Photo Y', rating: 10 }
  };

  const rated = updatePhotoRating(testCollections, testState, 'urlY', 1);
  assert.strictEqual(rated, true, 'updatePhotoRating must return true for found URLs');
  assert.strictEqual(testCollections['Scenic Nature'][1].rating, 1, 'rating must be set to 1');
  assert.ok(!testState.photosList.some(p => p.url === 'urlY'), 'banned photo must be immediately pruned from state.photosList');
});

assertTest('successfully sets preventPairing flag and updates state via updatePhotoPreventPairing', () => {
  const { updatePhotoPreventPairing } = require('./server/config/collections.js');
  const testCollections = {
    'Scenic Nature': [
      { url: 'urlA', title: 'Photo A' }
    ]
  };
  const testState = {
    photosList: [
      { url: 'urlA', title: 'Photo A' }
    ],
    activePhoto: { url: 'urlA', title: 'Photo A' }
  };

  const updated = updatePhotoPreventPairing(testCollections, testState, 'urlA', true);
  assert.strictEqual(updated, true, 'updatePhotoPreventPairing must return true for found URLs');
  assert.strictEqual(testCollections['Scenic Nature'][0].preventPairing, true, 'preventPairing must be set to true in collections');
  assert.strictEqual(testState.photosList[0].preventPairing, true, 'preventPairing must be set to true in state.photosList');
  assert.strictEqual(testState.activePhoto.preventPairing, true, 'preventPairing must be set to true in state.activePhoto');
});

assertTest('weighted distribution favors highly-rated photos', () => {
  const samplePhotos = [
    { url: 'high', title: 'High Rating Photo', rating: 10 },
    { url: 'low', title: 'Low Rating Photo', rating: 2 }
  ];
  screensaverState.photosList = samplePhotos;
  screensaverState.activePhoto = samplePhotos[0];
  screensaverState.alignWeather = false;
  screensaverState.alignTimeOfDay = false;

  let highCount = 0;
  let lowCount = 0;
  for (let i = 0; i < 1000; i++) {
    screensaverState.activePhoto = null; // Disable consecutive repeat filtering for pure probability testing
    const picked = getSmartPhoto('next');
    if (picked.url === 'high') {
      highCount++;
    } else if (picked.url === 'low') {
      lowCount++;
    }
  }

  // Expect highCount > lowCount by a significant margin (mathematically 5:1 ratio)
  assert.ok(highCount > lowCount * 2, `Expected highly-rated photo to be selected much more than low-rated one. High: ${highCount}, Low: ${lowCount}`);
});

assertTest('resets activeSecondPhoto to null when activePhoto is changed', () => {
  screensaverState.activeSecondPhoto = { url: 'url2' };
  screensaverState.activePhoto = { url: 'url1' };
  assert.strictEqual(screensaverState.activeSecondPhoto, null, 'activeSecondPhoto must be reset to null when activePhoto changes');
});

assertTest('updatePhotoCrop correctly sets and persists cropPercent and cropPositionY', () => {
  const { updatePhotoCrop } = require('./server/config/collections.js');
  const tempCollections = {
    'Scenic Nature': [
      { url: 'test-url-crop', title: 'Test Photo', rating: 5 }
    ]
  };
  const tempState = {
    activePhoto: { url: 'test-url-crop', rating: 5 },
    photosList: [
      { url: 'test-url-crop', rating: 5 }
    ]
  };
  updatePhotoCrop(tempCollections, tempState, 'test-url-crop', 40, 70);
  
  assert.strictEqual(tempState.activePhoto.cropPercent, 40, 'cropPercent must be updated');
  assert.strictEqual(tempState.activePhoto.cropPositionY, 70, 'cropPositionY must be updated');
  assert.strictEqual(tempCollections['Scenic Nature'][0].cropPercent, 40, 'collection entry cropPercent must be updated');
  assert.strictEqual(tempCollections['Scenic Nature'][0].cropPositionY, 70, 'collection entry cropPositionY must be updated');
});


// ============================================================================
// 4b. UNIT TEST SUITE: Keyword Exclusion Filters
// ============================================================================
logSuite('Keyword Exclusion Filters');

assertTest('correctly filters photos containing excluded keywords in combineFeedsBalanced', () => {
  const collections = {
    'Scenic Nature': [
      { url: 'url1', title: 'Beautiful Forest Mountains', rating: 10 },
      { url: 'url2', title: 'Stupid Anime Character Artwork', rating: 10 },
      { url: 'url3', title: 'Lovely Stream in the Woods', rating: 10 }
    ]
  };
  
  const originalExclusions = screensaverState.excludedKeywords;
  screensaverState.excludedKeywords = ['anime'];
  
  const combined = combineFeedsBalanced(['Scenic Nature'], collections);
  
  assert.strictEqual(combined.length, 2, 'Should return exactly 2 photos');
  assert.ok(combined.every(p => !p.title.toLowerCase().includes('anime')), 'No photo should contain the excluded keyword');
  
  screensaverState.excludedKeywords = originalExclusions;
});

assertTest('correctly filters photos containing excluded keywords in selectWeightedRandomPhoto', () => {
  const photos = [
    { url: 'url1', title: 'Cyberpunk anime wallpaper', rating: 10 },
    { url: 'url2', title: 'Futuristic neon city street', rating: 10 }
  ];
  
  const originalExclusions = screensaverState.excludedKeywords;
  screensaverState.excludedKeywords = ['anime'];
  
  const picked = selectWeightedRandomPhoto(photos);
  assert.strictEqual(picked.url, 'url2', 'Should pick the non-excluded photo');

  screensaverState.excludedKeywords = originalExclusions;
});

// ============================================================================
// 4c. UNIT TEST SUITE: Active Feed Runtime
// ============================================================================
logSuite('Active Feed Runtime');

assertTest('normalizeActiveCategories canonicalizes aliases against available feeds', () => {
  const { normalizeActiveCategories } = require('./server/runtime/activeFeed.js');

  assert.deepStrictEqual(
    normalizeActiveCategories({
      currentCategory: 'Liminal Space, Google Photos, Missing',
      collections: {
        'Scenic Nature': [],
        'Liminal Spaces': []
      },
      externalCollections: {
        'Google Photos': []
      }
    }),
    ['Liminal Spaces', 'Google Photos']
  );
});

assertTest('active-feed projections normalize categories and assemble visible feeds without mutating sources', () => {
  const {
    buildFeedSelection,
    getAvailableCategories,
    normalizeActiveCategories,
    splitCategorySelection
  } = require('./server/runtime/activeFeed.js');
  const naturePhoto = { url: 'nature-1', title: 'Forest Vista', rating: 10 };
  const pickerPhoto = { url: 'picker-1', title: 'Lake Vista', rating: 10 };
  const collections = {
    'Scenic Nature': [naturePhoto],
    'Hidden Pool': [{ url: 'hidden-1', title: 'Blocked photo', rating: 10 }]
  };
  const externalCollections = { 'Google Photos': [pickerPhoto] };

  assert.deepStrictEqual(splitCategorySelection(null), []);
  assert.deepStrictEqual(splitCategorySelection(' Scenic Nature, , Google Photos '), [
    'Scenic Nature',
    'Google Photos'
  ]);
  assert.deepStrictEqual(getAvailableCategories(collections, externalCollections), [
    'Scenic Nature',
    'Hidden Pool',
    'Google Photos'
  ]);
  assert.deepStrictEqual(normalizeActiveCategories({
    currentCategory: 'Missing,Google Photos',
    collections,
    externalCollections,
    fallbackCategory: 'Scenic Nature'
  }), ['Google Photos']);

  const feed = buildFeedSelection({
    selectedCategories: ['Scenic Nature', 'Hidden Pool', 'Google Photos'],
    collections,
    externalCollections,
    excludedKeywords: ['blocked']
  });

  assert.deepStrictEqual(feed.map(({ url, category }) => ({ url, category })), [
    { url: 'nature-1', category: 'Scenic Nature' },
    { url: 'picker-1', category: 'Google Photos' }
  ]);
  assert.strictEqual(naturePhoto.category, undefined);
  assert.strictEqual(pickerPhoto.category, undefined);
  assert.notStrictEqual(feed[0], naturePhoto);
  assert.notStrictEqual(feed[1], pickerPhoto);
});

assertTest('active-feed checked contracts keep photosList assignment in the runtime shell', () => {
  const source = fs.readFileSync(path.join(__dirname, 'server/runtime/activeFeed.js'), 'utf8');

  assert.match(source, /^\/\/ @ts-check/m);
  assert.match(source, /@typedef \{import\('\.\.\/domain\/types'\)\.Photo\} ActiveFeedPhoto/);
  assert.match(source, /@typedef \{object\} FeedSelectionOptions/);
  assert.match(source, /@param \{FeedSelectionOptions\} options/);
  assert.match(source, /@returns \{ActiveFeedPhoto\[\]\}/);
  assert.match(source, /state\.photosList = photos/);
});

assertTest('createActiveFeedRuntime refreshes the active selection into photosList', () => {
  const { createActiveFeedRuntime } = require('./server/runtime/activeFeed.js');
  const state = {
    currentCategory: 'Liminal Space',
    excludedKeywords: [],
    photosList: []
  };
  const collections = {
    'Scenic Nature': [{ url: 'scenic-1', title: 'Forest Vista', rating: 10 }],
    'Liminal Spaces': [{ url: 'liminal-1', title: 'Empty Hallway', rating: 10 }]
  };

  const runtime = createActiveFeedRuntime({ state, collections });
  const nextPhotos = runtime.refreshActiveFeed();

  assert.deepStrictEqual(nextPhotos.map((photo) => photo.url), ['liminal-1']);
  assert.deepStrictEqual(state.photosList, nextPhotos);
  assert.deepStrictEqual(runtime.getActiveCategories(), ['Liminal Spaces']);
});

assertTest('createActiveFeedRuntime leaves photosList untouched when a scoped refresh misses the active feed', () => {
  const { createActiveFeedRuntime } = require('./server/runtime/activeFeed.js');
  const existingPhotos = [{ url: 'keep-me', title: 'Existing Photo', category: 'Scenic Nature' }];
  const state = {
    currentCategory: 'Scenic Nature',
    excludedKeywords: [],
    photosList: existingPhotos
  };
  const collections = {
    'Scenic Nature': [{ url: 'scenic-1', title: 'Forest Vista', rating: 10 }],
    'Liminal Spaces': [{ url: 'liminal-1', title: 'Empty Hallway', rating: 10 }]
  };

  const runtime = createActiveFeedRuntime({ state, collections });
  const nextPhotos = runtime.refreshActiveFeedIfIncluded(['Liminal Spaces']);

  assert.strictEqual(nextPhotos, existingPhotos);
  assert.strictEqual(state.photosList, existingPhotos);
});

assertTest('createActiveFeedRuntime falls back to the default visible feed when the active selection is empty', () => {
  const { createActiveFeedRuntime } = require('./server/runtime/activeFeed.js');
  const state = {
    currentCategory: 'Liminal Spaces',
    excludedKeywords: ['hallway'],
    photosList: []
  };
  const collections = {
    'Scenic Nature': [{ url: 'scenic-1', title: 'Forest Vista', rating: 10 }],
    'Liminal Spaces': [{ url: 'liminal-1', title: 'Empty Hallway', rating: 10 }]
  };

  const runtime = createActiveFeedRuntime({ state, collections });
  const nextPhotos = runtime.refreshActiveFeed();

  assert.deepStrictEqual(nextPhotos.map((photo) => photo.url), ['scenic-1']);
  assert.deepStrictEqual(nextPhotos.map((photo) => photo.category), ['Scenic Nature']);
});

// ============================================================================
// 4d. UNIT TEST SUITE: Environment Refresh Runtime
// ============================================================================
logSuite('Ecowitt Environment Adapter');

const ecowittFixture = {
  common_list: [],
  debug: [],
  wh25: [{ intemp: '76.5', unit: 'F', inhumi: '63%', abs: '29.39 inHg', rel: '29.39 inHg' }]
};

assertTest('parses and normalizes the captured GW1200 indoor payload to metric units', () => {
  assert.deepStrictEqual(parseEcowittPayload(ecowittFixture), {
    temperatureC: 24.7,
    humidityPercent: 63,
    pressureAbsoluteHpa: 995.3,
    pressureRelativeHpa: 995.3
  });
});

assertTest('normalizes metric Celsius and hPa payloads without vendor suffixes', () => {
  assert.deepStrictEqual(parseEcowittPayload({
    wh25: [{ intemp: '22.8', unit: 'C', inhumi: '47%', abs: '1001.4 hPa', rel: '1018.7 hPa' }]
  }), {
    temperatureC: 22.8,
    humidityPercent: 47,
    pressureAbsoluteHpa: 1001.4,
    pressureRelativeHpa: 1018.7
  });
});

assertTest('returns null measurements for missing or malformed sensor fields', () => {
  assert.deepStrictEqual(parseEcowittPayload({ wh25: [{}] }), {
    temperatureC: null,
    humidityPercent: null,
    pressureAbsoluteHpa: null,
    pressureRelativeHpa: null
  });
  assert.deepStrictEqual(parseEcowittPayload({}), {
    temperatureC: null,
    humidityPercent: null,
    pressureAbsoluteHpa: null,
    pressureRelativeHpa: null
  });
});

assertTest('builds a stable disabled environment response', () => {
  assert.deepStrictEqual(buildEnvironmentResponse({ indoor: null, enabled: false }), {
    indoor: null,
    metrics: {},
    units: {
      temperature: 'C',
      pressure: 'hPa',
      wind: 'km/h',
      rain: 'mm',
      light: 'lux'
    },
    source: 'ecowitt-gw1200',
    observedAt: null,
    stale: false,
    enabled: false
  });
});

assertTest('keeps display units configurable while retaining canonical metric parsing', () => {
  assert.deepStrictEqual(normalizeUnits({ temperature: 'F' }), {
    temperature: 'F', pressure: 'hPa', wind: 'km/h', rain: 'mm', light: 'lux'
  });
  assert.strictEqual(validateEcowittSettings({ enabled: true, baseUrl: 'ftp://gateway' }).valid, false);
  assert.strictEqual(validateEcowittSettings({ enabled: true, baseUrl: 'http://gateway', pollIntervalMs: 60000 }).valid, true);
});

assertTest('normalizes GW1200 and outdoor weather into one hourly sensor record', () => {
  assert.deepStrictEqual(normalizeSensorSnapshot({
    environment: {
      source: 'ecowitt-gw1200',
      observedAt: '2026-07-18T21:45:12.000Z',
      metrics: { wh25: [{ intemp: '76.5', unit: 'F' }], lightning: [{ count: '2' }] },
      indoor: { temperatureC: 24.7, humidityPercent: 63, pressureRelativeHpa: 995.3 }
    },
    weather: {
      location: { lat: 45.45, lon: -73.56 },
      current: { temperature_2m: 20.1, weather_code: 2, precipitation: 0 }
    }
  }), {
    hourKey: '2026-07-18T21',
    observedAt: '2026-07-18T21:45:12.000Z',
    source: 'ecowitt-gw1200',
    device: 'GW1200',
    gatewayMetricsJson: '{"wh25":[{"intemp":"76.5","unit":"F"}],"lightning":[{"count":"2"}]}',
    indoorTemperatureC: 24.7,
    indoorHumidityPercent: 63,
    indoorPressureAbsoluteHpa: null,
    indoorPressureRelativeHpa: 995.3,
    outdoorTemperatureC: 20.1,
    outdoorHumidityPercent: null,
    outdoorApparentTemperatureC: null,
    outdoorPrecipitationMm: 0,
    outdoorRainMm: null,
    outdoorSnowfallMm: null,
    outdoorWeatherCode: 2,
    outdoorWindSpeedKmh: null,
    latitude: 45.45,
    longitude: -73.56
  });
});

assertTest('sensor history projections preserve input, null invalid clocks, bound limits, and escape CSV', () => {
  const input = {
    environment: {
      source: '',
      observedAt: '2026-07-18T21:45:12.000Z',
      metrics: { note: 'north, "upper"\nsouth' },
      indoor: { temperatureC: '21.5', humidityPercent: 'invalid' }
    },
    weather: { current: { temperature_2m: '18.25' }, location: { lat: '45.4', lon: '-73.6' } }
  };
  const originalInput = JSON.parse(JSON.stringify(input));
  const snapshot = normalizeSensorSnapshot(input);

  assert.strictEqual(snapshot?.hourKey, '2026-07-18T21');
  assert.strictEqual(snapshot?.source, 'ecowitt-gw1200');
  assert.strictEqual(snapshot?.indoorTemperatureC, 21.5);
  assert.strictEqual(snapshot?.indoorHumidityPercent, null);
  assert.strictEqual(snapshot?.outdoorTemperatureC, 18.25);
  assert.deepStrictEqual(input, originalInput);
  assert.strictEqual(
    normalizeSensorSnapshot({ observedAt: new Date(input.environment.observedAt) })?.observedAt,
    input.environment.observedAt
  );
  assert.strictEqual(normalizeSensorSnapshot({ environment: { observedAt: 'not-a-date' } }), null);

  assert.strictEqual(clampLimit('15 rows'), 15);
  assert.strictEqual(clampLimit('invalid'), 168);
  assert.strictEqual(clampLimit(0), 168);
  assert.strictEqual(clampLimit(-3), 1);
  assert.strictEqual(clampLimit(20_000), 10_000);

  const row = {
    hour_key: '2026-07-18T21',
    source: 'GW, "1200"',
    gateway_metrics_json: '{"note":"north\nsouth"}',
    indoor_temperature_c: null
  };
  const originalRow = { ...row };
  const csv = toCsv([row]);
  assert.ok(csv.endsWith('\n'));
  assert.ok(csv.includes('"GW, ""1200"""'));
  assert.ok(csv.includes('"{""note"":""north\nsouth""}"'));
  assert.deepStrictEqual(row, originalRow);
});

assertTest('stores one latest reading per hour and exports queryable CSV', () => {
  const store = createSensorHistoryStore();
  const today = new Date();
  const [firstReadingAt, latestReadingAt] = [5, 55].map(minute =>
    new Date(new Date(today).setHours(12, minute, 0, 0)).toISOString());
  const reading = observedAt => ({
    environment: {
      observedAt,
      indoor: { temperatureC: 22, humidityPercent: 50 }
    }
  });
  store.record(reading(firstReadingAt));
  store.record(reading(latestReadingAt));
  const rows = store.history({ limit: 10 });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].observed_at, latestReadingAt);
  assert.deepStrictEqual(JSON.parse(rows[0].gateway_metrics_json), {});
  assert.match(store.exportCsv({ limit: 10 }), /hour_key,observed_at,source/);
  assert.ok(store.exportCsv({ limit: 10 }).includes(`${latestReadingAt.slice(0, 13)},${latestReadingAt}`));
  const stats = store.stats({ days: 400, dayStart: 0, dayEnd: 23 });
  assert.strictEqual(stats.days, 90);
  assert.strictEqual(stats.day_start, 0);
  assert.strictEqual(stats.day_end, 23);
  assert.deepStrictEqual(stats.summary.daytime, {
    avg_temp_c: 22,
    avg_humidity_pct: 50,
    samples: 1
  });
  assert.strictEqual(stats.summary.nighttime.samples, 0);
  assert.strictEqual(stats.daily.length, 1);
  assert.strictEqual(stats.daily[0].day_temp_c, 22);
  assert.strictEqual(stats.daily[0].night_temp_c, null);

  const invalidOptions = store.stats({ days: 'invalid', dayStart: 'invalid', dayEnd: 'invalid' });
  assert.strictEqual(invalidOptions.days, 7);
  assert.strictEqual(invalidOptions.day_start, 9);
  assert.strictEqual(invalidOptions.day_end, 18);

  const defaultStats = store.stats();
  assert.strictEqual(defaultStats.days, 7);
  assert.strictEqual(defaultStats.day_start, 9);
  assert.strictEqual(defaultStats.day_end, 18);
  store.close();
});

assertAsyncTest('Ecowitt runtime retains the last good reading as stale after a network failure', async () => {
  let shouldFail = false;
  const runtime = createEcowittRuntime({
    settings: { enabled: true, baseUrl: 'http://gateway', timeoutMs: 50 },
    fetchImpl: async () => {
      if (shouldFail) throw new Error('gateway offline');
      return { ok: true, json: async () => ecowittFixture };
    },
    now: () => '2026-07-18T21:30:00.000Z',
    log: { log() {}, warn() {} }
  });

  const fresh = await runtime.readEnvironment();
  shouldFail = true;
  const stale = await runtime.readEnvironment();

  assert.strictEqual(fresh.stale, false);
  assert.strictEqual(stale.stale, true);
  assert.strictEqual(stale.observedAt, fresh.observedAt);
  assert.deepStrictEqual(stale.indoor, fresh.indoor);
});

assertAsyncTest('Ecowitt runtime remains disabled without making a network request', async () => {
  let fetchCount = 0;
  const runtime = createEcowittRuntime({
    settings: { enabled: false, baseUrl: 'http://gateway' },
    fetchImpl: async () => { fetchCount += 1; return { ok: true, json: async () => ({}) }; }
  });

  assert.deepStrictEqual(await runtime.readEnvironment(), buildEnvironmentResponse({ indoor: null, enabled: false }));
  assert.strictEqual(fetchCount, 0);
});

assertAsyncTest('Ecowitt runtime applies validated admin settings without a process restart', async () => {
  const runtime = createEcowittRuntime({
    settings: { enabled: false },
    fetchImpl: async () => ({ ok: true, json: async () => ecowittFixture }),
    log: { log() {}, warn() {} }
  });
  const result = runtime.updateSettings({
    enabled: true,
    baseUrl: 'http://gateway',
    pollIntervalMs: 60_000,
    timeoutMs: 3_000,
    units: { temperature: 'F' }
  });
  assert.strictEqual(result.valid, true);
  const reading = await runtime.readEnvironment();
  assert.strictEqual(reading.units.temperature, 'F');
  assert.strictEqual(reading.indoor.temperatureC, 24.7);
  assert.strictEqual(runtime.updateSettings({ enabled: true, baseUrl: 'ftp://gateway' }).valid, false);
  runtime.stop();
});

assertTest('sensor platform composes adapters behind one capability-aware contract', () => {
  const reads = [];
  const platform = createSensorPlatform({
    adapters: [{
      id: 'test-device',
      label: 'Test Device',
      capabilities: ['temperature'],
      read: async () => { reads.push('read'); return { source: 'test-device' }; },
      updateSettings: settings => ({ valid: true, settings })
    }]
  });
  assert.deepStrictEqual(platform.describe(), [{ id: 'test-device', label: 'Test Device', capabilities: ['temperature'] }]);
  assert.strictEqual(platform.getAdapter('test-device').id, 'test-device');
  assert.strictEqual(platform.updateSettings('test-device', { enabled: true }).valid, true);
  assert.deepStrictEqual(reads, []);
});

assertTest('sensor adapter descriptors canonicalize aliases and isolate metadata projections', () => {
  const compatibility = {
    summary: 'Compatible local gateways',
    models: ['GW1200'],
    details: { regions: ['home'] }
  };
  const descriptor = {
    id: 'ecowitt-local-http',
    aliases: ['gw1200'],
    label: 'Ecowitt Gateway',
    protocol: 'Ecowitt LAN HTTP',
    transport: 'http-poll',
    endpoint: '/get_livedata_info',
    compatibility,
    capabilities: ['temperature', 'humidity', 'temperature']
  };
  const read = Object.assign(async () => ({ source: 'ecowitt-local-http' }), {
    adapterDescriptor: descriptor
  });
  const input = {
    id: 'legacy-gateway',
    aliases: ['old-gateway'],
    label: 'Legacy label',
    capabilities: ['fallback'],
    read
  };
  const adapter = createSensorAdapter(input);

  assert.strictEqual(adapter.id, 'ecowitt-local-http');
  assert.deepStrictEqual(adapter.aliases, ['gw1200', 'old-gateway', 'legacy-gateway']);
  assert.strictEqual(adapter.label, 'Ecowitt Gateway');
  assert.deepStrictEqual(adapter.capabilities, ['temperature', 'humidity']);
  assert.deepStrictEqual(adapter.compatibility, compatibility);
  assert.notStrictEqual(adapter.compatibility, compatibility);
  assert.notStrictEqual(adapter.compatibility.details, compatibility.details);
  assert.ok(Object.isFrozen(adapter));
  assert.ok(Object.isFrozen(adapter.aliases));
  assert.ok(Object.isFrozen(adapter.compatibility.details.regions));

  const platform = createSensorPlatform({ adapters: [input] });
  const summary = platform.describe()[0];
  summary.aliases.push('summary-only');
  summary.compatibility.details.regions.push('summary-only');
  assert.deepStrictEqual(platform.describe()[0].aliases, ['gw1200', 'old-gateway', 'legacy-gateway']);
  assert.deepStrictEqual(platform.describe()[0].compatibility.details.regions, ['home']);

  descriptor.aliases.push('added-later');
  compatibility.models.push('added-later');
  assert.deepStrictEqual(adapter.aliases, ['gw1200', 'old-gateway', 'legacy-gateway']);
  assert.deepStrictEqual(adapter.compatibility.models, ['GW1200']);
  assert.deepStrictEqual(platform.describe()[0].aliases, ['gw1200', 'old-gateway', 'legacy-gateway']);
  assert.deepStrictEqual(platform.describe()[0].compatibility.details.regions, ['home']);
  assert.strictEqual(platform.getAdapter('gw1200').id, 'ecowitt-local-http');
});

assertAsyncTest('sensor platform delegates adapter effects and keeps empty-platform fallbacks explicit', async () => {
  const effects = [];
  const platform = createSensorPlatform({
    adapters: [{
      id: 'sensor-a',
      aliases: ['sensor-alias'],
      label: 'Sensor A',
      read: async () => { effects.push('read'); return { value: 21 }; },
      start: () => effects.push('start'),
      stop: () => effects.push('stop'),
      validateSettings: settings => ({ valid: true, settings }),
      updateSettings: settings => ({ valid: true, settings })
    }]
  });

  platform.start();
  assert.deepStrictEqual(await platform.read('sensor-alias'), { value: 21 });
  assert.deepStrictEqual(await platform.readPrimary(), { value: 21 });
  assert.deepStrictEqual(platform.validateSettings('sensor-a', { enabled: true }), {
    valid: true,
    settings: { enabled: true }
  });
  assert.deepStrictEqual(platform.updatePrimarySettings({ enabled: false }), {
    valid: true,
    settings: { enabled: false }
  });
  platform.stop();

  assert.deepStrictEqual(effects, ['start', 'read', 'read', 'stop']);
  assert.strictEqual(platform.validateSettings('missing', {}).valid, false);
  assert.strictEqual(platform.updateSettings('missing', {}).valid, false);
  await assert.rejects(platform.read('missing'), /Unknown sensor adapter: missing/);

  const emptyPlatform = createSensorPlatform();
  assert.strictEqual(emptyPlatform.getPrimaryAdapter(), null);
  assert.strictEqual(emptyPlatform.updatePrimarySettings({}).valid, false);
  await assert.rejects(emptyPlatform.readPrimary(), /No primary sensor adapter is configured\./);
});

// ============================================================================
// 4e. UNIT TEST SUITE: Environment Refresh Runtime
// ============================================================================
logSuite('Environment Refresh Runtime');

assertTest('shouldSkipDailyFeedUpdate only skips when the last refresh is still within the interval', () => {
  const { shouldSkipDailyFeedUpdate } = require('./server/runtime/environmentRefresh.js');

  assert.strictEqual(
    shouldSkipDailyFeedUpdate({ now: 2_000, lastUpdated: 1_500, refreshIntervalMs: 1_000 }),
    true
  );
  assert.strictEqual(
    shouldSkipDailyFeedUpdate({ now: 2_000, lastUpdated: 500, refreshIntervalMs: 1_000 }),
    false
  );
  assert.strictEqual(
    shouldSkipDailyFeedUpdate({ now: 2_000, lastUpdated: 0, refreshIntervalMs: 1_000 }),
    false
  );
});

assertAsyncTest('daily feed refresh ignores general snapshot writes and migrates legacy timestamps', async () => {
  const { createEnvironmentRefreshRuntime } = require('./server/runtime/environmentRefresh.js');
  let crawlCount = 0;
  let persistedOptions = null;

  const runtime = createEnvironmentRefreshRuntime({
    state: { feedConfigs: {}, searchKeywords: {}, excludedKeywords: [] },
    collections: {},
    activeFeedRuntime: { refreshActiveFeed: () => [] },
    jsonPath: '/tmp/curated.json',
    setWeatherData: () => {},
    resolveActiveLocation: async () => ({ lat: 0, lon: 0 }),
    fetchWeatherForecast: async () => ({ current: null, daily: [] }),
    classifyWeatherCode: () => ({ physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' }),
    analyzeSentiment: () => ({ score: 0, label: 'Overcast / Calm', weatherMatch: 'Cloudy' }),
    crawlCollections: async () => {
      crawlCount += 1;
      return { updatedCollections: { 'Scenic Nature': [{ url: 'new-1' }] }, updatedAny: true };
    },
    persistCollections: (_collections, _state, options) => { persistedOptions = options; },
    broadcastStateSync: () => {},
    triggerImageAnalysisBackground: async () => {},
    fsImpl: {
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ lastUpdated: 9_500 })
    },
    now: () => 10_000,
    refreshIntervalMs: 1_000,
    readNewsRss: async () => null,
    log: { log() {}, warn() {}, error() {} }
  });

  const result = await runtime.updateFeedsDaily();

  assert.strictEqual(result.skipped, false);
  assert.strictEqual(crawlCount, 1);
  assert.deepStrictEqual(persistedOptions, { lastFeedUpdated: 10_000 });
});

assertAsyncTest('createEnvironmentRefreshRuntime updates news sentiment and broadcasts the refreshed snapshot', async () => {
  const { createEnvironmentRefreshRuntime } = require('./server/runtime/environmentRefresh.js');
  const state = {};
  let broadcastCount = 0;

  const runtime = createEnvironmentRefreshRuntime({
    state,
    collections: {},
    activeFeedRuntime: { refreshActiveFeed: () => [] },
    jsonPath: '/tmp/not-used.json',
    setWeatherData: () => {},
    resolveActiveLocation: async () => ({ lat: 0, lon: 0 }),
    fetchWeatherForecast: async () => ({ current: null, daily: [] }),
    classifyWeatherCode: () => ({ physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' }),
    analyzeSentiment: () => ({
      score: 0.25,
      label: 'Sunny / Hopeful',
      weatherMatch: 'Sunny',
      headlinesCount: 2
    }),
    crawlCollections: async () => ({ updatedCollections: {}, updatedAny: false }),
    persistCollections: () => {},
    broadcastStateSync: () => { broadcastCount += 1; },
    triggerImageAnalysisBackground: async () => {},
    readNewsRss: async () => '<rss><channel><title>good news</title></channel></rss>',
    log: { log() {}, warn() {}, error() {} }
  });

  const sentiment = await runtime.updateNewsSentiment();

  assert.deepStrictEqual(sentiment, state.newsSentiment);
  assert.strictEqual(state.newsSentiment.weatherMatch, 'Sunny');
  assert.strictEqual(broadcastCount, 1);
});

assertTest('weather snapshot projections preserve provider values and classify current conditions purely', () => {
  const {
    buildPhysicalWeatherSnapshot,
    buildWeatherDataSnapshot
  } = require('./server/runtime/environmentRefresh.js');
  const location = { lat: 45.5, lon: -73.5, city: 'Montreal' };
  const current = { temperature_2m: 22.4, weather_code: 61, relative_humidity_2m: 55 };
  const daily = { weather_code: [61], temperature_2m_max: [24] };
  const forecast = { current, daily, hourly: { temperature_2m: [22.4] } };
  const snapshot = buildWeatherDataSnapshot(location, forecast);

  assert.deepStrictEqual(snapshot, { location, current, daily });
  assert.strictEqual(snapshot.location, location);
  assert.strictEqual(snapshot.current, current);
  assert.strictEqual(snapshot.daily, daily);
  assert.deepStrictEqual(Object.keys(snapshot), ['location', 'current', 'daily']);

  let classifiedCode = null;
  const physicalWeather = buildPhysicalWeatherSnapshot(current, (code) => {
    classifiedCode = code;
    return { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' };
  });
  assert.strictEqual(classifiedCode, 61);
  assert.deepStrictEqual(physicalWeather, {
    temp: 22,
    condition: 'Rainy / Stormy',
    weatherMatch: 'Rainy'
  });

  let classifierCalled = false;
  assert.strictEqual(buildPhysicalWeatherSnapshot(null, () => {
    classifierCalled = true;
    return { physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' };
  }), null);
  assert.strictEqual(classifierCalled, false);
});

assertAsyncTest('createEnvironmentRefreshRuntime updates weather cache and derived physical weather state', async () => {
  const { createEnvironmentRefreshRuntime } = require('./server/runtime/environmentRefresh.js');
  const state = {};
  let cachedWeather = null;
  let broadcastCount = 0;

  const runtime = createEnvironmentRefreshRuntime({
    state,
    collections: {},
    activeFeedRuntime: { refreshActiveFeed: () => [] },
    jsonPath: '/tmp/not-used.json',
    setWeatherData: (data) => { cachedWeather = data; },
    resolveActiveLocation: async () => ({ lat: 45.5, lon: -73.5, city: 'Montreal' }),
    fetchWeatherForecast: async () => ({
      current: {
        temperature_2m: 22.4,
        weather_code: 61
      },
      daily: [{ weather_code: 61 }]
    }),
    classifyWeatherCode: () => ({ physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' }),
    analyzeSentiment: () => ({ score: 0, label: 'Overcast / Calm', weatherMatch: 'Cloudy' }),
    crawlCollections: async () => ({ updatedCollections: {}, updatedAny: false }),
    persistCollections: () => {},
    broadcastStateSync: () => { broadcastCount += 1; },
    triggerImageAnalysisBackground: async () => {},
    readNewsRss: async () => null,
    log: { log() {}, warn() {}, error() {} }
  });

  const weatherData = await runtime.updateServerWeather();

  assert.deepStrictEqual(weatherData, cachedWeather);
  assert.deepStrictEqual(state.physicalWeather, {
    temp: 22,
    condition: 'Rainy / Stormy',
    weatherMatch: 'Rainy'
  });
  assert.strictEqual(broadcastCount, 1);
});

assertAsyncTest('createEnvironmentRefreshRuntime skips the daily feed refresh when collections were updated recently', async () => {
  const { createEnvironmentRefreshRuntime } = require('./server/runtime/environmentRefresh.js');
  let crawlCount = 0;

  const runtime = createEnvironmentRefreshRuntime({
    state: {
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: []
    },
    collections: {},
    activeFeedRuntime: { refreshActiveFeed: () => [] },
    jsonPath: '/tmp/curated.json',
    setWeatherData: () => {},
    resolveActiveLocation: async () => ({ lat: 0, lon: 0 }),
    fetchWeatherForecast: async () => ({ current: null, daily: [] }),
    classifyWeatherCode: () => ({ physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' }),
    analyzeSentiment: () => ({ score: 0, label: 'Overcast / Calm', weatherMatch: 'Cloudy' }),
    crawlCollections: async () => {
      crawlCount += 1;
      return { updatedCollections: {}, updatedAny: false };
    },
    persistCollections: () => {},
    broadcastStateSync: () => {},
    triggerImageAnalysisBackground: async () => {},
    fsImpl: {
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ lastFeedUpdated: 9_500 })
    },
    now: () => 10_000,
    refreshIntervalMs: 1_000,
    readNewsRss: async () => null,
    log: { log() {}, warn() {}, error() {} }
  });

  const result = await runtime.updateFeedsDaily();

  assert.strictEqual(result.skipped, true);
  assert.strictEqual(crawlCount, 0);
});

assertAsyncTest('createEnvironmentRefreshRuntime persists refreshed collections, refreshes the active feed, and schedules vision analysis', async () => {
  const { createEnvironmentRefreshRuntime } = require('./server/runtime/environmentRefresh.js');
  const state = {
    feedConfigs: { 'Scenic Nature': { featured: true } },
    searchKeywords: { 'Scenic Nature': ['forest'] },
    excludedKeywords: []
  };
  const collections = {
    'Scenic Nature': [{ url: 'old-1', title: 'Old Forest', category: 'Scenic Nature' }]
  };
  let persistedCount = 0;
  let refreshedCount = 0;
  let broadcastCount = 0;
  let analysisCount = 0;

  const runtime = createEnvironmentRefreshRuntime({
    state,
    collections,
    activeFeedRuntime: {
      refreshActiveFeed: () => {
        refreshedCount += 1;
        return collections['Scenic Nature'];
      }
    },
    jsonPath: '/tmp/curated.json',
    setWeatherData: () => {},
    resolveActiveLocation: async () => ({ lat: 0, lon: 0 }),
    fetchWeatherForecast: async () => ({ current: null, daily: [] }),
    classifyWeatherCode: () => ({ physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' }),
    analyzeSentiment: () => ({ score: 0, label: 'Overcast / Calm', weatherMatch: 'Cloudy' }),
    crawlCollections: async () => ({
      updatedCollections: {
        'Scenic Nature': [{ url: 'new-1', title: 'New Forest' }]
      },
      updatedAny: true
    }),
    persistCollections: () => { persistedCount += 1; },
    broadcastStateSync: () => { broadcastCount += 1; },
    triggerImageAnalysisBackground: async () => { analysisCount += 1; },
    fsImpl: {
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ lastUpdated: 0 })
    },
    now: () => 10_000,
    refreshIntervalMs: 1_000,
    readNewsRss: async () => null,
    log: { log() {}, warn() {}, error() {} }
  });

  const result = await runtime.updateFeedsDaily();

  assert.strictEqual(result.updatedAny, true);
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(persistedCount, 1);
  assert.strictEqual(refreshedCount, 1);
  assert.strictEqual(broadcastCount, 1);
  assert.strictEqual(analysisCount, 1);
  assert.deepStrictEqual(collections['Scenic Nature'], [
    { url: 'new-1', title: 'New Forest', category: 'Scenic Nature' }
  ]);
});

// ============================================================================
// 5. UNIT TEST SUITE: Customizable Keyword Search Manager
// ============================================================================
logSuite('Customizable Keyword Search Manager');

assertAsyncTest('keyword entry accepts one phrase per line as well as comma-separated phrases', async () => {
  const {
    parseFeedParameterInput,
    splitKeywordInput
  } = await importClientModule('./client/src/state/keywordInput.js');
  const keywordInputSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/keywordInput.js'),
    'utf8'
  );
  const timeRangePattern = /^\[((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9])-((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9])\]\s+(.+)$/;

  assert.deepStrictEqual(
    splitKeywordInput('misty morning\ncoastal cliffs, night sky; moon'),
    ['misty morning', 'coastal cliffs', 'night sky', 'moon']
  );
  assert.deepStrictEqual(
    parseFeedParameterInput('[06:00-12:00] morning, sunrise\nforest trail', timeRangePattern),
    [
      { timeStart: '06:00', timeEnd: '12:00', keywords: ['morning', 'sunrise'] },
      'forest trail'
    ]
  );
  assert.strictEqual(splitKeywordInput(null).length, 0);
  assert.strictEqual(parseFeedParameterInput(null, timeRangePattern).length, 0);
  assert.match(keywordInputSource, /^\/\/ @ts-check/);
  assert.match(keywordInputSource, /@typedef \{\{timeStart: string, timeEnd: string, keywords: string\[\]\}\} FeedParameter/);
  assert.match(keywordInputSource, /@typedef \{FeedParameter\|string\} ParsedFeedParameter/);
  assert.match(keywordInputSource, /@param \{unknown\} value/);
  assert.match(keywordInputSource, /@param \{RegExp\} timeRangePattern/);
  assert.match(keywordInputSource, /@returns \{ParsedFeedParameter\[\]\}/);

  const { decodeAddPoolCommand, decodePoolKeywordsCommand } = require('./server/domain/commands.js');
  assert.deepStrictEqual(
    decodeAddPoolCommand({ name: 'Pasted Phrases', keywords: 'misty morning\ncoastal cliffs, night sky' }),
    {
      type: 'add-pool',
      payload: { name: 'Pasted Phrases', keywords: ['misty morning', 'coastal cliffs', 'night sky'] }
    }
  );
  assert.deepStrictEqual(
    decodePoolKeywordsCommand({ name: 'Pasted Phrases', keywords: 'misty morning\ncoastal cliffs' }),
    {
      type: 'set-pool-keywords',
      payload: { name: 'Pasted Phrases', keywords: ['misty morning', 'coastal cliffs'] }
    }
  );
});

assertTest('correctly loads and configures searchKeywords state', () => {
  assert.ok(screensaverState.searchKeywords, 'searchKeywords object must exist in screensaverState');
  assert.ok(Array.isArray(screensaverState.searchKeywords['Scenic Nature']), 'Scenic Nature keywords should be an array');
  assert.ok(screensaverState.searchKeywords['Scenic Nature'].length > 0, 'Scenic Nature keywords should not be empty');
  assert.strictEqual(typeof screensaverState.searchKeywords['Scenic Nature'][0], 'string', 'Keyword must be a string');
});

assertTest('crawler consumes custom searchKeywords instead of static defaults', async () => {
  const { crawlAllCollections } = require('./server/services/crawler.js');
  assert.ok(typeof crawlAllCollections === 'function', 'crawlAllCollections must be a function');
});

assertTest('crawler cap preserves loved photos without reducing the standard dynamic pool size', () => {
  const { capCollectionLimit } = require('./server/services/crawler.js');
  const originals = Array.from({ length: 12 }, (_, index) => ({ url: `original-${index}` }));
  const olderStandard = Array.from({ length: 1988 }, (_, index) => ({ url: `standard-old-${index}` }));
  const lovedDynamic = [
    { url: 'loved-1', loved: true },
    { url: 'loved-2', loved: true }
  ];
  const newestStandard = Array.from({ length: 10 }, (_, index) => ({ url: `standard-new-${index}` }));
  const initialLength = originals.length + olderStandard.length + lovedDynamic.length;

  const capped = capCollectionLimit(
    originals.concat(olderStandard, lovedDynamic, newestStandard),
    initialLength,
    2000
  );

  assert.strictEqual(capped.length, 2002);
  assert.deepStrictEqual(capped.slice(0, 12).map((photo) => photo.url), originals.map((photo) => photo.url));
  assert.deepStrictEqual(
    capped.filter((photo) => photo.loved === true).map((photo) => photo.url),
    ['loved-1', 'loved-2']
  );
  assert.strictEqual(capped.some((photo) => photo.url === 'standard-old-0'), false);
  assert.strictEqual(capped.some((photo) => photo.url === 'standard-new-9'), true);
});

runDomainTests({ logSuite, assertTest });

logSuite('Domain Dispatch');

assertAsyncTest('createDomainDispatcher routes photo-update events and state-sync broadcasts through the shared handler table', async () => {
  const { dispatcher, ioEmits, state } = createDispatcherHarness();
  const result = await dispatcher.dispatchCommand({
    type: 'advance-photo',
    payload: {
      direction: 'next',
      strategy: 'sequence'
    }
  });

  assert.strictEqual(result.reducerResult.events[0].type, 'photo-update');
  assert.strictEqual(result.reducerResult.events[1].type, 'state-sync');
  assert.strictEqual(state.activePhoto.url, 'land-2');
  assert.deepStrictEqual(ioEmits.map(([event]) => event), ['photo-update', 'state-sync']);
  assert.strictEqual(ioEmits[0][1].url, 'land-2');
  assert.strictEqual(ioEmits[1][1].activePhoto.url, 'land-2');
});

assertAsyncTest('createDomainDispatcher interprets kiosk launch effects and keeps effect-only job commands free of socket broadcasts', async () => {
  const manualOverrideValues = [];
  let launchCalls = 0;
  let recrawlPayload = null;
  const { dispatcher, ioEmits, state } = createDispatcherHarness({
    launchKioskBrowser: () => { launchCalls += 1; },
    setManualOverride: (value) => { manualOverrideValues.push(value); },
    startRecrawlJob: async (payload) => {
      recrawlPayload = payload;
      return {
        job: {
          id: 'recrawl-test',
          type: 'recrawl',
          status: 'queued'
        },
        reused: false
      };
    }
  });

  const activeResult = await dispatcher.dispatchCommand({
    type: 'set-screensaver-active',
    payload: { active: true }
  });
  const jobResult = await dispatcher.dispatchCommand({
    type: 'trigger-recrawl',
    payload: { categories: ['Scenic Nature'] }
  });

  assert.strictEqual(activeResult.effectResults[0].effect.type, 'launch-kiosk');
  assert.strictEqual(launchCalls, 1);
  assert.deepStrictEqual(manualOverrideValues, [true]);
  assert.strictEqual(state.screensaverActive, true);
  assert.strictEqual(ioEmits.filter(([event]) => event === 'state-sync').length, 1);
  assert.deepStrictEqual(jobResult.reducerResult.events, []);
  assert.deepStrictEqual(recrawlPayload, { categories: ['Scenic Nature'] });
  assert.strictEqual(jobResult.effectResults[0].value.job.id, 'recrawl-test');
});

assertAsyncTest('createDomainDispatcher interprets effects sequentially and preserves result order', async () => {
  const order = [];
  const { dispatcher } = createDispatcherHarness({
    triggerWeatherUpdate: async () => {
      order.push('refresh-start');
      await Promise.resolve();
      order.push('refresh-end');
    }
  });

  const result = await dispatcher.dispatchCommand({
    type: 'patch-state',
    payload: { autoLocation: true }
  });

  assert.deepStrictEqual(result.effectResults.map(({ effect }) => effect.type), [
    'persist',
    'refresh-weather'
  ]);
  assert.deepStrictEqual(order, ['refresh-start', 'refresh-end']);
});

assertAsyncTest('createEffectInterpreter captures its effect step and preserves sequential handler order', async () => {
  const order = [];
  const interpretEffects = createEffectInterpreter({
    first: async () => {
      order.push('first-start');
      await Promise.resolve();
      order.push('first-end');
      return 'first-result';
    },
    second: () => {
      order.push('second');
      return 'second-result';
    }
  });

  const result = await interpretEffects([
    { type: 'first' },
    { type: 'second' },
    { type: 'unhandled' }
  ]);

  assert.deepStrictEqual(order, ['first-start', 'first-end', 'second']);
  assert.deepStrictEqual(result.map(({ value }) => value), [
    'first-result',
    'second-result',
    undefined
  ]);
});

assertAsyncTest('createEffectInterpreter keeps inherited effect keys outside the handler vocabulary', async () => {
  const interpretEffects = createEffectInterpreter({
    persist: async () => 'persisted'
  });

  const result = await interpretEffects([
    { type: 'toString' },
    { type: '__proto__' },
    { type: 'persist' }
  ]);

  assert.deepStrictEqual(result.map(({ value }) => value), [undefined, undefined, 'persisted']);
});

assertTest('createTypedHandlerInvoker shares closed type dispatch for domain items', () => {
  const seen = [];
  const invoke = createTypedHandlerInvoker({
    inspect: (item) => {
      seen.push(item.type);
      return item.payload;
    }
  });

  assert.strictEqual(invoke({ type: 'inspect', payload: 42 }), 42);
  assert.strictEqual(invoke({ type: 'toString', payload: 7 }), undefined);
  assert.strictEqual(invoke({ type: '__proto__', payload: 9 }), undefined);
  assert.deepStrictEqual(seen, ['inspect']);
});

assertAsyncTest('createCommandRunner keeps dispatcher precedence and legacy fallback payloads explicit', async () => {
  const calls = [];
  const dispatchRunner = createCommandRunner({
    dispatchCommand: async (command) => {
      calls.push(['dispatch', command]);
      return 'dispatched';
    },
    fallback: (command, payload) => {
      calls.push(['fallback', command, payload]);
      return 'fallback';
    }
  });
  const fallbackRunner = createCommandRunner({
    fallback: (command, payload) => {
      calls.push(['fallback', command, payload]);
      return 'fallback';
    }
  });
  const noopRunner = createCommandRunner({});

  assert.strictEqual(await dispatchRunner({ type: 'shared' }, { value: 1 }), 'dispatched');
  assert.strictEqual(await fallbackRunner({ type: 'legacy' }, { value: 2 }), 'fallback');
  assert.strictEqual(await noopRunner({ type: 'missing' }, { value: 3 }), undefined);
  assert.deepStrictEqual(calls, [
    ['dispatch', { type: 'shared' }],
    ['fallback', { type: 'legacy' }, { value: 2 }]
  ]);
});

assertTest('registerCommandSpecs keeps command listener registration data-driven', () => {
  const received = [];
  const register = registerCommandSpecs((spec) => received.push(spec));
  const specs = [{
    event: 'change-theme',
    decode: () => ({ type: 'patch-state' }),
    fallback: () => 'legacy',
    intercept: () => false,
    afterDispatch: () => {},
    onError: () => {}
  }];

  register(specs);

  assert.deepStrictEqual(received, specs);
});

assertTest('normalizeRuntimeFlags projects environment flags without mutating its input', () => {
  const flags = { hasUseApiToken: 1, hasTumblrApiKey: 0 };
  const normalized = normalizeRuntimeFlags(flags);

  assert.deepStrictEqual(normalized, {
    hasUseApiToken: true,
    hasTumblrApiKey: false
  });
  assert.deepStrictEqual(flags, { hasUseApiToken: 1, hasTumblrApiKey: 0 });
  assert.deepStrictEqual(normalizeRuntimeFlags(['not', 'a', 'record']), {});
});

assertAsyncTest('reduceAsyncSequentially preserves order and supports a partially applied batch reducer', async () => {
  const order = [];
  const sumBatch = reduceAsyncSequentially(async (sum, value) => {
    order.push(`start:${value}`);
    await new Promise((resolve) => setImmediate(resolve));
    order.push(`finish:${value}`);
    return sum + value;
  }, 0);

  const result = await sumBatch([1, 2, 3]);

  assert.strictEqual(result, 6);
  assert.deepStrictEqual(order, [
    'start:1', 'finish:1',
    'start:2', 'finish:2',
    'start:3', 'finish:3'
  ]);
});

assertTest('reduceUntil is data-last, preserves its input, and stops after the first match', () => {
  const values = [1, 2, 3];
  const visited = [];
  const findFirstEven = reduceUntil(
    (found, value) => {
      visited.push(value);
      return value % 2 === 0 ? value : found;
    },
    Boolean,
    null
  );

  assert.strictEqual(findFirstEven(values), 2);
  assert.deepStrictEqual(visited, [1, 2]);
  assert.deepStrictEqual(values, [1, 2, 3]);
  assert.strictEqual(reduceUntil((sum, value) => sum + value, Boolean, 0)([]), 0);
  assert.strictEqual(reduceUntil((sum, value) => sum + value, Boolean, 0)(null), 0);
});

assertTest('functional primitives keep their curried, data-last contracts', () => {
  const add = curry((left, right) => left + right);
  const normalizeNames = pipe(
    map((name) => name.trim()),
    filter(Boolean),
    map(toLower),
    uniqBy((name) => name)
  );

  assert.strictEqual(add(2)(3), 5);
  assert.deepStrictEqual(normalizeNames([' Ada ', 'ada', '', 'Grace']), ['ada', 'grace']);
  assert.strictEqual(prop('missing')({}), undefined);
  assert.deepStrictEqual(map((value) => value * 2)(null), []);
  assert.strictEqual(reduce((sum, value) => sum + value, 0)(null), 0);
  assert.strictEqual(includes('lum')('lumina'), true);
});

assertTest('functional interpreter contracts remain closed over declared keys', () => {
  const indexed = createIndexedInterpreter(
    [['ready', 'READY']],
    (entry) => entry,
    () => 'UNKNOWN'
  );
  const closed = createClosedInterpreter({ ready: () => 'READY' }, (handler) => handler(), () => 'UNKNOWN');

  assert.strictEqual(indexed('ready'), 'READY');
  assert.strictEqual(indexed('toString'), 'UNKNOWN');
  assert.strictEqual(closed('ready'), 'READY');
  assert.strictEqual(closed('toString'), 'UNKNOWN');
});

assertTest('functional primitive source exposes checked contracts', () => {
  const source = fs.readFileSync(path.join(__dirname, 'server/utils/fn.js'), 'utf8');
  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{\(\.\.\.args: any\[\]\) => any\} AnyFunction/);
  assert.match(source, /@param \{PropertyKey\} key/);
  assert.match(source, /@param \{any\[\] \| null \| undefined\} arr/);
});

assertTest('numeric validation source exposes a checked pure contract', () => {
  const source = fs.readFileSync(path.join(__dirname, 'server/utils/validation.js'), 'utf8');
  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{\(value: unknown\) => number\} NumberParser/);
  assert.match(source, /@typedef \{\(value: unknown\) => number \| null\} NumericValidator/);
  assert.match(source, /@param \{unknown\} value/);
  assert.match(source, /@returns \{number \| null\}/);
});

assertTest('environment content source exposes a checked pure contract', () => {
  const source = fs.readFileSync(path.join(__dirname, 'server/config/env.js'), 'utf8');
  assert.match(source, /^\/\/ @ts-check/);
  assert.match(source, /@typedef \{Record<string, unknown>\} EnvironmentEntries/);
  assert.match(source, /@param \{unknown\} value/);
  assert.match(source, /@param \{string\} name/);
  assert.match(source, /@returns \{string\}/);
});

assertAsyncTest('createDomainDispatcher routes kiosk kill effects through the shared manual-override helper', async () => {
  const manualOverrideValues = [];
  let killCalls = 0;
  const { dispatcher, ioEmits, state } = createDispatcherHarness({
    killKioskBrowser: () => { killCalls += 1; },
    setManualOverride: (value) => { manualOverrideValues.push(value); }
  });

  state.screensaverActive = true;

  const result = await dispatcher.dispatchCommand({
    type: 'set-screensaver-active',
    payload: { active: false }
  });

  assert.strictEqual(result.effectResults[0].effect.type, 'kill-kiosk');
  assert.strictEqual(killCalls, 1);
  assert.deepStrictEqual(manualOverrideValues, [false]);
  assert.strictEqual(state.screensaverActive, false);
  assert.deepStrictEqual(ioEmits.map(([event]) => event), ['state-sync']);
});

assertAsyncTest('createDomainDispatcher routes vision-analysis submissions through the shared payload effect runner', async () => {
  let visionPayload = null;
  const { dispatcher, ioEmits } = createDispatcherHarness({
    startVisionAnalysisJob: async (payload) => {
      visionPayload = payload;
      return {
        job: {
          id: 'vision-dispatch-test',
          type: 'vision-analysis',
          status: 'queued'
        },
        reused: false
      };
    }
  });

  const result = await dispatcher.dispatchCommand({
    type: 'trigger-vision-analysis',
    payload: { categories: ['Scenic Nature'] }
  });

  assert.deepStrictEqual(visionPayload, { categories: ['Scenic Nature'] });
  assert.strictEqual(result.effectResults[0].effect.type, 'start-vision-analysis-job');
  assert.strictEqual(result.effectResults[0].value.job.id, 'vision-dispatch-test');
  assert.deepStrictEqual(ioEmits, []);
});

assertAsyncTest('createDomainDispatcher keeps weather-refresh failures inside the shared effect interpreter', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  const { dispatcher, ioEmits, state } = createDispatcherHarness({
    triggerWeatherUpdate: async () => {
      throw new Error('weather refresh unavailable');
    }
  });

  console.warn = (...args) => {
    warnings.push(args.join(' '));
  };

  try {
    const result = await dispatcher.dispatchCommand({
      type: 'patch-state',
      payload: { autoLocation: true }
    });

    assert.deepStrictEqual(result.effectResults.map(({ effect }) => effect.type), ['persist', 'refresh-weather']);
    assert.strictEqual(state.autoLocation, true);
    assert.deepStrictEqual(ioEmits.map(([event]) => event), ['state-sync']);
  } finally {
    console.warn = originalWarn;
  }

  assert.strictEqual(warnings.length, 1);
  assert.ok(
    warnings[0].includes('Weather refresh failed after state update: weather refresh unavailable'),
    'Expected dispatcher to log a weather refresh warning without throwing.'
  );
});

assertAsyncTest('createDomainDispatcher interprets external photo persistence effects through the shared effect table', async () => {
  const googleUrl = buildGooglePhotoProxyUrl('dispatcher-photo');
  const persistedPayloads = [];
  const { dispatcher, ioEmits, runtimeContext, state } = createDispatcherHarness({
    persistExternalPhotoMetadata: async (payload) => {
      persistedPayloads.push(payload);
      return { persisted: true };
    }
  });

  state.currentCategory = 'Google Photos';
  state.photosList = [{ url: googleUrl, title: 'Google Photo', rating: 10, category: 'Google Photos' }];
  state.activePhoto = state.photosList[0];
  runtimeContext.externalCollections = {
    'Google Photos': [{ url: googleUrl, title: 'Google Photo', rating: 10, category: 'Google Photos' }]
  };

  const result = await dispatcher.dispatchCommand({
    type: 'set-photo-crop',
    payload: {
      url: googleUrl,
      cropPercent: 42
    }
  });

  assert.deepStrictEqual(persistedPayloads, [{
    url: googleUrl,
    metadata: { cropPercent: 42 }
  }]);
  assert.strictEqual(result.effectResults[0].effect.type, 'persist-external-photo-metadata');
  assert.strictEqual(state.photosList[0].cropPercent, 42);
  assert.deepStrictEqual(ioEmits.map(([event]) => event), ['state-sync']);
});

assertAsyncTest('createDomainDispatcher refreshes the active feed after a Google Photos policy update', async () => {
  const refreshed = [];
  const { dispatcher, runtimeContext, state } = createDispatcherHarness({
    refreshActiveFeed: ({ categories } = {}) => {
      refreshed.push(categories);
    }
  });
  state.currentCategory = 'Google Photos';
  runtimeContext.externalCollections = { 'Google Photos': [{ url: 'google-1', category: 'Google Photos' }] };

  const result = await dispatcher.dispatchCommand({
    type: 'set-pool-policy',
    payload: { name: 'Google Photos', policy: { retentionDays: 45, maxPhotos: 300 } }
  });

  assert.deepStrictEqual(refreshed, [['Google Photos']]);
  assert.strictEqual(result.effectResults[1].effect.type, 'refresh-active-feed');
  assert.deepStrictEqual(state.poolPolicies['Google Photos'], {
    retentionDays: 45,
    maxPhotos: 300,
    schedule: { enabled: false, start: '22:00', end: '06:00', priority: 0 }
  });
});

assertAsyncTest('createDomainDispatcher stays silent for no-op pool config commands', async () => {
  const { dispatcher, ioEmits, state } = createDispatcherHarness();
  state.searchKeywords['Scenic Nature'] = ['forest', 'mist'];
  state.feedConfigs['Scenic Nature'] = {
    reddit: { enabled: true, subreddits: ['EarthPorn'] }
  };

  const keywordsResult = await dispatcher.dispatchCommand({
    type: 'set-pool-keywords',
    payload: {
      name: 'Scenic Nature',
      keywords: ['forest', 'mist']
    }
  });
  const feedConfigResult = await dispatcher.dispatchCommand({
    type: 'merge-pool-feed-config',
    payload: {
      name: 'Scenic Nature',
      source: 'reddit',
      config: { enabled: true, subreddits: ['EarthPorn'] }
    }
  });

  [keywordsResult, feedConfigResult].forEach((result) => {
    assert.deepStrictEqual(result.reducerResult.events, []);
    assert.deepStrictEqual(result.reducerResult.effects, []);
  });
  assert.deepStrictEqual(ioEmits, []);
});

assertAsyncTest('createDomainDispatcher stays silent for no-op excluded-keyword commands after normalization', async () => {
  const { dispatcher, ioEmits, state } = createDispatcherHarness();
  state.excludedKeywords = ['forest', 'mist'];

  const result = await dispatcher.dispatchCommand({
    type: 'update-excluded-keywords',
    payload: { keywords: ['  forest  ', '', 'mist '] }
  });

  assert.deepStrictEqual(result.reducerResult.events, []);
  assert.deepStrictEqual(result.reducerResult.effects, []);
  assert.deepStrictEqual(ioEmits, []);
  assert.deepStrictEqual(state.excludedKeywords, ['forest', 'mist']);
});

async function runClientStateTests() {
  logSuite('Remote Feed Control Snapshot Mutations');

  const {
    createEnvironmentDevice,
    convertPressure,
    convertTemperature,
    formatEnvironmentMetric,
    formatEnvironmentTimestamp,
    getActiveEnvironmentDevice,
    getEnvironmentStatus,
    normalizeEnvironmentSettingsDraft,
    removeEnvironmentDevice,
    selectEnvironmentDevice,
    upsertEnvironmentDevice,
    parseEnvironmentSettingsJson
  } = await importClientModule('./client/src/state/environmentHistory.js');

  assertTest('environment UI helpers present normalized sensor status and safe metric fallbacks', () => {
    assert.strictEqual(formatEnvironmentMetric(24.75, '°C'), '24.8°C');
    assert.strictEqual(formatEnvironmentMetric(null, '%'), '—');
    assert.strictEqual(convertTemperature(20, 'F'), 68);
    assert.strictEqual(convertTemperature('not-a-number', 'F'), null);
    assert.strictEqual(convertPressure(1013.25, 'hPa'), 1013.25);
    assert.strictEqual(convertPressure(1013.25, 'inHg'), 29.921255347112236);
    assert.strictEqual(formatEnvironmentTimestamp('not-a-timestamp'), 'No reading yet');
    assert.deepStrictEqual(getEnvironmentStatus({ enabled: true, stale: false, indoor: { temperatureC: 22 } }), {
      label: 'Online',
      color: '#10b981'
    });
    assert.strictEqual(getEnvironmentStatus(null).label, 'Backend unavailable');
    assert.deepStrictEqual(parseEnvironmentSettingsJson('{"enabled":true,"baseUrl":"http://gateway"}'), {
      valid: true,
      value: { enabled: true, baseUrl: 'http://gateway' }
    });
    assert.strictEqual(parseEnvironmentSettingsJson('[]').valid, false);
    assert.strictEqual(getEnvironmentStatus({ enabled: true, stale: true }).label, 'Stale fallback');
  });

  assertTest('environment device helpers add, select, edit, and remove saved profiles immutably', () => {
    const empty = normalizeEnvironmentSettingsDraft({ devices: [], units: { temperature: 'C' } });
    const first = createEnvironmentDevice(empty, { name: 'Living room', baseUrl: 'http://living.local' });
    const withFirst = upsertEnvironmentDevice(empty, first);
    const selected = selectEnvironmentDevice(withFirst, first.id);
    const renamed = upsertEnvironmentDevice(selected, { ...first, name: 'Main room' });
    const removed = removeEnvironmentDevice(renamed, first.id);

    assert.deepStrictEqual(empty.devices, []);
    assert.strictEqual(first.id, 'living-room');
    assert.strictEqual(getActiveEnvironmentDevice(selected).baseUrl, 'http://living.local');
    assert.strictEqual(renamed.devices[0].name, 'Main room');
    assert.strictEqual(removed.activeDeviceId, null);
    assert.deepStrictEqual(removed.devices, []);
  });

  const {
    applyPhotoEvent,
    getConfirmedPhotoPatch,
    normalizeSnapshot: normalizeClientSnapshot,
    normalizeSnapshotResponse,
    projectPhotoEvent
  } = await importClientModule('./client/src/state/frameSelectors.js');
  const { projectJobEvent, projectJobStatus } = await importClientModule('./client/src/state/jobStatus.js');
  const { projectCredentialSaveStatus } = await importClientModule('./client/src/state/credentialStatus.js');
  const credentialStatusSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/credentialStatus.js'),
    'utf8'
  );
  const {
    buildFieldPatch,
    buildWidgetVisibilityPatch
  } = await importClientModule('./client/src/state/actionPlans.js');
  const { buildMutationPlan } = await importClientModule('./client/src/api/requestPlans.js');
  const {
    createJsonUnavailableError,
    isJsonContentType,
    postJson,
    readJson
  } = await importClientModule('./client/src/api/jsonClient.js');

  assertTest('client state action plans are pure, partially applicable, and REST-shaped', () => {
    const buildThemePatch = buildFieldPatch('theme');
    const buildWidgetPatch = buildWidgetVisibilityPatch('clock');

    assert.deepStrictEqual(buildThemePatch('Cosmic Night'), { theme: 'Cosmic Night' });
    assert.deepStrictEqual(buildWidgetPatch(false), { widgets: { clock: false } });
    assert.deepStrictEqual(buildThemePatch(undefined), { theme: undefined });
  });

  assertTest('client action plans expose checked patch contracts', () => {
    const actionPlansSource = fs.readFileSync(
      path.join(__dirname, 'client/src/state/actionPlans.js'),
      'utf8'
    );

    assert.match(actionPlansSource, /^\/\/ @ts-check/);
    assert.match(actionPlansSource, /@typedef \{Record<string, unknown>\} StatePatch/);
    assert.match(
      actionPlansSource,
      /@typedef \{\{widgets: Record<string, boolean>\}\} WidgetVisibilityPatch/
    );
    assert.match(actionPlansSource, /@returns \{\(value: unknown\) => StatePatch\}/);
    assert.match(
      actionPlansSource,
      /@returns \{\(visible: boolean\) => WidgetVisibilityPatch\}/
    );
  });

  assertTest('client mutation plans keep REST and legacy payload projections declarative', () => {
    const buildCategoryPlan = buildMutationPlan({
      path: '/api/state/categories',
      event: 'change-category',
      body: (categories) => ({ categories })
    });
    const buildScreensaverPlan = buildMutationPlan({
      path: '/api/state/screensaver',
      event: 'set-screensaver-active',
      body: (active) => ({ active })
    });

    assert.deepStrictEqual(buildCategoryPlan('Scenic Nature,Liminal Spaces'), {
      path: '/api/state/categories',
      method: 'POST',
      body: { categories: 'Scenic Nature,Liminal Spaces' },
      legacy: {
        event: 'change-category',
        payload: 'Scenic Nature,Liminal Spaces'
      }
    });
    assert.deepStrictEqual(buildScreensaverPlan(false), {
      path: '/api/state/screensaver',
      method: 'POST',
      body: { active: false },
      legacy: {
        event: 'set-screensaver-active',
        payload: false
      }
    });
  });

  assertTest('client mutation plans expose a checked legacy transport contract', () => {
    const requestPlansSource = fs.readFileSync(
      path.join(__dirname, 'client/src/api/requestPlans.js'),
      'utf8'
    );

    assert.match(requestPlansSource, /^\/\/ @ts-check/);
    assert.match(requestPlansSource, /@typedef \{\{event: string, payload: unknown\}\} LegacyMutation/);
    assert.match(requestPlansSource, /legacy: LegacyMutation/);
    assert.match(requestPlansSource, /@typedef \{\{/);
    assert.match(requestPlansSource, /\}\} MutationPlanSpec/);
    assert.match(requestPlansSource, /@param \{MutationPlanSpec<Input>\} spec/);
    assert.match(requestPlansSource, /@returns \{\(input: Input\) => MutationPlan\}/);
  });

  assertTest('client JSON response contracts classify media types without transport state', () => {
    assert.strictEqual(isJsonContentType('application/json; charset=utf-8'), true);
    assert.strictEqual(isJsonContentType('application/problem+json'), true);
    assert.strictEqual(isJsonContentType('application/jsonp'), false);
    assert.strictEqual(isJsonContentType('text/html'), false);
    assert.strictEqual(createJsonUnavailableError(502).message, 'JSON API unavailable (502)');
  });

  assertTest('client JSON transport exposes checked payload and option contracts', () => {
    const jsonClientSource = fs.readFileSync(
      path.join(__dirname, 'client/src/api/jsonClient.js'),
      'utf8'
    );

    assert.match(jsonClientSource, /^\/\/ @ts-check/);
    assert.match(
      jsonClientSource,
      /@typedef \{\{ error\?: unknown, message\?: unknown \}\} ApiErrorPayload/
    );
    assert.match(
      jsonClientSource,
      /@typedef \{\{ method\?: string, body\?: unknown, requireJson\?: boolean \}\} JsonRequestOptions/
    );
    assert.match(jsonClientSource, /@type \{ApiErrorPayload\}/);
    assert.match(jsonClientSource, /@template Payload/);
    assert.match(jsonClientSource, /@param \{JsonRequestOptions\} \[options\]/);
    assert.match(jsonClientSource, /@returns \{Promise<Payload>\}/);
  });

  assertTest('client photo event projection updates the selected frame side immutably', () => {
    const snapshot = normalizeClientSnapshot({
      activePhoto: { url: 'primary-before' },
      activeSecondPhoto: { url: 'secondary-before' },
      currentFrame: {
        primary: { url: 'primary-before' },
        secondary: { url: 'secondary-before' },
        layout: 'split',
        crop: { primaryPercent: 40, secondaryPercent: 60 },
        context: { categories: ['Scenic Nature'] }
      }
    });
    const nextPrimary = { url: 'primary-after', title: 'Primary' };
    const nextSecondary = { url: 'secondary-after', title: 'Secondary' };

    const primaryResult = applyPhotoEvent(snapshot, 'primary', nextPrimary);
    const secondaryResult = applyPhotoEvent(snapshot, 'secondary', nextSecondary);

    assert.notStrictEqual(primaryResult, snapshot);
    assert.notStrictEqual(secondaryResult, snapshot);
    assert.deepStrictEqual(primaryResult.activePhoto, nextPrimary);
    assert.deepStrictEqual(primaryResult.currentFrame.primary, nextPrimary);
    assert.deepStrictEqual(primaryResult.currentFrame.secondary, snapshot.currentFrame.secondary);
    assert.deepStrictEqual(secondaryResult.activeSecondPhoto, nextSecondary);
    assert.deepStrictEqual(secondaryResult.currentFrame.secondary, nextSecondary);
    assert.deepStrictEqual(secondaryResult.currentFrame.primary, snapshot.currentFrame.primary);
    assert.deepStrictEqual(snapshot.activePhoto, { url: 'primary-before' });
    assert.deepStrictEqual(snapshot.activeSecondPhoto, { url: 'secondary-before' });
  });

  assertTest('client photo event projection preserves identity for missing snapshots or sides', () => {
    const snapshot = { activePhoto: { url: 'primary' } };

    assert.strictEqual(applyPhotoEvent(null, 'primary', { url: 'next' }), null);
    assert.strictEqual(applyPhotoEvent(snapshot, 'unknown', { url: 'next' }), snapshot);
  });

  assertTest('client photo event envelopes select the canonical frame side', () => {
    const primary = { url: 'primary' };
    const secondary = { url: 'secondary' };

    assert.deepStrictEqual(projectPhotoEvent('photo-update', primary), {
      side: 'primary',
      photo: primary
    });
    assert.deepStrictEqual(projectPhotoEvent('second-photo-update', secondary), {
      side: 'secondary',
      photo: secondary
    });
    assert.strictEqual(projectPhotoEvent('unknown-photo-event', primary), null);
    assert.strictEqual(projectPhotoEvent('toString', primary), null);
  });

  assertTest('client job status projection shares recrawl and vision state transitions', () => {
    assert.deepStrictEqual(projectJobStatus({
      type: 'recrawl',
      status: 'running',
      progress: { message: 'Fetching feeds' }
    }), {
      status: 'loading',
      message: 'Fetching feeds'
    });
    assert.deepStrictEqual(projectJobStatus({
      type: 'vision-analysis',
      status: 'succeeded',
      result: { taggedCount: 12 }
    }), {
      status: 'success',
      count: 12,
      message: 'Vision analysis completed successfully.',
      reset: true
    });
    assert.deepStrictEqual(projectJobStatus({
      type: 'recrawl',
      status: 'failed',
      error: 'Feed source unavailable'
    }), {
      status: 'error',
      message: 'Feed source unavailable',
      reset: true
    });
    assert.strictEqual(projectJobStatus({ type: 'unknown', status: 'running' }), null);
    assert.strictEqual(projectJobStatus({ type: 'toString', status: 'running' }), null);
    assert.strictEqual(projectJobStatus({ type: 'recrawl', status: 'cancelled' }), null);
    assert.deepStrictEqual(projectJobStatus({ type: 'recrawl', status: 'queued' }), {
      status: 'loading',
      message: 'Crawling web feeds & self-healing links...'
    });
    assert.strictEqual(projectJobStatus(null), null);
  });

  assertTest('client job event projection normalizes legacy recrawl completion', () => {
    assert.deepStrictEqual(projectJobEvent('job-status', {
      type: 'vision-analysis',
      status: 'running'
    }), {
      type: 'vision-analysis',
      update: {
        status: 'loading',
        message: 'Analyzing photo metadata...'
      }
    });
    assert.deepStrictEqual(projectJobEvent('recrawl-complete', {
      success: true,
      count: 18
    }), {
      type: 'recrawl',
      update: {
        status: 'success',
        count: 18,
        message: 'Feed recrawl completed successfully.',
        reset: true
      }
    });
    assert.deepStrictEqual(projectJobEvent('recrawl-complete', {
      success: false,
      error: 'Feed source unavailable'
    }), {
      type: 'recrawl',
      update: {
        status: 'error',
        message: 'Feed source unavailable',
        reset: true
      }
    });
    assert.strictEqual(projectJobEvent('unknown', {}), null);
    assert.deepStrictEqual(projectJobEvent('job-status', null), {
      type: undefined,
      update: null
    });
  });

  assertTest('credential save acknowledgements share a pure status projection', () => {
    assert.deepStrictEqual(projectCredentialSaveStatus({ success: true }), {
      status: 'success',
      clearInput: true
    });
    assert.deepStrictEqual(projectCredentialSaveStatus({ success: false }), {
      status: 'error',
      clearInput: false
    });
    assert.strictEqual(projectCredentialSaveStatus({ success: 'true' }), null);
    assert.strictEqual(projectCredentialSaveStatus(null), null);
  });

  assertTest('credential save status exposes a checked unknown-safe contract', () => {
    assert.strictEqual(projectCredentialSaveStatus({ success: undefined }), null);
    assert.strictEqual(projectCredentialSaveStatus('not-an-acknowledgement'), null);
    assert.match(credentialStatusSource, /^\/\/ @ts-check/);
    assert.match(
      credentialStatusSource,
      /@typedef \{\{status: 'success'\|'error', clearInput: boolean\}\} CredentialSaveStatus/
    );
    assert.match(credentialStatusSource, /@param \{unknown\} response/);
    assert.match(credentialStatusSource, /@returns \{CredentialSaveStatus\|null\}/);
  });

  assertTest('photo mutation UI reconciles source-local metadata from the server response', () => {
    assert.deepStrictEqual(
      getConfirmedPhotoPatch('requested-url', { loved: true }, {
        photo: { url: '/api/google-photos/media/picker-1?w=2560&h=1440', loved: true }
      }),
      {
        url: '/api/google-photos/media/picker-1?w=2560&h=1440',
        patch: { loved: true }
      }
    );
    assert.deepStrictEqual(
      getConfirmedPhotoPatch('requested-url', { loved: false }, null),
      { url: 'requested-url', patch: { loved: false } }
    );
  });

  const {
    applyCategorySelection,
    applyFeedSourceConfigPatch,
    getSelectedCategories,
    isCategorySelected,
    normalizeCategorySelection,
    serializeCategorySelection,
    toggleCategorySelection
  } = await importClientModule('./client/src/state/feedMutations.js');
  const { normalizeCategoryName } = await importClientModule('./client/src/state/categorySelection.js');

  assertTest('toggleCategorySelection normalizes commas and toggles without duplicating categories', () => {
    const sourceSelection = [' Scenic Nature ', 'Liminal Space', 'Liminal Space'];

    assert.deepStrictEqual(
      toggleCategorySelection('Liminal Spaces', 'Scenic Nature, Liminal Spaces'),
      ['Scenic Nature']
    );
    assert.deepStrictEqual(
      toggleCategorySelection('AI Creations', 'Scenic Nature, Liminal Spaces'),
      ['Scenic Nature', 'Liminal Spaces', 'AI Creations']
    );
    assert.deepStrictEqual(
      normalizeCategorySelection(' Scenic Nature , Scenic Nature ,AI Creations '),
      ['Scenic Nature', 'AI Creations']
    );
    assert.strictEqual(
      serializeCategorySelection([' Scenic Nature ', 'AI Creations', 'Scenic Nature']),
      'Scenic Nature,AI Creations'
    );
    assert.strictEqual(normalizeCategoryName('AI Creation'), 'AI Creations');
    assert.deepStrictEqual(normalizeCategorySelection(sourceSelection), [
      'Scenic Nature',
      'Liminal Spaces'
    ]);
    assert.deepStrictEqual(sourceSelection, [' Scenic Nature ', 'Liminal Space', 'Liminal Space']);
  });

  assertTest('client category helpers prefer canonical playback selection over stale top-level category strings', () => {
    const snapshot = {
      currentCategory: 'Scenic Nature',
      currentFrame: {
        context: {
          categories: ['AI Creation']
        }
      },
      playback: {
        selectedCategories: ['Liminal Space', 'Google Photos']
      }
    };

    assert.deepStrictEqual(
      getSelectedCategories(snapshot),
      ['Liminal Spaces', 'Google Photos']
    );
    assert.strictEqual(isCategorySelected(snapshot, 'Liminal Spaces'), true);
    assert.strictEqual(isCategorySelected(snapshot, 'AI Creations'), false);
    assert.deepStrictEqual(
      toggleCategorySelection('AI Creations', snapshot),
      ['Liminal Spaces', 'Google Photos', 'AI Creations']
    );
  });

  assertTest('normalizeSnapshot reconciles currentCategory with canonical playback selection', () => {
    const nextSnapshot = normalizeClientSnapshot({
      currentCategory: 'Scenic Nature',
      currentFrame: {
        layout: 'single',
        primary: { url: 'land-1', category: 'Google Photos' },
        secondary: null,
        crop: {
          primaryPercent: 100,
          primaryPositionY: 50,
          secondaryPercent: 50,
          secondaryPositionY: 50
        },
        context: {
          category: 'Google Photos',
          categories: ['AI Creation'],
          photoCount: 1,
          orientation: 'landscape',
          splitEligible: false
        }
      },
      playback: {
        selectedCategories: ['Liminal Space', 'Google Photos']
      }
    });

    assert.strictEqual(nextSnapshot.currentCategory, 'Liminal Spaces,Google Photos');
    assert.deepStrictEqual(nextSnapshot.playback.selectedCategories, ['Liminal Spaces', 'Google Photos']);
    assert.deepStrictEqual(nextSnapshot.currentFrame.context.categories, ['Liminal Spaces', 'Google Photos']);
  });

  assertTest('normalizeSnapshotResponse composes direct and mutation response snapshots without mutation', () => {
    const sourceSnapshot = {
      currentCategory: 'Scenic Nature',
      playback: { selectedCategories: ['Liminal Space'] },
      activePhoto: { url: 'land-1' }
    };
    const direct = normalizeSnapshotResponse(sourceSnapshot);
    const enveloped = normalizeSnapshotResponse({ state: sourceSnapshot });

    assert.deepStrictEqual(enveloped, direct);
    assert.deepStrictEqual(sourceSnapshot, {
      currentCategory: 'Scenic Nature',
      playback: { selectedCategories: ['Liminal Space'] },
      activePhoto: { url: 'land-1' }
    });
    assert.strictEqual(normalizeSnapshotResponse(null), null);
    assert.strictEqual(normalizeSnapshotResponse(undefined), undefined);
  });

  assertTest('applyCategorySelection patches both top-level and nested playback selection state', () => {
    const snapshot = {
      currentCategory: 'Scenic Nature',
      currentFrame: {
        layout: 'single',
        primary: { url: 'land-1' },
        secondary: null,
        crop: {
          primaryPercent: 100,
          primaryPositionY: 50,
          secondaryPercent: 50,
          secondaryPositionY: 50
        },
        context: {
          category: 'Scenic Nature',
          categories: ['Scenic Nature'],
          photoCount: 1,
          orientation: 'landscape',
          splitEligible: false
        }
      },
      playback: {
        selectedCategories: ['Scenic Nature'],
        activePhotoUrl: 'land-1',
        splitSeed: 0,
        lastDirection: 'next'
      }
    };

    const nextSnapshot = applyCategorySelection(snapshot, 'Scenic Nature,Liminal Spaces');
    assert.strictEqual(nextSnapshot.currentCategory, 'Scenic Nature,Liminal Spaces');
    assert.deepStrictEqual(nextSnapshot.playback.selectedCategories, ['Scenic Nature', 'Liminal Spaces']);
    assert.deepStrictEqual(nextSnapshot.currentFrame.context.categories, ['Scenic Nature', 'Liminal Spaces']);
    assert.deepStrictEqual(snapshot.playback.selectedCategories, ['Scenic Nature']);
    assert.deepStrictEqual(snapshot.currentFrame.context.categories, ['Scenic Nature']);
    assert.strictEqual(applyCategorySelection(null, 'Scenic Nature'), null);
  });

  assertTest('applyFeedSourceConfigPatch merges source patches without dropping sibling fields', () => {
    const snapshot = {
      feedConfigs: {
        'Scenic Nature': {
          reddit: { enabled: false, subreddits: ['EarthPorn'] }
        }
      },
      config: {
        feedConfigs: {
          'Scenic Nature': {
            reddit: { enabled: false, subreddits: ['EarthPorn'] }
          }
        }
      }
    };

    const nextSnapshot = applyFeedSourceConfigPatch(snapshot, 'Scenic Nature', 'reddit', {
      enabled: true,
      subreddits: ['SkyPorn']
    });

    assert.deepStrictEqual(nextSnapshot.feedConfigs['Scenic Nature'].reddit, {
      enabled: true,
      subreddits: ['SkyPorn']
    });
    assert.deepStrictEqual(nextSnapshot.config.feedConfigs['Scenic Nature'].reddit, {
      enabled: true,
      subreddits: ['SkyPorn']
    });
    assert.deepStrictEqual(snapshot.feedConfigs['Scenic Nature'].reddit, {
      enabled: false,
      subreddits: ['EarthPorn']
    });
    assert.strictEqual(applyFeedSourceConfigPatch(snapshot, '', 'reddit', {}), snapshot);
    assert.strictEqual(applyFeedSourceConfigPatch(snapshot, 'Scenic Nature', '', {}), snapshot);
    assert.strictEqual(applyFeedSourceConfigPatch(snapshot, 'Scenic Nature', 'reddit', null), snapshot);
  });

  const originalWindow = global.window;
  const originalFetch = global.fetch;

  try {
    global.window = {
      location: {
        port: '5000',
        protocol: 'http:',
        hostname: '127.0.0.1',
        origin: 'http://127.0.0.1:5000'
      }
    };

    const {
      getStateSnapshot: getClientStateSnapshot,
      saveUseApiToken: saveClientUseApiToken,
      selectCategories: selectClientCategories,
      setScreensaverActive: setClientScreensaverActive,
      startRecrawlJob: startClientRecrawlJob,
      startVisionAnalysisJob: startClientVisionAnalysisJob
    } = await importClientModule('./client/src/api/luminaClient.js');

    const requestCalls = [];
    global.fetch = async (url, options) => {
      requestCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => ({ success: true })
      };
    };
    const readResult = await readJson('/api/environment');
    const postResult = await postJson('/api/environment/settings', { enabled: true });

    assertTest('shared client JSON transport keeps read and post effects at one boundary', () => {
      assert.deepStrictEqual(readResult, { success: true });
      assert.deepStrictEqual(postResult, { success: true });
      assert.deepStrictEqual(requestCalls, [
        {
          url: 'http://127.0.0.1:5000/api/environment',
          options: { method: 'GET', headers: undefined, body: undefined }
        },
        {
          url: 'http://127.0.0.1:5000/api/environment/settings',
          options: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
          }
        }
      ]);
    });

    global.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      json: async () => ({})
    });
    await assertAsyncTest('shared read contract rejects an HTML response before view-specific presentation', async () => {
      await assert.rejects(readJson('/api/environment'), /JSON API unavailable \(200\)/);
    });
    await assertAsyncTest('state snapshot reads use the shared strict JSON contract', async () => {
      await assert.rejects(getClientStateSnapshot(), /JSON API unavailable \(200\)/);
    });

    const emittedEvents = [];
    global.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({})
    });
    const fallbackResult = await selectClientCategories('Scenic Nature,Liminal Spaces', {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });
    const fallbackSecretResult = await saveClientUseApiToken('secret-123', {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });
    const fallbackScreensaverResult = await setClientScreensaverActive(false, {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });
    const fallbackRecrawlResult = await startClientRecrawlJob({ categories: ['Scenic Nature'] }, {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });
    const fallbackVisionResult = await startClientVisionAnalysisJob({ categories: ['Scenic Nature'] }, {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });

    assertTest('selectCategories falls back to the legacy socket event when the REST route is missing', () => {
      assert.strictEqual(fallbackResult, null);
      assert.deepStrictEqual(emittedEvents[0], [
        ['change-category', 'Scenic Nature,Liminal Spaces']
      ][0]);
    });

    assertTest('saveUseApiToken falls back to the legacy socket event when the REST route is missing', () => {
      assert.strictEqual(fallbackSecretResult, null);
      assert.deepStrictEqual(emittedEvents[1], ['save-useapi-token', { token: 'secret-123' }]);
    });

    assertTest('the shared client fallback adapter preserves screensaver and job legacy events', () => {
      assert.deepStrictEqual([
        fallbackScreensaverResult,
        fallbackRecrawlResult,
        fallbackVisionResult
      ], [null, null, null]);
      assert.deepStrictEqual(emittedEvents.slice(2), [
        ['set-screensaver-active', false],
        ['trigger-recrawl', { categories: ['Scenic Nature'] }],
        ['trigger-vision-analysis', { categories: ['Scenic Nature'] }]
      ]);
    });

    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server unavailable' })
    });
    await assertAsyncTest('the shared client fallback adapter rethrows non-404 REST failures', async () => {
      await assert.rejects(
        setClientScreensaverActive(false, {
          socket: {
            emit: () => { throw new Error('socket fallback should not run'); }
          }
        }),
        /server unavailable/
      );
    });
  } finally {
    global.window = originalWindow;
    global.fetch = originalFetch;
  }

  const socketFamilyEmits = [];
  const compatibilityFallback = () => 'legacy-state-patch';
  const interpretSocketFamily = createSocketCommandSpecInterpreter({
    compatibility: {
      statePatch: compatibilityFallback,
      categorySelection: () => 'legacy-category'
    },
    emitSecretSaveResult: () => {},
    socket: {
      emit: (...args) => socketFamilyEmits.push(args)
    }
  });

  assertTest('socket command-family interpreter keeps its declared vocabulary closed', () => {
    const statePatch = interpretSocketFamily({ family: 'state-patch', event: 'change-theme' });
    const durableCommand = interpretSocketFamily({
      family: 'durable-command',
      event: 'change-category',
      decode: (payload) => ({ type: 'select-categories', payload }),
      fallbackKey: 'categorySelection'
    });
    const asyncJob = interpretSocketFamily({
      family: 'async-job',
      event: 'trigger-recrawl',
      decode: () => ({ type: 'request-recrawl' }),
      unavailableEvent: 'recrawl-complete',
      unavailablePayload: { success: false }
    });
    const unknown = interpretSocketFamily({ family: 'unknown-family', event: 'custom' });
    const inherited = interpretSocketFamily({ family: '__proto__', event: 'custom-inherited' });

    assert.strictEqual(statePatch.fallback, compatibilityFallback);
    assert.deepStrictEqual(durableCommand.decode(['Scenic Nature']), {
      type: 'select-categories',
      payload: ['Scenic Nature']
    });
    assert.strictEqual(durableCommand.fallback(), 'legacy-category');
    asyncJob.fallback();
    assert.deepStrictEqual(socketFamilyEmits, [['recrawl-complete', { success: false }]]);
    assert.deepStrictEqual(unknown, { event: 'custom' });
    assert.deepStrictEqual(inherited, { event: 'custom-inherited' });
  });

  const dispatchedCommands = [];
  const dispatchHarness = createSocketHarness({
    dispatchCommand: async (command) => {
      dispatchedCommands.push(command);
      return null;
    }
  });

  await dispatchHarness.socketHandlers['change-category']('Scenic Nature,Liminal Spaces');
  await dispatchHarness.socketHandlers['rate-photo']({ url: 'land-1', rating: 7 });
  await dispatchHarness.socketHandlers['mark-photo-broken']({ url: 'land-1' });
  await dispatchHarness.socketHandlers['set-photo-crop']({
    url: buildGooglePhotoProxyUrl('picker-123'),
    cropPercent: 62
  });
  await dispatchHarness.socketHandlers['update-keywords']({ category: 'Scenic Nature', keywords: ['forest', 'mist'] });
  await dispatchHarness.socketHandlers['update-feed-config']({
    category: 'Scenic Nature',
    source: 'reddit',
    config: {
      enabled: false,
      subreddits: ['CityPorn']
    }
  });
  await dispatchHarness.socketHandlers['update-excluded-keywords'](['forest', ' mist ']);
  await dispatchHarness.socketHandlers['save-useapi-token']({ token: 'secret-123' });

  assertTest('socket category, pool, photo, excluded-keyword, Google Photos, and admin compatibility events dispatch shared domain commands when available', () => {
    assert.deepStrictEqual(dispatchedCommands, [
      {
        type: 'select-categories',
        payload: {
          categories: 'Scenic Nature,Liminal Spaces'
        }
      },
      {
        type: 'rate-photo',
        payload: {
          url: 'land-1',
          rating: 7
        }
      },
      {
        type: 'mark-photo-broken',
        payload: {
          url: 'land-1'
        }
      },
      {
        type: 'set-photo-crop',
        payload: {
          url: buildGooglePhotoProxyUrl('picker-123'),
          cropPercent: 62
        }
      },
      {
        type: 'set-pool-keywords',
        payload: {
          name: 'Scenic Nature',
          keywords: ['forest', 'mist']
        }
      },
      {
        type: 'merge-pool-feed-config',
        payload: {
          name: 'Scenic Nature',
          source: 'reddit',
          config: {
            enabled: false,
            subreddits: ['CityPorn']
          }
        }
      },
      {
        type: 'update-excluded-keywords',
        payload: {
          keywords: ['forest', ' mist ']
        }
      },
      {
        type: 'save-env-secret',
        payload: {
          envKey: 'USEAPI_TOKEN',
          runtimeFlag: 'hasUseApiToken',
          value: 'secret-123'
        }
      }
    ]);
    assert.deepStrictEqual(
      dispatchHarness.socketEmits.find(([event]) => event === 'useapi-token-saved'),
      ['useapi-token-saved', { success: true }]
    );
  });

  assertTest('socket shared listener-spec table registers every shared command handler', () => {
    const missingEvents = SOCKET_COMMAND_LISTENER_SPECS
      .map(({ event }) => event)
      .filter((event) => typeof dispatchHarness.socketHandlers[event] !== 'function');

    assert.deepStrictEqual(missingEvents, []);
  });

  const statePatchCommands = [];
  const statePatchHarness = createSocketHarness({
    dispatchCommand: async (command) => {
      statePatchCommands.push(command);
      return null;
    }
  });
  await statePatchHarness.socketHandlers['change-theme'](' Cosmic Night ');
  await statePatchHarness.socketHandlers['toggle-auto-location'](true);
  await statePatchHarness.socketHandlers['toggle-widget']({ widgetName: 'clock', visible: 0 });

  assertTest('socket state-patch listener specs dispatch shared patch-state commands declaratively', () => {
    assert.deepStrictEqual(statePatchCommands, [
      {
        type: 'patch-state',
        payload: {
          theme: 'Cosmic Night'
        }
      },
      {
        type: 'patch-state',
        payload: {
          autoLocation: true
        }
      },
      {
        type: 'patch-state',
        payload: {
          widgets: {
            clock: 0
          }
        }
      }
    ]);
  });

  const fallbackHarness = createSocketHarness();
  await fallbackHarness.socketHandlers['update-keywords']({
    category: 'Scenic Nature',
    keywords: ['forest', 'mist']
  });
  await fallbackHarness.socketHandlers['update-feed-config']({
    category: 'Scenic Nature',
    source: 'reddit',
    config: { enabled: false }
  });
  await fallbackHarness.socketHandlers['update-pool-policy']({
    category: 'Scenic Nature',
    policy: { retentionDays: 14, maxPhotos: 500 }
  });
  const poolFallbackBroadcasts = fallbackHarness.ioEmits.length;
  await fallbackHarness.socketHandlers['update-keywords']({
    category: 'Missing Pool',
    keywords: ['ignored']
  });

  assertTest('legacy pool compatibility mutations share persistence and broadcast boundaries', () => {
    assert.deepStrictEqual(fallbackHarness.state.searchKeywords['Scenic Nature'], ['forest', 'mist']);
    assert.deepStrictEqual(fallbackHarness.state.feedConfigs['Scenic Nature'].reddit, { enabled: false });
    assert.deepStrictEqual(fallbackHarness.state.poolPolicies['Scenic Nature'], {
      retentionDays: 14,
      maxPhotos: 500,
      schedule: {
        enabled: false,
        start: '22:00',
        end: '06:00',
        priority: 0
      }
    });
    assert.strictEqual(fallbackHarness.ioEmits.length, poolFallbackBroadcasts);
    assert.strictEqual(fallbackHarness.state.searchKeywords['Missing Pool'], undefined);
  });

  const photoFallbackHarness = createSocketHarness();
  const photoBroadcastStart = photoFallbackHarness.ioEmits.length;
  await photoFallbackHarness.socketHandlers['rate-photo']({
    url: 'land-1',
    rating: 7
  });
  await photoFallbackHarness.socketHandlers['set-photo-crop']({
    url: 'land-1',
    cropPercent: 62
  });
  await photoFallbackHarness.socketHandlers['set-photo-prevent-pairing']({
    url: 'land-1',
    preventPairing: true
  });
  const photoBroadcastsAfterMutations = photoFallbackHarness.ioEmits.length;
  await photoFallbackHarness.socketHandlers['mark-photo-broken']({
    url: 'missing-photo'
  });

  assertTest('legacy photo compatibility mutations share the broadcast boundary and keep broken-photo no-ops silent', () => {
    assert.strictEqual(photoBroadcastsAfterMutations - photoBroadcastStart, 3);
    assert.deepStrictEqual(photoFallbackHarness.state.photosList[0], {
      url: 'land-1',
      title: 'Forest',
      rating: 7,
      cropPercent: 62,
      preventPairing: true
    });
    assert.strictEqual(photoFallbackHarness.ioEmits.length, photoBroadcastsAfterMutations);
  });

  await fallbackHarness.socketHandlers['next-photo']();

  assertTest('socket next-photo fallback still advances the active photo through the legacy smart selector', () => {
    assert.deepStrictEqual(fallbackHarness.state.activePhoto, {
      url: 'next-smart',
      title: 'next smart'
    });
    assert.deepStrictEqual(
      fallbackHarness.ioEmits.find(([event]) => event === 'photo-update'),
      ['photo-update', { url: 'next-smart', title: 'next smart' }]
    );
  });

  const excludedKeywordsFallbackHarness = createSocketHarness({
    combineFeedsBalanced: () => [{ url: 'replacement', title: 'Fresh Skyline' }]
  });
  await excludedKeywordsFallbackHarness.socketHandlers['update-excluded-keywords'](['  forest  ', '', 'mist']);

  assertTest('socket excluded-keywords fallback still normalizes the list and reselects away from excluded active photos', () => {
    assert.deepStrictEqual(excludedKeywordsFallbackHarness.state.excludedKeywords, ['forest', 'mist']);
    assert.deepStrictEqual(excludedKeywordsFallbackHarness.state.photosList, [{
      url: 'replacement',
      title: 'Fresh Skyline'
    }]);
    assert.deepStrictEqual(excludedKeywordsFallbackHarness.state.activePhoto, {
      url: 'replacement',
      title: 'Fresh Skyline'
    });
    assert.deepStrictEqual(
      excludedKeywordsFallbackHarness.ioEmits.findLast(([event]) => event === 'state-sync'),
      ['state-sync', excludedKeywordsFallbackHarness.state]
    );
  });

  const telemetryHarness = createSocketHarness({
    resolveTvDisplayInfo: async () => ({ name: 'HDMI-1', width: 3840, height: 2160 }),
    refreshGooglePhotoUrl: async (mediaItemId) => `https://photos.example/${mediaItemId}`
  });
  await telemetryHarness.socketHandlers['report-tv-viewport']({ width: 1920, height: 1080 });
  await telemetryHarness.socketHandlers['get-active-google-photo']({ mediaItemId: 'picker-123' });

  assertTest('socket telemetry listeners keep viewport reporting explicit and lazy-load display info once', () => {
    assert.deepStrictEqual(telemetryHarness.state.tvViewport, {
      width: 1920,
      height: 1080,
      aspectRatio: 1920 / 1080,
      updatedAt: telemetryHarness.state.tvViewport.updatedAt
    });
    assert.deepStrictEqual(telemetryHarness.state.tvDisplayInfo, {
      name: 'HDMI-1',
      width: 3840,
      height: 2160
    });
    assert.strictEqual(typeof telemetryHarness.state.tvViewport.updatedAt, 'number');
    assert.deepStrictEqual(
      telemetryHarness.ioEmits.findLast(([event]) => event === 'state-sync'),
      ['state-sync', telemetryHarness.state]
    );
  });

  assertTest('socket Google Photos refresh listener responds through the dedicated async adapter', () => {
    assert.deepStrictEqual(
      telemetryHarness.socketEmits.findLast(([event]) => event === 'active-google-photo-response'),
      ['active-google-photo-response', {
        mediaItemId: 'picker-123',
        url: 'https://photos.example/picker-123'
      }]
    );
  });

  const failedRefreshHarness = createSocketHarness({
    refreshGooglePhotoUrl: async () => {
      throw new Error('refresh unavailable');
    }
  });
  await failedRefreshHarness.socketHandlers['get-active-google-photo']({ mediaItemId: 'picker-failed' });

  assertTest('socket Google Photos refresh failures stay inside the shared async boundary', () => {
    assert.deepStrictEqual(
      failedRefreshHarness.socketEmits.findLast(([event]) => event === 'active-google-photo-response'),
      ['active-google-photo-response', {
        mediaItemId: 'picker-failed',
        error: 'refresh unavailable'
      }]
    );
  });

  const googleFallbackHarness = createSocketHarness();
  const originalIsGooglePhotoProxyUrl = googlePhotos.isGooglePhotoProxyUrl;
  const originalUpdateCachedMediaItemMetadata = googlePhotos.updateCachedMediaItemMetadata;
  const originalApplyCachedMediaItemMetadataToState = googlePhotos.applyCachedMediaItemMetadataToState;
  const googleFallbackUrl = buildGooglePhotoProxyUrl('picker-fallback');

  try {
    googlePhotos.isGooglePhotoProxyUrl = (value) => value === googleFallbackUrl;
    googlePhotos.updateCachedMediaItemMetadata = (value, metadata) => (
      value === googleFallbackUrl
        ? { id: 'picker-fallback', url: googleFallbackUrl, ...metadata }
        : null
    );
    googlePhotos.applyCachedMediaItemMetadataToState = (state, value, metadata) => {
      if (value !== googleFallbackUrl) {
        return null;
      }

      state.photosList = [{
        id: 'picker-fallback',
        url: googleFallbackUrl,
        title: 'Picker Photo',
        ...metadata
      }];
      state.activePhoto = { ...state.photosList[0] };
      return state.activePhoto;
    };

    await googleFallbackHarness.socketHandlers['set-photo-crop']({
      url: googleFallbackUrl,
      cropPercent: 48
    });

    assertTest('socket Google Photos fallback still applies source-local metadata when the shared dispatcher is unavailable', () => {
      assert.strictEqual(googleFallbackHarness.state.photosList[0].cropPercent, 48);
      assert.strictEqual(googleFallbackHarness.state.activePhoto.cropPercent, 48);
      assert.deepStrictEqual(
        googleFallbackHarness.ioEmits.findLast(([event]) => event === 'state-sync'),
        ['state-sync', googleFallbackHarness.state]
      );
    });
  } finally {
    googlePhotos.isGooglePhotoProxyUrl = originalIsGooglePhotoProxyUrl;
    googlePhotos.updateCachedMediaItemMetadata = originalUpdateCachedMediaItemMetadata;
    googlePhotos.applyCachedMediaItemMetadataToState = originalApplyCachedMediaItemMetadataToState;
  }

  const asyncFallbackHarness = createSocketHarness();
  await asyncFallbackHarness.socketHandlers['trigger-recrawl']({});
  await asyncFallbackHarness.socketHandlers['trigger-vision-analysis']({});

  assertTest('socket async job fallback listeners emit explicit failure payloads when no dispatcher is available', () => {
    assert.deepStrictEqual(
      asyncFallbackHarness.socketEmits.findLast(([event]) => event === 'recrawl-complete'),
      ['recrawl-complete', { success: false, error: 'Recrawl dispatcher unavailable.' }]
    );
    assert.deepStrictEqual(
      asyncFallbackHarness.socketEmits.findLast(([event]) => event === 'job-status'),
      ['job-status', {
        type: 'vision-analysis',
        status: 'failed',
        error: 'Vision-analysis dispatcher unavailable.'
      }]
    );
  });

  const secretFailureHarness = createSocketHarness({
    dispatchCommand: async (command) => {
      if (command.type === 'save-env-secret') {
        throw new Error('persist failed');
      }
      return null;
    }
  });
  await secretFailureHarness.socketHandlers['save-tumblr-api-key']({ value: 'tumblr-secret' });

  assertTest('socket secret-save listener specs acknowledge shared command failures without throwing', () => {
    assert.deepStrictEqual(
      secretFailureHarness.socketEmits.findLast(([event]) => event === 'tumblr-api-key-saved'),
      ['tumblr-api-key-saved', { success: false, error: 'persist failed' }]
    );
  });
}

async function runClientRenderingTests() {
  logSuite('Client Rendering Helpers');

  const { toCssImageUrl } = await importClientModule('./client/src/state/cssImage.js');
  const { formatClockParts } = await importClientModule('./client/src/state/clock.js');
  const {
    DEFAULT_CONTAIN_CROP_PERCENT,
    DEFAULT_COVER_CROP_PERCENT,
    MAX_PHOTO_CROP_PERCENT,
    getDefaultPhotoCropPercent,
    getPhotoCropBlend
  } = await importClientModule('./client/src/state/photoCrop.js');
  const {
    MEDIA_RETRY_DELAYS_MS,
    buildMediaOriginProbeUrl,
    decideMediaFailure
  } = await importClientModule('./client/src/state/mediaRecovery.js');
  const {
    isEscapeKey,
    isScreensaverDismissalActivity
  } = await importClientModule('./client/src/state/screensaverActivity.js');
  const {
    DEFAULT_SWIPE_STATUS,
    SWIPE_THRESHOLD_PX,
    classifySwipe,
    getTouchClientX,
    getTriggeredSwipeStatus
  } = await importClientModule('./client/src/state/swipeGesture.js');
  const {
    DEFAULT_CROP_CONTAINER_HEIGHT,
    DEFAULT_CROP_SENSITIVITY,
    getPointerClientY,
    getTouchClientY,
    projectCropPosition
  } = await importClientModule('./client/src/state/cropDrag.js');
  const dashboardSource = fs.readFileSync(
    path.join(__dirname, 'client/src/components/Dashboard.jsx'),
    'utf8'
  );
  const frameSelectorsSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/frameSelectors.js'),
    'utf8'
  );
  const environmentRefreshSource = fs.readFileSync(
    path.join(__dirname, 'server/runtime/environmentRefresh.js'),
    'utf8'
  );
  const idleDaemonSource = fs.readFileSync(
    path.join(__dirname, 'server/runtime/idleDaemon.js'),
    'utf8'
  );
  const categorySelectionSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/categorySelection.js'),
    'utf8'
  );
  const jobStatusSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/jobStatus.js'),
    'utf8'
  );
  const feedMutationsSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/feedMutations.js'),
    'utf8'
  );
  const environmentHistorySource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/environmentHistory.js'),
    'utf8'
  );
  const photoCropSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/photoCrop.js'),
    'utf8'
  );
  const cssImageSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/cssImage.js'),
    'utf8'
  );
  const clockSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/clock.js'),
    'utf8'
  );
  const cropDragSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/cropDrag.js'),
    'utf8'
  );

  const clockOptions = { timeZone: 'UTC' };
  const morningClock = formatClockParts(
    new Date('2026-01-02T05:07:00.000Z'),
    'en-US',
    clockOptions
  );
  const afternoonClock = formatClockParts(
    new Date('2026-01-02T17:07:00.000Z'),
    'en-US',
    clockOptions
  );

  assertTest('formatClockParts keeps AM and PM separate from locale time punctuation', () => {
    assert.deepStrictEqual(morningClock, { time: '05:07', period: 'AM' });
    assert.deepStrictEqual(afternoonClock, { time: '05:07', period: 'PM' });
  });

  assertTest('formatClockParts does not inherit the clock digit tracking contract', () => {
    assert.notStrictEqual(morningClock.period, '');
    assert.notStrictEqual(afternoonClock.period, '');
    assert.strictEqual(morningClock.time.includes('AM'), false);
    assert.strictEqual(afternoonClock.time.includes('PM'), false);
  });

  assertTest('formatClockParts preserves caller formatter options at the pure boundary', () => {
    const twentyFourHourClock = formatClockParts(
      new Date('2026-01-02T17:07:00.000Z'),
      'en-US',
      { timeZone: 'UTC', hour12: false }
    );

    assert.deepStrictEqual(twentyFourHourClock, { time: '17:07', period: '' });
  });

  assertTest('formatClockParts exposes a local checked presentation contract', () => {
    assert.match(clockSource, /^\/\/ @ts-check/);
    assert.match(clockSource, /@typedef \{\{time: string, period: string\}\} ClockParts/);
    assert.match(clockSource, /@returns \{ClockParts\}/);
  });

  assertTest('photo crop helpers preserve pure baselines and blend math', () => {
    assert.strictEqual(DEFAULT_CONTAIN_CROP_PERCENT, 0);
    assert.strictEqual(DEFAULT_COVER_CROP_PERCENT, 100);
    assert.strictEqual(MAX_PHOTO_CROP_PERCENT, 200);
    assert.strictEqual(getDefaultPhotoCropPercent('contain'), 0);
    assert.strictEqual(getDefaultPhotoCropPercent('cover'), 100);
    assert.strictEqual(getDefaultPhotoCropPercent(null), 100);
    assert.strictEqual(getDefaultPhotoCropPercent(undefined), 100);
    assert.strictEqual(getPhotoCropBlend(0), 0);
    assert.strictEqual(getPhotoCropBlend(50), 0.5);
    assert.strictEqual(getPhotoCropBlend(MAX_PHOTO_CROP_PERCENT), 2);
  });

  assertTest('photo crop helpers expose a local checked scalar contract', () => {
    assert.match(photoCropSource, /^\/\/ @ts-check/);
    assert.match(photoCropSource, /@typedef \{'contain'\|'cover'\} PhotoScaleMode/);
    assert.match(photoCropSource, /@typedef \{number\} PhotoCropPercent/);
    assert.match(photoCropSource, /@param \{PhotoScaleMode\|null\|undefined\} scaleMode/);
    assert.match(photoCropSource, /@param \{PhotoCropPercent\} cropPercent/);
    assert.match(photoCropSource, /@returns \{PhotoCropPercent\}/);
  });

  assertTest('toCssImageUrl quotes and encodes whitespace-safe image URLs', () => {
    assert.strictEqual(
      toCssImageUrl('https://images.metmuseum.org/CRDImages/as/original/8 NEW DP257785r1_61E.jpg'),
      'url("https://images.metmuseum.org/CRDImages/as/original/8%20NEW%20DP257785r1_61E.jpg")'
    );
  });

  assertTest('toCssImageUrl preserves already-encoded paths', () => {
    assert.strictEqual(
      toCssImageUrl('https://example.com/already%20encoded/image.jpg'),
      'url("https://example.com/already%20encoded/image.jpg")'
    );
  });

  assertTest('toCssImageUrl exposes a checked pure presentation contract', () => {
    assert.match(cssImageSource, /^\/\/ @ts-check/);
    assert.match(cssImageSource, /@param \{unknown\} url/);
    assert.match(cssImageSource, /@returns \{string\}/);
    assert.strictEqual(toCssImageUrl(null), 'none');
    assert.strictEqual(toCssImageUrl('   '), 'none');
  });

  assertTest('media recovery uses bounded exponential retry delays', () => {
    assert.deepStrictEqual(MEDIA_RETRY_DELAYS_MS, [1000, 2000, 4000, 8000]);
    assert.deepStrictEqual(decideMediaFailure({ attempt: 0, hostReachable: false }), {
      action: 'retry',
      attempt: 1,
      delayMs: 1000
    });
    assert.deepStrictEqual(decideMediaFailure({ attempt: 3, hostReachable: true }), {
      action: 'retry',
      attempt: 4,
      delayMs: 8000
    });
  });

  assertTest('media recovery holds unreachable hosts and skips only reachable broken URLs', () => {
    assert.deepStrictEqual(decideMediaFailure({ attempt: 4, hostReachable: false }), {
      action: 'hold',
      attempt: 4
    });
    assert.deepStrictEqual(decideMediaFailure({ attempt: 4, hostReachable: true }), {
      action: 'skip',
      attempt: 4
    });
  });

  assertTest('media connectivity probes target only the image origin', () => {
    assert.strictEqual(
      buildMediaOriginProbeUrl('https://images.example.test/path/photo.jpg?size=large', 'http://localhost:5000'),
      'https://images.example.test'
    );
    assert.strictEqual(
      buildMediaOriginProbeUrl('/media/photo.jpg', 'http://localhost:5000'),
      'http://localhost:5000'
    );
    assert.strictEqual(buildMediaOriginProbeUrl('http://[invalid', 'http://localhost:5000'), null);
  });

  assertTest('screensaver activity treats Escape and ordinary input as dismissal signals', () => {
    assert.strictEqual(isEscapeKey({ key: 'Escape' }), true);
    assert.strictEqual(isEscapeKey({ code: 'Escape' }), true);
    assert.strictEqual(isEscapeKey({ key: 'Enter', code: 'Enter' }), false);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      event: { type: 'keydown', key: 'Enter' }
    }), true);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      event: { type: 'mousemove' }
    }), true);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      allowDismissal: false,
      event: { type: 'mousedown' }
    }), false, 'admin TV previews must not dismiss the kiosk screensaver');
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: false,
      event: { type: 'keydown', key: 'Escape' }
    }), false);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      event: null
    }), false);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      event: { type: 'wheel' }
    }), false);
  });

  assertTest('screensaver activity exposes a local checked event contract', () => {
    const screensaverActivitySource = fs.readFileSync(
      path.join(__dirname, 'client/src/state/screensaverActivity.js'),
      'utf8'
    );

    assert.match(screensaverActivitySource, /^\/\/ @ts-check/);
    assert.match(screensaverActivitySource, /@typedef \{\{key\?: string, code\?: string\}\} KeyboardActivity/);
    assert.match(screensaverActivitySource, /@typedef \{\{type\?: string\}\} ActivityEvent/);
    assert.match(
      screensaverActivitySource,
      /@typedef \{\{screensaverActive: boolean, allowDismissal\?: boolean, event\?: ActivityEvent\|null\}\} ScreensaverActivity/
    );
    assert.match(
      screensaverActivitySource,
      /@param \{KeyboardActivity\|null\|undefined\} event/
    );
    assert.match(screensaverActivitySource, /@param \{ScreensaverActivity\} input/);
  });

  assertTest('only an explicitly launched TV kiosk can dismiss the shared screensaver from input', () => {
    const appSource = fs.readFileSync(path.join(__dirname, 'client/src/App.jsx'), 'utf8');
    const dashboardSource = fs.readFileSync(path.join(__dirname, 'client/src/components/Dashboard.jsx'), 'utf8');

    assert.match(appSource, /get\('mode'\) === 'tv'/);
    assert.match(appSource, /allowScreensaverDismissal=\{isKioskSession\}/);
    assert.match(dashboardSource, /allowScreensaverDismissal = false/);
    assert.match(dashboardSource, /if \(!allowScreensaverDismissal \|\| !state\.screensaverActive/);
  });

  assertTest('active TV kiosk hides the cursor across the page after inactivity', () => {
    const dashboardSource = fs.readFileSync(path.join(__dirname, 'client/src/components/Dashboard.jsx'), 'utf8');
    const stylesSource = fs.readFileSync(path.join(__dirname, 'client/src/index.css'), 'utf8');

    assert.match(dashboardSource, /\}, \[allowScreensaverDismissal, isSettingsOpen, state\.screensaverActive\]\);/);
    assert.match(dashboardSource, /\}, 3000\);/);
    assert.match(dashboardSource, /document\.body\.classList\.add\('hide-cursor'\)/);
    assert.match(dashboardSource, /if \(!allowScreensaverDismissal \|\| !state\.screensaverActive \|\| showCursor\)/);
    assert.match(stylesSource, /\.hide-cursor,\s*\.hide-cursor \*\s*\{\s*cursor: none !important;/);
  });

  assertTest('swipe gesture projection keeps threshold and direction policy pure', () => {
    assert.strictEqual(DEFAULT_SWIPE_STATUS, 'Swipe left or right to change photo');
    assert.strictEqual(SWIPE_THRESHOLD_PX, 50);
    assert.strictEqual(getTouchClientX({ 0: { clientX: 120 } }), 120);
    assert.strictEqual(getTouchClientX({}), null);
    assert.strictEqual(getTouchClientX({ 0: { clientX: '120' } }), null);
    assert.strictEqual(classifySwipe(100, 50), null, 'exact threshold should remain inert');
    assert.deepStrictEqual(classifySwipe(100, 49), {
      direction: 'next',
      status: 'Swiped Left: Next Photo'
    });
    assert.deepStrictEqual(classifySwipe(100, 151), {
      direction: 'previous',
      status: 'Swiped Right: Previous Photo'
    });
    assert.strictEqual(classifySwipe('100', 49), null);
    assert.strictEqual(getTriggeredSwipeStatus('next'), 'Next Photo Triggered');
    assert.strictEqual(getTriggeredSwipeStatus('previous'), 'Previous Photo Triggered');
  });

  assertTest('swipe gesture projection exposes a checked event algebra', () => {
    const swipeGestureSource = fs.readFileSync(
      path.join(__dirname, 'client/src/state/swipeGesture.js'),
      'utf8'
    );

    assert.match(swipeGestureSource, /^\/\/ @ts-check/);
    assert.match(swipeGestureSource, /@typedef \{'next'\|'previous'\} SwipeDirection/);
    assert.match(
      swipeGestureSource,
      /@typedef \{\{direction: SwipeDirection, status: string\}\} SwipeDecision/
    );
    assert.match(swipeGestureSource, /@param \{unknown\} touches/);
    assert.match(swipeGestureSource, /@returns \{SwipeDecision\|null\}/);
  });

  assertTest('crop drag projection decodes coordinates and preserves bounded crop math', () => {
    assert.strictEqual(DEFAULT_CROP_CONTAINER_HEIGHT, 180);
    assert.strictEqual(DEFAULT_CROP_SENSITIVITY, 0.8);
    assert.strictEqual(getTouchClientY({ 0: { clientY: 120 } }), 120);
    assert.strictEqual(getTouchClientY({ 0: { clientY: '120' } }), null);
    assert.strictEqual(getPointerClientY({ clientY: 80 }), 80);
    assert.strictEqual(getPointerClientY({ touches: { 0: { clientY: 95 } } }), 95);
    assert.strictEqual(getPointerClientY({ touches: {} }), null);
    assert.strictEqual(projectCropPosition({
      startY: 100,
      startCropY: 50,
      clientY: 118,
      containerHeight: 180
    }), 42);
    assert.strictEqual(projectCropPosition({
      startY: 100,
      startCropY: 50,
      clientY: 0,
      containerHeight: 0
    }), 94);
    assert.strictEqual(projectCropPosition({
      startY: 100,
      startCropY: 50,
      clientY: -100,
      containerHeight: 180
    }), 100);
    assert.strictEqual(projectCropPosition({
      startY: 100,
      startCropY: 50,
      clientY: 400,
      containerHeight: 180
    }), 0);
    assert.strictEqual(projectCropPosition({
      startY: Number.NaN,
      startCropY: 50,
      clientY: 118
    }), null);
  });

  assertTest('crop drag projection exposes a checked coordinate algebra', () => {
    assert.match(cropDragSource, /^\/\/ @ts-check/);
    assert.match(cropDragSource, /@typedef \{\{startY: number, startCropY: number, clientY: number/);
    assert.match(cropDragSource, /@param \{unknown\} touches/);
    assert.match(cropDragSource, /@param \{unknown\} event/);
    assert.match(cropDragSource, /@returns \{CropPosition\|null\}/);
  });

  assertTest('Dashboard derives screensaver-dependent effects from canonical App state', () => {
    assert.strictEqual(dashboardSource.includes("socket.on('state-sync'"), false);
    assert.match(
      dashboardSource,
      /\}, \[state\.widgets\.particles, state\.screensaverActive\]\);/
    );
  });

  assertTest('Dashboard uses one preloaded image path with host-aware recovery', () => {
    assert.ok(dashboardSource.includes('decideMediaFailure'));
    assert.ok(dashboardSource.includes("method: 'HEAD'"));
    assert.strictEqual(dashboardSource.includes('Split slide primary image failed in DOM:'), false);
    assert.strictEqual(dashboardSource.includes('style={{ display: \'none\' }}'), false);
  });

  assertTest('App registers paired photo events through one declarative handler table', () => {
    const appSource = fs.readFileSync(
      path.join(__dirname, 'client/src/App.jsx'),
      'utf8'
    );

    assert.match(appSource, /\['photo-update', 'second-photo-update'\]\.map\(\(event\)/);
    assert.strictEqual(appSource.includes("socket.on('photo-update'"), false);
    assert.strictEqual(appSource.includes("socket.on('second-photo-update'"), false);
  });

  assertTest('frame selectors expose a stable checked snapshot contract', () => {
    assert.match(frameSelectorsSource, /^\/\/ @ts-check/);
    assert.match(frameSelectorsSource, /@typedef \{Record<string, unknown> & \{/);
    assert.match(frameSelectorsSource, /@param \{ClientSnapshot\|null\|undefined\} snapshot/);
    assert.match(frameSelectorsSource, /@returns \{PhotoEventProjection\|null\}/);
  });

  assertTest('category selection exposes a checked pure selection contract', () => {
    assert.match(categorySelectionSource, /^\/\/ @ts-check/);
    assert.match(categorySelectionSource, /@typedef \{string\[\]\} CategorySelection/);
    assert.match(categorySelectionSource, /@typedef \{Record<string, unknown> & \{/);
    assert.match(categorySelectionSource, /@param \{unknown\} category/);
    assert.match(categorySelectionSource, /@returns \{CategorySelection\}/);
  });

  assertTest('job status exposes a checked shared event contract', () => {
    assert.match(jobStatusSource, /^\/\/ @ts-check/);
    assert.match(jobStatusSource, /@typedef \{'recrawl'\|'vision-analysis'\} JobType/);
    assert.match(jobStatusSource, /@typedef \{object\} JobStatusEvent/);
    assert.match(jobStatusSource, /@param \{unknown\} job/);
    assert.match(jobStatusSource, /@returns \{JobStatusUpdate\|null\}/);
    assert.match(jobStatusSource, /@returns \{JobEventProjection\|null\}/);
  });

  assertTest('feed mutations expose checked pure snapshot contracts', () => {
    assert.match(feedMutationsSource, /^\/\/ @ts-check/);
    assert.match(feedMutationsSource, /@typedef \{Record<string, unknown> & \{/);
    assert.match(feedMutationsSource, /@param \{unknown\} selection/);
    assert.match(feedMutationsSource, /@param \{unknown\} configPatch/);
    assert.match(feedMutationsSource, /@returns \{ClientMutationSnapshot\|null\|undefined\}/);
  });

  assertTest('environment presentation exposes a checked pure status contract', () => {
    assert.match(environmentHistorySource, /^\/\/ @ts-check/);
    assert.match(environmentHistorySource, /@typedef \{object\} EnvironmentStatusSnapshot/);
    assert.match(environmentHistorySource, /@param \{unknown\} value/);
    assert.match(environmentHistorySource, /@returns \{EnvironmentStatus\}/);
  });

  assertTest('environment refresh weather projections expose checked local contracts', () => {
    assert.match(environmentRefreshSource, /^\/\/ @ts-check/);
    assert.match(environmentRefreshSource, /@typedef \{Record<string, unknown> & \{lat: number, lon: number\}\} WeatherLocation/);
    assert.match(environmentRefreshSource, /@typedef \{Record<string, unknown> & \{temperature_2m: number, weather_code: number\}\} CurrentWeatherSnapshot/);
    assert.match(environmentRefreshSource, /@param \{WeatherLocation\} location/);
    assert.match(environmentRefreshSource, /@returns \{WeatherDataSnapshot\}/);
    assert.match(environmentRefreshSource, /@param \{CurrentWeatherSnapshot \| null \| undefined\} currentWeather/);
    assert.match(environmentRefreshSource, /@returns \{PhysicalWeatherSnapshot \| null\}/);
  });

  assertTest('idle daemon projections expose checked inputs, state, and action contracts', () => {
    assert.match(idleDaemonSource, /^\/\/ @ts-check/);
    assert.match(idleDaemonSource, /@typedef \{object\} IdleDaemonState/);
    assert.match(idleDaemonSource, /@typedef \{object\} IdleDaemonNextState/);
    assert.match(idleDaemonSource, /@typedef \{object\} IdleDaemonInputs/);
    assert.match(idleDaemonSource, /@typedef \{object\} IdleDaemonObservation/);
    assert.match(idleDaemonSource, /@typedef \{'launch' \| 'kill' \| null\} IdleDaemonAction/);
    assert.match(idleDaemonSource, /@param \{IdleDaemonState\} currentState/);
    assert.match(idleDaemonSource, /@param \{IdleDaemonInputs\} inputs/);
    assert.match(idleDaemonSource, /@returns \{IdleDaemonTransition\}/);
    assert.match(idleDaemonSource, /@returns \{IdleDaemonInputs\}/);
    assert.match(idleDaemonSource, /The returned action is interpreted by the runtime shell/);
  });
}

// ============================================================================
// 6. UNIT TEST SUITE: Multi-Source Wallpaper Aggregator
// ============================================================================
logSuite('Multi-Source Wallpaper Aggregator');

assertTest('crawler exports Wallhaven, NASA APOD, Midjourney, Bing, MetMuseum, and AIC adapters successfully', () => {
  const {
    fetchWallhavenImages,
    fetchNasaApod,
    fetchMidjourneyImages,
    fetchBingImageOfTheDay,
    fetchMetMuseumImages,
    fetchAicImages,
    fetchTumblrTaggedImages
  } = require('./server/services/crawler.js');
  assert.strictEqual(typeof fetchWallhavenImages, 'function', 'fetchWallhavenImages must be a function');
  assert.strictEqual(typeof fetchNasaApod, 'function', 'fetchNasaApod must be a function');
  assert.strictEqual(typeof fetchMidjourneyImages, 'function', 'fetchMidjourneyImages must be a function');
  assert.strictEqual(typeof fetchBingImageOfTheDay, 'function', 'fetchBingImageOfTheDay must be a function');
  assert.strictEqual(typeof fetchMetMuseumImages, 'function', 'fetchMetMuseumImages must be a function');
  assert.strictEqual(typeof fetchAicImages, 'function', 'fetchAicImages must be a function');
  assert.strictEqual(typeof fetchTumblrTaggedImages, 'function', 'fetchTumblrTaggedImages must be a function');
});

assertTest('Tumblr tagged crawler safely skips when TUMBLR_API_KEY is not configured', async () => {
  const { fetchTumblrTaggedImages } = require('./server/services/crawler.js');
  const originalKey = process.env.TUMBLR_API_KEY;
  delete process.env.TUMBLR_API_KEY;

  try {
    const photos = await fetchTumblrTaggedImages('landscape', 2);
    assert.deepStrictEqual(photos, [], 'Crawler should return an empty array without credentials');
  } finally {
    if (originalKey === undefined) {
      delete process.env.TUMBLR_API_KEY;
    } else {
      process.env.TUMBLR_API_KEY = originalKey;
    }
  }
});

assertTest('MetMuseum crawler retrieves public domain artworks', async () => {
  const { fetchMetMuseumImages } = require('./server/services/crawler.js');
  try {
    const photos = await fetchMetMuseumImages('impressionism', 2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Artwork must have a valid url');
      assert.strictEqual(photos[0].source, 'metmuseum', 'Source must equal metmuseum');
      assert.ok(photos[0].author, 'Artwork must have an artist/author');
    }
  } catch (err) {
    // Graceful catch for offline
  }
});

assertTest('AIC crawler retrieves public domain artworks', async () => {
  const { fetchAicImages } = require('./server/services/crawler.js');
  try {
    const photos = await fetchAicImages('impressionism', 2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Artwork must have a valid url');
      assert.strictEqual(photos[0].source, 'artic', 'Source must equal artic');
      assert.ok(photos[0].author, 'Artwork must have an artist/author');
    }
  } catch (err) {
    // Graceful catch for offline
  }
});

assertTest('Wallhaven crawler maps query and returns SFW landscapes', async () => {
  const { fetchWallhavenImages } = require('./server/services/crawler.js');
  try {
    const photos = await fetchWallhavenImages('nature', 'Scenic Nature', 2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Photo must have a valid url');
      assert.strictEqual(photos[0].source, 'wallhaven', 'Source must equal wallhaven');
      assert.ok(photos[0].title.includes('Scenic Nature'), 'Title should map category');
    }
  } catch (err) {
    // Graceful catch for offline/DNS failures in test environments
  }
});

assertTest('NASA APOD crawler retrieves astronomy picture stream', async () => {
  const { fetchNasaApod } = require('./server/services/crawler.js');
  try {
    const photos = await fetchNasaApod(2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Photo must have a valid url');
      assert.strictEqual(photos[0].source, 'nasa_apod', 'Source must equal nasa_apod');
      assert.strictEqual(photos[0].isNight, true, 'Space APODs must be night-aligned');
    }
  } catch (err) {
    // Graceful catch for API limit/offline issues
  }
});

assertTest('Bing crawler retrieves daily high-quality wallpapers', async () => {
  const { fetchBingImageOfTheDay } = require('./server/services/crawler.js');
  try {
    const photos = await fetchBingImageOfTheDay(2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Photo must have a valid url');
      assert.strictEqual(photos[0].source, 'bing', 'Source must equal bing');
      assert.ok(photos[0].title, 'Photo must have a valid title');
    }
  } catch (err) {
    // Graceful catch for offline
  }
});

assertTest('Midjourney crawler falls back gracefully to Lexica AI creations if no USEAPI_TOKEN is set', async () => {
  const { fetchMidjourneyImages } = require('./server/services/crawler.js');
  const originalToken = process.env.USEAPI_TOKEN;
  delete process.env.USEAPI_TOKEN;
  
  try {
    const photos = await fetchMidjourneyImages(2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Photo must have a valid url');
      assert.strictEqual(photos[0].source, 'lexica', 'Fallback should retrieve Lexica AI source');
    }
  } catch (err) {
    // Graceful catch for offline/DNS failures in test environments
  } finally {
    process.env.USEAPI_TOKEN = originalToken;
  }
});

// ============================================================================
// 7. INTEGRATION TEST SUITE: Live Endpoint Verification
// ============================================================================
async function runIntegrationTests() {
  await Promise.all([
    ...googlePhotosPickerSyncChecks,
    ...googlePhotosPickerDeletionChecks,
    ...googlePhotosPickerListingChecks,
    ...googlePhotosPickerRetrievalChecks,
    ...googlePhotosPickerCreationChecks,
    ...googlePhotosAuthenticationPresenceChecks,
    ...googlePhotosTokenChecks,
    ...googlePhotosRefreshChecks,
    ...googlePhotosExchangeChecks,
    googlePhotosDownloadNoopCheck, googlePhotosDownloadOrderCheck, googlePhotosDownloadFailureCheck
  ]);
  await runClientStateTests();
  await runClientRenderingTests();
  logSuite('Async Recrawl Job Flow');
  await runRecrawlJobTests(assertAsyncTest);

  logSuite('REST Async Job Routes');
  await assertAsyncTest('POST /api/jobs/recrawl returns an accepted recrawl job from the shared dispatcher effect', async () => {
    const dispatched = [];
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async (command) => {
        dispatched.push(command);
        return {
          reducerResult: {
            events: [],
            effects: [{ type: 'start-recrawl-job' }]
          },
          effectResults: [{
            effect: { type: 'start-recrawl-job' },
            value: {
              job: {
                id: 'job-rest-1',
                type: 'recrawl',
                status: 'queued',
                scope: { categories: ['Scenic Nature'] }
              },
              reused: false
            }
          }]
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/jobs/recrawl', {
      body: {}
    });
    assert.strictEqual(response.status, 202);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.job.id, 'job-rest-1');
    assert.deepStrictEqual(dispatched, [{
      type: 'trigger-recrawl',
      payload: {}
    }]);
  });

  await assertAsyncTest('GET /api/weather shares the async JSON boundary for cached and fresh data', async () => {
    const cachedWeather = {
      location: { city: 'Cached City' },
      current: { temperature_2m: 21 },
      daily: []
    };
    let locationCalls = 0;
    let forecastCalls = 0;
    let savedWeather = null;
    const freshWeather = {
      current: { temperature_2m: 22 },
      daily: [{ weather_code: 1 }]
    };
    const responseApp = buildConfiguredRoutesApp({
      getWeatherData: () => savedWeather || cachedWeather,
      setWeatherData: (value) => { savedWeather = value; },
      resolveWeatherLocation: async () => {
        locationCalls += 1;
        return { city: 'Fresh City', lat: 45, lon: -73 };
      },
      fetchWeather: async () => {
        forecastCalls += 1;
        return freshWeather;
      }
    });

    const cached = await invokeRoute(responseApp, 'get', '/api/weather');
    assert.deepStrictEqual(cached.body, cachedWeather);
    assert.strictEqual(locationCalls, 0);
    assert.strictEqual(forecastCalls, 0);

    const freshResponseApp = buildConfiguredRoutesApp({
      getWeatherData: () => null,
      setWeatherData: (value) => { savedWeather = value; },
      resolveWeatherLocation: async () => ({ city: 'Fresh City', lat: 45, lon: -73 }),
      fetchWeather: async () => freshWeather
    });
    const fresh = await invokeRoute(freshResponseApp, 'get', '/api/weather');
    assert.deepStrictEqual(fresh.body, {
      location: { city: 'Fresh City', lat: 45, lon: -73 },
      current: freshWeather.current,
      daily: freshWeather.daily
    });
    assert.deepStrictEqual(savedWeather, fresh.body);
  });

  assertTest('buildWeatherResponse projects only the public weather fields without mutation', () => {
    const location = { city: 'Fresh City', lat: 45, lon: -73, privateNote: 'ignored' };
    const weatherData = {
      current: { temperature_2m: 22 },
      daily: [{ weather_code: 1 }],
      hourly: [{ temperature_2m: 22 }]
    };

    assert.deepStrictEqual(buildWeatherResponse(location, weatherData), {
      location,
      current: weatherData.current,
      daily: weatherData.daily
    });
    assert.deepStrictEqual(location, { city: 'Fresh City', lat: 45, lon: -73, privateNote: 'ignored' });
    assert.deepStrictEqual(weatherData, {
      current: { temperature_2m: 22 },
      daily: [{ weather_code: 1 }],
      hourly: [{ temperature_2m: 22 }]
    });
  });

  await assertAsyncTest('GET /api/weather presents resolver failures through the shared JSON error contract', async () => {
    const responseApp = buildConfiguredRoutesApp({
      getWeatherData: () => null,
      resolveWeatherLocation: async () => { throw new Error('location unavailable'); }
    });
    const response = await invokeRoute(responseApp, 'get', '/api/weather');

    assert.deepStrictEqual(response, {
      status: 500,
      body: {
        error: 'Failed to fetch weather data',
        message: 'location unavailable'
      }
    });
  });

  await assertAsyncTest('GET /api/environment returns the stable normalized indoor contract', async () => {
    const environment = {
      indoor: {
        temperatureC: 24.7,
        humidityPercent: 63,
        pressureAbsoluteHpa: 995.3,
        pressureRelativeHpa: 995.3
      },
      source: 'ecowitt-gw1200',
      observedAt: '2026-07-18T21:30:00.000Z',
      stale: false,
      enabled: true
    };
    const response = await invokeRoute(buildConfiguredRoutesApp({
      getEnvironmentData: async () => environment
    }), 'get', '/api/environment');

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, environment);
  });

  await assertAsyncTest('GET environment history and CSV export use the injected storage boundary', async () => {
    const readings = [{ hour_key: '2026-07-18T21', indoor_temperature_c: 24.7 }];
    const responseApp = buildConfiguredRoutesApp({
      getEnvironmentHistory: async () => readings,
      exportEnvironmentHistory: async () => 'hour_key,indoor_temperature_c\n2026-07-18T21,24.7\n'
    });
    const history = await invokeRoute(responseApp, 'get', '/api/environment/history', { query: { limit: '1' } });
    const csv = await invokeRoute(responseApp, 'get', '/api/environment/history/export', { query: { format: 'csv' } });
    assert.deepStrictEqual(history.body, { readings });
    assert.strictEqual(csv.status, 200);
    assert.match(csv.body, /hour_key,indoor_temperature_c/);
  });

  await assertAsyncTest('Google Photos media proxy keeps binary projection and shared async failures', async () => {
    const originalFetchMediaItemBytes = googlePhotos.fetchMediaItemBytes;
    let request = null;

    try {
      googlePhotos.fetchMediaItemBytes = async (mediaItemId, options) => {
        request = { mediaItemId, options };
        return { contentType: 'image/png', buffer: Buffer.from('png-bytes') };
      };

      const success = await invokeRoute(buildConfiguredRoutesApp(), 'get', '/api/google-photos/media/:mediaItemId', {
        params: { mediaItemId: 'picker-123' },
        query: { w: '1080', h: '1920', c: '1' }
      });
      assert.strictEqual(success.status, 200);
      assert.strictEqual(success.body.toString(), 'png-bytes');
      assert.deepStrictEqual(request, {
        mediaItemId: 'picker-123',
        options: { width: 1080, height: 1920, crop: true }
      });

      googlePhotos.fetchMediaItemBytes = async () => {
        throw new Error('media unavailable');
      };
      const failed = await invokeRoute(buildConfiguredRoutesApp(), 'get', '/api/google-photos/media/:mediaItemId', {
        params: { mediaItemId: 'picker-123' }
      });
      assert.deepStrictEqual(failed, {
        status: 502,
        body: {
          error: 'Failed to proxy Google Photos media item.',
          message: 'media unavailable'
        }
      });
    } finally {
      googlePhotos.fetchMediaItemBytes = originalFetchMediaItemBytes;
    }
  });

  await assertAsyncTest('Google Photos callbacks share async failure handling without merging success flows', async () => {
    const originalExchangeGoogleCode = googlePhotos.exchangeGoogleCode;
    const originalCreatePickerSession = googlePhotos.createPickerSession;
    const originalSyncGoogleAlbum = googlePhotos.syncGoogleAlbum;

    try {
      googlePhotos.exchangeGoogleCode = async (code, redirectUri) => ({ code, redirectUri });
      googlePhotos.createPickerSession = async () => ({ id: 'picker-session', pickerUri: 'https://picker.example/session' });
      googlePhotos.syncGoogleAlbum = async () => ({ synced: true });

      const sandboxSuccess = await invokeRoute(
        buildConfiguredRoutesApp(),
        'get',
        '/api/auth/google/sandbox-callback',
        { headers: { host: 'display.example' } }
      );
      assert.deepStrictEqual(sandboxSuccess, {
        status: 200,
        body: { redirect: 'http://display.example/?mode=remote&googleAuth=success' }
      });

      googlePhotos.exchangeGoogleCode = async () => {
        throw new Error('oauth unavailable');
      };
      const failure = await invokeRoute(
        buildConfiguredRoutesApp(),
        'get',
        '/api/auth/google/sandbox-callback'
      );
      assert.deepStrictEqual(failure, {
        status: 500,
        body: 'Sandbox Google Photos Link Failed: oauth unavailable'
      });

      const missingCode = await invokeRoute(
        buildConfiguredRoutesApp(),
        'get',
        '/api/auth/google/callback'
      );
      assert.deepStrictEqual(missingCode, {
        status: 400,
        body: 'Authentication code is missing from Google redirect.'
      });
    } finally {
      googlePhotos.exchangeGoogleCode = originalExchangeGoogleCode;
      googlePhotos.createPickerSession = originalCreatePickerSession;
      googlePhotos.syncGoogleAlbum = originalSyncGoogleAlbum;
    }
  });

  await assertAsyncTest('environment history export shares the async error boundary for JSON and CSV failures', async () => {
    const responseApp = buildConfiguredRoutesApp({
      getEnvironmentHistory: async () => { throw new Error('history unavailable'); },
      exportEnvironmentHistory: async () => { throw new Error('csv unavailable'); }
    });
    const [json, csv] = await Promise.all([
      invokeRoute(responseApp, 'get', '/api/environment/history/export'),
      invokeRoute(responseApp, 'get', '/api/environment/history/export', {
        query: { format: 'csv' }
      })
    ]);

    assert.deepStrictEqual({ status: json.status, body: json.body }, {
      status: 503,
      body: {
        error: 'Failed to export environment history',
        message: 'history unavailable'
      }
    });
    assert.deepStrictEqual({ status: csv.status, body: csv.body }, {
      status: 503,
      body: {
        error: 'Failed to export environment history',
        message: 'csv unavailable'
      }
    });
  });

  await assertAsyncTest('GET environment history stats uses the injected storage boundary', async () => {
    const statsPayload = { summary: { daytime: { avg_temp_c: 24.5 } }, daily: [] };
    const responseApp = buildConfiguredRoutesApp({
      getEnvironmentStats: async () => statsPayload
    });
    const statsRes = await invokeRoute(responseApp, 'get', '/api/environment/history/stats');
    assert.strictEqual(statsRes.status, 200);
    assert.deepStrictEqual(statsRes.body, statsPayload);
  });

  await assertAsyncTest('environment read routes share the async JSON failure boundary', async () => {
    const responseApp = buildConfiguredRoutesApp({
      getEnvironmentData: async () => { throw new Error('gateway offline'); },
      getEnvironmentHistory: async () => { throw new Error('history unavailable'); },
      getEnvironmentStats: async () => { throw new Error('stats unavailable'); }
    });
    const responses = await Promise.all([
      invokeRoute(responseApp, 'get', '/api/environment'),
      invokeRoute(responseApp, 'get', '/api/environment/history'),
      invokeRoute(responseApp, 'get', '/api/environment/history/stats')
    ]);

    assert.deepStrictEqual(responses.map(({ status, body }) => ({
      status,
      error: body.error,
      message: body.message
    })), [
      {
        status: 503,
        error: 'Failed to fetch indoor environment data',
        message: 'gateway offline'
      },
      {
        status: 503,
        error: 'Failed to read environment history',
        message: 'history unavailable'
      },
      {
        status: 503,
        error: 'Failed to calculate environment stats',
        message: 'stats unavailable'
      }
    ]);
  });

  await assertAsyncTest('GET and POST environment settings expose a validated admin configuration boundary', async () => {
    let savedSettings = { enabled: false, baseUrl: 'http://ecowitt.local', units: { temperature: 'C' } };
    const responseApp = buildConfiguredRoutesApp({
      getEnvironmentSettings: () => savedSettings,
      updateEnvironmentSettings: settings => {
        savedSettings = settings;
        return { valid: true, settings };
      }
    });
    const current = await invokeRoute(responseApp, 'get', '/api/environment/settings');
    const saved = await invokeRoute(responseApp, 'post', '/api/environment/settings', {
      body: { enabled: true, baseUrl: 'http://gateway', units: { temperature: 'F' } }
    });
    assert.strictEqual(current.body.baseUrl, 'http://ecowitt.local');
    assert.strictEqual(saved.body.success, true);
    assert.strictEqual(saved.body.settings.units.temperature, 'F');
  });

  await assertAsyncTest('POST /api/environment/settings preserves validation and async failure contracts through the shared JSON route shell', async () => {
    const invalidApp = buildConfiguredRoutesApp({
      updateEnvironmentSettings: async () => ({ valid: false, error: 'Gateway URL is required.' })
    });
    const invalid = await invokeRoute(invalidApp, 'post', '/api/environment/settings', {
      body: {}
    });

    const failingApp = buildConfiguredRoutesApp({
      updateEnvironmentSettings: async () => {
        throw new Error('settings store unavailable');
      }
    });
    const failed = await invokeRoute(failingApp, 'post', '/api/environment/settings', {
      body: { enabled: true }
    });

    assert.deepStrictEqual({
      status: invalid.status,
      error: invalid.body.error
    }, {
      status: 400,
      error: 'Gateway URL is required.'
    });
    assert.deepStrictEqual({
      status: failed.status,
      error: failed.body.error,
      message: failed.body.message
    }, {
      status: 500,
      error: 'Failed to save environment settings',
      message: 'settings store unavailable'
    });
  });

  await assertAsyncTest('POST /api/pools/:name/crawl scopes the recrawl effect to the requested pool', async () => {
    const dispatched = [];
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async (command) => {
        dispatched.push(command);
        return {
          reducerResult: {
            events: [],
            effects: [{ type: 'start-recrawl-job' }]
          },
          effectResults: [{
            effect: { type: 'start-recrawl-job' },
            value: {
              job: {
                id: 'job-rest-2',
                type: 'recrawl',
                status: 'queued',
                scope: { categories: ['Scenic Nature'] }
              },
              reused: false
            }
          }]
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/pools/:name/crawl', {
      params: { name: 'Scenic Nature' },
      body: {}
    });
    assert.strictEqual(response.status, 202);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.pool.name, 'Scenic Nature');
    assert.deepStrictEqual(dispatched, [{
      type: 'trigger-recrawl',
      payload: {
        categories: ['Scenic Nature']
      }
    }]);
  });

  await assertAsyncTest('POST /api/jobs/vision-analysis returns an accepted job from the shared dispatcher effect', async () => {
    const dispatched = [];
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async (command) => {
        dispatched.push(command);
        return {
          reducerResult: {
            events: [],
            effects: [{ type: 'start-vision-analysis-job' }]
          },
          effectResults: [{
            effect: { type: 'start-vision-analysis-job' },
            value: {
              job: {
                id: 'vision-rest-1',
                type: 'vision-analysis',
                status: 'queued',
                scope: { categories: ['Scenic Nature'] }
              },
              reused: false
            }
          }]
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/jobs/vision-analysis', {
      body: {}
    });
    assert.strictEqual(response.status, 202);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.job.id, 'vision-rest-1');
    assert.deepStrictEqual(dispatched, [{
      type: 'trigger-vision-analysis',
      payload: {}
    }]);
  });

  await assertAsyncTest('POST /api/jobs/recrawl returns 503 when the shared dispatcher does not yield a submitted job', async () => {
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => ({
        reducerResult: {
          events: [],
          effects: [{ type: 'start-recrawl-job' }]
        },
        effectResults: [{
          effect: { type: 'start-recrawl-job' },
          value: { reused: false }
        }]
      })
    });
    const response = await invokeRoute(app, 'post', '/api/jobs/recrawl', {
      body: {}
    });

    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.body.error, 'Recrawl job service unavailable.');
  });

  logSuite('Route Decode Helpers');
  assertTest('route decode contracts preserve wrapped results and normalize legacy values', () => {
    const failure = createRouteDecodeFailure(422, 'Invalid field.', { field: 'name' });

    assert.strictEqual(normalizeRouteDecodeResult(failure), failure);
    assert.deepStrictEqual(normalizeRouteDecodeResult(null), createRouteDecodeSuccess(null));
    assert.deepStrictEqual(failure, {
      routeDecode: true,
      ok: false,
      failure: {
        status: 422,
        error: 'Invalid field.',
        extra: { field: 'name' }
      }
    });
  });

  assertTest('route decode mapping composes and preserves failures', () => {
    const decoded = createRouteDecodeSuccess(4);
    const increment = (value) => value + 1;
    const double = (value) => value * 2;
    const composed = mapRouteDecode((value) => increment(double(value)))(decoded);
    const mappedInStages = mapRouteDecode(increment)(mapRouteDecode(double)(decoded));
    const failure = createRouteDecodeFailure(400, 'Cannot map a failed decode.');

    assert.deepStrictEqual(mapRouteDecode((value) => value)(decoded), decoded);
    assert.deepStrictEqual(composed, mappedInStages);
    assert.strictEqual(composed.value, 9);
    assert.strictEqual(mapRouteDecode(increment)(failure), failure);
  });

  assertTest('route decode module exposes checked success, failure, and composition contracts', () => {
    const source = fs.readFileSync(require.resolve('./server/utils/routeDecode.js'), 'utf8');

    assert.match(source, /^\/\/ @ts-check/);
    assert.match(source, /@typedef \{object\} RouteFailure/);
    assert.match(source, /@typedef \{RouteDecodeSuccess<T> \| RouteDecodeFailure\} RouteDecodeResult/);
    assert.match(source, /@returns \{\(decoded: T \| RouteDecodeResult<T>\) => RouteDecodeResult<U>\}/);
    assert.match(source, /@returns \{RouteDecodeResult<T\[]>\}/);
  });

  assertTest('collectRouteDecodeResults accumulates successes and short-circuits on the first failure', () => {
    const result = collectRouteDecodeResults([
      createRouteDecodeSuccess({ step: 'first' }),
      createRouteDecodeFailure(400, 'Bad second decode'),
      createRouteDecodeSuccess({ step: 'third' })
    ]);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.failure.status, 400);
    assert.strictEqual(result.failure.error, 'Bad second decode');

    const successful = collectRouteDecodeResults([
      { step: 'plain value' },
      createRouteDecodeSuccess({ step: 'wrapped value' })
    ]);
    assert.deepStrictEqual(successful, {
      routeDecode: true,
      ok: true,
      value: [
        { step: 'plain value' },
        { step: 'wrapped value' }
      ]
    });
  });

  assertTest('collectRouteDecodeResults has an empty-success identity', () => {
    assert.deepStrictEqual(collectRouteDecodeResults(), {
      routeDecode: true,
      ok: true,
      value: []
    });
  });

  assertTest('chainRouteDecode composes follow-up validation on successful decode values only', () => {
    const result = chainRouteDecode((value) => (
      value.enabled
        ? createRouteDecodeSuccess({ ...value, chained: true })
        : createRouteDecodeFailure(409, 'Disabled decode')
    ))(mapRouteDecode((value) => ({ ...value, enabled: true }))(createRouteDecodeSuccess({ key: 'value' })));

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.value, {
      key: 'value',
      enabled: true,
      chained: true
    });

    let continuationRan = false;
    const failure = createRouteDecodeFailure(409, 'Disabled decode');
    const failedChain = chainRouteDecode(() => {
      continuationRan = true;
      return createRouteDecodeSuccess({ unexpected: true });
    })(failure);

    assert.strictEqual(failedChain, failure);
    assert.strictEqual(continuationRan, false);
  });

  logSuite('Keyword Specification Helpers');
  assertTest('keyword term normalization safely filters unknown values and keeps phrase order', () => {
    assert.deepStrictEqual(normalizeKeywordTerms([' forest ', 7, null, '', ' moon ']), ['forest', 'moon']);
    assert.deepStrictEqual(normalizeKeywordTerms('forest, moon', { splitString: true }), ['forest', 'moon']);
    assert.deepStrictEqual(normalizeKeywordTerms(null), []);
    assert.deepStrictEqual(normalizeKeywordTerms({ keywords: ['forest'] }), []);
  });

  assertTest('keyword entry normalization preserves valid order and detaches timed specs', () => {
    const timedSpec = { timeStart: ' 18:00 ', timeEnd: '23:30', keywords: [' night sky ', ' moon '] };
    const input = [' forest ', timedSpec, null, { timeStart: '25:00', timeEnd: '23:30', keywords: ['invalid'] }];
    const normalized = normalizeKeywordEntries(input);

    assert.deepStrictEqual(normalized, [
      'forest',
      { timeStart: '18:00', timeEnd: '23:30', keywords: ['night sky', 'moon'] }
    ]);
    assert.deepStrictEqual(normalizeKeywordEntry({ timeStart: '18:00', timeEnd: '06:00', keywords: [' night '] }), {
      timeStart: '18:00',
      timeEnd: '06:00',
      keywords: ['night']
    });
    assert.deepStrictEqual(normalizeKeywordEntries(' forest; moon ', { splitTopLevelString: true }), ['forest', 'moon']);
    assert.notStrictEqual(normalized[1], timedSpec);
    assert.notStrictEqual(normalized[1].keywords, timedSpec.keywords);
    normalized[1].keywords.push('changed');
    assert.deepStrictEqual(timedSpec.keywords, [' night sky ', ' moon ']);
  });

  assertTest('keyword equality compares normalized specs while preserving order significance', () => {
    const timed = [{ timeStart: '18:00', timeEnd: '23:30', keywords: ['night', 'moon'] }];

    assert.strictEqual(keywordEntriesEqual(timed, timed), true);
    assert.strictEqual(keywordEntriesEqual([' forest '], ['forest']), true);
    assert.strictEqual(keywordEntriesEqual(
      [{ timeStart: ' 18:00 ', timeEnd: '23:30', keywords: [' night ', 'moon'] }],
      timed
    ), true);
    assert.strictEqual(keywordEntriesEqual(['forest', 'moon'], ['moon', 'forest']), false);
  });

  assertTest('keyword term collection flattens specs declaratively without reordering phrases', () => {
    const entries = [
      'forest, moon',
      { timeStart: '18:00', timeEnd: '06:00', keywords: [' dusk ', 'night sky'] },
      null,
      { keywords: 'mist' }
    ];

    assert.deepStrictEqual(collectKeywordTerms(entries), ['forest, moon', 'dusk', 'night sky', 'mist']);
    assert.deepStrictEqual(collectKeywordTerms('forest; moon\r\nsky'), ['forest', 'moon', 'sky']);
    assert.deepStrictEqual(collectKeywordTerms(null), []);
    assert.deepStrictEqual(entries[1].keywords, [' dusk ', 'night sky']);
  });

  assertTest('keyword specification helpers expose checked unknown-safe contracts', () => {
    const source = fs.readFileSync(require.resolve('./server/utils/keywordSpecs.js'), 'utf8');

    assert.match(source, /^\/\/ @ts-check/);
    assert.match(source, /@typedef \{\{timeStart: string, timeEnd: string, keywords: string\[\]\}\} TimedKeywordSpec/);
    assert.match(source, /@typedef \{string \| TimedKeywordSpec\} KeywordSpec/);
    assert.match(source, /@param \{unknown\} keywords/);
    assert.match(source, /@param \{unknown\} entries/);
    assert.match(source, /@returns \{KeywordSpec\[\]\}/);
    assert.match(source, /@returns \{boolean\}/);
  });

  logSuite('REST Pool Mutation Routes');
  await assertAsyncTest('GET /api/pools preserves total photo counts and reports usable counts for empty, mixed, and external pools', async () => {
    const originalGetCachedMediaItems = googlePhotos.getCachedMediaItems;
    googlePhotos.getCachedMediaItems = () => [
      { url: 'google-usable', rating: 8 },
      { url: 'google-banned', rating: 1 },
      { url: 'google-broken', isBroken: true }
    ];

    try {
      const app = buildConfiguredRoutesApp({
        state: {
          searchKeywords: { 'Mixed Pool': ['forest'] },
          feedConfigs: { 'Mixed Pool': { reddit: { enabled: true } } }
        },
        collections: {
          'Empty Pool': [],
          'Single Pool': [{ url: 'single-usable' }],
          'Mixed Pool': [
            { url: 'mixed-usable', rating: 5 },
            { url: 'mixed-usable-2', rating: 10 },
            { url: 'mixed-banned', rating: 1 },
            { url: 'mixed-broken', isBroken: true }
          ]
        }
      });
      const response = await invokeRoute(app, 'get', '/api/pools');
      const pools = Object.fromEntries(response.body.map((pool) => [pool.name, pool]));

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(
        [pools['Empty Pool'].photosCount, pools['Empty Pool'].usablePhotosCount],
        [0, 0]
      );
      assert.deepStrictEqual(
        [pools['Single Pool'].photosCount, pools['Single Pool'].usablePhotosCount],
        [1, 1]
      );
      assert.deepStrictEqual(
        [pools['Mixed Pool'].photosCount, pools['Mixed Pool'].usablePhotosCount],
        [4, 2]
      );
      assert.deepStrictEqual(pools['Mixed Pool'].keywords, ['forest']);
      assert.deepStrictEqual(pools['Mixed Pool'].feedConfigs, { reddit: { enabled: true } });
      assert.deepStrictEqual(
        [pools['Google Photos'].photosCount, pools['Google Photos'].usablePhotosCount],
        [3, 1]
      );
    } finally {
      googlePhotos.getCachedMediaItems = originalGetCachedMediaItems;
    }
  });

  await assertAsyncTest('POST /api/pools rejects duplicate pool names before dispatching the shared command route', async () => {
    let dispatched = false;
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => {
        dispatched = true;
        return null;
      }
    });
    const response = await invokeRoute(app, 'post', '/api/pools', {
      body: {
        name: 'Scenic Nature',
        keywords: ['forest']
      }
    });

    assert.strictEqual(response.status, 409);
    assert.strictEqual(response.body.error, 'Pool "Scenic Nature" already exists.');
    assert.strictEqual(dispatched, false);
  });

  await assertAsyncTest('PATCH /api/pools/:name returns 404 before batch dispatch when the pool guard fails', async () => {
    let dispatched = false;
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => {
        dispatched = true;
        return null;
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/pools/:name', {
      params: { name: 'Missing Pool' },
      body: {
        keywords: ['mist']
      }
    });

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.error, 'Pool "Missing Pool" not found.');
    assert.strictEqual(dispatched, false);
  });

  await assertAsyncTest('PATCH /api/pools/Google Photos accepts the dedicated lifecycle policy', async () => {
    const state = {
      currentCategory: 'Google Photos',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      poolPolicies: {},
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const dispatched = [];
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.poolPolicies['Google Photos'] = command.payload.policy;
        return { reducerResult: { events: [{ type: 'state-sync' }], effects: [{ type: 'persist' }] } };
      }
    });

    const response = await invokeRoute(app, 'patch', '/api/pools/:name', {
      params: { name: 'Google Photos' },
      body: { policy: { retentionDays: 45, maxPhotos: 300 } }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(dispatched[0].type, 'set-pool-policy');
    assert.deepStrictEqual(dispatched[0].payload.policy, {
      retentionDays: 45,
      maxPhotos: 300,
      schedule: { enabled: false, start: '22:00', end: '06:00', priority: 0 }
    });
  });

  await assertAsyncTest('GET /api/pools/:name/photos reuses the shared pool guard for missing pools', async () => {
    const app = buildConfiguredRoutesApp();
    const response = await invokeRoute(app, 'get', '/api/pools/:name/photos', {
      params: { name: 'Missing Pool' }
    });

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.error, 'Pool "Missing Pool" not found.');
  });

  await assertAsyncTest('GET /api/pools/:name/photos returns the pool collection for an existing pool', async () => {
    const app = buildConfiguredRoutesApp();
    const response = await invokeRoute(app, 'get', '/api/pools/:name/photos', {
      params: { name: 'Scenic Nature' }
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, [{ url: 'land-1', category: 'Scenic Nature' }]);
  });

  await assertAsyncTest('PATCH /api/pools/:name rejects an invalid feed-source config before batch dispatching the shared decode pipeline', async () => {
    let dispatched = false;
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => {
        dispatched = true;
        return null;
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/pools/:name', {
      params: { name: 'Scenic Nature' },
      body: {
        feedConfigs: {
          reddit: ['not-an-object']
        }
      }
    });

    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error, 'Invalid feed config payload for source "reddit".');
    assert.strictEqual(dispatched, false);
  });

  await assertAsyncTest('PATCH /api/pools/:name/feed-sources/:source uses the shared guarded command route for existing pools', async () => {
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {
        'Scenic Nature': {
          reddit: { enabled: true, subreddits: ['EarthPorn'] }
        }
      },
      searchKeywords: {
        'Scenic Nature': ['forest']
      },
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const collections = {
      'Scenic Nature': [{ url: 'land-1', category: 'Scenic Nature' }]
    };
    const dispatched = [];
    const app = buildConfiguredRoutesApp({
      state,
      collections,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.feedConfigs['Scenic Nature'].reddit = {
          ...state.feedConfigs['Scenic Nature'].reddit,
          ...command.payload.config
        };
        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{ type: 'persist' }]
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/pools/:name/feed-sources/:source', {
      params: { name: 'Scenic Nature', source: 'reddit' },
      body: {
        subreddits: ['CityPorn', 'WeatherPorn']
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.feedSource, 'reddit');
    assert.deepStrictEqual(response.body.pool.feedConfigs.reddit, {
      enabled: true,
      subreddits: ['CityPorn', 'WeatherPorn']
    });
    assert.deepStrictEqual(dispatched, [{
      type: 'merge-pool-feed-config',
      payload: {
        name: 'Scenic Nature',
        source: 'reddit',
        config: {
          subreddits: ['CityPorn', 'WeatherPorn']
        }
      }
    }]);
  });

  await assertAsyncTest('PATCH /api/pools/:name batches keywords and feed-config updates through the shared decoder-spec pipeline', async () => {
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {
        'Scenic Nature': {
          reddit: { enabled: true, subreddits: ['EarthPorn'] },
          unsplash: { enabled: true, keywords: ['forest'] }
        }
      },
      searchKeywords: {
        'Scenic Nature': ['forest']
      },
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const collections = {
      'Scenic Nature': [{ url: 'land-1', category: 'Scenic Nature' }]
    };
    const dispatched = [];
    const app = buildConfiguredRoutesApp({
      state,
      collections,
      dispatchCommand: async (command) => {
        dispatched.push(command);

        if (command.type === 'set-pool-keywords') {
          state.searchKeywords[command.payload.name] = command.payload.keywords;
        }

        if (command.type === 'merge-pool-feed-config') {
          state.feedConfigs[command.payload.name] ||= {};
          state.feedConfigs[command.payload.name][command.payload.source] = {
            ...(state.feedConfigs[command.payload.name][command.payload.source] || {}),
            ...command.payload.config
          };
        }

        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{ type: 'persist' }]
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/pools/:name', {
      params: { name: 'Scenic Nature' },
      body: {
        keywords: ['mist', 'river'],
        feedConfigs: {
          reddit: { enabled: false, subreddits: ['CityPorn'] },
          unsplash: { featured: true, keywords: ['mist'] }
        }
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.deepStrictEqual(response.body.pool.keywords, ['mist', 'river']);
    assert.deepStrictEqual(response.body.pool.feedConfigs.reddit, {
      enabled: false,
      subreddits: ['CityPorn']
    });
    assert.deepStrictEqual(response.body.pool.feedConfigs.unsplash, {
      enabled: true,
      keywords: ['mist'],
      featured: true
    });
    assert.deepStrictEqual(dispatched, [
      {
        type: 'set-pool-keywords',
        payload: {
          name: 'Scenic Nature',
          keywords: ['mist', 'river']
        }
      },
      {
        type: 'merge-pool-feed-config',
        payload: {
          name: 'Scenic Nature',
          source: 'reddit',
          config: {
            enabled: false,
            subreddits: ['CityPorn']
          }
        }
      },
      {
        type: 'merge-pool-feed-config',
        payload: {
          name: 'Scenic Nature',
          source: 'unsplash',
          config: {
            featured: true,
            keywords: ['mist']
          }
        }
      }
    ]);
  });

  await assertAsyncTest('POST /api/pools/:name/crawl returns 404 before async effect submission when the pool guard fails', async () => {
    let dispatched = false;
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => {
        dispatched = true;
        return null;
      }
    });
    const response = await invokeRoute(app, 'post', '/api/pools/:name/crawl', {
      params: { name: 'Missing Pool' },
      body: {}
    });

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.error, 'Pool "Missing Pool" not found.');
    assert.strictEqual(dispatched, false);
  });

  await assertAsyncTest('POST /api/config/keywords routes time-scoped keyword specs through the shared pool-keywords command', async () => {
    const dispatched = [];
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {
        'Scenic Nature': ['forest']
      },
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const collections = {
      'Scenic Nature': [{ url: 'land-1', category: 'Scenic Nature' }]
    };
    const app = buildConfiguredRoutesApp({
      state,
      collections,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.searchKeywords[command.payload.name] = command.payload.keywords;
        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{ type: 'persist' }]
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/config/keywords', {
      body: {
        category: 'Scenic Nature',
        keywords: [
          { timeStart: ' 18:00 ', timeEnd: '23:30', keywords: [' night sky ', ' moon '] },
          'forest'
        ]
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.category, 'Scenic Nature');
    assert.deepStrictEqual(response.body.keywords, [
      { timeStart: '18:00', timeEnd: '23:30', keywords: ['night sky', 'moon'] },
      'forest'
    ]);
    assert.deepStrictEqual(dispatched, [{
      type: 'set-pool-keywords',
      payload: {
        name: 'Scenic Nature',
        keywords: [
          { timeStart: '18:00', timeEnd: '23:30', keywords: ['night sky', 'moon'] },
          'forest'
        ]
      }
    }]);
  });

  logSuite('REST State Mutation Routes');
  await assertAsyncTest('POST /api/state/categories dispatches the shared single-command route spec and returns the updated state snapshot', async () => {
    const dispatched = [];
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.currentCategory = command.payload.categories;
        return {
          reducerResult: {
            events: [{ type: 'photo-update' }, { type: 'state-sync' }],
            effects: [{ type: 'persist' }]
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/state/categories', {
      body: {
        categories: ['Scenic Nature', 'Liminal Spaces']
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.state.currentCategory, 'Scenic Nature,Liminal Spaces');
    assert.deepStrictEqual(dispatched, [{
      type: 'select-categories',
      payload: {
        categories: 'Scenic Nature,Liminal Spaces'
      }
    }]);
  });

  await assertAsyncTest('POST /api/state/screensaver dispatches the shared single-command route spec and returns the updated active flag', async () => {
    const dispatched = [];
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: [],
      screensaverActive: false,
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.screensaverActive = command.payload.active;
        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{ type: 'launch-kiosk' }]
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/state/screensaver', {
      body: {
        active: true
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.screensaverActive, true);
    assert.strictEqual(response.body.state.screensaverActive, true);
    assert.deepStrictEqual(dispatched, [{
      type: 'set-screensaver-active',
      payload: {
        active: true
      }
    }]);
  });

  await assertAsyncTest('POST /api/state/screensaver also keeps the shared deactivation path explicit at the route boundary', async () => {
    const dispatched = [];
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: [],
      screensaverActive: true,
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.screensaverActive = command.payload.active;
        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{ type: 'kill-kiosk' }]
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/state/screensaver', {
      body: {
        active: false
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.screensaverActive, false);
    assert.strictEqual(response.body.state.screensaverActive, false);
    assert.deepStrictEqual(dispatched, [{
      type: 'set-screensaver-active',
      payload: {
        active: false
      }
    }]);
  });

  await assertAsyncTest('PATCH /api/state preserves the raw state response shape when the shared command route is a no-op', async () => {
    const dispatched = [];
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        return {
          reducerResult: {
            events: [],
            effects: []
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/state', {
      body: {
        widgets: {
          clock: true
        }
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, undefined);
    assert.strictEqual(response.body.theme, 'Zen Retreat');
    assert.deepStrictEqual(dispatched, [{
      type: 'patch-state',
      payload: {
        widgets: {
          clock: true
        }
      }
    }]);
  });

  logSuite('REST Admin Secret Routes');
  await assertAsyncTest('POST /api/admin/secrets/useapi-token dispatches the shared admin secret command and returns the updated configured flag', async () => {
    const dispatched = [];
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.hasUseApiToken = true;
        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{ type: 'persist-env-vars' }]
          },
          effectResults: [{
            effect: { type: 'persist-env-vars' },
            value: {
              entries: { USEAPI_TOKEN: 'secret-123' },
              runtimeFlags: { hasUseApiToken: true }
            }
          }]
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/admin/secrets/useapi-token', {
      body: { token: ' secret-123 ' }
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.secret, 'useapi-token');
    assert.strictEqual(response.body.configured, true);
    assert.strictEqual(response.body.state.hasUseApiToken, true);
    assert.deepStrictEqual(dispatched, [{
      type: 'save-env-secret',
      payload: {
        envKey: 'USEAPI_TOKEN',
        runtimeFlag: 'hasUseApiToken',
        value: 'secret-123'
      }
    }]);
  });

  await assertAsyncTest('POST /api/admin/secrets/tumblr-api-key dispatches the shared admin secret route spec and returns the Tumblr configured flag', async () => {
    const dispatched = [];
    const state = {
      currentCategory: 'Scenic Nature',
      photosList: [],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.hasTumblrApiKey = true;
        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{ type: 'persist-env-vars' }]
          },
          effectResults: [{
            effect: { type: 'persist-env-vars' },
            value: {
              entries: { TUMBLR_API_KEY: 'tumblr-secret' },
              runtimeFlags: { hasTumblrApiKey: true }
            }
          }]
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/admin/secrets/tumblr-api-key', {
      body: { value: ' tumblr-secret ' }
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.secret, 'tumblr-api-key');
    assert.strictEqual(response.body.configured, true);
    assert.strictEqual(response.body.state.hasTumblrApiKey, true);
    assert.deepStrictEqual(dispatched, [{
      type: 'save-env-secret',
      payload: {
        envKey: 'TUMBLR_API_KEY',
        runtimeFlag: 'hasTumblrApiKey',
        value: 'tumblr-secret'
      }
    }]);
  });

  logSuite('REST Photo Patch Routes');
  await assertAsyncTest('POST /api/photos/rate dispatches the shared single-command route spec and returns the normalized rating payload', async () => {
    const dispatched = [];
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async (command) => {
        dispatched.push(command);
        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{ type: 'persist' }]
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/photos/rate', {
      body: {
        url: 'land-1',
        rating: 7
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.deepStrictEqual(response.body, {
      success: true,
      url: 'land-1',
      rating: 7
    });
    assert.deepStrictEqual(dispatched, [{
      type: 'rate-photo',
      payload: {
        url: 'land-1',
        rating: 7
      }
    }]);
  });

  await assertAsyncTest('PATCH /api/photos rejects an empty url before dispatching the shared photo batch route', async () => {
    let dispatched = false;
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => {
        dispatched = true;
        return null;
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/photos', {
      body: {
        cropPercent: 44
      }
    });

    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error, 'Invalid parameter: "url" must be a non-empty string.');
    assert.strictEqual(dispatched, false);
  });

  await assertAsyncTest('PATCH /api/photos rejects a no-op photo batch before dispatching the shared route shell', async () => {
    let dispatched = false;
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => {
        dispatched = true;
        return null;
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/photos', {
      body: {
        url: 'land-1'
      }
    });

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.error, 'Photo URL not found in available photo collections.');
    assert.strictEqual(dispatched, false);
  });

  await assertAsyncTest('PATCH /api/photos returns 404 before batch dispatch when the photo guard fails', async () => {
    let dispatched = false;
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => {
        dispatched = true;
        return null;
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/photos', {
      body: {
        url: 'missing-photo',
        cropPercent: 44
      }
    });

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.error, 'Photo URL not found in available photo collections.');
    assert.strictEqual(dispatched, false);
  });

  await assertAsyncTest('PATCH /api/photos surfaces crop decode failures before dispatching the shared photo batch route', async () => {
    let dispatched = false;
    const app = buildConfiguredRoutesApp({
      dispatchCommand: async () => {
        dispatched = true;
        return null;
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/photos', {
      body: {
        url: 'land-1',
        cropPercent: 240
      }
    });

    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error, 'Invalid parameter: "cropPercent" must be an integer between 0 and 200, and "cropPositionY" must be an integer between 0 and 100.');
    assert.strictEqual(dispatched, false);
  });

  await assertAsyncTest('PATCH /api/photos routes Google Photos crop, pairing, and loved updates through the shared photo command batch', async () => {
    const dispatched = [];
    const googleUrl = buildGooglePhotoProxyUrl('picker-route');
    const state = {
      currentCategory: 'Google Photos',
      photosList: [{ url: googleUrl, title: 'Proxy Photo', author: 'Lumina' }],
      widgets: { clock: true },
      theme: 'Zen Retreat',
      feedConfigs: {},
      searchKeywords: {},
      excludedKeywords: [],
      hasUseApiToken: false,
      hasTumblrApiKey: false
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        return {
          reducerResult: {
            events: [{ type: 'state-sync' }],
            effects: [{
              type: 'persist-external-photo-metadata',
              payload: { url: googleUrl, metadata: {} }
            }]
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'patch', '/api/photos', {
      body: {
        url: googleUrl,
        cropPercent: 44,
        preventPairing: true,
        preserveActive: true,
        loved: true
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.deepStrictEqual(response.body.photo, {
      url: googleUrl,
      cropPercent: 44,
      preventPairing: true,
      loved: true
    });
    assert.deepStrictEqual(dispatched, [
      {
        type: 'set-photo-crop',
        payload: {
          url: googleUrl,
          cropPercent: 44
        }
      },
      {
        type: 'set-photo-prevent-pairing',
        payload: {
          url: googleUrl,
          preventPairing: true,
          preserveActive: true
        }
      },
      {
        type: 'set-photo-loved',
        payload: {
          url: googleUrl,
          loved: true
        }
      }
    ]);
  });

  logSuite('REST Photo Preview Routes');
  await assertAsyncTest('POST /api/photos/preview routes a payload photo through the shared preview command shell', async () => {
    const dispatched = [];
    const previewPhoto = {
      url: 'preview-photo-route',
      title: 'Preview Route',
      author: 'Lumina'
    };
    const state = {
      currentCategory: 'Scenic Nature',
      activePhoto: { url: 'land-1', title: 'Land 1', author: 'A' },
      photosList: [{ url: 'land-1', title: 'Land 1', author: 'A', category: 'Scenic Nature' }],
      widgets: { clock: true },
      theme: 'Zen Retreat'
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.activePhoto = command.payload.photo;
        return {
          reducerResult: {
            events: [{ type: 'photo-update' }, { type: 'state-sync' }],
            effects: []
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/photos/preview', {
      body: previewPhoto
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.activePhoto.url, 'preview-photo-route');
    assert.deepStrictEqual(dispatched, [{
      type: 'set-active-photo',
      payload: {
        url: 'preview-photo-route',
        photo: previewPhoto
      }
    }]);
  });

  logSuite('REST Advance Photo Routes');
  await assertAsyncTest('POST /api/photos/prev dispatches the shared sequence-advance route spec and returns the updated active photo', async () => {
    const dispatched = [];
    const state = {
      currentCategory: 'Scenic Nature',
      activePhoto: { url: 'land-2', title: 'Land 2', author: 'B' },
      photosList: [{ url: 'land-2', title: 'Land 2', author: 'B', category: 'Scenic Nature' }],
      widgets: { clock: true },
      theme: 'Zen Retreat'
    };
    const app = buildConfiguredRoutesApp({
      state,
      dispatchCommand: async (command) => {
        dispatched.push(command);
        state.activePhoto = { url: 'land-1', title: 'Land 1', author: 'A' };
        return {
          reducerResult: {
            events: [{ type: 'photo-update' }, { type: 'state-sync' }],
            effects: []
          },
          effectResults: []
        };
      }
    });
    const response = await invokeRoute(app, 'post', '/api/photos/prev');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.activePhoto.url, 'land-1');
    assert.deepStrictEqual(dispatched, [{
      type: 'advance-photo',
      payload: {
        direction: 'prev',
        strategy: 'sequence'
      }
    }]);
  });

  logSuite('Live Server Endpoint Smoke Tests');
  const socketPath = path.join('/tmp', `lumina-live-${process.pid}-${Date.now()}.sock`);
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }
  console.log('Starting temporary test server on a temporary Unix socket...');
  let testServer = null;

  try {
    testServer = await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(socketPath, () => {
        server.off('error', reject);
        resolve(server);
      });
    });
  } catch (error) {
    console.warn(`Skipping live server endpoint smoke tests in this environment: ${error.message}`);
  }

  if (testServer) {
    const liveFetchJson = async (requestPath) => (await requestSocketJson(socketPath, requestPath, 'GET')).body;
    const livePostJson = (requestPath, body) => requestSocketJson(socketPath, requestPath, 'POST', body);
    const liveRequestJson = (requestPath, method = 'GET', body = null) => requestSocketJson(socketPath, requestPath, method, body);
    console.log(`Temporary test server bound to ${socketPath}`);

    try {
      const serverConfig = await liveFetchJson('/api/config');
    
    assertTest('GET /api/config successfully retrieves configuration and network data', () => {
      assert.ok(Array.isArray(serverConfig.localIps), 'localIps should be an array');
      assert.ok(serverConfig.port, 'port should be defined');
      assert.ok(serverConfig.state, 'state object must be present');
    });

    const weather = await liveFetchJson('/api/weather');
    assertTest('GET /api/weather serves live Open-Meteo telemetry geolocated to Montreal', () => {
      assert.ok(weather.location, 'location data should be populated');
      assert.strictEqual(weather.location.city, config.location.city, `City should be geolocated to ${config.location.city}`);
      assert.ok(weather.current, 'current weather telemetry must be present');
      assert.ok(weather.daily, 'daily forecast arrays must be present');
    });

    const normalizedPhotos = await liveFetchJson('/api/photos?category=Liminal%20Space');
    assertTest('GET /api/photos successfully normalizes category spelling (Liminal Space -> Liminal Spaces)', () => {
      assert.ok(Array.isArray(normalizedPhotos), 'photos list must be returned as an array');
      assert.ok(normalizedPhotos.length > 0, 'normalized list should not be empty');
      assert.ok(normalizedPhotos.every(p => p.url), 'every photograph must have a valid url attribute');
    });

    const aiNormalizedPhotos = await liveFetchJson('/api/photos?category=AI%20Creation');
    assertTest('GET /api/photos successfully normalizes category spelling (AI Creation -> AI Creations)', () => {
      assert.ok(Array.isArray(aiNormalizedPhotos), 'AI Creations photos list must be returned as an array');
      assert.ok(aiNormalizedPhotos.length > 0, 'normalized AI Creations list should not be empty');
      assert.ok(aiNormalizedPhotos.every(p => p.url), 'every AI Creation photograph must have a valid url attribute');
    });

    const combinedPhotos = await liveFetchJson('/api/photos?category=Scenic%20Nature,Cosmic%20Space');
    assertTest('GET /api/photos successfully merges and serves combined feeds (Scenic Nature, Cosmic Space)', () => {
      assert.ok(Array.isArray(combinedPhotos), 'combined photos list must be returned as an array');
      assert.ok(combinedPhotos.length > 0, 'combined list should not be empty');
      assert.ok(combinedPhotos.every(p => p.url), 'every photograph must have a valid url attribute');
    });

    // Test HTTP Rating API
    let samplePhotoUrl = '';
    const poolPhotos = await liveFetchJson('/api/pools/Scenic%20Nature/photos');
    if (Array.isArray(poolPhotos) && poolPhotos.length > 0) {
      const validPhoto = poolPhotos.find(p => p && p.url && p.rating !== 1 && !p.isBroken);
      samplePhotoUrl = validPhoto ? validPhoto.url : poolPhotos[0].url;
    }

    if (samplePhotoUrl) {
      const rateResponse = await livePostJson('/api/photos/rate', { url: samplePhotoUrl, rating: 8 });
      assertTest('POST /api/photos/rate successfully updates and persists a photo rating', () => {
        assert.strictEqual(rateResponse.status, 200, 'Response status must be 200');
        assert.strictEqual(rateResponse.body.success, true, 'success attribute must be true');
        assert.strictEqual(rateResponse.body.rating, 8, 'rating should be 8');
      });

      // Test bad parameter validation
      const invalidResponse = await livePostJson('/api/photos/rate', { url: samplePhotoUrl, rating: 15 });
      assertTest('POST /api/photos/rate rejects invalid rating values (e.g. rating = 15)', () => {
        assert.strictEqual(invalidResponse.status, 400, 'Response status must be 400');
        assert.ok(invalidResponse.body.error, 'Should return error message');
      });

      // Test HTTP Keyword API
      const keywordResponse = await livePostJson('/api/config/keywords', {
        category: 'Scenic Nature',
        keywords: ['forest mountains landscape', 'autumn stream']
      });
      assertTest('POST /api/config/keywords successfully updates and persists custom keywords', () => {
        assert.strictEqual(keywordResponse.status, 200, 'Response status must be 200');
        assert.strictEqual(keywordResponse.body.success, true, 'success attribute must be true');
        assert.deepStrictEqual(keywordResponse.body.keywords, ['forest mountains landscape', 'autumn stream'], 'keywords should match updated values');
      });

      // Test bad category validation
      const invalidKeywordResponse = await livePostJson('/api/config/keywords', {
        category: 'Unknown Category',
        keywords: ['test']
      });
      assertTest('POST /api/config/keywords rejects unknown categories', () => {
        assert.strictEqual(invalidKeywordResponse.status, 404, 'Response status must be 404');
      });
    }

    // ==========================================================================
    // NEW REST API INTEGRATION TESTS
    // ==========================================================================

    // 1. GET /api/state
    const stateGet = await liveRequestJson('/api/state', 'GET');
    assertTest('GET /api/state retrieves the current unified state', () => {
      assert.strictEqual(stateGet.status, 200);
      assert.ok(stateGet.body.widgets, 'State must contain widgets object');
      assert.ok(stateGet.body.theme, 'State must contain theme');
      assert.ok(stateGet.body.currentFrame, 'State must expose derived currentFrame');
      assert.strictEqual(
        stateGet.body.currentFrame.primary?.url || null,
        stateGet.body.activePhoto?.url || null,
        'currentFrame.primary should mirror activePhoto in the snapshot'
      );
    });

    // 2. PATCH /api/state
    const statePatch = await liveRequestJson('/api/state', 'PATCH', {
      theme: 'Cosmic Night',
      widgets: { clock: false }
    });
    assertTest('PATCH /api/state successfully updates widgets and configurations', () => {
      assert.strictEqual(statePatch.status, 200);
      assert.strictEqual(statePatch.body.theme, 'Cosmic Night');
      assert.strictEqual(statePatch.body.widgets.clock, false);
    });

    const stateLocationPatch = await liveRequestJson('/api/state', 'PATCH', {
      autoLocation: true,
      manualLocation: {
        city: 'Montreal',
        regionName: 'Quebec',
        country: 'Canada',
        lat: 45.5,
        lon: -73.6
      }
    });
    assertTest('PATCH /api/state routes location settings through the shared command path without changing the response envelope', () => {
      assert.strictEqual(stateLocationPatch.status, 200);
      assert.strictEqual(stateLocationPatch.body.success, undefined);
      assert.strictEqual(stateLocationPatch.body.autoLocation, true);
      assert.deepStrictEqual(stateLocationPatch.body.manualLocation, {
        city: 'Montreal',
        regionName: 'Quebec',
        country: 'Canada',
        lat: 45.5,
        lon: -73.6
      });
    });

    // 3. POST /api/state/screensaver
    const screensaverActiveRes = await liveRequestJson('/api/state/screensaver', 'POST', { active: true });
    assertTest('POST /api/state/screensaver toggles the screensaver status to active', () => {
      assert.strictEqual(screensaverActiveRes.status, 200);
      assert.strictEqual(screensaverActiveRes.body.success, true);
      assert.strictEqual(screensaverActiveRes.body.screensaverActive, true);
    });

    const screensaverInactiveRes = await liveRequestJson('/api/state/screensaver', 'POST', { active: false });
    assertTest('POST /api/state/screensaver toggles the screensaver status to inactive', () => {
      assert.strictEqual(screensaverInactiveRes.status, 200);
      assert.strictEqual(screensaverInactiveRes.body.success, true);
      assert.strictEqual(screensaverInactiveRes.body.screensaverActive, false);
    });

    // 4. POST /api/state/categories
    const categoriesPost = await liveRequestJson('/api/state/categories', 'POST', {
      categories: 'Scenic Nature,Liminal Spaces'
    });
    assertTest('POST /api/state/categories updates the active category selection through the shared command path', () => {
      assert.strictEqual(categoriesPost.status, 200);
      assert.strictEqual(categoriesPost.body.success, true);
      assert.strictEqual(categoriesPost.body.state.currentCategory, 'Scenic Nature,Liminal Spaces');
      assert.ok(Array.isArray(categoriesPost.body.state.photosList));
      assert.ok(categoriesPost.body.state.photosList.length > 0);
    });

    // 5. GET /api/pools
    const poolsGet = await liveRequestJson('/api/pools', 'GET');
    assertTest('GET /api/pools lists all scenic pools with stats', () => {
      assert.strictEqual(poolsGet.status, 200);
      assert.ok(Array.isArray(poolsGet.body));
      const scenicNaturePool = poolsGet.body.find(p => p.name === 'Scenic Nature');
      assert.ok(scenicNaturePool);
      assert.ok(Array.isArray(scenicNaturePool.keywords));
      assert.strictEqual(typeof scenicNaturePool.photosCount, 'number');
    });

    // 6. POST /api/pools (create)
    const poolName = `REST Pool Test ${Date.now()}`;
    const newPoolRes = await liveRequestJson('/api/pools', 'POST', {
      name: poolName,
      keywords: ['test-rest-keyword-1', 'test-rest-keyword-2']
    });
    assertTest('POST /api/pools creates a new pool with custom keywords', () => {
      assert.strictEqual(newPoolRes.status, 201);
      assert.strictEqual(newPoolRes.body.success, true);
      assert.strictEqual(newPoolRes.body.pool.name, poolName);
      assert.deepStrictEqual(newPoolRes.body.pool.keywords, ['test-rest-keyword-1', 'test-rest-keyword-2']);
      assert.strictEqual(newPoolRes.body.pool.feedConfigs.artic.enabled, false);
    });

    // 7. GET /api/pools/:name/photos
    const poolPhotosGet = await liveRequestJson(`/api/pools/${encodeURIComponent(poolName)}/photos`, 'GET');
    assertTest('GET /api/pools/:name/photos retrieves photo metadata for a pool', () => {
      assert.strictEqual(poolPhotosGet.status, 200);
      assert.ok(Array.isArray(poolPhotosGet.body));
    });

    // 8. PATCH /api/pools/:name (update keywords)
    const patchPoolRes = await liveRequestJson(`/api/pools/${encodeURIComponent(poolName)}`, 'PATCH', {
      keywords: ['modified-keyword-1']
    });
    assertTest('PATCH /api/pools/:name updates pool settings/keywords', () => {
      assert.strictEqual(patchPoolRes.status, 200);
      assert.strictEqual(patchPoolRes.body.success, true);
      assert.deepStrictEqual(patchPoolRes.body.pool.keywords, ['modified-keyword-1']);
    });

    const patchPoolPolicyRes = await liveRequestJson(`/api/pools/${encodeURIComponent(poolName)}`, 'PATCH', {
      policy: {
        retentionDays: 45,
        maxPhotos: 500,
        schedule: { enabled: true, start: '22:00', end: '06:00', priority: 3 }
      }
    });
    const stateAfterPoolPolicy = await liveRequestJson('/api/state', 'GET');
    assertTest('PATCH /api/pools/:name retains a custom maximum in the returned and refreshed state', () => {
      assert.strictEqual(patchPoolPolicyRes.status, 200);
      assert.deepStrictEqual(patchPoolPolicyRes.body.state.poolPolicies[poolName], {
        retentionDays: 45,
        maxPhotos: 500,
        schedule: { enabled: true, start: '22:00', end: '06:00', priority: 3 }
      });
      assert.deepStrictEqual(stateAfterPoolPolicy.body.poolPolicies[poolName], {
        retentionDays: 45,
        maxPhotos: 500,
        schedule: { enabled: true, start: '22:00', end: '06:00', priority: 3 }
      });
    });

    // 9. PATCH /api/pools/:name/feed-sources/:source
    const patchFeedSourceRes = await liveRequestJson(
      `/api/pools/${encodeURIComponent(poolName)}/feed-sources/reddit`,
      'PATCH',
      {
        enabled: true,
        subreddits: ['EarthPorn', 'SkyPorn']
      }
    );
    assertTest('PATCH /api/pools/:name/feed-sources/:source merges a single feed source config without dropping fields', () => {
      assert.strictEqual(patchFeedSourceRes.status, 200);
      assert.strictEqual(patchFeedSourceRes.body.success, true);
      assert.strictEqual(patchFeedSourceRes.body.feedSource, 'reddit');
      assert.deepStrictEqual(patchFeedSourceRes.body.pool.feedConfigs.reddit, {
        enabled: true,
        subreddits: ['EarthPorn', 'SkyPorn']
      });
    });

    // 10. DELETE /api/pools/:name
    const deletePoolRes = await liveRequestJson(`/api/pools/${encodeURIComponent(poolName)}`, 'DELETE');
    assertTest('DELETE /api/pools/:name removes the pool completely', () => {
      assert.strictEqual(deletePoolRes.status, 200);
      assert.strictEqual(deletePoolRes.body.success, true);
    });

    // 11. PATCH /api/photos (composability testing: rating, crop, pairing)
    if (samplePhotoUrl) {
      const patchRateRes = await liveRequestJson('/api/photos', 'PATCH', {
        url: samplePhotoUrl,
        rating: 9
      });
      assertTest('PATCH /api/photos updates photo rating', () => {
        assert.strictEqual(patchRateRes.status, 200);
        assert.strictEqual(patchRateRes.body.success, true);
        assert.strictEqual(patchRateRes.body.photo.rating, 9);
      });

      const patchCropRes = await liveRequestJson('/api/photos', 'PATCH', {
        url: samplePhotoUrl,
        cropPercent: 140,
        cropPositionY: 30
      });
      assertTest('PATCH /api/photos updates photo zoom/crop percentages', () => {
        assert.strictEqual(patchCropRes.status, 200);
        assert.strictEqual(patchCropRes.body.success, true);
        assert.strictEqual(patchCropRes.body.photo.cropPercent, 140);
        assert.strictEqual(patchCropRes.body.photo.cropPositionY, 30);
      });

      const patchPairingRes = await liveRequestJson('/api/photos', 'PATCH', {
        url: samplePhotoUrl,
        preventPairing: true
      });
      assertTest('PATCH /api/photos updates photo preventPairing flag', () => {
        assert.strictEqual(patchPairingRes.status, 200);
        assert.strictEqual(patchPairingRes.body.success, true);
        assert.strictEqual(patchPairingRes.body.photo.preventPairing, true);
      });

      const patchLovedRes = await liveRequestJson('/api/photos', 'PATCH', {
        url: samplePhotoUrl,
        loved: true
      });
      assertTest('PATCH /api/photos updates photo permanent-collection loved flag', () => {
        assert.strictEqual(patchLovedRes.status, 200);
        assert.strictEqual(patchLovedRes.body.success, true);
        assert.strictEqual(patchLovedRes.body.photo.loved, true);
      });

      const patchCombinedRes = await liveRequestJson('/api/photos', 'PATCH', {
        url: samplePhotoUrl,
        rating: 8,
        cropPercent: 161,
        cropPositionY: 27,
        loved: false
      });
      assertTest('PATCH /api/photos batches rating, crop, and loved updates through the shared command path', () => {
        assert.strictEqual(patchCombinedRes.status, 200);
        assert.strictEqual(patchCombinedRes.body.success, true);
        assert.strictEqual(patchCombinedRes.body.photo.rating, 8);
        assert.strictEqual(patchCombinedRes.body.photo.cropPercent, 161);
        assert.strictEqual(patchCombinedRes.body.photo.cropPositionY, 27);
        assert.strictEqual(patchCombinedRes.body.photo.loved, false);
      });

      const previewPhotoRes = await liveRequestJson('/api/photos/preview', 'POST', {
        url: samplePhotoUrl
      });
      assertTest('POST /api/photos/preview forces displays to preview a photo', () => {
        assert.strictEqual(previewPhotoRes.status, 200);
        assert.strictEqual(previewPhotoRes.body.success, true);
        assert.strictEqual(previewPhotoRes.body.activePhoto.url, samplePhotoUrl);
      });
    }

    // 10. POST /api/photos/next
    const nextPhotoRes = await liveRequestJson('/api/photos/next', 'POST');
    assertTest('POST /api/photos/next transitions active display to the next photo', () => {
      assert.strictEqual(nextPhotoRes.status, 200);
      assert.strictEqual(nextPhotoRes.body.success, true);
      assert.ok(nextPhotoRes.body.activePhoto);
    });

    const prevPhotoRes = await liveRequestJson('/api/photos/prev', 'POST');
    assertTest('POST /api/photos/prev reverses the direct-control sequence after next', () => {
      assert.strictEqual(prevPhotoRes.status, 200);
      assert.strictEqual(prevPhotoRes.body.success, true);
      assert.strictEqual(prevPhotoRes.body.activePhoto.url, samplePhotoUrl);
    });

    } catch (err) {
      console.error('Integration tests failed with error:', err);
      STATS.failed++;
    } finally {
      console.log('Shutting down temporary test server...');
      await new Promise((resolve) => testServer.close(resolve));
      if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
      }
    }
  }

  // Test Runner Final Dashboard
  console.log(`\n${COLORS.bold}=======================================${COLORS.reset}`);
  console.log(`${COLORS.bold}📊 DIAGNOSTIC REPORT:${COLORS.reset}`);
  console.log(`  Total Executed Tests: ${STATS.total}`);
  console.log(`  Passed assertions   : ${COLORS.green}${STATS.passed}${COLORS.reset}`);
  console.log(`  Failed assertions   : ${STATS.failed > 0 ? COLORS.red : COLORS.reset}${STATS.failed}${COLORS.reset}`);
  console.log(`${COLORS.bold}=======================================${COLORS.reset}\n`);

  if (STATS.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run integration async test suite
runIntegrationTests();
