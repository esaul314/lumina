const { sendEmailAlert } = require('./services/notifier.js');

/**
 * 🛰️ configureSockets
 * Orchestrates Socket.IO event hooks, synchronizing the smart display
 * client and mobile remote controls in real-time.
 */
module.exports = function(io, state, collections, combineFeedsBalanced, getSmartPhoto, launchKioskBrowser, killKioskBrowser, getLocalIpAddresses, PORT) {
  
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
        io.emit('state-sync', state);
      }
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
        launchKioskBrowser();
      } else {
        state.screensaverActive = false;
        killKioskBrowser();
      }
      io.emit('state-sync', state);
    });
    
    socket.on('disconnect', () => {
      console.log('Device disconnected:', socket.id);
    });
  });
};
