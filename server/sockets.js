// @ts-check

const { sendEmailAlert } = require('./services/notifier.js');
const googlePhotos = require('./services/googlePhotos.js');
const { saveCuratedCollections } = require('./config/collections.js');
const { persistEnvVars } = require('./config/env.js');
const { getHostDisplayInfo } = require('./services/system.js');
const {
  buildBooleanFieldPatch,
  buildEnumFieldPatch,
  buildFiniteNumberFieldPatch,
  buildObjectFieldPatch,
  buildPercentFieldPatch,
  buildTrimmedStringFieldPatch,
  buildWidgetPatch,
  createStatePatchCommandDecoder,
  decodeAddPoolCommand,
  decodeActivePhotoCommand,
  decodeAdvancePhotoCommand,
  decodeCategorySelectionFromSocket,
  decodeDeletePoolCommand,
  decodeExcludedKeywordsCommand,
  decodePoolFeedConfigCommand,
  decodePoolKeywordsCommand,
  decodeBrokenPhotoCommand,
  decodePhotoCropCommand,
  decodePhotoMetadataCommand,
  decodePhotoPreventPairingCommand,
  decodePhotoRatingCommand,
  decodeRecrawlCommand,
  decodeScreensaverActiveCommand,
  decodeTumblrApiKeyCommand,
  decodeUseApiTokenCommand,
  decodeVisionAnalysisCommand,
} = require('./domain/commands.js');

const STATE_PATCH_FIELDS = [
  'theme',
  'inactivityTimeout',
  'slideshowInterval',
  'scaleMode',
  'splitPortrait',
  'splitCropPercent',
  'alignTimeOfDay',
  'alignWeather',
  'nightPercentage',
  'allowOpenAiFallback'
];
const CATEGORY_ALIASES = {
  'Liminal Space': 'Liminal Spaces',
  'Liminal Spaces': 'Liminal Spaces',
  'AI Creation': 'AI Creations',
  'AI Creations': 'AI Creations'
};

const decodeWidgetCommand = createStatePatchCommandDecoder(buildWidgetPatch);
const decodeAlignTimeCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('alignTimeOfDay'));
const decodeAlignWeatherCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('alignWeather'));
const decodeAllowOpenAiFallbackCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('allowOpenAiFallback'));
const decodeScaleModeCommand = createStatePatchCommandDecoder(buildEnumFieldPatch('scaleMode', ['cover', 'contain']));
const decodeSplitPortraitCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('splitPortrait'));
const decodeSplitCropCommand = createStatePatchCommandDecoder(buildPercentFieldPatch('splitCropPercent'));
const decodeVisionConfigCommand = createStatePatchCommandDecoder(buildObjectFieldPatch('visionConfig'));
const decodeNightPercentageCommand = createStatePatchCommandDecoder(buildPercentFieldPatch('nightPercentage'));
const decodeIntervalCommand = createStatePatchCommandDecoder(buildFiniteNumberFieldPatch('slideshowInterval'));
const decodeThemeCommand = createStatePatchCommandDecoder(buildTrimmedStringFieldPatch('theme'));
const decodeAutoLocationCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('autoLocation'));
const decodeManualLocationCommand = createStatePatchCommandDecoder(buildObjectFieldPatch('manualLocation'));
const decodeScreensaverActiveFromSocket = (active) => decodeScreensaverActiveCommand({ active });
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const splitCategories = (categories = '') => categories.split(',').map((category) => category.trim()).filter(Boolean);
const normalizeSocketCategories = (category) => splitCategories(category).map((name) => CATEGORY_ALIASES[name] ?? name);
const pickRandomPhoto = (photos) => photos[Math.floor(Math.random() * photos.length)] ?? null;
const syncActivePhoto = (io, state, photo) => {
  state.activePhoto = photo;
  io.emit('photo-update', state.activePhoto);
};

