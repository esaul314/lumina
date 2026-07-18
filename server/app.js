const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const config = require('./config/configLoader.js');
const { readEnvVar } = require('./config/env.js');
const { createRecrawlJobService, executeRecrawlPass } = require('./jobs/recrawl.js');
const { createVisionAnalysisJobService } = require('./jobs/visionAnalysis.js');

// Modular config and service imports
const { sendEmailAlert } = require('./services/notifier.js');
const { screensaverState, buildFeedConfigsFromKeywords } = require('./config/state.js');
const { defaultCuratedCollections, saveCuratedCollections } = require('./config/collections.js');
const { loadCollectionsSnapshot } = require('./config/collectionsCodec.js');
const { createDomainDispatcher } = require('./domain/dispatch.js');
const {
  buildBalancedFeed,
  filterPhotosForNight,
  filterPhotosForTime,
  filterPhotosForWeather,
  selectWeightedRandomPhoto: selectWeightedRandomPhotoFromSelectors,
  isTimeInSchedule
} = require('./domain/selectors.js');
const { syncLegacySnapshot } = require('./domain/snapshot.js');
const { createActiveFeedRuntime } = require('./runtime/activeFeed.js');
const { createEnvironmentRefreshRuntime } = require('./runtime/environmentRefresh.js');
const { createIdleDaemonRuntime, getNextScreensaverState } = require('./runtime/idleDaemon.js');
const { createKioskControlRuntime } = require('./runtime/kioskControl.js');
const {
  getGnomeIdleTime,
  isAudioPlaying,
  isSessionInhibited,
  launchChromiumKiosk,
  killChromiumKiosk,
  setCpuGovernor
} = require('./services/system.js');
const {
  resolveActiveLocation,
  classifyWeatherCode,
  fetchWeatherForecast
} = require('./services/weather.js');
const googlePhotos = require('./services/googlePhotos.js');
const { analyzeSentiment } = require('./services/sentiment.js');
const { createEcowittRuntime } = require('./services/ecowitt.js');
const { crawlAllCollections } = require('./services/crawler.js');
const {
  curry,
  pipe,
  prop,
  map,
  toLower,
  includes
} = require('./utils/fn.js');

// Global Weather Telemetry Cache
let serverWeatherData = null;
const getWeatherData = () => serverWeatherData;
const setWeatherData = (data) => { serverWeatherData = data; };
const ecowittRuntime = createEcowittRuntime({ settings: config.ecowitt });
const ANALYSIS_PROGRESS_INTERVAL = 25;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve client built static production files
const rootDir = path.join(__dirname, '..');
app.use(express.static(path.join(rootDir, 'client/dist')));

// Curated collections persistence loader
const jsonPath = path.join(rootDir, 'curated_collections.json');
const loadedCollectionsSnapshot = loadCollectionsSnapshot({
  jsonPath,
  defaultCollections: defaultCuratedCollections,
  defaultState: screensaverState,
  buildFeedConfigsFromKeywords
});
let curatedCollections = loadedCollectionsSnapshot.collections;

if (loadedCollectionsSnapshot.parseError) {
  console.error('Failed to parse curated_collections.json, falling back to normalized defaults:', loadedCollectionsSnapshot.parseError.message);
} else {
  console.log('Successfully loaded persisted curated collections from file!');
}

if (loadedCollectionsSnapshot.createdFile) {
  console.log('Created new curated_collections.json file from seed data.');
}

if (loadedCollectionsSnapshot.duplicatesRemoved) {
  console.log('Global Deduplication: Removed duplicate photo URLs during snapshot normalization.');
}

const {
  persistedState: {
    searchKeywords,
    feedConfigs,
    autoLocation,
    manualLocation,
    visionConfig,
    scaleMode,
    splitPortrait,
    splitCropPercent,
    excludedKeywords
  }
} = loadedCollectionsSnapshot;

Object.assign(screensaverState, {
  searchKeywords,
  feedConfigs,
  autoLocation,
  manualLocation,
  visionConfig,
  scaleMode,
  splitPortrait,
  splitCropPercent,
  excludedKeywords
});

const hasWord = includes;

// Curried checker that matches a list of keywords against the lowercase photo title
const titleHasKeyword = curry((keywords, photo) => {
  const titleText = pipe(prop('title'), toLower)(photo);
  return keywords.some(word => hasWord(word, titleText));
});

