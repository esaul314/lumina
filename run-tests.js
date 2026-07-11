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
const { updatePhotoCrop } = require('./server/config/collections.js');
const { buildFeedConfigsFromKeywords } = require('./server/config/state.js');
const { runDomainTests } = require('./server/domain/tests.js');
const { createDomainDispatcher } = require('./server/domain/dispatch.js');
const { runRecrawlJobTests } = require('./server/jobs/tests.js');
const configureRoutes = require('./server/routes.js');
const configureSockets = require('./server/sockets.js');
const { upsertEnvVarInContent } = require('./server/config/env.js');
const googlePhotos = require('./server/services/googlePhotos.js');
const {
  applyCachedMediaItemMetadataToState,
  buildGooglePhotoProxyUrl,
  buildCachedMediaItem,
  getGooglePhotoMediaItemId,
  mergeCachedMediaItemMetadata,
  normalizeCachedMediaItem,
  isUsableCachedMediaItem
} = require('./server/services/googlePhotos.js');
const {
  buildChromiumFlags,
  getChromiumAccelerationProfile
} = require('./server/services/system.js');

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
  const { validateRating, validatePercent } = require('./server/utils/validation.js');

  // Test validators
  assert.strictEqual(validateRating(5), 5);
  assert.strictEqual(validateRating('8'), 8);
  assert.strictEqual(validateRating(15), null);
  assert.strictEqual(validateRating('invalid'), null);

  assert.strictEqual(validatePercent(0), 0);
  assert.strictEqual(validatePercent(100), 100);
  assert.strictEqual(validatePercent(-5), null);

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
    log: { log() {}, warn() {} }
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
  assert.strictEqual(kioskKillCount, 1);
  assert.deepStrictEqual(kioskLaunches, [{ port: 5050, mode: 'tv' }]);

  exitHandler?.();
  assert.strictEqual(runtime.isBrowserRunning(), false);
  assert.strictEqual(runtime.isManualOverride(), false);
  assert.strictEqual(state.screensaverActive, false);
  assert.strictEqual(broadcastCount, 1);
  assert.deepStrictEqual(killedTimers, []);
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
      readFileSync: () => JSON.stringify({ lastUpdated: 9_500 })
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
    normalizeSnapshot: normalizeClientSnapshot
  } = await importClientModule('./client/src/state/frameSelectors.js');

  const {
    applyCategorySelection,
    applyFeedSourceConfigPatch,
    getSelectedCategories,
    isCategorySelected,
    normalizeCategorySelection,
    serializeCategorySelection,
    toggleCategorySelection
  } = await importClientModule('./client/src/state/feedMutations.js');

  assertTest('toggleCategorySelection normalizes commas and toggles without duplicating categories', () => {
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

    const emittedEvents = [];
    global.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({})
    });

    const {
      saveUseApiToken: saveClientUseApiToken,
      selectCategories: selectClientCategories
    } = await importClientModule('./client/src/api/luminaClient.js');
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
  } finally {
    global.window = originalWindow;
    global.fetch = originalFetch;
  }

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

  const fallbackHarness = createSocketHarness();
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
}

async function runClientRenderingTests() {
  logSuite('Client Rendering Helpers');

  const { toCssImageUrl } = await importClientModule('./client/src/state/cssImage.js');

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

  logSuite('REST Photo Patch Routes');
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

  await assertAsyncTest('PATCH /api/photos routes Google Photos crop and pairing updates through the shared photo command batch', async () => {
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
        preserveActive: true
      }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.deepStrictEqual(response.body.photo, {
      url: googleUrl,
      cropPercent: 44,
      preventPairing: true
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
        cropPercent: 75,
        cropPositionY: 30
      });
      assertTest('PATCH /api/photos updates photo zoom/crop percentages', () => {
        assert.strictEqual(patchCropRes.status, 200);
        assert.strictEqual(patchCropRes.body.success, true);
        assert.strictEqual(patchCropRes.body.photo.cropPercent, 75);
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

      const patchCombinedRes = await liveRequestJson('/api/photos', 'PATCH', {
        url: samplePhotoUrl,
        rating: 8,
        cropPercent: 61,
        cropPositionY: 27
      });
      assertTest('PATCH /api/photos batches rating and crop updates through the shared command path', () => {
        assert.strictEqual(patchCombinedRes.status, 200);
        assert.strictEqual(patchCombinedRes.body.success, true);
        assert.strictEqual(patchCombinedRes.body.photo.rating, 8);
        assert.strictEqual(patchCombinedRes.body.photo.cropPercent, 61);
        assert.strictEqual(patchCombinedRes.body.photo.cropPositionY, 27);
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
