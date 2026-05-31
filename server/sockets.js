const { sendEmailAlert } = require('./services/notifier.js');
const googlePhotos = require('./services/googlePhotos.js');
const fs = require('fs');
const path = require('path');
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

    // Rate photo socket event
    socket.on('rate-photo', ({ url, rating }) => {
      if (!url || typeof url !== 'string') return;
      const numericRating = parseInt(rating, 10);
      if (isNaN(numericRating) || numericRating < 1 || numericRating > 10) return;

      const { updatePhotoRating } = require('./config/collections.js');
      const updated = updatePhotoRating(collections, state, url, numericRating);
      if (updated) {
        if (numericRating === 1 && state.activePhoto && state.activePhoto.url === url) {
          const nextPhoto = getSmartPhoto('next');
          if (nextPhoto) {
            state.activePhoto = nextPhoto;
            io.emit('photo-update', state.activePhoto);
          }
        }
        io.emit('state-sync', state);
      }
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

        const { updatedCollections, updatedAny } = await crawlAllCollections(collections, state.searchKeywords);
        
        if (updatedAny) {
          for (const key of Object.keys(updatedCollections)) {
            collections[key] = updatedCollections[key];
          }

          saveCuratedCollections(collections, state);
          console.log('[SOCKET EVENT] Successfully saved manual crawl results to curated_collections.json');
        }

        const activeCategory = state.currentCategory;
        const currentCats = activeCategory ? activeCategory.split(',') : [];
        state.photosList = combineFeedsBalanced(currentCats, collections);
        
        io.emit('state-sync', state);
        socket.emit('recrawl-complete', { success: true, count: state.photosList.length });
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
