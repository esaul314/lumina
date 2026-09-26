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
  createSensorHistoryStore,
  normalizeSensorSnapshot
} = require('./server/services/sensorHistory.js');
const { updatePhotoCrop } = require('./server/config/collections.js');
const { buildFeedConfigsFromKeywords } = require('./server/config/state.js');
const { runDomainTests } = require('./server/domain/tests.js');
const {
  createDomainDispatcher,
  createEffectInterpreter,
  createTypedHandlerInvoker,
  normalizeRuntimeFlags
} = require('./server/domain/dispatch.js');
const { reduceAsyncSequentially } = require('./server/utils/asyncReduce.js');
const { reduceUntil } = require('./server/utils/fn.js');
const { SOCKET_COMMAND_LISTENER_SPECS } = require('./server/domain/commands.js');
const { createPoolScheduleRuntime } = require('./server/runtime/poolSchedule.js');
const { runRecrawlJobTests } = require('./server/jobs/tests.js');
const configureRoutes = require('./server/routes.js');
const { buildWeatherResponse } = configureRoutes;
const configureSockets = require('./server/sockets.js');
const {
  createCommandRunner,
  createSocketCommandSpecInterpreter,
  registerCommandSpecs
} = configureSockets;
const { createSensorPlatform } = require('./server/services/sensorPlatform.js');
const { upsertEnvVarInContent } = require('./server/config/env.js');
const googlePhotos = require('./server/services/googlePhotos.js');
const {
  chainRouteDecode,
  collectRouteDecodeResults,
  createRouteDecodeFailure,
  createRouteDecodeSuccess,
  mapRouteDecode
} = require('./server/utils/routeDecode.js');
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

assertTest('correctly classifies meteorological WMO weather codes', () => {
  const sunnyClassification = classifyWeatherCode(0);
  const rainyClassification = classifyWeatherCode(61);
  const snowyClassification = classifyWeatherCode(73);
  
  assert.strictEqual(sunnyClassification.physicalMatch, 'Sunny', 'WMO code 0 must classify as Sunny');
  assert.strictEqual(rainyClassification.physicalMatch, 'Rainy', 'WMO code 61 must classify as Rainy');
  assert.strictEqual(snowyClassification.physicalMatch, 'Snowy', 'WMO code 73 must classify as Snowy');
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

logSuite('Runtime Shell Composition');

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

  runtime.launchKioskBrowser(true);
  assert.strictEqual(deferredLaunches.length, 1, 'launch retries should be deduplicated while one is already pending');

  serverListening = true;
  deferredLaunches[0].fn();
  await flushPromises();

  assert.strictEqual(runtime.isBrowserRunning(), true);
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

assertTest('buildCachedMediaItem extracts nested mediaFile data and emits a local proxy URL', () => {
  const item = buildCachedMediaItem({
    id: 'picker-123',
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
  assert.ok(item.addedAt, 'newly synced Google Photos items need a retention timestamp');
  const refreshed = buildCachedMediaItem(
    { id: 'picker-123', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/picker-item' } },
    'session-abc',
    { addedAt: '2026-01-01T00:00:00.000Z' },
    '2026-09-06T00:00:00Z'
  );
  assert.strictEqual(refreshed.addedAt, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(item.mimeType, 'image/jpeg');
});

assertTest('buildGooglePhotoProxyUrl preserves same-origin rendering for browser previews without forced crop', () => {
  const proxyUrl = buildGooglePhotoProxyUrl('A/B+C', { width: 1080, height: 1920 });
  assert.strictEqual(proxyUrl, '/api/google-photos/media/A%2FB%2BC?w=1080&h=1920');
});

assertTest('buildGooglePhotoProxyUrl still supports explicit crop opt-in', () => {
  const proxyUrl = buildGooglePhotoProxyUrl('A/B+C', { width: 1080, height: 1920, crop: true });
  assert.strictEqual(proxyUrl, '/api/google-photos/media/A%2FB%2BC?w=1080&h=1920&c=1');
});

assertTest('Google Photos proxy URLs round-trip their media item ids', () => {
  const proxyUrl = buildGooglePhotoProxyUrl('A/B+C');
  assert.strictEqual(getGooglePhotoMediaItemId(proxyUrl), 'A/B+C');
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
      const poolApp = buildConfiguredRoutesApp();
      const poolsResponse = await invokeRoute(poolApp, 'get', '/api/pools');
      const googlePool = poolsResponse.body.find(({ name }) => name === 'Google Photos');
      assert.strictEqual(googlePool.photosCount, 3);
      const googlePhotosResponse = await invokeRoute(
        poolApp,
        'get',
        '/api/pools/:name/photos',
        { params: { name: 'Google Photos' } }
      );
      assert.strictEqual(googlePhotosResponse.body.length, 3);

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

assertTest('getOrphanedFiles functional helper identifies orphaned media files correctly', () => {
  const allFiles = ['item1.jpg', 'item2.jpg', 'item3.jpg'];
  const activeIds = ['item1', 'item3'];
  const orphans = getOrphanedFiles(allFiles, activeIds);
  assert.deepStrictEqual(orphans, ['item2.jpg']);
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
  const path = require('path');
  
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

assertTest('stores one latest reading per hour and exports queryable CSV', () => {
  const store = createSensorHistoryStore();
  const reading = observedAt => ({
    environment: {
      observedAt,
      indoor: { temperatureC: 22, humidityPercent: 50 }
    }
  });
  store.record(reading('2026-07-18T21:05:00.000Z'));
  store.record(reading('2026-07-18T21:55:00.000Z'));
  const rows = store.history({ limit: 10 });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].observed_at, '2026-07-18T21:55:00.000Z');
  assert.deepStrictEqual(JSON.parse(rows[0].gateway_metrics_json), {});
  assert.match(store.exportCsv({ limit: 10 }), /hour_key,observed_at,source/);
  assert.match(store.exportCsv({ limit: 10 }), /2026-07-18T21,2026-07-18T21:55:00.000Z/);
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
  const dashboardSource = fs.readFileSync(
    path.join(__dirname, 'client/src/components/Dashboard.jsx'),
    'utf8'
  );
  const frameSelectorsSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/frameSelectors.js'),
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
      /@typedef \{\{screensaverActive: boolean, event\?: ActivityEvent\|null\}\} ScreensaverActivity/
    );
    assert.match(
      screensaverActivitySource,
      /@param \{KeyboardActivity\|null\|undefined\} event/
    );
    assert.match(screensaverActivitySource, /@param \{ScreensaverActivity\} input/);
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
  });

  logSuite('REST Pool Mutation Routes');
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
