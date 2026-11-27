/**
 * Explicit assembly for the single native daemon. Importing this module alone
 * does not load adapters, normalize files, open history or schedule resources.
 * Construction still reads defaults/snapshots and configures source adapters;
 * it is an effectful composition boundary, not a pure multi-instance container.
 */
function createApplication() {
  const express = require('express');
  const http = require('http');
  const { Server } = require('socket.io');
  const cors = require('cors');
  const path = require('path');
  const os = require('os');
  const config = require('./config/configLoader.js');
  const { readEnvVar, persistEnvVars } = require('./config/env.js');
  const { createRecrawlJobService, executeRecrawlPass } = require('./jobs/recrawl.js');
  const { createImageAnalysisRunner, createVisionAnalysisJobService } = require('./jobs/visionAnalysis.js');

  // Modular config and service imports
  const { sendEmailAlert } = require('./services/notifier.js');
  const { screensaverState, buildFeedConfigsFromKeywords } = require('./config/state.js');
  const { defaultCuratedCollections, saveCuratedCollections } = require('./config/collections.js');
  const { loadCollectionsSnapshot } = require('./config/collectionsCodec.js');
  const {
    createActiveCategoryDispatcher,
    loadActiveCategories,
    normalizeActiveCategories,
    saveActiveCategories
  } = require('./config/activeCategories.js');
  const { createPhotoCommentStore } = require('./services/photoComments.js');
  const { createDomainDispatcher } = require('./domain/dispatch.js');
  const { applyPoolPolicy } = require('./domain/poolRetention.js');
  const {
    buildBalancedFeed,
    getPhotoByUrl,
    selectSmartPhotoFromFeed,
    isTimeInSchedule
  } = require('./domain/selectors.js');
  const { syncLegacySnapshot } = require('./domain/snapshot.js');
  const { createActiveFeedRuntime } = require('./runtime/activeFeed.js');
  const { createPoolScheduleRuntime } = require('./runtime/poolSchedule.js');
  const { createEnvironmentRefreshRuntime } = require('./runtime/environmentRefresh.js');
  const { createIdleDaemonRuntime, getNextScreensaverState } = require('./runtime/idleDaemon.js');
  const { createKioskControlRuntime } = require('./runtime/kioskControl.js');
  const {
    getGnomeIdleTime,
    isAudioPlaying,
    isSessionInhibited,
    launchChromiumKiosk,
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
  const { createSensorHistoryStore, environmentDeviceKey, indoorTrendQuery, selectIndoorTrend } = require('./services/sensorHistory.js');
  const { saveLocalConfigPatch } = require('./config/localSettings.js');
  const { createSensorPlatform } = require('./services/sensorPlatform.js');
  const {
    decodeEnvironmentSettings,
    normalizeEnvironmentSettings,
    projectLegacySettings,
    toRuntimeSettings,
    validateEnvironmentSettings
  } = require('./domain/environmentSettings.js');
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
  const rootDir = path.join(__dirname, '..');
  /** @type {'constructed' | 'running' | 'stopped'} */
  let lifecycle = 'constructed';
  /** @type {Promise<void> | null} */
  let stopping = null;
  /** @type {Set<ReturnType<typeof setTimeout>>} */
  const timeouts = new Set();
  /** @type {Set<ReturnType<typeof setInterval>>} */
  const intervals = new Set();
  const ownedTimeout = (run, delay) => {
    const handle = setTimeout(() => {
      timeouts.delete(handle);
      if (lifecycle === 'running') run();
    }, delay);
    timeouts.add(handle);
    return handle;
  };
  const ownedInterval = (run, delay) => {
    const handle = setInterval(() => { if (lifecycle === 'running') run(); }, delay);
    intervals.add(handle);
    return handle;
  };

  /** @type {import('./services/sensorHistory.js').SensorHistoryStore|null} */
  let sensorHistoryStore = null;
  const openSensorHistory = () => {
    if (config.sensorHistory?.enabled !== false) {
      try {
        sensorHistoryStore = createSensorHistoryStore({
          databasePath: process.env.NODE_ENV === 'test'
            ? ':memory:'
            : path.resolve(rootDir, config.sensorHistory?.databasePath || 'sensor_history.db')
        });
      } catch (error) {
        console.warn(`Sensor history disabled: ${error.message}`);
      }
    }
  };
  const recordSensorReading = (environment) => {
    try {
      return sensorHistoryStore?.record({ environment: { ...environment, device: environmentDeviceKey(environmentSettings) }, weather: getWeatherData() });
    } catch (error) {
      console.warn(`Sensor history write skipped: ${error.message}`);
      return null;
    }
  };
  let environmentSettings = normalizeEnvironmentSettings(config.ecowitt);
  const persistedEcowittRuntime = createEcowittRuntime({
    settings: toRuntimeSettings(environmentSettings),
    onReading: recordSensorReading
  });
  const sensorPlatform = createSensorPlatform({
    adapters: [{
      id: 'ecowitt-gw1200',
      label: 'Ecowitt GW1200',
      capabilities: ['temperature', 'humidity', 'pressure', 'gateway-payload'],
      read: persistedEcowittRuntime.readEnvironment,
      start: persistedEcowittRuntime.start,
      stop: persistedEcowittRuntime.stop,
      validateSettings: persistedEcowittRuntime.validateSettings,
      updateSettings: persistedEcowittRuntime.updateSettings
    }]
  });
  const updateEcowittSettings = (payload) => {
    const nextSettings = decodeEnvironmentSettings(environmentSettings, payload);
    const validation = validateEnvironmentSettings(nextSettings, {
      adapterIds: sensorPlatform.describe().map(({ id }) => id),
      validateDevice: sensorPlatform.validateSettings
    });
    if (!validation.valid) return validation;

    const runtimeResult = sensorPlatform.updateSettings('ecowitt-gw1200', toRuntimeSettings(nextSettings));
    if (!runtimeResult.valid) return runtimeResult;

    environmentSettings = nextSettings;
    config.ecowitt = projectLegacySettings(environmentSettings);
    saveLocalConfigPatch({ configPath: path.join(rootDir, 'config.json'), patch: { ecowitt: config.ecowitt } });
    return { valid: true, settings: config.ecowitt };
  };

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
  app.use(express.static(path.join(rootDir, 'client/dist')));

  // Curated collections persistence loader
  const jsonPath = path.join(rootDir, 'curated_collections.json');
  const photoComments = createPhotoCommentStore({ jsonPath });
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
      widgets,
      searchKeywords,
      feedConfigs,
      poolPolicies,
      autoLocation,
      manualLocation,
      visionConfig,
      scaleMode,
      unratedPlaybackWeight,
      splitPortrait,
      splitCropPercent,
      excludedKeywords
    }
  } = loadedCollectionsSnapshot;

  Object.assign(screensaverState, {
    widgets,
    searchKeywords,
    feedConfigs,
    poolPolicies,
    autoLocation,
    manualLocation,
    visionConfig,
    scaleMode,
    unratedPlaybackWeight,
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
    rating: photo.rating === undefined ? null : photo.rating,
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
  const activeCategoriesPath = path.join(rootDir, 'active_categories.json');
  const startupCategories = process.env.NODE_ENV === 'test'
    ? [initialCategory]
    : loadActiveCategories({
        path: activeCategoriesPath,
        availableCategories: Object.keys(curatedCollections),
        fallbackCategory: initialCategory
      });
  screensaverState.currentCategory = startupCategories.join(',');
  const initialPhotos = combineFeedsBalanced(startupCategories, curatedCollections);
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
    const googlePhotosPolicy = screensaverState.poolPolicies?.['Google Photos'];
    const googlePhotosItems = applyPoolPolicy(new Date(), googlePhotosPolicy)(
      googlePhotos.getCachedMediaItems()
    );

    return {
      'Google Photos': googlePhotosItems.map((photo) => ({ ...photo, category: 'Google Photos' }))
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
   * Chooses an active pool uniformly, then applies mood and rating preferences
   * within that pool. Rating=1 photos remain excluded.
   */
  function selectWeightedRandomPhoto(photos, currentPhotoUrl = null, direction = 'next') {
    const currentPhoto = photos.find((photo) => photo.url === currentPhotoUrl);
    return selectSmartPhotoFromFeed({
      photos,
      currentPhotoUrl,
      previousCategory: currentPhoto?.category ?? null,
      direction,
      excludedKeywords: screensaverState.excludedKeywords,
      alignWeather: screensaverState.alignWeather,
      physicalMatch: screensaverState.physicalWeather?.weatherMatch ?? 'Cloudy',
      newsMatch: screensaverState.newsSentiment?.weatherMatch ?? 'Cloudy',
      alignTimeOfDay: screensaverState.alignTimeOfDay,
      isNight: serverWeatherData?.current
        ? serverWeatherData.current.is_day === 0
        : (() => {
            const hour = new Date().getHours();
            return hour >= 18 || hour < 6;
          })(),
      nightPercentage: screensaverState.nightPercentage,
      unratedPlaybackWeight: screensaverState.unratedPlaybackWeight
    });
  }

  /**
   * 🎯 getSmartPhoto
   * Dynamic weighted select algorithm mapping physical weather & news sentiment to wallpaper lists,
   * resolved through a Cumulative Distribution Function (CDF) rating-weighted engine.
   */
  function getSmartPhoto(direction = 'next') {
    const list = screensaverState.photosList;
    if (!list?.length) return null;
    const currentPhotoUrl = screensaverState.activePhoto?.url;
    return selectWeightedRandomPhoto(list, currentPhotoUrl, direction);
  }

  const { analyzeImageContent } = require('./services/vision.js');

  const triggerImageAnalysisBackground = createImageAnalysisRunner({
    collections: curatedCollections,
    analyzeImageContent,
    persistCollections: (collections) => saveCuratedCollections(collections, screensaverState),
    refreshActiveFeedIfIncluded: activeFeedRuntime.refreshActiveFeedIfIncluded,
    broadcastStateSync: emitStateSync,
    getVisionConfig: () => screensaverState.visionConfig
  });

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

  let notifyIdleActivity = () => {};

  const kioskControlRuntime = createKioskControlRuntime({
    state: screensaverState,
    emitStateSync,
    getPort: () => PORT,
    isServerListening: () => server.listening,
    notifyActivity: () => notifyIdleActivity(),
    setCpuGovernor,
    launchChromiumKiosk
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

  notifyIdleActivity = idleDaemonRuntime.notifyActivity;

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
    // Policy and explicit display preference saves have narrow strict persistence/retry boundaries.
    persistCollections: saveCuratedCollections,
    persistPoolPolicy: (collections, state) => saveCuratedCollections(collections, state, { throwOnError: true }),
    persistDisplayPreference: (collections, state) => saveCuratedCollections(collections, state, { throwOnError: true }),
    persistEnvVars,
    io,
    getRuntimeContext,
    launchKioskBrowser: kioskControlRuntime.launchKioskBrowser,
    killKioskBrowser: kioskControlRuntime.killKioskBrowser,
    setManualOverride: kioskControlRuntime.setManualOverride,
    persistExternalPhotoMetadata,
    refreshActiveFeed: ({ categories } = {}) => activeFeedRuntime.refreshActiveFeedIfIncluded(categories),
    runCrawler,
    savePhotoComment: ({ url, comment }) => {
      const photo = getPhotoByUrl(curatedCollections, url, { 'Google Photos': googlePhotos.getCachedMediaItems() });
      if (!photo) throw new Error('Photo identity no longer available.');
      return photoComments.write(photo, comment);
    },
    startRecrawlJob: (payload) => recrawlJobService?.submit(payload),
    startVisionAnalysisJob: (payload) => visionAnalysisJobService?.submit(payload),
    triggerWeatherUpdate
  });

  const dispatchRemoteCommand = createActiveCategoryDispatcher({
    dispatchCommand,
    getCategories: () => normalizeActiveCategories(
      screensaverState.currentCategory,
      Object.keys(curatedCollections),
      initialCategory
    ),
    save: (categories) => {
      if (process.env.NODE_ENV === 'test') return;
      try {
        saveActiveCategories({
          path: activeCategoriesPath,
          categories
        });
      } catch (error) {
        console.error('[Active Categories] Failed to persist selection:', error.message);
      }
    }
  });

  const poolScheduleRuntime = createPoolScheduleRuntime({
    state: screensaverState,
    collections: curatedCollections,
    dispatchCommand,
    log: console
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
    readPhotoComment: (photo) => photoComments.read(photo),
    getWeatherData,
    setWeatherData,
    getEnvironmentData: async () => {
      const device = environmentDeviceKey(environmentSettings);
      const reading = await sensorPlatform.read('ecowitt-gw1200');
      // Do not relabel an in-flight observation after a profile/connection edit.
      const environment = { ...(reading && typeof reading === 'object' ? reading : {}),
        device: device === environmentDeviceKey(environmentSettings) ? device : null };
      const now = Date.now(), query = indoorTrendQuery(environment, now);
      try {
        const readings = query ? sensorHistoryStore?.history(query) || [] : [];
        return { ...environment, trend: selectIndoorTrend({ environment, weather: getWeatherData(), readings, now }) };
      } catch (error) {
        console.warn('Indoor trend unavailable:', error instanceof Error ? error.message : String(error));
        return { ...environment, trend: null };
      }
    },
    getEnvironmentHistory: query => sensorHistoryStore?.history(query) || [],
    getEnvironmentStats: query => sensorHistoryStore?.stats(query) || { summary: {}, daily: [] },
    exportEnvironmentHistory: query => sensorHistoryStore?.exportCsv(query) || '',
    getEnvironmentSettings: () => projectLegacySettings(environmentSettings),
    updateEnvironmentSettings: updateEcowittSettings,
    getEnvironmentAdapters: sensorPlatform.describe,
    io,
    port: PORT,
    dispatchCommand: dispatchRemoteCommand,
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
    triggerImageAnalysisBackground,
    dispatchCommand: dispatchRemoteCommand,
    broadcastStateSync,
    getLatestJobs: () => [
    recrawlJobService.getLatestJob(),
    visionAnalysisJobService.getLatestJob()
    ]
  });

  // Self-healing EADDRINUSE conflict recovery boundary
  const onServerError = (err) => {
    if (lifecycle !== 'running') return;
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = parseInt(PORT, 10) + 1;
      console.error(`Self-Healing: Port ${PORT} is already bound! Trying fallback port ${fallbackPort}...`);
      sendEmailAlert(
        '⚠️ LUMINA SYSTEM WARNING: Port Collision Intercepted',
        `Port collision detected on default port ${PORT}.\n\nAction: Lumina is automatically healing by binding to fallback port ${fallbackPort}.`
      );
      PORT = fallbackPort;
      ownedTimeout(() => {
        server.listen(PORT, '0.0.0.0');
      }, 1000);
    } else {
      console.error('Core Server Error:', err.message);
      void stopServer().catch(error => console.error('Server cleanup failed:', error));
    }
  };
  server.on('error', onServerError);

  const closeHttp = () => new Promise((resolve, reject) => {
    try {
      server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve());
    } finally {
      server.closeAllConnections();
    }
  });

  /** Unconditional, retryable disposal of this constructed lifetime. @returns {Promise<void>} */
  function stopServer() {
    lifecycle = 'stopped';
    if (stopping) return stopping;
    const release = [
      ...[...timeouts].map(handle => () => { clearTimeout(handle); timeouts.delete(handle); }),
      ...[...intervals].map(handle => () => { clearInterval(handle); intervals.delete(handle); }),
      () => idleDaemonRuntime.stop(),
      () => poolScheduleRuntime.stop(),
      () => sensorPlatform.stop(),
      () => kioskControlRuntime.killKioskBrowser(true),
      () => { if (sensorHistoryStore) { sensorHistoryStore.close(); sensorHistoryStore = null; } },
      () => server.removeListener('error', onServerError),
      () => io.close(),
      closeHttp
    ];
    screensaverState.screensaverActive = false;
    // Start every teardown even when another rejects. No failed cleanup latch:
    // a later stop retries remaining handles, and concurrent calls join this one.
    stopping = Promise.allSettled(release.map(close => Promise.resolve().then(close)))
      .then(results => {
        const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
        if (errors.length) throw new AggregateError(errors, 'Application cleanup incomplete.');
      })
      .finally(() => { stopping = null; });
    return stopping;
  }

  // Native service restart constructs a fresh lifetime; no reattachment layer.
  function startServer() {
    if (process.env.NODE_ENV === 'test' || lifecycle === 'running') return;
    if (lifecycle === 'stopped') throw new Error('Application is stopped; construct a fresh lifetime.');
    lifecycle = 'running';
    try {
      openSensorHistory();
      ownedInterval(updateServerWeather, 15 * 60 * 1000);
      ownedTimeout(updateServerWeather, 3000);
      ownedInterval(updateNewsSentiment, 30 * 60 * 1000);
      ownedTimeout(updateNewsSentiment, 5000);

      ownedTimeout(() => {
        updateFeedsDaily().catch(err => console.error('Error in initial feed update:', err));
      }, 5000);

      ownedTimeout(() => {
        triggerImageAnalysisBackground().catch(err => console.error('Error in initial background image analysis:', err));
      }, 10000);

      ownedInterval(() => {
        updateFeedsDaily().catch(err => console.error('Error in scheduled feed update:', err));
      }, 4 * 60 * 60 * 1000);
      idleDaemonRuntime.start();
      poolScheduleRuntime.start();
      sensorPlatform.start();
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Lumina Core backend running at http://localhost:${PORT}`);
        console.log('Mobile Remote accessible at your local network IPs:');
        getLocalIpAddresses().forEach(ip => console.log(`  http://${ip}:${PORT}`));
      });
    } catch (error) {
      void stopServer().catch(cleanupError => console.error('Startup cleanup failed:', cleanupError));
      throw error;
    }
  }

  return {
    app,
    server,
    io,
    startServer,
    stopServer,
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
}

// ponytail: preserve the CommonJS facade lazily, with one default application.
let defaultApplication;
const getDefaultApplication = () => (defaultApplication ??= createApplication());
const legacyExports = ['app', 'server', 'io', 'startServer', 'stopServer', 'tagPhotosWithKeywords', 'getSmartPhoto', 'screensaverState', 'curatedCollections', 'updateNewsSentiment', 'updateServerWeather', 'triggerImageAnalysisBackground', 'combineFeedsBalanced', 'selectWeightedRandomPhoto', 'isTimeInSchedule', 'getNextScreensaverState'];
// Retain the concrete CommonJS shape for typed consumers of lazy properties.
module.exports = /** @type {ReturnType<typeof createApplication> & { createApplication: typeof createApplication }} */ (
  Object.defineProperties({ createApplication }, Object.fromEntries(
    legacyExports.map(name => [name, {
      enumerable: true,
      configurable: true,
      get: () => getDefaultApplication()[name],
      set: value => { getDefaultApplication()[name] = value; }
    }])
  ))
);
