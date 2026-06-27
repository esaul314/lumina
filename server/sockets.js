const { sendEmailAlert } = require('./services/notifier.js');
const googlePhotos = require('./services/googlePhotos.js');
const { saveCuratedCollections } = require('./config/collections.js');

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
module.exports = function(io, state, collections, combineFeedsBalanced, getSmartPhoto, launchKioskBrowser, killKioskBrowser, setManualOverride, getLocalIpAddresses, PORT, triggerWeatherUpdate) {
  
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
        io.emit('state-sync', state);
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
        io.emit('state-sync', state);
      } else {
        console.error(`[SOCKET EVENT] ERROR: None of the categories in "${category}" exist in curatedCollections keys:`, Object.keys(collections));
      }
    });

    // Toggle time of day alignment
    socket.on('toggle-align-time', (enabled) => {
      state.alignTimeOfDay = enabled;
      console.log(`Align Time of Day changed to: ${enabled}`);
      io.emit('state-sync', state);
    });

    // Toggle weather alignment
    socket.on('toggle-align-weather', (enabled) => {
      state.alignWeather = enabled;
      console.log(`Align Weather changed to: ${enabled}`);
      io.emit('state-sync', state);
    });

    // Toggle OpenAI fallback consent
    socket.on('toggle-allow-openai-fallback', (enabled) => {
      state.allowOpenAiFallback = !!enabled;
      console.log(`Allow OpenAI Fallback changed to: ${state.allowOpenAiFallback}`);
      io.emit('state-sync', state);
    });

    // Change scale mode
    socket.on('change-scale-mode', (mode) => {
      if (mode === 'cover' || mode === 'contain') {
        state.scaleMode = mode;
        console.log(`Scale Mode changed to: ${mode}`);
        saveCuratedCollections(collections, state);
        io.emit('state-sync', state);
      }
    });

    // Toggle split portrait display
    socket.on('toggle-split-portrait', (enabled) => {
      state.splitPortrait = !!enabled;
      console.log(`Split Portrait changed to: ${state.splitPortrait}`);
      saveCuratedCollections(collections, state);
      io.emit('state-sync', state);
    });

    // Update split portrait crop percentage
    socket.on('change-split-crop', (percent) => {
      const val = parseInt(percent, 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        state.splitCropPercent = val;
        console.log(`Split Crop Percent changed to: ${val}%`);
        saveCuratedCollections(collections, state);
        io.emit('state-sync', state);
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
        io.emit('state-sync', state);
      }
    });

    // Change night photo percentage selection
    socket.on('change-night-percentage', (percentage) => {
      if (typeof percentage === 'number' && percentage >= 0 && percentage <= 100) {
        state.nightPercentage = percentage;
        console.log(`Night Photo Percentage changed to: ${percentage}%`);
        io.emit('state-sync', state);
      }
    });

    // Change slideshow transition interval
    socket.on('change-interval', (intervalMs) => {
      if (intervalMs && typeof intervalMs === 'number') {
        state.slideshowInterval = intervalMs;
        io.emit('state-sync', state);
      }
    });

    // Change individual active photo
    socket.on('set-active-photo', (photo) => {
      state.activePhoto = photo;
      io.emit('photo-update', photo);
    });

    // Set individual active second photo (sent by TV client to synchronize display control preview)
    socket.on('set-active-second-photo', (photo) => {
      state.activeSecondPhoto = photo;
      io.emit('second-photo-update', photo);
    });

    // Rate photo socket event
    socket.on('rate-photo', ({ url, rating }) => {
      if (!url || typeof url !== 'string') return;
      const numericRating = parseInt(rating, 10);
      if (isNaN(numericRating) || numericRating < 1 || numericRating > 10) return;

      const { updatePhotoRating } = require('./config/collections.js');
      updatePhotoRating(collections, state, url, numericRating);
      if (numericRating === 1 && state.activePhoto && state.activePhoto.url === url) {
        const nextPhoto = getSmartPhoto('next');
        if (nextPhoto) {
          state.activePhoto = nextPhoto;
          io.emit('photo-update', state.activePhoto);
        }
      }
      io.emit('state-sync', state);
    });

    // Set individual photo crop ratio and vertical position
    socket.on('set-photo-crop', ({ url, cropPercent, cropPositionY }) => {
      if (!url || typeof url !== 'string') return;
      
      const numericCrop = cropPercent !== undefined ? parseInt(cropPercent, 10) : undefined;
      const numericCropY = cropPositionY !== undefined ? parseInt(cropPositionY, 10) : undefined;
      
      if (numericCrop !== undefined && (isNaN(numericCrop) || numericCrop < 0 || numericCrop > 100)) return;
      if (numericCropY !== undefined && (isNaN(numericCropY) || numericCropY < 0 || numericCropY > 100)) return;

      const { updatePhotoCrop } = require('./config/collections.js');
      updatePhotoCrop(collections, state, url, numericCrop, numericCropY);
      io.emit('state-sync', state);
    });


    // Set individual photo pairing prevention
    socket.on('set-photo-prevent-pairing', ({ url, preventPairing }) => {
      if (!url || typeof url !== 'string') return;

      const { updatePhotoPreventPairing } = require('./config/collections.js');
      updatePhotoPreventPairing(collections, state, url, preventPairing);
      io.emit('state-sync', state);
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

      io.emit('state-sync', state);
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

      io.emit('state-sync', state);
    });

    // Save and sync excluded keywords
    socket.on('update-excluded-keywords', (keywords) => {
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

        io.emit('state-sync', state);
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
      io.emit('state-sync', state);

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
        io.emit('state-sync', state);
        
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
      io.emit('state-sync', state);
    });

    // Trigger Next Photo
    socket.on('next-photo', () => {
      const photo = getSmartPhoto('next');
      if (photo) {
        state.activePhoto = photo;
        io.emit('photo-update', state.activePhoto);
      }
    });

    // Trigger Prev Photo
    socket.on('prev-photo', () => {
      const photo = getSmartPhoto('prev');
      if (photo) {
        state.activePhoto = photo;
        io.emit('photo-update', state.activePhoto);
      }
    });

    // Update Mood Theme
    socket.on('change-theme', (themeName) => {
      state.theme = themeName;
      io.emit('state-sync', state);
    });

    // Update screensaver active state
    socket.on('set-screensaver-active', (active) => {
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
      io.emit('state-sync', state);
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
      io.emit('state-sync', state);
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
      io.emit('state-sync', state);
      if (triggerWeatherUpdate) {
        await triggerWeatherUpdate();
      }
    });

    // 🛑 Client reported broken photo marker
    socket.on('mark-photo-broken', ({ url }) => {
      if (!url || typeof url !== 'string') return;
      console.log(`[SOCKET EVENT] mark-photo-broken received for URL: ${url}`);
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
        io.emit('state-sync', state);
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
        
        io.emit('state-sync', state);
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
      process.env.USEAPI_TOKEN = sanitizedToken;
      state.hasUseApiToken = !!sanitizedToken;
      io.emit('state-sync', state);

      try {
        const fs = require('fs');
        const path = require('path');
        const rootDir = path.join(__dirname, '..');
        const envPath = path.join(rootDir, '.env');

        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Replace or append USEAPI_TOKEN
        if (envContent.includes('USEAPI_TOKEN=')) {
          envContent = envContent.replace(/USEAPI_TOKEN=.*/g, `USEAPI_TOKEN=${sanitizedToken}`);
        } else {
          envContent += `\nUSEAPI_TOKEN=${sanitizedToken}\n`;
        }

        fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
        console.log('[SOCKET EVENT] Successfully persisted USEAPI_TOKEN to .env file');
        socket.emit('useapi-token-saved', { success: true });
      } catch (err) {
        console.error('[SOCKET EVENT] Failed to save USEAPI_TOKEN to .env:', err.message);
        socket.emit('useapi-token-saved', { success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Device disconnected:', socket.id);
    });
  });
};