// Composable curried checkers partially executed with specific weather lexicon arrays
const isNightPhoto = titleHasKeyword(['night', 'dark', 'twilight', 'midnight', 'stars', 'moon', 'sunset', 'evening', '3 am', 'eclipse', 'space', 'nebula', 'stardust']);
const isRainPhoto = titleHasKeyword(['rain', 'rainy', 'wet', 'storm', 'water', 'dewy', 'jungle', 'stream', 'lake', 'puddle', 'drizzle']);
const isSunnyPhoto = titleHasKeyword(['sun', 'sunny', 'clear', 'bright', 'golden', 'morning', 'summer', 'daylight', 'drenched', 'warm']);
const isCloudyPhoto = titleHasKeyword(['mist', 'cloud', 'cloudy', 'fog', 'foggy', 'mist-veiled', 'misty', 'hazy', 'overcast', 'moody', 'shadow', 'pale', 'eerie', 'familiar', 'empty', 'silent', 'deserted', 'abandoned', 'quiet']);
const isSnowyPhoto = titleHasKeyword(['snow', 'snowy', 'winter', 'ice', 'frozen', 'cold', 'alpine']);

/**
 * 🏷&zwj; classifyAtmosphere
 * Curried classifier mapping title keywords to environmental attributes.
 */
const classifyAtmosphere = curry((defaultIsNight, photo) => ({
  isNight: photo.isNight ?? (defaultIsNight || isNightPhoto(photo)),
  isRain: photo.isRain ?? isRainPhoto(photo),
  isSunny: photo.isSunny ?? isSunnyPhoto(photo),
  isCloudy: photo.isCloudy ?? isCloudyPhoto(photo),
  isSnowy: photo.isSnowy ?? isSnowyPhoto(photo)
}));

/**
 * 🏷&zwj; tagSinglePhoto
 * Curried decorator that applies rating, isBroken, and classification to a photo.
 */
const tagSinglePhoto = curry((defaultIsNight, photo) => ({
  ...photo,
  source: photo.source || 'curated',
  rating: photo.rating ?? 10,
  isBroken: photo.isBroken ?? false,
  ...classifyAtmosphere(defaultIsNight, photo)
}));

/**
 * 🏷&zwj; tagPhotosWithKeywords
 * Declarative mapper that applies tagSinglePhoto to a photo list.
 */
function tagPhotosWithKeywords(photos, defaultIsNight = false) {
  return map(tagSinglePhoto(defaultIsNight), photos);
}

// Initial auto-tagging setup
Object.entries(curatedCollections).forEach(([category, photos]) => {
  curatedCollections[category] = tagPhotosWithKeywords(photos, category === 'Cosmic Space');
});

const initialCategory = Object.keys(curatedCollections)[0] ?? 'Scenic Nature';
const initialPhotos = curatedCollections[initialCategory]
  ?.filter((photo) => photo.rating !== 1 && !photo.isBroken)
  .map((photo) => ({ ...photo, category: initialCategory })) ?? [];
screensaverState.photosList = initialPhotos;
screensaverState.activePhoto = initialPhotos[0] ?? null;
screensaverState.hasUseApiToken = Boolean(readEnvVar('USEAPI_TOKEN'));
screensaverState.hasTumblrApiKey = Boolean(readEnvVar('TUMBLR_API_KEY'));

/**
 * 🔄 combineFeedsBalanced
 * Combines active image feeds using a balanced round-robin interleave layout.
 */
function combineFeedsBalanced(categories, collections) {
  return buildBalancedFeed({
    selectedCategories: categories,
    collections,
    externalCollections: getExternalCollections(),
    excludedKeywords: screensaverState.excludedKeywords
  });
}

function getExternalCollections() {
  return {
    'Google Photos': googlePhotos.getCachedMediaItems().map((photo) => ({ ...photo, category: 'Google Photos' }))
  };
}

const activeFeedRuntime = createActiveFeedRuntime({
  state: screensaverState,
  collections: curatedCollections,
  getExternalCollections
});

const getActiveCategories = activeFeedRuntime.getActiveCategories;

/**
 * 🎯 selectWeightedRandomPhoto
 * Picks a photo from a list based on ratings. Rating=1 is blocked (Weight=0).
 * Scales ratings 2-10 linearly (2=0.2, 10=1.0).
 */
