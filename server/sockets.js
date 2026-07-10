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
  decodePhotoCropCommand,
  decodePhotoMetadataCommand,
  decodePhotoRatingCommand,
  decodeRecrawlCommand,
  decodeScreensaverActiveCommand,
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
 *   fallback?: (command: Record<string, any>, payload: any) => Promise<void> | void
 * }} options
 */
function createCommandListener({ dispatchCommand, decode, fallback }) {
  return async (payload) => {
    const command = decode(payload);
    if (!command) {
      return;
    }

    if (typeof dispatchCommand === 'function') {
      await dispatchCommand(command);
      return;
    }

    if (typeof fallback === 'function') {
      await fallback(command, payload);
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

    const listenForCommand = (eventName, decode, fallback) => {
      socket.on(eventName, createCommandListener({ dispatchCommand, decode, fallback }));
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
    socket.on('change-category', async (category) => {
      console.log(`[SOCKET EVENT] change-category received: "${category}"`);

      if (dispatchCommand) {
        const command = decodeCategorySelectionFromSocket(category);
        if (command) {
          await dispatchCommand(command);
          return;
        }
      }

      const validCategories = normalizeSocketCategories(category).filter((name) => Boolean(collections[name]));

      if (validCategories.length > 0) {
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
      } else {
        console.error(`[SOCKET EVENT] ERROR: None of the categories in "${category}" exist in curatedCollections keys:`, Object.keys(collections));
      }
    });

    // Change individual active photo
    socket.on('set-active-photo', (photo) => {
      if (dispatchCommand) {
        const command = decodeActivePhotoCommand(photo);
        if (command) {
          dispatchCommand(command);
        }
        return;
      }
      state.activePhoto = photo;
      io.emit('photo-update', photo);
    });

    // Set individual active second photo (sent by TV client to synchronize display control preview)
    socket.on('set-active-second-photo', (photo) => {
      state.activeSecondPhoto = photo;
      io.emit('second-photo-update', photo);
    });

    socket.on('report-photo-metadata', (payload) => {
      const command = decodePhotoMetadataCommand(payload);
      if (!command) return;

      if (googlePhotos.isGooglePhotoProxyUrl(command.payload.url)) {
        const updatedPhoto = applyGooglePhotoMetadata(command.payload.url, {
          orientation: command.payload.orientation,
          width: command.payload.width,
          height: command.payload.height
        });
        if (updatedPhoto) {
          broadcast();
        }
        return;
      }

      if (!dispatchCommand) return;
      dispatchCommand(command);
    });

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
    socket.on('rate-photo', ({ url, rating }) => {
      const command = decodePhotoRatingCommand({ url, rating });
      if (command && dispatchCommand) {
        dispatchCommand(command);
        return;
      }
      if (!command) return;

      const { updatePhotoRating } = require('./config/collections.js');
      updatePhotoRating(collections, state, command.payload.url, command.payload.rating);
      if (command.payload.rating === 1 && state.activePhoto && state.activePhoto.url === command.payload.url) {
        const nextPhoto = getSmartPhoto('next');
        if (nextPhoto) {
          syncActivePhoto(io, state, nextPhoto);
        }
      }
      broadcast();
    });

    // Set individual photo crop ratio and vertical position
    socket.on('set-photo-crop', ({ url, cropPercent, cropPositionY }) => {
      const command = decodePhotoCropCommand({ url, cropPercent, cropPositionY });
      if (!command) return;

      if (googlePhotos.isGooglePhotoProxyUrl(command.payload.url)) {
        const updatedPhoto = applyGooglePhotoMetadata(command.payload.url, {
          cropPercent: command.payload.cropPercent,
          cropPositionY: command.payload.cropPositionY
        });
        if (updatedPhoto) {
          broadcast();
        }
        return;
      }

      if (command && dispatchCommand) {
        dispatchCommand(command);
        return;
      }

      const { updatePhotoCrop } = require('./config/collections.js');
      updatePhotoCrop(collections, state, command.payload.url, command.payload.cropPercent, command.payload.cropPositionY);
      broadcast();
    });


    // Set individual photo pairing prevention
    socket.on('set-photo-prevent-pairing', ({ url, preventPairing, preserveActive }) => {
      if (googlePhotos.isGooglePhotoProxyUrl(url)) {
        const metadata = { preventPairing: Boolean(preventPairing) };
        const updatedPhoto = applyGooglePhotoMetadata(url, metadata);
        if (!updatedPhoto) return;

        if (metadata.preventPairing && preserveActive) {
          const focusedPhoto = state.photosList?.find((photo) => photo?.url === url);
          if (focusedPhoto) {
            state.activePhoto = { ...focusedPhoto };
            state.activeSecondPhoto = null;
          }
        }

        broadcast();
        return;
      }

      if (dispatchCommand) {
        dispatchCommand({
          type: 'set-photo-prevent-pairing',
          payload: { url, preventPairing, preserveActive }
        });
        return;
      }
      if (!url || typeof url !== 'string') return;

      const { updatePhotoPreventPairing } = require('./config/collections.js');
      updatePhotoPreventPairing(collections, state, url, preventPairing);
      if (preventPairing && preserveActive) {
        const focusedPhoto = state.photosList?.find((photo) => photo?.url === url)
          || Object.values(collections).flat().find((photo) => photo?.url === url);
        if (focusedPhoto) {
          state.activePhoto = focusedPhoto;
          state.activeSecondPhoto = null;
        }
      }
      broadcast();
    });

    // Update keywords socket event
    socket.on('update-keywords', ({ category, keywords }) => {
      if (dispatchCommand) {
        const command = decodePoolKeywordsCommand({ category, keywords });
        if (command) {
          void dispatchCommand(command);
        }
        return;
      }

      if (!category || typeof category !== 'string') return;
      if (!collections[category]) return;
      if (!Array.isArray(keywords) || !keywords.every(kw => typeof kw === 'string' && kw.trim().length > 0)) return;

      // Update in state
      state.searchKeywords[category] = keywords.map(kw => kw.trim());

      // Save to curated_collections.json using unified persistence helper
      saveCuratedCollections(collections, state);
      console.log(`[Config Socket] Saved updated search keywords for category "${category}":`, state.searchKeywords[category]);

      broadcast();
    });

    // Update feed config socket event
    socket.on('update-feed-config', ({ category, source, config }) => {
      if (dispatchCommand) {
        const command = decodePoolFeedConfigCommand({ category, source, config });
        if (command) {
          void dispatchCommand(command);
        }
        return;
      }

      if (!category || typeof category !== 'string') return;
      if (!source || typeof source !== 'string') return;
      if (!config || typeof config !== 'object') return;
      if (!collections[category]) return;

      if (!state.feedConfigs) {
        state.feedConfigs = {};
      }
      if (!state.feedConfigs[category]) {
        state.feedConfigs[category] = {};
      }

      state.feedConfigs[category][source] = {
        ...state.feedConfigs[category][source],
        ...config
      };

      saveCuratedCollections(collections, state);
      console.log(`[Config Socket] Saved updated feed config for category "${category}" source "${source}":`, state.feedConfigs[category][source]);

      broadcast();
    });

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
    socket.on('add-category', async ({ category, keyword }) => {
      if (dispatchCommand) {
        const command = decodeAddPoolCommand({ category, keyword });
        if (command) {
          await dispatchCommand(command);
        }
        return;
      }

      if (!category || typeof category !== 'string') return;
      const cleanCategory = category.trim();
      if (!cleanCategory) return;

      const cleanKeyword = String(keyword ?? '').trim();
      if (!cleanKeyword) return;

      // Split keywords by comma or semicolon, trim whitespace, filter out empty strings
      const parsedKeywords = cleanKeyword
        .split(/[;,]/)
        .map(kw => kw.trim())
        .filter(kw => kw.length > 0);

      if (parsedKeywords.length === 0) return;

      console.log(`[SOCKET EVENT] add-category received: "${cleanCategory}" with keywords:`, parsedKeywords);

      // Initialize state searchKeywords if not present
      state.searchKeywords ??= {};

      // Check if it already exists to prevent duplicate creation
      if (collections[cleanCategory] || state.searchKeywords[cleanCategory]) {
        console.warn(`Category "${cleanCategory}" already exists.`);
        return;
      }

      // 1. Register category keywords in state
      state.searchKeywords[cleanCategory] = parsedKeywords;

      // Initialize state feedConfigs if not present
      state.feedConfigs ??= {};
      state.feedConfigs[cleanCategory] = {
        unsplash: { enabled: true, keywords: [...parsedKeywords] },
        wallhaven: { enabled: true, keywords: [...parsedKeywords] },
        metmuseum: { enabled: true, keywords: [...parsedKeywords] },
        artic: { enabled: false, keywords: [...parsedKeywords] }
      };

      // 2. Initialize the collection list in collections
      collections[cleanCategory] = [];

      // 3. Save to curated_collections.json
      saveCuratedCollections(collections, state);

      // Sync state to all clients so remote control UI knows about the category right away
      broadcast();

      // 4. Trigger crawlAllCollections to download photos for this category instantly
      try {
        const { crawlAllCollections } = require('./services/crawler.js');
        const { updatedCollections, updatedAny } = await crawlAllCollections(collections, state.feedConfigs, state.searchKeywords);
        if (updatedAny) {
          Object.entries(updatedCollections).forEach(([key, photos]) => {
            collections[key] = photos;
          });
          saveCuratedCollections(collections, state);
        }

        // If the added category is the current/active category, update photosList
        const currentCats = splitCategories(state.currentCategory);
        if (currentCats.includes(cleanCategory)) {
          state.photosList = combineFeedsBalanced(currentCats, collections);
          if (state.photosList.length > 0) {
            syncActivePhoto(io, state, getSmartPhoto('next') || state.photosList[0]);
          }
        }

        // Broadcast fully loaded updated state
        broadcast();

        // Run background image analysis on the new photos
        const { triggerImageAnalysisBackground } = require('./app.js');
        triggerImageAnalysisBackground().catch((err) => console.error('Error in background image analysis:', err));
      } catch (err) {
        console.error(`Error crawling new category "${cleanCategory}":`, err.message);
      }
    });

    // Delete custom category / scenic pool
    socket.on('delete-category', ({ category }) => {
      if (dispatchCommand) {
        const command = decodeDeletePoolCommand({ category });
        if (command) {
          void dispatchCommand(command);
        }
        return;
      }

      if (!category || typeof category !== 'string') return;
      const cleanCategory = category.trim();
      if (!cleanCategory) return;

      console.log(`[SOCKET EVENT] delete-category received: "${cleanCategory}"`);

      // 1. Delete the category key from state.searchKeywords, state.feedConfigs, and collections
      if (state.searchKeywords) {
        delete state.searchKeywords[cleanCategory];
      }
      if (state.feedConfigs) {
        delete state.feedConfigs[cleanCategory];
      }
      delete collections[cleanCategory];

      // 2. Save collections
      saveCuratedCollections(collections, state);

      // 3. Re-adjust screensaver selected active list if the deleted category was currently displayed
      const currentCats = splitCategories(state.currentCategory);
      if (currentCats.includes(cleanCategory)) {
        const remainingCats = currentCats.filter(c => c !== cleanCategory);
        if (remainingCats.length > 0) {
          state.currentCategory = remainingCats.join(',');
        } else {
          // If no categories are left, fallback to first available category key, or default 'Scenic Nature'
          const remainingKeys = Object.keys(state.searchKeywords || {});
          state.currentCategory = remainingKeys[0] || 'Scenic Nature';
        }

        // Re-combine remaining categories
        const updatedCats = splitCategories(state.currentCategory);
        state.photosList = combineFeedsBalanced(updatedCats, collections);
        const smartPhoto = getSmartPhoto('next');
        if (smartPhoto) {
          state.activePhoto = smartPhoto;
        } else if (state.photosList.length > 0) {
          state.activePhoto = state.photosList[Math.floor(Math.random() * state.photosList.length)];
        } else {
          state.activePhoto = null;
        }
      }

      // 4. Sync state
      broadcast();
    });

    listenForCommand('next-photo', () => decodeAdvancePhotoCommand('next'), () => {
      const photo = getSmartPhoto('next');
      if (photo) {
        syncActivePhoto(io, state, photo);
      }
    });

    listenForCommand('prev-photo', () => decodeAdvancePhotoCommand('prev'), () => {
      const photo = getSmartPhoto('prev');
      if (photo) {
        syncActivePhoto(io, state, photo);
      }
    });

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

    // 🛑 Client reported broken photo marker
    socket.on('mark-photo-broken', ({ url }) => {
      if (!url || typeof url !== 'string') return;
      console.log(`[SOCKET EVENT] mark-photo-broken received for URL: ${url}`);
      if (dispatchCommand) {
        dispatchCommand({
          type: 'mark-photo-broken',
          payload: { url }
        });
        return;
      }
      const { markPhotoBroken } = require('./config/collections.js');
      const updated = markPhotoBroken(collections, state, url);
      if (updated) {
        // If the broken photo is currently active, transition to the next smart photo immediately
        if (state.activePhoto && state.activePhoto.url === url) {
          const nextPhoto = getSmartPhoto('next');
          if (nextPhoto) {
            syncActivePhoto(io, state, nextPhoto);
          }
        }
        broadcast();
      }
    });

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

    socket.on('save-useapi-token', ({ token }) => {
      console.log('[SOCKET EVENT] save-useapi-token received.');
      const sanitizedToken = String(token ?? '').trim();

      try {
        persistEnvVars({ USEAPI_TOKEN: sanitizedToken });
        state.hasUseApiToken = !!sanitizedToken;
        broadcast();
        console.log('[SOCKET EVENT] Successfully persisted USEAPI_TOKEN to .env file');
        socket.emit('useapi-token-saved', { success: true });
      } catch (err) {
        console.error('[SOCKET EVENT] Failed to save USEAPI_TOKEN to .env:', err.message);
        socket.emit('useapi-token-saved', { success: false, error: err.message });
      }
    });

    socket.on('save-tumblr-api-key', ({ token }) => {
      console.log('[SOCKET EVENT] save-tumblr-api-key received.');
      const sanitizedToken = String(token ?? '').trim();

      try {
        persistEnvVars({ TUMBLR_API_KEY: sanitizedToken });
        state.hasTumblrApiKey = !!sanitizedToken;
        broadcast();
        console.log('[SOCKET EVENT] Successfully persisted TUMBLR_API_KEY to .env file');
        socket.emit('tumblr-api-key-saved', { success: true });
      } catch (err) {
        console.error('[SOCKET EVENT] Failed to save TUMBLR_API_KEY to .env:', err.message);
        socket.emit('tumblr-api-key-saved', { success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Device disconnected:', socket.id);
    });
  });
};