/**
 * @param {{
 *   dispatchCommand?: (command: Record<string, any>) => Promise<any> | any,
 *   decode: (payload: any) => Record<string, any> | null,
 *   fallback?: (command: Record<string, any>, payload: any) => Promise<void> | void,
 *   intercept?: (command: Record<string, any>, payload: any) => Promise<boolean> | boolean,
 *   afterDispatch?: (result: any, command: Record<string, any>, payload: any) => Promise<void> | void,
 *   onError?: (error: Error, command: Record<string, any>, payload: any) => Promise<void> | void
 * }} options
 */
function createCommandListener({ dispatchCommand, decode, fallback, intercept, afterDispatch, onError }) {
  return async (payload) => {
    const command = decode(payload);
    if (!command) {
      return;
    }

    try {
      if (typeof intercept === 'function' && await intercept(command, payload)) {
        return;
      }

      const result = typeof dispatchCommand === 'function'
        ? await dispatchCommand(command)
        : (typeof fallback === 'function' ? await fallback(command, payload) : undefined);

      if (typeof afterDispatch === 'function') {
        await afterDispatch(result, command, payload);
      }
    } catch (error) {
      if (typeof onError === 'function') {
        await onError(error, command, payload);
        return;
      }

      throw error;
    }
  };
}

/**
 * 🛰️ configureSockets
 * Orchestrates Socket.IO event hooks, synchronizing the smart display
 * client and mobile remote controls in real-time.
 */