function selectWeightedRandomPhoto(photos, currentPhotoUrl = null) {
  return selectWeightedRandomPhotoFromSelectors({
    photos,
    currentPhotoUrl,
    excludedKeywords: screensaverState.excludedKeywords
  });
}

/**
 * 🎯 getSmartPhoto
 * Dynamic weighted select algorithm mapping physical weather & news sentiment to wallpaper lists,
 * resolved through a Cumulative Distribution Function (CDF) rating-weighted engine.
 */
function getSmartPhoto(_direction = 'next') {
  const list = screensaverState.photosList;
  if (!list?.length) return null;

  const isNight = serverWeatherData?.current
    ? serverWeatherData.current.is_day === 0
    : (() => {
        const hour = new Date().getHours();
        return hour >= 18 || hour < 6;
      })();

  const physicalMatch = screensaverState.physicalWeather?.weatherMatch ?? 'Cloudy';
  const newsMatch = screensaverState.newsSentiment?.weatherMatch ?? 'Cloudy';

  const now = new Date();

  // Composed pipeline of pure functional filters
  const candidates = pipe(
    (photos) => filterPhotosForTime(photos, now),
    (photos) => filterPhotosForWeather(photos, screensaverState.alignWeather, physicalMatch, newsMatch),
    (photos) => filterPhotosForNight(photos, screensaverState.alignTimeOfDay, isNight, screensaverState.nightPercentage)
  )(list);

  // Delegate selection to the weighted CDF probability engine
  const currentPhotoUrl = screensaverState.activePhoto?.url;
  return selectWeightedRandomPhoto(candidates, currentPhotoUrl);
}

const { analyzeImageContent } = require('./services/vision.js');

function applyVisionTags(photo, analysis) {
  const nextPatch = {
    isNight: analysis.isNight,
    isRain: analysis.isRain,
    isSunny: analysis.isSunny,
    isCloudy: analysis.isCloudy,
    isSnowy: analysis.isSnowy
  };
  const changed = Object.entries(nextPatch).some(([key, value]) => photo[key] !== value);
  Object.assign(photo, nextPatch);
  return changed;
}

async function triggerImageAnalysisBackground({
  categories = [],
  emitProgress = () => {},
  requireConfigured = false
} = {}) {
  if (process.env.NODE_ENV === 'test') return;
  console.log('[Vision Service] Starting background content analysis for curated collections...');

  const scopedCategories = Array.isArray(categories) && categories.length > 0
    ? categories.filter((category) => Array.isArray(curatedCollections[category]))
    : Object.keys(curatedCollections);
  let consecutiveFailures = 0;
  const isConfigured = Boolean(screensaverState.visionConfig?.apiUrl);
  if (!isConfigured) {
    const message = 'Vision API is not configured.';
    if (requireConfigured) {
      throw new Error(message);
    }
    console.warn(`[Vision Service] ${message} Skipping background content analysis.`);
    return {
      categories: scopedCategories,
      processedCount: 0,
      taggedCount: 0,
      changedCount: 0,
      categoryCounts: []
    };
  }

  const categoryCounts = scopedCategories.map((category) => ({
    name: category,
    photoCount: Array.isArray(curatedCollections[category]) ? curatedCollections[category].length : 0
  }));
  const candidatePhotos = scopedCategories.flatMap((category) =>
    (Array.isArray(curatedCollections[category]) ? curatedCollections[category] : [])
      .filter((photo) => photo.rating !== 1 && !photo.isBroken)
  );
  const totalCandidates = candidatePhotos.length;
  let processedCount = 0;
  let taggedCount = 0;
  let changedCount = 0;

  emitProgress({
    phase: 'scanning',
    message: totalCandidates > 0
      ? `Scanning ${totalCandidates} photo${totalCandidates === 1 ? '' : 's'} for vision analysis...`
      : 'No eligible photos found for vision analysis.',
    processedCount,
    totalCount: totalCandidates
  });

  for (const category of scopedCategories) {
    const photos = curatedCollections[category];
    if (!Array.isArray(photos)) continue;

    for (const photo of photos) {
      if (photo.rating === 1 || photo.isBroken) continue;

      const analysis = await analyzeImageContent(photo.url, photo.title);
      processedCount += 1;
      if (analysis) {
        if (applyVisionTags(photo, analysis)) {
          changedCount += 1;
        }
        taggedCount += 1;
        consecutiveFailures = 0;
      } else if (isConfigured) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          const message = 'Aborting background analysis after 3 consecutive API failures. The Vision API server is likely offline or misconfigured.';
          console.warn(`[Vision Service] ${message}`);
          throw new Error(message);
        }
      }

      if (
        processedCount === totalCandidates
        || processedCount === 1
        || processedCount % ANALYSIS_PROGRESS_INTERVAL === 0
      ) {
        emitProgress({
          phase: 'analyzing',
          message: `Processed ${processedCount} of ${totalCandidates} photo${totalCandidates === 1 ? '' : 's'}...`,
          processedCount,
          totalCount: totalCandidates,
          taggedCount,
          changedCount
        });
      }
    }
  }

  if (taggedCount > 0) {
    console.log(`[Vision Service] Finished background image analysis. Tagged ${taggedCount} images across ${scopedCategories.length} categories.`);
    saveCuratedCollections(curatedCollections, screensaverState);
    activeFeedRuntime.refreshActiveFeedIfIncluded(scopedCategories);

    emitProgress({
      phase: 'persisting',
      message: 'Persisting refreshed vision metadata...'
    });
    emitStateSync();
  } else {
    console.log('[Vision Service] All active images are already precisely analyzed.');
  }

  return {
    categories: scopedCategories,
    processedCount,
    taggedCount,
    changedCount,
    categoryCounts
  };
}

