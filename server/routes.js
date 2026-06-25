const os = require('os');
const { resolveActiveLocation, fetchWeatherForecast } = require('./services/weather.js');
const googlePhotos = require('./services/googlePhotos.js');
const {
  map,
  filter,
  reduce,
  prop,
  uniqBy,
  toLower,
  includes,
  curry,
  pipe
} = require('./utils/fn.js');

const uniqByUrl = uniqBy(prop('url'));

// Pure/functional shuffle helper
const shuffle = (list) => {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Functional, curried helper that checks if a photo matches any excluded keyword
const matchesExclusion = curry((excludedList, photo) => {
  if (!excludedList || excludedList.length === 0) return false;
  const titleText = pipe(prop('title'), toLower)(photo);
  return excludedList.some(kw => includes(toLower(kw), titleText));
});

/**
 * 🛠️ getLocalIpAddresses
 * Queries local network interfaces to return non-internal IPv4 addresses.
 */
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

/**
 * 🧭 configureRoutes
 * Sets up Express HTTP routes for the Lumina API.
 */
module.exports = function(app, state, collections, getWeatherData, setWeatherData, combineFeedsBalanced, getSmartPhoto, io, PORT, launchKioskBrowser, killKioskBrowser, setManualOverride) {
  
  // GET /api/weather
  app.get('/api/weather', async (req, res) => {
    const cached = getWeatherData();
    if (cached) {
      return res.json(cached);
    }
    try {
      const loc = await resolveActiveLocation(state);
      const weatherData = await fetchWeatherForecast(loc.lat, loc.lon);
      
      const finalData = {
        location: loc,
        current: weatherData.current,
        daily: weatherData.daily
      };
      setWeatherData(finalData);
      res.json(finalData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch weather data', message: error.message });
    }
  });

  // Helper to dynamically balance google photos and curated categories round-robin
  function combineGoogleAndCuratedFeeds(categoriesList, collectionsObj) {
    const lists = filter(list => list.length > 0, map(cat => {
      if (cat === 'Google Photos') {
        return googlePhotos.getCachedMediaItems().map(p => ({ ...p, category: 'Google Photos' }));
      }
      return shuffle(filter(p => p.rating !== 1 && !p.isBroken && !matchesExclusion(state.excludedKeywords, p), collectionsObj[cat] || [])).map(p => ({ ...p, category: cat }));
    }, categoriesList));

    if (lists.length === 0) return [];
    if (lists.length === 1) return uniqByUrl(lists[0]);

    const maxLen = Math.max(...map(l => l.length, lists));

    const combined = reduce((acc, i) => {
      return acc.concat(map(list => list[i % list.length], lists));
    }, [], Array.from({ length: maxLen }, (_, i) => i));

    return uniqByUrl(combined);
  }

  // GET /api/photos
  app.get('/api/photos', async (req, res) => {
    const { category } = req.query;
    
    try {
      if (category) {
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

        const validCategories = selectedCategories.filter(catName => !!collections[catName] || catName === 'Google Photos');

        if (validCategories.length > 0) {
          state.currentCategory = validCategories.join(',');
          state.photosList = combineGoogleAndCuratedFeeds(validCategories, collections);
          
          const smartPhoto = getSmartPhoto('next');
          if (smartPhoto) {
            state.activePhoto = smartPhoto;
          } else if (state.photosList.length > 0) {
            state.activePhoto = state.photosList[Math.floor(Math.random() * state.photosList.length)];
          }
          
          io.emit('state-sync', state);
        }
      }
      
      const currentCats = state.currentCategory ? state.currentCategory.split(',') : [];
      const responsePhotos = combineGoogleAndCuratedFeeds(currentCats, collections);
      res.json(responsePhotos.length > 0 ? responsePhotos : (collections['Scenic Nature'] || []).filter(p => p.rating !== 1 && !p.isBroken && !matchesExclusion(state.excludedKeywords, p)));
    } catch (error) {
      console.error('Failed to fetch photos from curated list', error.message);
      res.json((collections['Scenic Nature'] || []).filter(p => p.rating !== 1 && !p.isBroken));
    }
  });

  // POST /api/photos/rate
  app.post('/api/photos/rate', (req, res) => {
    const { url, rating } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid parameter: "url" must be a non-empty string.' });
    }
    
    const numericRating = parseInt(rating, 10);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 10) {
      return res.status(400).json({ error: 'Invalid parameter: "rating" must be an integer between 1 and 10.' });
    }

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
      return res.json({ success: true, url, rating: numericRating });
    } else {
      return res.status(404).json({ error: 'Photo URL not found in curated collections.' });
    }
  });

  // POST /api/config/keywords
  app.post('/api/config/keywords', (req, res) => {
    const { category, keywords } = req.body;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Invalid parameter: "category" must be a non-empty string.' });
    }

    if (!collections[category]) {
      return res.status(404).json({ error: `Category "${category}" not found in curated collections.` });
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const isValid = Array.isArray(keywords) && keywords.every(item => {
      if (typeof item === 'string') {
        return item.trim().length > 0;
      }
      if (item && typeof item === 'object') {
        const { timeStart, timeEnd, keywords: itemKws } = item;
        if (typeof timeStart !== 'string' || !timeRegex.test(timeStart)) return false;
        if (typeof timeEnd !== 'string' || !timeRegex.test(timeEnd)) return false;
        if (Array.isArray(itemKws)) {
          return itemKws.every(kw => typeof kw === 'string' && kw.trim().length > 0);
        }
        return typeof itemKws === 'string' && itemKws.trim().length > 0;
      }
      return false;
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid parameter: "keywords" must be an array of strings or time-based keyword objects.' });
    }

    // Update in state
    state.searchKeywords[category] = keywords.map(item => {
      if (typeof item === 'string') {
        return item.trim();
      }
      const itemKws = Array.isArray(item.keywords) ? item.keywords : [item.keywords];
      return {
        timeStart: item.timeStart.trim(),
        timeEnd: item.timeEnd.trim(),
        keywords: itemKws.map(kw => kw.trim())
      };
    });

    // Save to curated_collections.json using unified persistence helper
    const { saveCuratedCollections } = require('./config/collections.js');
    saveCuratedCollections(collections, state);
    console.log(`[Config API] Saved updated search keywords for category "${category}":`, state.searchKeywords[category]);

    io.emit('state-sync', state);
    return res.json({ success: true, category, keywords: state.searchKeywords[category] });
  });

  // POST /api/auth/google/credentials
  app.post('/api/auth/google/credentials', (req, res) => {
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Client ID and Client Secret are required.' });
    }
    const success = googlePhotos.saveGoogleCredentials(clientId, clientSecret);
    return res.json({ success });
  });

  // GET /api/auth/google/login
  app.get('/api/auth/google/login', (req, res) => {
    const localIp = getLocalIpAddresses()[0] || 'localhost';
    const redirectUri = `http://${localIp}:${PORT}/api/auth/google/callback`;
    const url = googlePhotos.getGoogleAuthUrl(redirectUri);
    res.redirect(url);
  });

  // GET /api/auth/google/callback
  app.get('/api/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Authentication code is missing from Google redirect.');
    }
    
    try {
      const localIp = getLocalIpAddresses()[0] || 'localhost';
      const redirectUri = `http://${localIp}:${PORT}/api/auth/google/callback`;
      
      await googlePhotos.exchangeGoogleCode(code, redirectUri);
      await googlePhotos.syncGoogleAlbum();
      
      // Emit state-sync so clients know Google Photos is active
      io.emit('state-sync', state);
      
      // Redirect back to mobile remote control with success indicator
      res.redirect(`http://${localIp}:${PORT}/?mode=remote&googleAuth=success`);
    } catch (err) {
      console.error('Google Photos Auth Callback error:', err.message);
      res.status(500).send(`Google Photos Link Failed: ${err.message}`);
    }
  });

  // GET /api/auth/google/sandbox-callback
  app.get('/api/auth/google/sandbox-callback', async (req, res) => {
    try {
      await googlePhotos.exchangeGoogleCode('sandbox-code', '');
      await googlePhotos.syncGoogleAlbum();
      
      const localIp = getLocalIpAddresses()[0] || 'localhost';
      res.redirect(`http://${localIp}:${PORT}/?mode=remote&googleAuth=success`);
    } catch (err) {
      res.status(500).send(`Sandbox Google Photos Link Failed: ${err.message}`);
    }
  });

  // GET /api/config
  app.get('/api/config', (req, res) => {
    res.json({
      localIps: getLocalIpAddresses(),
      port: PORT,
      state
    });
  });

  // GET /api/state
  app.get('/api/state', (req, res) => {
    res.json(state);
  });

  // PATCH /api/state
  app.patch('/api/state', (req, res) => {
    const { saveCuratedCollections } = require('./config/collections.js');
    const writableFields = [
      'theme', 'inactivityTimeout', 'slideshowInterval', 'scaleMode',
      'splitPortrait', 'splitCropPercent', 'alignTimeOfDay', 'alignWeather',
      'nightPercentage', 'allowOpenAiFallback', 'excludedKeywords', 'visionConfig'
    ];
    let updated = false;

    // Handle top-level writable fields
    for (const key of writableFields) {
      if (req.body[key] !== undefined) {
        if (key === 'excludedKeywords') {
          if (Array.isArray(req.body.excludedKeywords)) {
            state.excludedKeywords = req.body.excludedKeywords.map(kw => String(kw).trim()).filter(Boolean);
            // Refresh photos list to apply new exclusions
            state.photosList = combineFeedsBalanced(state.currentCategory ? state.currentCategory.split(',').map(c => c.trim()) : [], collections);
            // If active photo matches exclusions, transition it
            const matchesExclusionLocally = (photo) => {
              if (!photo || !photo.title) return false;
              const titleText = photo.title.toLowerCase();
              return state.excludedKeywords.some(kw => titleText.includes(kw.toLowerCase()));
            };
            if (matchesExclusionLocally(state.activePhoto) && state.photosList.length > 0) {
              state.activePhoto = state.photosList[Math.floor(Math.random() * state.photosList.length)];
            }
            updated = true;
          }
        } else if (key === 'visionConfig') {
          if (req.body.visionConfig && typeof req.body.visionConfig === 'object') {
            state.visionConfig = {
              apiUrl: String(req.body.visionConfig.apiUrl || '').trim(),
              apiKey: String(req.body.visionConfig.apiKey || '').trim(),
              model: String(req.body.visionConfig.model || '').trim(),
              fallbackUrl: String(req.body.visionConfig.fallbackUrl || '').trim(),
              fallbackApiKey: String(req.body.visionConfig.fallbackApiKey || '').trim(),
              fallbackModel: String(req.body.visionConfig.fallbackModel || '').trim()
            };
            updated = true;
          }
        } else {
          state[key] = req.body[key];
          updated = true;
        }
      }
    }

    // Handle nested widgets updates
    if (req.body.widgets && typeof req.body.widgets === 'object') {
      for (const widgetName of Object.keys(req.body.widgets)) {
        if (state.widgets[widgetName] !== undefined) {
          state.widgets[widgetName] = !!req.body.widgets[widgetName];
          updated = true;
        }
      }
    }

    if (updated) {
      saveCuratedCollections(collections, state);
      io.emit('state-sync', state);
    }

    res.json(state);
  });

  // POST /api/state/screensaver
  app.post('/api/state/screensaver', (req, res) => {
    const { active } = req.body;
    if (active === undefined || typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Invalid parameter: "active" must be a boolean.' });
    }

    if (active) {
      state.screensaverActive = true;
      if (typeof setManualOverride === 'function') setManualOverride(true);
      if (typeof launchKioskBrowser === 'function') launchKioskBrowser();
    } else {
      state.screensaverActive = false;
      if (typeof setManualOverride === 'function') setManualOverride(false);
      if (typeof killKioskBrowser === 'function') killKioskBrowser();
    }

    io.emit('state-sync', state);
    res.json({ success: true, screensaverActive: state.screensaverActive });
  });

  // GET /api/pools
  app.get('/api/pools', (req, res) => {
    const pools = Object.keys(collections).map(name => {
      const keywords = (state.searchKeywords && state.searchKeywords[name]) || [];
      const feedConfigs = (state.feedConfigs && state.feedConfigs[name]) || {};
      const photosCount = Array.isArray(collections[name]) ? collections[name].length : 0;
      return {
        name,
        keywords,
        feedConfigs,
        photosCount
      };
    });
    res.json(pools);
  });

  // POST /api/pools
  app.post('/api/pools', async (req, res) => {
    const { name, keywords } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Invalid parameter: "name" must be a non-empty string.' });
    }

    const cleanCategory = name.trim();
    if (collections[cleanCategory] || (state.searchKeywords && state.searchKeywords[cleanCategory])) {
      return res.status(409).json({ error: `Pool "${cleanCategory}" already exists.` });
    }

    let parsedKeywords = [];
    if (Array.isArray(keywords)) {
      parsedKeywords = keywords.map(kw => String(kw).trim()).filter(Boolean);
    } else if (typeof keywords === 'string') {
      parsedKeywords = keywords.split(/[;,]/).map(kw => kw.trim()).filter(Boolean);
    }

    if (parsedKeywords.length === 0) {
      return res.status(400).json({ error: 'Invalid parameter: "keywords" must contain at least one non-empty string.' });
    }

    if (!state.searchKeywords) state.searchKeywords = {};
    state.searchKeywords[cleanCategory] = parsedKeywords;

    if (!state.feedConfigs) state.feedConfigs = {};
    state.feedConfigs[cleanCategory] = {
      unsplash: { enabled: true, keywords: [...parsedKeywords] },
      wallhaven: { enabled: true, keywords: [...parsedKeywords] },
      metmuseum: { enabled: true, keywords: [...parsedKeywords] },
      artic: { enabled: true, keywords: [...parsedKeywords] }
    };

    collections[cleanCategory] = [];

    const { saveCuratedCollections } = require('./config/collections.js');
    saveCuratedCollections(collections, state);

    io.emit('state-sync', state);

    // Trigger crawl asynchronously in the background so the HTTP request returns quickly
    // ponytail: run crawler asynchronously for fast response
    (async () => {
      try {
        const { crawlAllCollections } = require('./services/crawler.js');
        const { updatedCollections, updatedAny } = await crawlAllCollections(collections, state.feedConfigs, state.searchKeywords);
        if (updatedAny) {
          for (const key of Object.keys(updatedCollections)) {
            collections[key] = updatedCollections[key];
          }
          saveCuratedCollections(collections, state);
        }

        const currentCats = state.currentCategory ? state.currentCategory.split(',').map(c => c.trim()) : [];
        if (currentCats.includes(cleanCategory)) {
          state.photosList = combineFeedsBalanced(currentCats, collections);
          if (state.photosList.length > 0) {
            state.activePhoto = getSmartPhoto('next') || state.photosList[0];
            io.emit('photo-update', state.activePhoto);
          }
        }
        io.emit('state-sync', state);

        const { triggerImageAnalysisBackground } = require('./app.js');
        triggerImageAnalysisBackground().catch(err => console.error('Error in background image analysis:', err));
      } catch (err) {
        console.error(`Error crawling new pool "${cleanCategory}":`, err.message);
      }
    })();

    res.status(201).json({
      success: true,
      pool: {
        name: cleanCategory,
        keywords: parsedKeywords,
        feedConfigs: state.feedConfigs[cleanCategory],
        photosCount: 0
      }
    });
  });

  // DELETE /api/pools/:name
  app.delete('/api/pools/:name', (req, res) => {
    const { name } = req.params;
    const cleanCategory = name.trim();

    if (!collections[cleanCategory] && (!state.searchKeywords || !state.searchKeywords[cleanCategory])) {
      return res.status(404).json({ error: `Pool "${cleanCategory}" not found.` });
    }

    if (state.searchKeywords) {
      delete state.searchKeywords[cleanCategory];
    }
    if (state.feedConfigs) {
      delete state.feedConfigs[cleanCategory];
    }
    delete collections[cleanCategory];

    const { saveCuratedCollections } = require('./config/collections.js');
    saveCuratedCollections(collections, state);

    const currentCats = state.currentCategory ? state.currentCategory.split(',').map(c => c.trim()) : [];
    if (currentCats.includes(cleanCategory)) {
      const remainingCats = currentCats.filter(c => c !== cleanCategory);
      if (remainingCats.length > 0) {
        state.currentCategory = remainingCats.join(',');
      } else {
        const remainingKeys = Object.keys(state.searchKeywords || {});
        state.currentCategory = remainingKeys[0] || 'Scenic Nature';
      }
      
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

    io.emit('state-sync', state);
    res.json({ success: true, message: `Pool "${cleanCategory}" deleted successfully.` });
  });

  // PATCH /api/pools/:name
  app.patch('/api/pools/:name', (req, res) => {
    const { name } = req.params;
    const cleanCategory = name.trim();

    if (!collections[cleanCategory]) {
      return res.status(404).json({ error: `Pool "${cleanCategory}" not found.` });
    }

    const { keywords, feedConfigs } = req.body;
    let updated = false;

    if (keywords !== undefined) {
      if (!Array.isArray(keywords) || !keywords.every(kw => typeof kw === 'string' && kw.trim().length > 0)) {
        return res.status(400).json({ error: 'Invalid parameter: "keywords" must be an array of non-empty strings.' });
      }
      if (!state.searchKeywords) state.searchKeywords = {};
      state.searchKeywords[cleanCategory] = keywords.map(kw => kw.trim());
      updated = true;
    }

    if (feedConfigs !== undefined) {
      if (typeof feedConfigs !== 'object' || feedConfigs === null) {
        return res.status(400).json({ error: 'Invalid parameter: "feedConfigs" must be an object.' });
      }
      if (!state.feedConfigs) state.feedConfigs = {};
      state.feedConfigs[cleanCategory] = {
        ...state.feedConfigs[cleanCategory],
        ...feedConfigs
      };
      updated = true;
    }

    if (updated) {
      const { saveCuratedCollections } = require('./config/collections.js');
      saveCuratedCollections(collections, state);
      io.emit('state-sync', state);
    }

    res.json({
      success: true,
      pool: {
        name: cleanCategory,
        keywords: (state.searchKeywords && state.searchKeywords[cleanCategory]) || [],
        feedConfigs: (state.feedConfigs && state.feedConfigs[cleanCategory]) || {},
        photosCount: Array.isArray(collections[cleanCategory]) ? collections[cleanCategory].length : 0
      }
    });
  });

  // POST /api/pools/:name/crawl
  app.post('/api/pools/:name/crawl', async (req, res) => {
    const { name } = req.params;
    const cleanCategory = name.trim();

    if (!collections[cleanCategory]) {
      return res.status(404).json({ error: `Pool "${cleanCategory}" not found.` });
    }

    try {
      const { crawlAllCollections } = require('./services/crawler.js');
      const { saveCuratedCollections } = require('./config/collections.js');

      const { updatedCollections, updatedAny } = await crawlAllCollections(collections, state.feedConfigs, state.searchKeywords);
      
      if (updatedAny) {
        for (const key of Object.keys(updatedCollections)) {
          collections[key] = updatedCollections[key].map(p => ({ ...p, category: key }));
        }
        saveCuratedCollections(collections, state);
      }

      const activeCategory = state.currentCategory;
      const currentCats = activeCategory ? activeCategory.split(',') : [];
      state.photosList = combineFeedsBalanced(currentCats, collections);
      
      io.emit('state-sync', state);

      const { triggerImageAnalysisBackground } = require('./app.js');
      triggerImageAnalysisBackground().catch(err => console.error('Error in background image analysis:', err));

      res.json({ success: true, count: collections[cleanCategory].length });
    } catch (err) {
      console.error(`Manual REST recrawl failed for pool "${cleanCategory}":`, err.message);
      res.status(500).json({ error: 'Recrawl failed', message: err.message });
    }
  });

  // GET /api/pools/:name/photos
  app.get('/api/pools/:name/photos', (req, res) => {
    const { name } = req.params;
    const cleanCategory = name.trim();

    if (!collections[cleanCategory]) {
      return res.status(404).json({ error: `Pool "${cleanCategory}" not found.` });
    }

    res.json(collections[cleanCategory]);
  });

  // PATCH /api/photos
  app.patch('/api/photos', (req, res) => {
    const { url, rating, cropPercent, cropPositionY, preventPairing, isBroken } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid parameter: "url" must be a non-empty string.' });
    }

    let updated = false;
    const responsePayload = { url };

    // 1. Rating update
    if (rating !== undefined) {
      const numericRating = parseInt(rating, 10);
      if (isNaN(numericRating) || numericRating < 1 || numericRating > 10) {
        return res.status(400).json({ error: 'Invalid parameter: "rating" must be an integer between 1 and 10.' });
      }
      const { updatePhotoRating } = require('./config/collections.js');
      const ratingUpdated = updatePhotoRating(collections, state, url, numericRating);
      if (ratingUpdated) {
        updated = true;
        responsePayload.rating = numericRating;
        if (numericRating === 1 && state.activePhoto && state.activePhoto.url === url) {
          const nextPhoto = getSmartPhoto('next');
          if (nextPhoto) {
            state.activePhoto = nextPhoto;
            io.emit('photo-update', state.activePhoto);
          }
        }
      }
    }

    // 2. Broken marker update
    if (isBroken === true) {
      const { markPhotoBroken } = require('./config/collections.js');
      const brokenUpdated = markPhotoBroken(collections, state, url);
      if (brokenUpdated) {
        updated = true;
        responsePayload.isBroken = true;
        responsePayload.rating = 1;
        if (state.activePhoto && state.activePhoto.url === url) {
          const nextPhoto = getSmartPhoto('next');
          if (nextPhoto) {
            state.activePhoto = nextPhoto;
            io.emit('photo-update', state.activePhoto);
          }
        }
      }
    }

    // 3. Crop update
    if (cropPercent !== undefined || cropPositionY !== undefined) {
      const numericCrop = cropPercent !== undefined ? parseInt(cropPercent, 10) : undefined;
      const numericCropY = cropPositionY !== undefined ? parseInt(cropPositionY, 10) : undefined;
      if (numericCrop !== undefined && (isNaN(numericCrop) || numericCrop < 0 || numericCrop > 100)) {
        return res.status(400).json({ error: 'Invalid parameter: "cropPercent" must be between 0 and 100.' });
      }
      if (numericCropY !== undefined && (isNaN(numericCropY) || numericCropY < 0 || numericCropY > 100)) {
        return res.status(400).json({ error: 'Invalid parameter: "cropPositionY" must be between 0 and 100.' });
      }
      const { updatePhotoCrop } = require('./config/collections.js');
      const cropUpdated = updatePhotoCrop(collections, state, url, numericCrop, numericCropY);
      if (cropUpdated) {
        updated = true;
        if (numericCrop !== undefined) responsePayload.cropPercent = numericCrop;
        if (numericCropY !== undefined) responsePayload.cropPositionY = numericCropY;
      }
    }

    // 4. Prevent pairing update
    if (preventPairing !== undefined) {
      const { updatePhotoPreventPairing } = require('./config/collections.js');
      const pairingUpdated = updatePhotoPreventPairing(collections, state, url, preventPairing);
      if (pairingUpdated) {
        updated = true;
        responsePayload.preventPairing = !!preventPairing;
      }
    }

    if (!updated) {
      return res.status(404).json({ error: 'Photo URL not found in curated collections.' });
    }

    io.emit('state-sync', state);
    res.json({ success: true, photo: responsePayload });
  });

  // POST /api/photos/preview
  app.post('/api/photos/preview', (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid parameter: "url" must be a non-empty string.' });
    }

    let foundPhoto = null;
    for (const cat of Object.keys(collections)) {
      const arr = collections[cat];
      if (Array.isArray(arr)) {
        const match = arr.find(p => p.url === url);
        if (match) {
          foundPhoto = match;
          break;
        }
      }
    }

    if (!foundPhoto) {
      return res.status(404).json({ error: 'Photo URL not found in curated collections.' });
    }

    state.activePhoto = foundPhoto;
    io.emit('photo-update', foundPhoto);
    io.emit('state-sync', state);

    res.json({ success: true, activePhoto: foundPhoto });
  });

  // POST /api/photos/next
  app.post('/api/photos/next', (req, res) => {
    const photo = getSmartPhoto('next');
    if (photo) {
      state.activePhoto = photo;
      io.emit('photo-update', state.activePhoto);
      io.emit('state-sync', state);
      return res.json({ success: true, activePhoto: state.activePhoto });
    }
    res.status(500).json({ error: 'Could not transition to next photo.' });
  });

  // POST /api/photos/prev
  app.post('/api/photos/prev', (req, res) => {
    const photo = getSmartPhoto('prev');
    if (photo) {
      state.activePhoto = photo;
      io.emit('photo-update', state.activePhoto);
      io.emit('state-sync', state);
      return res.json({ success: true, activePhoto: state.activePhoto });
    }
    res.status(500).json({ error: 'Could not transition to previous photo.' });
  });
};