module.exports = function configureSockets({
  io,
  state,
  collections,
  combineFeedsBalanced,
  getSmartPhoto,
  launchKioskBrowser,
  killKioskBrowser,
  setManualOverride,
  getLocalIpAddresses,
  port,
  triggerWeatherUpdate,
  dispatchCommand,
  broadcastStateSync,
  getLatestJobs = null
}) {
  const broadcast = () => {
    if (typeof broadcastStateSync === 'function') {
      return broadcastStateSync();
    }

    io.emit('state-sync', state);
  };

  const applyGooglePhotoMetadata = (url, metadata) => {
    const metadataPatch = googlePhotos.buildGooglePhotoMetadataPatch(metadata);
    const updatedPhoto = googlePhotos.updateCachedMediaItemMetadata(url, metadataPatch);
    if (!updatedPhoto) {
      return null;
    }

    googlePhotos.applyCachedMediaItemMetadataToState(state, url, metadataPatch);
    return updatedPhoto;
  };

  const pickPayloadFields = (command, fields) => Object.fromEntries(
    fields.flatMap((field) => (
      command.payload?.[field] === undefined
        ? []
        : [[field, command.payload[field]]]
    ))
  );

  const preserveFocusedPhoto = (url) => {
    const focusedPhoto = state.photosList?.find((photo) => photo?.url === url);
    if (!focusedPhoto) {
      return false;
    }

    state.activePhoto = { ...focusedPhoto };
    state.activeSecondPhoto = null;
    return true;
  };

  const createGooglePhotoMetadataInterceptor = ({ buildMetadata, afterApply }) => async (command) => {
    const url = String(command.payload?.url || '');
    if (!googlePhotos.isGooglePhotoProxyUrl(url)) {
      return false;
    }

    const updatedPhoto = applyGooglePhotoMetadata(url, buildMetadata(command));
    if (updatedPhoto && typeof afterApply === 'function') {
      await afterApply({ command, updatedPhoto });
    }
    if (updatedPhoto) {
      broadcast();
    }
    return true;
  };

  const applyLegacyStatePatchCommand = async (command) => {
    const patch = isPlainObject(command.payload) ? command.payload : {};
    const {
      widgets,
      visionConfig,
      autoLocation,
      manualLocation
    } = patch;
    let changed = false;
    let refreshWeather = false;

    STATE_PATCH_FIELDS.forEach((field) => {
      if (patch[field] === undefined || state[field] === patch[field]) {
        return;
      }

      state[field] = patch[field];
      changed = true;
    });

    if (isPlainObject(widgets)) {
      Object.keys(widgets).forEach((widgetName) => {
        if (!Object.prototype.hasOwnProperty.call(state.widgets || {}, widgetName)) {
          return;
        }

        const visible = Boolean(widgets[widgetName]);
        if (state.widgets[widgetName] !== visible) {
          state.widgets[widgetName] = visible;
          changed = true;
        }
      });
    }

    if (isPlainObject(visionConfig)) {
      state.visionConfig = { ...visionConfig };
      changed = true;
    }

    if (autoLocation !== undefined && state.autoLocation !== autoLocation) {
      state.autoLocation = Boolean(autoLocation);
      changed = true;
      refreshWeather = true;
    }

    if (isPlainObject(manualLocation)) {
      state.manualLocation = { ...manualLocation };
      changed = true;
      refreshWeather = true;
    }

    if (!changed) {
      return;
    }

    saveCuratedCollections(collections, state);
    if (refreshWeather && typeof triggerWeatherUpdate === 'function') {
      await triggerWeatherUpdate();
    }
    broadcast();
  };

  const applyLegacyCategorySelection = (command) => {
    const validCategories = normalizeSocketCategories(command.payload?.categories).filter((name) => Boolean(collections[name]));

    if (validCategories.length === 0) {
      console.error(`[SOCKET EVENT] ERROR: None of the categories in "${command.payload?.categories}" exist in curatedCollections keys:`, Object.keys(collections));
      return;
    }

    state.currentCategory = validCategories.join(',');
    state.photosList = combineFeedsBalanced(validCategories, collections);

    const smartPhoto = getSmartPhoto('next');
    if (smartPhoto) {
      state.activePhoto = smartPhoto;
      console.log(`[SOCKET EVENT] Selected smart starting photo: "${smartPhoto.title}"`);
    } else if (state.photosList.length > 0) {
      state.activePhoto = pickRandomPhoto(state.photosList);
      console.log(`[SOCKET EVENT] Selected random starting photo: "${state.activePhoto.title}"`);
    }

    console.log(`[SOCKET EVENT] Broadcasting state-sync with categories: "${state.currentCategory}"`);
    broadcast();
  };

  const applyLegacyActivePhoto = (command) => {
    syncActivePhoto(io, state, command.payload?.photo || { url: command.payload?.url });
  };

  const applyLegacyPhotoRating = (command) => {
    const { updatePhotoRating } = require('./config/collections.js');
    updatePhotoRating(collections, state, command.payload.url, command.payload.rating);
    if (command.payload.rating === 1 && state.activePhoto && state.activePhoto.url === command.payload.url) {
      const nextPhoto = getSmartPhoto('next');
      if (nextPhoto) {
        syncActivePhoto(io, state, nextPhoto);
      }
    }
    broadcast();
  };

  const applyLegacyPhotoCrop = (command) => {
    const { updatePhotoCrop } = require('./config/collections.js');
    updatePhotoCrop(
      collections,
      state,
      command.payload.url,
      command.payload.cropPercent,
      command.payload.cropPositionY
    );
    broadcast();
  };

  const applyLegacyPreventPairing = (command) => {
    const { updatePhotoPreventPairing } = require('./config/collections.js');
    const { url, preventPairing, preserveActive } = command.payload;
    updatePhotoPreventPairing(collections, state, url, preventPairing);
    if (preventPairing && preserveActive) {
      preserveFocusedPhoto(url);
    }
    broadcast();
  };

  const applyLegacyAdvancePhoto = (direction) => () => {
    const photo = getSmartPhoto(direction);
    if (photo) {
      syncActivePhoto(io, state, photo);
    }
  };

  const applyLegacyPoolKeywords = (command) => {
    const { name, keywords } = command.payload;
    if (!collections[name]) {
      return;
    }

    state.searchKeywords[name] = [...keywords];
    saveCuratedCollections(collections, state);
    console.log(`[Config Socket] Saved updated search keywords for category "${name}":`, state.searchKeywords[name]);
    broadcast();
  };

  const applyLegacyPoolFeedConfig = (command) => {
    const { name, source, config } = command.payload;
    if (!collections[name]) {
      return;
    }

    state.feedConfigs ??= {};
    state.feedConfigs[name] ??= {};
    state.feedConfigs[name][source] = {
      ...state.feedConfigs[name][source],
      ...config
    };

    saveCuratedCollections(collections, state);
    console.log(`[Config Socket] Saved updated feed config for category "${name}" source "${source}":`, state.feedConfigs[name][source]);
    broadcast();
  };

  const buildDefaultPoolFeedConfig = (keywords) => ({
    unsplash: { enabled: true, keywords: [...keywords] },
    wallhaven: { enabled: true, keywords: [...keywords] },
    metmuseum: { enabled: true, keywords: [...keywords] },
    artic: { enabled: false, keywords: [...keywords] }
  });

  const applyLegacyAddPool = async (command) => {
    const { name, keywords } = command.payload;
    if (collections[name] || state.searchKeywords?.[name]) {
      console.warn(`Category "${name}" already exists.`);
      return;
    }

    console.log(`[SOCKET EVENT] add-category received: "${name}" with keywords:`, keywords);

    state.searchKeywords ??= {};
    state.searchKeywords[name] = [...keywords];
    state.feedConfigs ??= {};
    state.feedConfigs[name] = buildDefaultPoolFeedConfig(keywords);
    collections[name] = [];

    saveCuratedCollections(collections, state);
    broadcast();

    try {
      const { crawlAllCollections } = require('./services/crawler.js');
      const { updatedCollections, updatedAny } = await crawlAllCollections(collections, state.feedConfigs, state.searchKeywords);
      if (updatedAny) {
        Object.entries(updatedCollections).forEach(([key, photos]) => {
          collections[key] = photos;
        });
        saveCuratedCollections(collections, state);
      }

      const currentCats = splitCategories(state.currentCategory);
      if (currentCats.includes(name)) {
        state.photosList = combineFeedsBalanced(currentCats, collections);
        if (state.photosList.length > 0) {
          syncActivePhoto(io, state, getSmartPhoto('next') || state.photosList[0]);
        }
      }

      broadcast();

      const { triggerImageAnalysisBackground } = require('./app.js');
      triggerImageAnalysisBackground().catch((err) => console.error('Error in background image analysis:', err));
    } catch (err) {
      console.error(`Error crawling new category "${name}":`, err.message);
    }
  };

  const applyLegacyDeletePool = (command) => {
    const { name } = command.payload;
    if (!collections[name] && !state.searchKeywords?.[name]) {
      return;
    }

    console.log(`[SOCKET EVENT] delete-category received: "${name}"`);

    if (state.searchKeywords) {
      delete state.searchKeywords[name];
    }
    if (state.feedConfigs) {
      delete state.feedConfigs[name];
    }
    delete collections[name];

    saveCuratedCollections(collections, state);

    const currentCats = splitCategories(state.currentCategory);
    if (currentCats.includes(name)) {
      const remainingCats = currentCats.filter((category) => category !== name);
      if (remainingCats.length > 0) {
        state.currentCategory = remainingCats.join(',');
      } else {
        const remainingKeys = Object.keys(state.searchKeywords || {});
        state.currentCategory = remainingKeys[0] || 'Scenic Nature';
      }

      const updatedCats = splitCategories(state.currentCategory);
      state.photosList = combineFeedsBalanced(updatedCats, collections);
      const smartPhoto = getSmartPhoto('next');
      state.activePhoto = smartPhoto || pickRandomPhoto(state.photosList);
    }

    broadcast();
  };

  const createLegacyEnvSecretFallback = ({ envKey, runtimeFlag }) => (command) => {
    const value = String(command.payload?.value || '');
    persistEnvVars({ [envKey]: value });
    state[runtimeFlag] = Boolean(value);
    broadcast();
  };

  const applyLegacyBrokenPhoto = (command) => {
    const { markPhotoBroken } = require('./config/collections.js');
    const updated = markPhotoBroken(collections, state, command.payload.url);
    if (!updated) {
      return;
    }

    if (state.activePhoto && state.activePhoto.url === command.payload.url) {
      const nextPhoto = getSmartPhoto('next');
      if (nextPhoto) {
        syncActivePhoto(io, state, nextPhoto);
      }
    }
    broadcast();
  };

  io.on('connection', (socket) => {
    console.log('Device connected to Lumina network:', socket.id);

    // Sync immediately on connect
    socket.emit('state-sync', state);
    socket.emit('ip-info', {
      localIps: getLocalIpAddresses(),
      port
    });

    const latestJobs = typeof getLatestJobs === 'function' ? getLatestJobs() : [];
    latestJobs.filter(Boolean).forEach((job) => {
      socket.emit('job-status', job);
    });

    const listenForCommand = (eventName, decode, fallback, intercept, afterDispatch, onError) => {
      socket.on(eventName, createCommandListener({
        dispatchCommand,
        decode,
        fallback,
        intercept,
        afterDispatch,
        onError
      }));
    };

    const listenForStatePatch = (eventName, decode) => {
      listenForCommand(eventName, decode, applyLegacyStatePatchCommand);
    };

    listenForStatePatch('toggle-widget', decodeWidgetCommand);
    listenForStatePatch('toggle-align-time', decodeAlignTimeCommand);
    listenForStatePatch('toggle-align-weather', decodeAlignWeatherCommand);
    listenForStatePatch('toggle-allow-openai-fallback', decodeAllowOpenAiFallbackCommand);
    listenForStatePatch('change-scale-mode', decodeScaleModeCommand);
    listenForStatePatch('toggle-split-portrait', decodeSplitPortraitCommand);
    listenForStatePatch('change-split-crop', decodeSplitCropCommand);
    listenForStatePatch('update-vision-config', decodeVisionConfigCommand);
    listenForStatePatch('change-night-percentage', decodeNightPercentageCommand);
    listenForStatePatch('change-interval', decodeIntervalCommand);
    listenForStatePatch('change-theme', decodeThemeCommand);
    listenForStatePatch('toggle-auto-location', decodeAutoLocationCommand);
    listenForStatePatch('update-manual-location', decodeManualLocationCommand);

    // Client media loading failure notifier
    socket.on('report-media-failure', ({ category, failedUrls, message }) => {
      console.error(`CLIENT ERROR REPORT: Media loading failed in category "${category}":`, message);
      sendEmailAlert(
        '🚨 LUMINA CRITICAL ALERT: Display Feed Failure Detected',
        `Lumina screensaver client has reported a media loading failure on your smart display.\n\nCategory: ${category}\n\nProblem: ${message}\n\nFailed Wallpaper URLs:\n${failedUrls.join('\n')}\n\nAction: The client is rate-limiting skips and holding an offline visual boundary. Please check your network connection.`
      );
    });
    
    // Change Wallpaper category
    listenForCommand('change-category', (category) => {
      console.log(`[SOCKET EVENT] change-category received: "${category}"`);
      return decodeCategorySelectionFromSocket(category);
    }, applyLegacyCategorySelection);

    // Change individual active photo
    listenForCommand('set-active-photo', decodeActivePhotoCommand, applyLegacyActivePhoto);

    // Set individual active second photo (sent by TV client to synchronize display control preview)
    socket.on('set-active-second-photo', (photo) => {
      state.activeSecondPhoto = photo;
      io.emit('second-photo-update', photo);
    });

    listenForCommand(
      'report-photo-metadata',
      decodePhotoMetadataCommand,
      null,
      createGooglePhotoMetadataInterceptor({
        buildMetadata: (command) => pickPayloadFields(command, ['orientation', 'width', 'height'])
      })
    );

    socket.on('report-tv-viewport', async (payload) => {
      const width = Number(payload?.width);
      const height = Number(payload?.height);

      if (!(width > 0) || !(height > 0)) {
        return;
      }

      state.tvViewport = {
        width,
        height,
        aspectRatio: width / height,
        updatedAt: Date.now()
      };

      if (!state.tvDisplayInfo) {
        const tvDisplayInfo = await getHostDisplayInfo();
        if (tvDisplayInfo) {
          state.tvDisplayInfo = tvDisplayInfo;
        }
      }
      broadcast();
    });

    // Rate photo socket event
    listenForCommand(
      'rate-photo',
      decodePhotoRatingCommand,
      applyLegacyPhotoRating,
      createGooglePhotoMetadataInterceptor({
        buildMetadata: (command) => pickPayloadFields(command, ['rating'])
      })
    );

    // Set individual photo crop ratio and vertical position
    listenForCommand(
      'set-photo-crop',
      decodePhotoCropCommand,
      applyLegacyPhotoCrop,
      createGooglePhotoMetadataInterceptor({
        buildMetadata: (command) => pickPayloadFields(command, ['cropPercent', 'cropPositionY'])
      })
    );


    // Set individual photo pairing prevention
    listenForCommand(
      'set-photo-prevent-pairing',
      decodePhotoPreventPairingCommand,
      applyLegacyPreventPairing,
      createGooglePhotoMetadataInterceptor({
        buildMetadata: (command) => pickPayloadFields(command, ['preventPairing']),
        afterApply: ({ command }) => {
          if (command.payload.preventPairing && command.payload.preserveActive) {
            preserveFocusedPhoto(command.payload.url);
          }
        }
      })
    );

    // Update keywords socket event
    listenForCommand('update-keywords', decodePoolKeywordsCommand, applyLegacyPoolKeywords);

    // Update feed config socket event
    listenForCommand('update-feed-config', decodePoolFeedConfigCommand, applyLegacyPoolFeedConfig);

    // Save and sync excluded keywords
    socket.on('update-excluded-keywords', (keywords) => {
      if (dispatchCommand) {
        const command = decodeExcludedKeywordsCommand(keywords);
        if (command) {
          dispatchCommand(command);
          console.log('[SOCKET EVENT] update-excluded-keywords saved and broadcasted:', keywords);
        }
        return;
      }

      if (Array.isArray(keywords)) {
        state.excludedKeywords = keywords.map(kw => String(kw).trim()).filter(Boolean);
        saveCuratedCollections(collections, state);

        // Instantly refresh photos list in state to apply new exclusions
        const currentCats = splitCategories(state.currentCategory);
        state.photosList = combineFeedsBalanced(currentCats, collections);

        if (state.photosList.length > 0) {
          const matchesExclusionLocally = (photo) => state.excludedKeywords.some(
            (keyword) => photo?.title?.toLowerCase().includes(keyword.toLowerCase())
          );

          if (matchesExclusionLocally(state.activePhoto)) {
            state.activePhoto = pickRandomPhoto(state.photosList);
          }
        }

        broadcast();
        console.log('[SOCKET EVENT] update-excluded-keywords saved and broadcasted:', state.excludedKeywords);
      }
    });

    // Add custom category / scenic pool
    listenForCommand('add-category', decodeAddPoolCommand, applyLegacyAddPool);

    // Delete custom category / scenic pool
    listenForCommand('delete-category', decodeDeletePoolCommand, applyLegacyDeletePool);

    listenForCommand('next-photo', () => decodeAdvancePhotoCommand('next'), applyLegacyAdvancePhoto('next'));

    listenForCommand('prev-photo', () => decodeAdvancePhotoCommand('prev'), applyLegacyAdvancePhoto('prev'));

    listenForCommand('set-screensaver-active', decodeScreensaverActiveFromSocket, (command) => {
      if (command.payload.active) {
        state.screensaverActive = true;
        // Arm manualOverride BEFORE launching so the idle daemon doesn't
        // immediately conclude shouldBeActive=false and revert the state.
        setManualOverride(true);
        launchKioskBrowser();
      } else {
        state.screensaverActive = false;
        setManualOverride(false);
        killKioskBrowser();
      }
      broadcast();
    });

    // Dynamic signed URL refresh for Google Photos casting on demand
    socket.on('get-active-google-photo', async ({ mediaItemId }) => {
      try {
        const freshUrl = await googlePhotos.refreshMediaItemUrl(mediaItemId);
        socket.emit('active-google-photo-response', { mediaItemId, url: freshUrl });
      } catch (err) {
        console.error(`Socket Event: Failed to refresh Google Photo URL for item ${mediaItemId}:`, err.message);
        socket.emit('active-google-photo-response', { mediaItemId, error: err.message });
      }
    });

    listenForCommand(
      'mark-photo-broken',
      (payload) => {
        console.log(`[SOCKET EVENT] mark-photo-broken received for URL: ${payload?.url}`);
        return decodeBrokenPhotoCommand(payload);
      },
      applyLegacyBrokenPhoto,
      createGooglePhotoMetadataInterceptor({
        buildMetadata: () => ({ rating: 1, isBroken: true })
      })
    );

    listenForCommand('trigger-recrawl', (payload) => {
      console.log('[SOCKET EVENT] trigger-recrawl received. Initiating manual crawl...');
      return decodeRecrawlCommand(payload);
    }, () => {
      socket.emit('recrawl-complete', { success: false, error: 'Recrawl dispatcher unavailable.' });
    });

    listenForCommand('trigger-vision-analysis', (payload) => {
      console.log('[SOCKET EVENT] trigger-vision-analysis received. Initiating manual vision analysis...');
      return decodeVisionAnalysisCommand(payload);
    }, () => {
      socket.emit('job-status', {
        type: 'vision-analysis',
        status: 'failed',
        error: 'Vision-analysis dispatcher unavailable.'
      });
    });

    const emitSecretSaveResult = (eventName, success, error) => {
      socket.emit(eventName, success ? { success: true } : { success: false, error });
    };

    listenForCommand(
      'save-useapi-token',
      decodeUseApiTokenCommand,
      createLegacyEnvSecretFallback({ envKey: 'USEAPI_TOKEN', runtimeFlag: 'hasUseApiToken' }),
      null,
      () => {
        console.log('[SOCKET EVENT] Successfully persisted USEAPI_TOKEN through the shared admin command path');
        emitSecretSaveResult('useapi-token-saved', true);
      },
      (error) => {
        console.error('[SOCKET EVENT] Failed to save USEAPI_TOKEN:', error.message);
        emitSecretSaveResult('useapi-token-saved', false, error.message);
      }
    );

    listenForCommand(
      'save-tumblr-api-key',
      decodeTumblrApiKeyCommand,
      createLegacyEnvSecretFallback({ envKey: 'TUMBLR_API_KEY', runtimeFlag: 'hasTumblrApiKey' }),
      null,
      () => {
        console.log('[SOCKET EVENT] Successfully persisted TUMBLR_API_KEY through the shared admin command path');
        emitSecretSaveResult('tumblr-api-key-saved', true);
      },
      (error) => {
        console.error('[SOCKET EVENT] Failed to save TUMBLR_API_KEY:', error.message);
        emitSecretSaveResult('tumblr-api-key-saved', false, error.message);
      }
    );

    socket.on('disconnect', () => {
      console.log('Device disconnected:', socket.id);
    });
  });
};