// Subprocess State Management helpers for Sockets
let PORT = config.port ?? 5000;

function emitStateSync() {
  syncLegacySnapshot(screensaverState, curatedCollections, getRuntimeContext());
  io.emit('state-sync', screensaverState);
}

const environmentRefreshRuntime = createEnvironmentRefreshRuntime({
  state: screensaverState,
  collections: curatedCollections,
  activeFeedRuntime,
  jsonPath,
  setWeatherData,
  resolveActiveLocation,
  fetchWeatherForecast,
  classifyWeatherCode,
  analyzeSentiment,
  crawlCollections: crawlAllCollections,
  persistCollections: saveCuratedCollections,
  broadcastStateSync: emitStateSync,
  triggerImageAnalysisBackground
});

const {
  updateFeedsDaily,
  updateNewsSentiment,
  updateServerWeather
} = environmentRefreshRuntime;

const kioskControlRuntime = createKioskControlRuntime({
  state: screensaverState,
  emitStateSync,
  getPort: () => PORT,
  isServerListening: () => server.listening,
  setCpuGovernor,
  launchChromiumKiosk,
  killChromiumKiosk
});

function getRuntimeContext() {
  return {
    weather: serverWeatherData,
    ...kioskControlRuntime.getRuntimeContext(),
    externalCollections: getExternalCollections()
  };
}

const idleDaemonRuntime = createIdleDaemonRuntime({
  state: screensaverState,
  getRuntimeContext: kioskControlRuntime.getRuntimeContext,
  getIdleTime: getGnomeIdleTime,
  isAudioPlaying,
  isSessionInhibited,
  launchKioskBrowser: kioskControlRuntime.launchKioskBrowser,
  killKioskBrowser: kioskControlRuntime.killKioskBrowser,
  broadcastStateSync: emitStateSync
});

// Daemon-specific interval bindings (disabled under test suites)
if (process.env.NODE_ENV !== 'test') {
  setInterval(updateServerWeather, 15 * 60 * 1000);
  setTimeout(updateServerWeather, 3000);
  setInterval(updateNewsSentiment, 30 * 60 * 1000);
  setTimeout(updateNewsSentiment, 5000);

  setTimeout(() => {
    updateFeedsDaily().catch(err => console.error('Error in initial feed update:', err));
  }, 5000);

  setTimeout(() => {
    triggerImageAnalysisBackground().catch(err => console.error('Error in initial background image analysis:', err));
  }, 10000);

  setInterval(() => {
    updateFeedsDaily().catch(err => console.error('Error in scheduled feed update:', err));
  }, 4 * 60 * 60 * 1000);
  idleDaemonRuntime.start();
}

function getLocalIpAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface?.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address);
}

// Wire up modular controllers
const triggerWeatherUpdate = async () => {
  serverWeatherData = null; // Clear cache
  await updateServerWeather();
};

