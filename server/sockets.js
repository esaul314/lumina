const { sendEmailAlert } = require('./services/notifier.js');
const googlePhotos = require('./services/googlePhotos.js');
const { saveCuratedCollections } = require('./config/collections.js');
const { persistEnvVars } = require('./config/env.js');
const {
  decodeActivePhotoCommand,
  decodeAdvancePhotoCommand,
  decodeCategorySelectionFromSocket,
  decodeExcludedKeywordsCommand,
  decodePhotoCropCommand,
  decodePhotoMetadataCommand,
  decodePhotoRatingCommand,
  decodeSplitCropCommand,
  decodeSplitPortraitCommand
} = require('./domain/commands.js');

/**
 * 💾 persistLocationSettings
 * Saves autoLocation and manualLocation into curated_collections.json
 * so they survive server restarts.
 */
function persistLocationSettings(state, collections) {
  saveCuratedCollections(collections, state);
  console.log('[Config] Persisted location settings to curated_collections.json');
}
/**
 * 🛰️ configureSockets
 * Orchestrates Socket.IO event hooks, synchronizing the smart display
 * client and mobile remote controls in real-time.
 */
module.exports = function(io, state, collections, combineFeedsBalanced, getSmartPhoto, launchKioskBrowser, killKioskBrowser, setManualOverride, getLocalIpAddresses, PORT, triggerWeatherUpdate, dispatchCommand, broadcastStateSync) {
  const broadcast = () => {
    if (typeof broadcastStateSync === 'function') {
      broadcastStateSync();
      return;
    }
    io.emit('state-sync', state);
  };
  
  io.on('connection', (socket) => {
    console.log('Device connected to Lumina network:', socket.id);
    
    // Sync immediately on connect
    socket.emit('state-sync', state);
    socket.emit('ip-info', {
      localIps: getLocalIpAddresses(),
      port: PORT
    });
    
    // Toggle Widget event
    socket.on('toggle-widget', ({ widgetName, visible }) => {
      if (state.widgets[widgetName] !== undefined) {
        state.widgets[widgetName] = visible;
        broadcast();
      }
    });

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
      
      const selectedCategories = category.split(',').map(c => {
        const catName = c.trim();
        if (catName === 'Liminal Space' || catName === 'Liminal Spaces') {
          return 'Liminal Spaces';
        }
        if (catName === 'AI Creation' || catName === 'AI Creations') {
          return 'AI Creations';
        }
        return catName;
      });

      const validCategories = selectedCategories.filter(catName => !!collections[catName]);

      if (validCategories.length > 0) {
        state.currentCategory = validCategories.join(',');
        state.photosList = combineFeedsBalanced(validCategories, collections);
        
        const smartPhoto = getSmartPhoto('next');
        if (smartPhoto) {
          state.activePhoto = smartPhoto;
          console.log(`[SOCKET EVENT] Selected smart starting photo: "${smartPhoto.title}"`);
        } else if (state.photosList.length > 0) {
          state.activePhoto = state.photosList[Math.floor(Math.random() * state.photosList.length)];
          console.log(`[SOCKET EVENT] Selected random starting photo: "${state.activePhoto.title}"`);
        }
        
        console.log(`[SOCKET EVENT] Broadcasting state-sync with categories: "${state.currentCategory}"`);
        broadcast();
      } else {
        console.error(`[SOCKET EVENT] ERROR: None of the categories in "${category}" exist in curatedCollections keys:`, Object.keys(collections));
      }
    });

    // Toggle time of day alignment
    socket.on('toggle-align-time', (enabled) => {
      state.alignTimeOfDay = enabled;
      console.log(`Align Time of Day changed to: ${enabled}`);
      broadcast();
    });

    // Toggle weather alignment
    socket.on('toggle-align-weather', (enabled) => {
      state.alignWeather = enabled;
      console.log(`Align Weather changed to: ${enabled}`);
      broadcast();
    });

    // Toggle OpenAI fallback consent
    socket.on('toggle-allow-openai-fallback', (enabled) => {
      state.allowOpenAiFallback = !!enabled;
      console.log(`Allow OpenAI Fallback changed to: ${state.allowOpenAiFallback}`);
      broadcast();
    });

    // Change scale mode
    socket.on('change-scale-mode', (mode) => {
      if (mode === 'cover' || mode === 'contain') {
        if (dispatchCommand) {
          dispatchCommand({
            type: 'set-scale-mode',
            payload: { mode }
          });
          return;
        }
        state.scaleMode = mode;
        console.log(`Scale Mode changed to: ${mode}`);
        saveCuratedCollections(collections, state);
        broadcast();
      }
    });

    // Toggle split portrait display
    socket.on('toggle-split-portrait', (enabled) => {
      if (dispatchCommand) {
        const command = decodeSplitPortraitCommand(enabled);
        dispatchCommand(command);
        return;
      }
      state.splitPortrait = !!enabled;
      console.log(`Split Portrait changed to: ${state.splitPortrait}`);
      saveCuratedCollections(collections, state);
      broadcast();
    });

    // Update split portrait crop percentage
    socket.on('change-split-crop', (percent) => {
      if (dispatchCommand) {
        const command = decodeSplitCropCommand(percent);
        if (command) {
          dispatchCommand(command);
        }
        return;
      }
      const val = parseInt(percent, 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        state.splitCropPercent = val;
        console.log(`Split Crop Percent changed to: ${val}%`);
        saveCuratedCollections(collections, state);
        broadcast();
      }
    });

    // Update vision configuration settings
    socket.on('update-vision-config', (config) => {
      if (config && typeof config === 'object') {
        state.visionConfig = {
          apiUrl: String(config.apiUrl || '').trim(),
          apiKey: String(config.apiKey || '').trim(),
          model: String(config.model || '').trim(),
          fallbackUrl: String(config.fallbackUrl || '').trim(),
          fallbackApiKey: String(config.fallbackApiKey || '').trim(),
          fallbackModel: String(config.fallbackModel || '').trim()
        };
        console.log('[Config Socket] Saved updated Vision API Configuration.');
        saveCuratedCollections(collections, state);
        broadcast();
      }
    });

    // Change night photo percentage selection
    socket.on('change-night-percentage', (percentage) => {
      if (typeof percentage === 'number' && percentage >= 0 && percentage <= 100) {
        state.nightPercentage = percentage;
        console.log(`Night Photo Percentage changed to: ${percentage}%`);
        broadcast();
      }
    });

    // Change slideshow transition interval
    socket.on('change-interval', (intervalMs) => {
      if (intervalMs && typeof intervalMs === 'number') {
        if (dispatchCommand) {
          dispatchCommand({
            type: 'change-interval',
            payload: { intervalMs }
          });
          return;
        }
        state.slideshowInterval = intervalMs;
        broadcast();
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
      if (!dispatchCommand) return;
      const command = decodePhotoMetadataCommand(payload);
      if (command) {
        dispatchCommand(command);
      }
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
          state.activePhoto = nextPhoto;
          io.emit('photo-update', state.activePhoto);
        }
      }
      broadcast();
    });

    // Set individual photo crop ratio and vertical position
    socket.on('set-photo-crop', ({ url, cropPercent, cropPositionY }) => {
      const command = decodePhotoCropCommand({ url, cropPercent, cropPositionY });
      if (command && dispatchCommand) {
        dispatchCommand(command);
        return;
      }
      if (!command) return;

      const { updatePhotoCrop } = require('./config/collections.js');
      updatePhotoCrop(collections, state, command.payload.url, command.payload.cropPercent, command.payload.cropPositionY);
      broadcast();
    });


    // Set individual photo pairing prevention
    socket.on('set-photo-prevent-pairing', ({ url, preventPairing }) => {
      if (dispatchCommand) {
        dispatchCommand({
          type: 'set-photo-prevent-pairing',
          payload: { url, preventPairing }
        });
        return;
      }
      if (!url || typeof url !== 'string') return;

      const { updatePhotoPreventPairing } = require('./config/collections.js');
      updatePhotoPreventPairing(collections, state, url, preventPairing);
      broadcast();
    });

    // Update keywords socket event
    socket.on('update-keywords', ({ category, keywords }) => {
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
        const activeCategory = state.currentCategory;
        const currentCats = activeCategory ? activeCategory.split(',') : [];
        state.photosList = combineFeedsBalanced(currentCats, collections);
        
        if (state.photosList.length > 0) {
          const matchesExclusionLocally = (photo) => {
            if (!photo || !photo.title) return false;
            const titleText = photo.title.toLowerCase();
            return state.excludedKeywords.some(kw => titleText.includes(kw.toLowerCase()));
          };
          if (matchesExclusionLocally(state.activePhoto)) {
            state.activePhoto = state.photosList[Math.floor(Math.random() * state.photosList.length)];
          }
        }

        broadcast();
        console.log('[SOCKET EVENT] update-excluded-keywords saved and broadcasted:', state.excludedKeywords);
      }
    });

    // Add custom category / scenic pool
    socket.on('add-category', async ({ category, keyword }) => {
      if (!category || typeof category !== 'string') return;
      const cleanCategory = category.trim();
      if (!cleanCategory) return;
      
      const cleanKeyword = (keyword || '').trim();
      if (!cleanKeyword) return;

      // Split keywords by comma or semicolon, trim whitespace, filter out empty strings
      const parsedKeywords = cleanKeyword
        .split(/[;,]/)
        .map(kw => kw.trim())
        .filter(kw => kw.length > 0);

      if (parsedKeywords.length === 0) return;

      console.log(`[SOCKET EVENT] add-category received: "${cleanCategory}" with keywords:`, parsedKeywords);

      // Initialize state searchKeywords if not present
      if (!state.searchKeywords) {
        state.searchKeywords = {};
      }

      // Check if it already exists to prevent duplicate creation
      if (collections[cleanCategory] || state.searchKeywords[cleanCategory]) {
        console.warn(`Category "${cleanCategory}" already exists.`);
        return;
      }

      // 1. Register category keywords in state
      state.searchKeywords[cleanCategory] = parsedKeywords;

      // Initialize state feedConfigs if not present
      if (!state.feedConfigs) {
        state.feedConfigs = {};
      }
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
          for (const key of Object.keys(updatedCollections)) {
            collections[key] = updatedCollections[key];
          }
          saveCuratedCollections(collections, state);
        }

        // If the added category is the current/active category, update photosList
        const currentCats = state.currentCategory ? state.currentCategory.split(',').map(c => c.trim()) : [];
        if (currentCats.includes(cleanCategory)) {
          state.photosList = combineFeedsBalanced(currentCats, collections);
          if (state.photosList.length > 0) {
            state.activePhoto = getSmartPhoto('next') || state.photosList[0];
            io.emit('photo-update', state.activePhoto);
          }
        }
        
        // Broadcast fully loaded updated state
        broadcast();
        
        // Run background image analysis on the new photos
        const { triggerImageAnalysisBackground } = require('./app.js');
        triggerImageAnalysisBackground().catch(err => console.error('Error in background image analysis:', err));
      } catch (err) {
        console.error(`Error crawling new category "${cleanCategory}":`, err.message);
      }
    });

    // Delete custom category / scenic pool
    socket.on('delete-category', ({ category }) => {
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
      const currentCats = state.currentCategory ? state.currentCategory.split(',').map(c => c.trim()) : [];
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
        const updatedCats = state.currentCategory.split(',').map(c => c.trim());
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

    // Trigger Next Photo
    socket.on('next-photo', () => {
      if (dispatchCommand) {
        dispatchCommand(decodeAdvancePhotoCommand('next'));
        return;
      }
      const photo = getSmartPhoto('next');
      if (photo) {
        state.activePhoto = photo;
        io.emit('photo-update', state.activePhoto);
      }
    });

    // Trigger Prev Photo
    socket.on('prev-photo', () => {
      if (dispatchCommand) {
        dispatchCommand(decodeAdvancePhotoCommand('prev'));
        return;
      }
      const photo = getSmartPhoto('prev');
      if (photo) {
        state.activePhoto = photo;
        io.emit('photo-update', state.activePhoto);
      }
    });

    // Update Mood Theme
    socket.on('change-theme', (themeName) => {
      if (dispatchCommand) {
        dispatchCommand({
          type: 'change-theme',
          payload: { theme: themeName }
        });
        return;
      }
      state.theme = themeName;
      broadcast();
    });

    // Update screensaver active state
    socket.on('set-screensaver-active', (active) => {
      if (dispatchCommand) {
        dispatchCommand({
          type: 'set-screensaver-active',
          payload: { active }
        });
        return;
      }
      if (active) {
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
    
    // Toggle auto geolocation setting
    socket.on('toggle-auto-location', async (autoLocation) => {
      console.log(`[SOCKET EVENT] toggle-auto-location: ${autoLocation}`);
      state.autoLocation = !!autoLocation;
      persistLocationSettings(state, collections);
      broadcast();
      if (triggerWeatherUpdate) {
        await triggerWeatherUpdate();
      }
    });

    // Update manual location overrides
    socket.on('update-manual-location', async ({ lat, lon, city, regionName, country }) => {
      console.log(`[SOCKET EVENT] update-manual-location: ${city} (${lat}, ${lon})`);
      state.manualLocation = {
        lat: parseFloat(lat) || 45.45,
        lon: parseFloat(lon) || -73.56,
        city: String(city || 'Verdun').trim(),
        regionName: String(regionName || 'Quebec').trim(),
        country: String(country || 'Canada').trim()
      };
      persistLocationSettings(state, collections);
      broadcast();
      if (triggerWeatherUpdate) {
        await triggerWeatherUpdate();
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
            state.activePhoto = nextPhoto;
            io.emit('photo-update', state.activePhoto);
          }
        }
        broadcast();
      }
    });

    // 🔄 Force background crawler recrawl immediately
    socket.on('trigger-recrawl', async () => {
      console.log('[SOCKET EVENT] trigger-recrawl received. Initiating manual crawl...');
      try {
        const { crawlAllCollections } = require('./services/crawler.js');

        const { updatedCollections, updatedAny } = await crawlAllCollections(collections, state.feedConfigs, state.searchKeywords);
        
        if (updatedAny) {
          for (const key of Object.keys(updatedCollections)) {
            collections[key] = updatedCollections[key].map(p => ({ ...p, category: key }));
          }

          saveCuratedCollections(collections, state);
          console.log('[SOCKET EVENT] Successfully saved manual crawl results to curated_collections.json');
        }

        const activeCategory = state.currentCategory;
        const currentCats = activeCategory ? activeCategory.split(',') : [];
        state.photosList = combineFeedsBalanced(currentCats, collections);
        
        broadcast();
        socket.emit('recrawl-complete', { success: true, count: state.photosList.length });
        
        // Trigger background content-aware vision analysis for any newly crawled photos
        const { triggerImageAnalysisBackground } = require('./app.js');
        triggerImageAnalysisBackground().catch(err => console.error('Error in background image analysis:', err));
      } catch (err) {
        console.error('[SOCKET EVENT] Manual recrawl failed:', err.message);
        socket.emit('recrawl-complete', { success: false, error: err.message });
      }
    });

    socket.on('save-useapi-token', ({ token }) => {
      console.log('[SOCKET EVENT] save-useapi-token received.');
      const sanitizedToken = String(token || '').trim();

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
      const sanitizedToken = String(token || '').trim();

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