const runCrawler = async ({ categories = [] } = {}) => {
  await executeRecrawlPass({
    state: screensaverState,
    collections: curatedCollections,
    crawlCollections: crawlAllCollections,
    persistCollections: saveCuratedCollections,
    buildActiveFeed: combineFeedsBalanced,
    getActiveCategories,
    broadcastStateSync: emitStateSync,
    triggerImageAnalysisBackground,
    categories,
    broadcast: false
  });
};
let recrawlJobService = null;
let visionAnalysisJobService = null;
const persistExternalPhotoMetadata = ({ url, metadata }) => {
  if (!googlePhotos.isGooglePhotoProxyUrl(url)) {
    return null;
  }

  return googlePhotos.updateCachedMediaItemMetadata(url, metadata || {});
};

const { dispatchCommand, broadcastStateSync, refreshSnapshot } = createDomainDispatcher({
  state: screensaverState,
  collections: curatedCollections,
  io,
  getRuntimeContext,
  launchKioskBrowser: kioskControlRuntime.launchKioskBrowser,
  killKioskBrowser: kioskControlRuntime.killKioskBrowser,
  setManualOverride: kioskControlRuntime.setManualOverride,
  persistExternalPhotoMetadata,
  runCrawler,
  startRecrawlJob: (payload) => recrawlJobService?.submit(payload),
  startVisionAnalysisJob: (payload) => visionAnalysisJobService?.submit(payload),
  triggerWeatherUpdate
});

recrawlJobService = createRecrawlJobService({
  state: screensaverState,
  collections: curatedCollections,
  io,
  crawlCollections: crawlAllCollections,
  persistCollections: saveCuratedCollections,
  buildActiveFeed: combineFeedsBalanced,
  getActiveCategories,
  broadcastStateSync,
  triggerImageAnalysisBackground
});

visionAnalysisJobService = createVisionAnalysisJobService({
  state: screensaverState,
  collections: curatedCollections,
  io,
  getActiveCategories,
  triggerImageAnalysisBackground
});

refreshSnapshot();

require('./routes.js')({
  app,
  state: screensaverState,
  collections: curatedCollections,
  getWeatherData,
  setWeatherData,
  getEnvironmentData: ecowittRuntime.readEnvironment,
  io,
  port: PORT,
  dispatchCommand,
  broadcastStateSync
});
require('./sockets.js')({
  io,
  state: screensaverState,
  collections: curatedCollections,
  combineFeedsBalanced,
  getSmartPhoto,
  launchKioskBrowser: kioskControlRuntime.launchKioskBrowser,
  killKioskBrowser: kioskControlRuntime.killKioskBrowser,
  setManualOverride: kioskControlRuntime.setManualOverride,
  getLocalIpAddresses,
  port: PORT,
  triggerWeatherUpdate,
  dispatchCommand,
  broadcastStateSync,
  getLatestJobs: () => [
  recrawlJobService.getLatestJob(),
  visionAnalysisJobService.getLatestJob()
  ]
});

// Self-healing EADDRINUSE conflict recovery boundary
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const fallbackPort = parseInt(PORT, 10) + 1;
    console.error(`Self-Healing: Port ${PORT} is already bound! Trying fallback port ${fallbackPort}...`);
    sendEmailAlert(
      '⚠️ LUMINA SYSTEM WARNING: Port Collision Intercepted',
      `Port collision detected on default port ${PORT}.\n\nAction: Lumina is automatically healing by binding to fallback port ${fallbackPort}.`
    );
    PORT = fallbackPort;
    setTimeout(() => {
      server.listen(PORT, '0.0.0.0');
    }, 1000);
  } else {
    console.error('Core Server Error:', err.message);
  }
});

// Bootstrapper initialization handler
function startServer() {
  if (process.env.NODE_ENV !== 'test') {
    ecowittRuntime.start();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Lumina Core backend running at http://localhost:${PORT}`);
      console.log('Mobile Remote accessible at your local network IPs:');
      getLocalIpAddresses().forEach(ip => console.log(`  http://${ip}:${PORT}`));
    });
  }
}

module.exports = {
  app,
  server,
  io,
  startServer,
  tagPhotosWithKeywords,
  getSmartPhoto,
  screensaverState,
  curatedCollections,
  updateNewsSentiment,
  updateServerWeather,
  triggerImageAnalysisBackground,
  combineFeedsBalanced,
  selectWeightedRandomPhoto,
  isTimeInSchedule,
  getNextScreensaverState
};
