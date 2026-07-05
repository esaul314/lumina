const os = require('os');
const { resolveActiveLocation, fetchWeatherForecast } = require('./services/weather.js');
const googlePhotos = require('./services/googlePhotos.js');
const {
  decodeAddPoolCommand,
  decodeActivePhotoCommand,
  decodeAdvancePhotoCommand,
  decodeCategorySelectionFromHttp,
  decodeDeletePoolCommand,
  decodePoolFeedConfigCommand,
  decodePoolKeywordsCommand,
  decodePhotoCropCommand,
  decodePhotoRatingCommand
} = require('./domain/commands.js');
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
const normalizeCoordinate = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
module.exports = function(app, state, collections, getWeatherData, setWeatherData, combineFeedsBalanced, getSmartPhoto, io, PORT, launchKioskBrowser, killKioskBrowser, setManualOverride, triggerWeatherUpdate, dispatchCommand, broadcastStateSync) {
  const broadcast = () => {
    if (typeof broadcastStateSync === 'function') {
      broadcastStateSync();
      return;
    }
    io.emit('state-sync', state);
  };
  const buildStateResponse = () => ({
    ...state,
    currentFrame: state.currentFrame || null,
    config: state.config || null,
    runtime: state.runtime || null,
    library: state.library || null,
    playback: state.playback || null
  });
  const hasPool = (name) => Boolean(name && collections[name]);
  const buildPoolResponse = (name) => ({
    name,
    keywords: (state.searchKeywords && state.searchKeywords[name]) || [],
    feedConfigs: (state.feedConfigs && state.feedConfigs[name]) || {},
    photosCount: Array.isArray(collections[name]) ? collections[name].length : 0
  });
  const respondWithState = (res, status, body = {}) => res.status(status).json({
    success: true,
    ...body,
    state: buildStateResponse()
  });
  
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

  // GET /api/google-photos/media/:mediaItemId
  app.get('/api/google-photos/media/:mediaItemId', async (req, res) => {
    const width = Number.parseInt(req.query.w, 10);
    const height = Number.parseInt(req.query.h, 10);
    const crop = req.query.c === '1';

    try {
      const media = await googlePhotos.fetchMediaItemBytes(req.params.mediaItemId, {
        width: Number.isFinite(width) && width > 0 ? width : 2560,
        height: Number.isFinite(height) && height > 0 ? height : 1440,
        crop
      });

      res.setHeader('Content-Type', media.contentType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(media.buffer);
    } catch (error) {
      res.status(502).json({
        error: 'Failed to proxy Google Photos media item.',
        message: error.message
      });
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
      if (category && dispatchCommand) {
        const command = decodeCategorySelectionFromHttp(req.query);
        if (command) {
          await dispatchCommand(command);
        }
      } else if (category) {
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
          
          broadcast();
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
    const command = decodePhotoRatingCommand(req.body);
    if (!command) {
      return res.status(400).json({ error: 'Invalid parameter: "url" must be a non-empty string and "rating" must be an integer between 1 and 10.' });
    }

    if (dispatchCommand) {
      dispatchCommand(command).then((result) => {
        if (!result) {
          return res.status(404).json({ error: 'Photo URL not found in curated collections.' });
        }
        return res.json({ success: true, url: command.payload.url, rating: command.payload.rating });
      }).catch((error) => {
        res.status(500).json({ error: error.message });
      });
      return;
    }

    const { updatePhotoRating } = require('./config/collections.js');
    const updated = updatePhotoRating(collections, state, command.payload.url, command.payload.rating);

    if (!updated) {
      return res.status(404).json({ error: 'Photo URL not found in curated collections.' });
    }

    if (command.payload.rating === 1 && state.activePhoto && state.activePhoto.url === command.payload.url) {
      const nextPhoto = getSmartPhoto('next');
      if (nextPhoto) {
        state.activePhoto = nextPhoto;
        io.emit('photo-update', state.activePhoto);
      }
    }
    broadcast();
    return res.json({ success: true, url: command.payload.url, rating: command.payload.rating });
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

    broadcast();
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

  function startPickerSessionPoller(sessionId) {
    const startTime = Date.now();
    const intervalId = setInterval(async () => {
      // Timeout after 5 minutes (300,000 ms)
      if (Date.now() - startTime > 300000) {
        console.log(`Google Picker Poller: Session ${sessionId} timed out.`);
        clearInterval(intervalId);
        try {
          await googlePhotos.deletePickerSession(sessionId);
        } catch (err) {
          console.error(`Google Picker Poller: Failed to delete timed out session ${sessionId}:`, err.message);
        }
        return;
      }

      try {
        const session = await googlePhotos.getPickerSession(sessionId);
        if (session.mediaItemsSet) {
          console.log(`Google Picker Poller: Session ${sessionId} completed. Syncing items...`);
          clearInterval(intervalId);
          
          await googlePhotos.syncGoogleAlbum(sessionId);
          
          const currentCats = state.currentCategory ? state.currentCategory.split(',').map(c => c.trim()) : [];
          if (currentCats.includes('Google Photos')) {
            state.photosList = combineGoogleAndCuratedFeeds(currentCats, collections);
          }
          
          broadcast();
          console.log(`Google Picker Poller: Session ${sessionId} completed and cached successfully.`);
        }
      } catch (err) {
        console.error(`Google Picker Poller error for session ${sessionId}:`, err.message);
        clearInterval(intervalId);
      }
    }, 3000);
  }

  // GET /api/auth/google/login
  app.get('/api/auth/google/login', (req, res) => {
    const host = req.headers.host || `localhost:${PORT}`;
    const redirectUri = `http://${host}/api/auth/google/callback`;
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
      const host = req.headers.host || `localhost:${PORT}`;
      const redirectUri = `http://${host}/api/auth/google/callback`;
      
      await googlePhotos.exchangeGoogleCode(code, redirectUri);
      
      const session = await googlePhotos.createPickerSession();
      startPickerSessionPoller(session.id);
      
      res.redirect(`${session.pickerUri}/autoclose`);
    } catch (err) {
      console.error('Google Photos Auth Callback error:', err.message);
      res.status(500).send(`Google Photos Link Failed: ${err.message}`);
    }
  });

  // GET /api/auth/google/sandbox-callback
  app.get('/api/auth/google/sandbox-callback', async (req, res) => {
    try {
      await googlePhotos.exchangeGoogleCode('sandbox-code', '');
      const session = await googlePhotos.createPickerSession();
      await googlePhotos.syncGoogleAlbum(session.id);
      
      const currentCats = state.currentCategory ? state.currentCategory.split(',').map(c => c.trim()) : [];
      if (currentCats.includes('Google Photos')) {
        state.photosList = combineGoogleAndCuratedFeeds(currentCats, collections);
      }
      broadcast();
      
      const host = req.headers.host || `localhost:${PORT}`;
      res.redirect(`http://${host}/?mode=remote&googleAuth=success`);
    } catch (err) {
      res.status(500).send(`Sandbox Google Photos Link Failed: ${err.message}`);
    }
  });

  // GET /api/config
  app.get('/api/config', (req, res) => {
    res.json({
      localIps: getLocalIpAddresses(),
      port: PORT,
      state: buildStateResponse()
    });
  });

  // GET /api/state
  app.get('/api/state', (req, res) => {
    res.json(buildStateResponse());
  });

  // POST /api/state/categories
  app.post('/api/state/categories', async (req, res) => {
    const command = decodeCategorySelectionFromHttp(req.body);
    if (!command) {
      return res.status(400).json({ error: 'Invalid parameter: "categories" must be a non-empty string or array.' });
    }

    if (dispatchCommand) {
      try {
        await dispatchCommand(command);
        return respondWithState(res, 200);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(501).json({ error: 'Category selection dispatcher unavailable.' });
  });

  // PATCH /api/state
  app.patch('/api/state', async (req, res) => {
    const { saveCuratedCollections } = require('./config/collections.js');
    const writableFields = [
      'theme', 'inactivityTimeout', 'slideshowInterval', 'scaleMode',
      'splitPortrait', 'splitCropPercent', 'alignTimeOfDay', 'alignWeather',
      'nightPercentage', 'allowOpenAiFallback', 'excludedKeywords', 'visionConfig',
      'autoLocation'
    ];
    let updated = false;
    let shouldRefreshWeather = false;

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
        } else if (key === 'autoLocation') {
          state.autoLocation = !!req.body.autoLocation;
          updated = true;
          shouldRefreshWeather = true;
        } else {
          state[key] = req.body[key];
          updated = true;
        }
      }
    }

    if (req.body.manualLocation && typeof req.body.manualLocation === 'object') {
      const location = req.body.manualLocation;
      state.manualLocation = {
        lat: normalizeCoordinate(location.lat, 45.45),
        lon: normalizeCoordinate(location.lon, -73.56),
        city: String(location.city || 'Verdun').trim(),
        regionName: String(location.regionName || 'Quebec').trim(),
        country: String(location.country || 'Canada').trim()
      };
      updated = true;
      shouldRefreshWeather = true;
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
      if (shouldRefreshWeather && typeof triggerWeatherUpdate === 'function') {
        try {
          await triggerWeatherUpdate();
        } catch (error) {
          console.warn('[Config API] Weather refresh failed after state update:', error.message);
        }
      }
      broadcast();
    }

    res.json(buildStateResponse());
  });

  // POST /api/state/screensaver
  app.post('/api/state/screensaver', (req, res) => {
    const { active } = req.body;
    if (active === undefined || typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Invalid parameter: "active" must be a boolean.' });
    }

    if (dispatchCommand) {
      dispatchCommand({
        type: 'set-screensaver-active',
        payload: { active }
      }).then(() => {
        res.json({ success: true, screensaverActive: state.screensaverActive, state: buildStateResponse() });
      }).catch((error) => {
        res.status(500).json({ error: error.message });
      });
      return;
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

    broadcast();
    res.json({ success: true, screensaverActive: state.screensaverActive, state: buildStateResponse() });
  });

  // GET /api/pools
  app.get('/api/pools', (req, res) => {
    const pools = Object.keys(collections).map(buildPoolResponse);
    res.json(pools);
  });

  // POST /api/pools
  app.post('/api/pools', async (req, res) => {
    const command = decodeAddPoolCommand(req.body);
    if (!command) {
      return res.status(400).json({ error: 'Invalid pool payload. Provide a non-empty "name" and at least one keyword.' });
    }

    if (hasPool(command.payload.name) || (state.searchKeywords && state.searchKeywords[command.payload.name])) {
      return res.status(409).json({ error: `Pool "${command.payload.name}" already exists.` });
    }

    if (dispatchCommand) {
      try {
        await dispatchCommand(command);
        return respondWithState(res, 201, {
          pool: buildPoolResponse(command.payload.name)
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(501).json({ error: 'Pool dispatcher unavailable.' });
  });

  // DELETE /api/pools/:name
  app.delete('/api/pools/:name', async (req, res) => {
    const command = decodeDeletePoolCommand({ name: req.params.name });
    if (!command) {
      return res.status(400).json({ error: 'Invalid pool name.' });
    }

    if (!hasPool(command.payload.name) && (!state.searchKeywords || !state.searchKeywords[command.payload.name])) {
      return res.status(404).json({ error: `Pool "${command.payload.name}" not found.` });
    }

    if (dispatchCommand) {
      try {
        await dispatchCommand(command);
        return respondWithState(res, 200, {
          message: `Pool "${command.payload.name}" deleted successfully.`
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(501).json({ error: 'Pool dispatcher unavailable.' });
  });

  // PATCH /api/pools/:name
  app.patch('/api/pools/:name', async (req, res) => {
    const cleanCategory = req.params.name.trim();

    if (!hasPool(cleanCategory)) {
      return res.status(404).json({ error: `Pool "${cleanCategory}" not found.` });
    }

    if (
      req.body.feedConfigs !== undefined
      && (
        typeof req.body.feedConfigs !== 'object'
        || req.body.feedConfigs === null
        || Array.isArray(req.body.feedConfigs)
      )
    ) {
      return res.status(400).json({ error: 'Invalid parameter: "feedConfigs" must be an object.' });
    }

    const commands = [
      req.body.keywords !== undefined
        ? decodePoolKeywordsCommand({ name: cleanCategory, keywords: req.body.keywords })
        : null,
      ...Object.entries(req.body.feedConfigs || {}).map(([source, config]) =>
        decodePoolFeedConfigCommand({ name: cleanCategory, source, config })
      )
    ].filter(Boolean);

    const expectedCommandCount = (req.body.keywords !== undefined ? 1 : 0) + Object.keys(req.body.feedConfigs || {}).length;
    if (commands.length !== expectedCommandCount) {
      return res.status(400).json({ error: 'Invalid pool patch payload.' });
    }

    if (commands.length === 0) {
      return respondWithState(res, 200, {
        pool: buildPoolResponse(cleanCategory)
      });
    }

    if (dispatchCommand) {
      try {
        for (const command of commands) {
          await dispatchCommand(command);
        }
        return respondWithState(res, 200, {
          pool: buildPoolResponse(cleanCategory)
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(501).json({ error: 'Pool dispatcher unavailable.' });
  });

  // PATCH /api/pools/:name/feed-sources/:source
  app.patch('/api/pools/:name/feed-sources/:source', async (req, res) => {
    const command = decodePoolFeedConfigCommand({
      name: req.params.name,
      source: req.params.source,
      config: req.body
    });

    if (!command) {
      return res.status(400).json({ error: 'Invalid feed source patch payload.' });
    }

    if (!hasPool(command.payload.name)) {
      return res.status(404).json({ error: `Pool "${command.payload.name}" not found.` });
    }

    if (dispatchCommand) {
      try {
        await dispatchCommand(command);
        return respondWithState(res, 200, {
          pool: buildPoolResponse(command.payload.name),
          feedSource: command.payload.source
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(501).json({ error: 'Pool dispatcher unavailable.' });
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
      
      broadcast();

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
    const { url, rating, cropPercent, cropPositionY, preventPairing, preserveActive, isBroken } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid parameter: "url" must be a non-empty string.' });
    }

    const isGoogleMetadataPatch =
      googlePhotos.isGooglePhotoProxyUrl(url)
      && rating === undefined
      && isBroken !== true
      && (
        cropPercent !== undefined
        || cropPositionY !== undefined
        || preventPairing !== undefined
      );

    if (isGoogleMetadataPatch) {
      const googleCropCommand = (cropPercent !== undefined || cropPositionY !== undefined)
        ? decodePhotoCropCommand({ url, cropPercent, cropPositionY })
        : null;

      if ((cropPercent !== undefined || cropPositionY !== undefined) && !googleCropCommand) {
        return res.status(400).json({ error: 'Invalid crop payload.' });
      }

      const metadataPatch = googlePhotos.buildGooglePhotoMetadataPatch({
        ...(googleCropCommand?.payload.cropPercent !== undefined ? { cropPercent: googleCropCommand.payload.cropPercent } : {}),
        ...(googleCropCommand?.payload.cropPositionY !== undefined ? { cropPositionY: googleCropCommand.payload.cropPositionY } : {}),
        ...(preventPairing !== undefined ? { preventPairing: !!preventPairing } : {})
      });

      const updatedPhoto = googlePhotos.updateCachedMediaItemMetadata(url, metadataPatch);

      if (!updatedPhoto) {
        return res.status(404).json({ error: 'Photo URL not found in Google Photos cache.' });
      }

      googlePhotos.applyCachedMediaItemMetadataToState(state, url, metadataPatch);
      if (preventPairing && preserveActive) {
        const focusedPhoto = state.photosList?.find((photo) => photo?.url === url);
        if (focusedPhoto) {
          state.activePhoto = { ...focusedPhoto };
          state.activeSecondPhoto = null;
        }
      }
      broadcast();

      return res.json({
        success: true,
        photo: {
          url,
          ...(googleCropCommand?.payload.cropPercent !== undefined ? { cropPercent: googleCropCommand.payload.cropPercent } : {}),
          ...(googleCropCommand?.payload.cropPositionY !== undefined ? { cropPositionY: googleCropCommand.payload.cropPositionY } : {}),
          ...(preventPairing !== undefined ? { preventPairing: !!preventPairing } : {})
        }
      });
    }

    if (dispatchCommand) {
      const commands = [];

      if (rating !== undefined) {
        const ratingCommand = decodePhotoRatingCommand({ url, rating });
        if (!ratingCommand) {
          return res.status(400).json({ error: 'Invalid parameter: "rating" must be an integer between 1 and 10.' });
        }
        commands.push(ratingCommand);
      }

      if (isBroken === true) {
        commands.push({
          type: 'mark-photo-broken',
          payload: { url }
        });
      }

      if (cropPercent !== undefined || cropPositionY !== undefined) {
        const cropCommand = decodePhotoCropCommand({ url, cropPercent, cropPositionY });
        if (!cropCommand) {
          return res.status(400).json({ error: 'Invalid crop payload.' });
        }
        commands.push(cropCommand);
      }

      if (preventPairing !== undefined) {
        commands.push({
          type: 'set-photo-prevent-pairing',
          payload: { url, preventPairing, preserveActive }
        });
      }

      Promise.all(commands.map((command) => dispatchCommand(command))).then((results) => {
        if (results.length === 0 || results.every((result) => !result)) {
          return res.status(404).json({ error: 'Photo URL not found in curated collections.' });
        }

        return res.json({
          success: true,
          photo: {
            url,
            ...(rating !== undefined ? { rating: Number(rating) } : {}),
            ...(isBroken === true ? { isBroken: true } : {}),
            ...(cropPercent !== undefined ? { cropPercent: Number(cropPercent) } : {}),
            ...(cropPositionY !== undefined ? { cropPositionY: Number(cropPositionY) } : {}),
            ...(preventPairing !== undefined ? { preventPairing: !!preventPairing } : {})
          }
        });
      }).catch((error) => {
        res.status(500).json({ error: error.message });
      });
      return;
    }

    let updated = false;
    const responsePayload = { url };

    // 1. Rating update
    if (rating !== undefined) {
      const { validateRating } = require('./utils/validation.js');
      const numericRating = validateRating(rating);
      if (numericRating === null) {
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
      const { validatePercent } = require('./utils/validation.js');
      const numericCrop = cropPercent !== undefined ? validatePercent(cropPercent) : undefined;
      const numericCropY = cropPositionY !== undefined ? validatePercent(cropPositionY) : undefined;
      if (cropPercent !== undefined && numericCrop === null) {
        return res.status(400).json({ error: 'Invalid parameter: "cropPercent" must be between 0 and 100.' });
      }
      if (cropPositionY !== undefined && numericCropY === null) {
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
        if (preventPairing && preserveActive) {
          const focusedPhoto = state.photosList?.find((photo) => photo?.url === url)
            || Object.values(collections).flat().find((photo) => photo?.url === url);
          if (focusedPhoto) {
            state.activePhoto = focusedPhoto;
            state.activeSecondPhoto = null;
          }
        }
      }
    }

    if (!updated) {
      return res.status(404).json({ error: 'Photo URL not found in curated collections.' });
    }

    broadcast();
    res.json({ success: true, photo: responsePayload });
  });

  // POST /api/photos/preview
  app.post('/api/photos/preview', (req, res) => {
    const command = decodeActivePhotoCommand(req.body);
    if (!command) {
      return res.status(400).json({ error: 'Invalid parameter: "url" must be a non-empty string.' });
    }

    const requestedUrl = command.payload.url;
    const payloadPhoto = command.payload.photo && typeof command.payload.photo === 'object'
      ? command.payload.photo
      : null;

    const foundPhoto = state.photosList?.find((photo) => photo?.url === requestedUrl)
      || Object.values(collections).flat().find((photo) => photo?.url === requestedUrl)
      || payloadPhoto;

    if (!foundPhoto) {
      return res.status(404).json({ error: 'Photo URL not found in active feed or curated collections.' });
    }

    if (dispatchCommand) {
      dispatchCommand({
        ...command,
        payload: {
          ...command.payload,
          photo: foundPhoto
        }
      }).then(() => {
        res.json({ success: true, activePhoto: state.activePhoto });
      }).catch((error) => {
        res.status(500).json({ error: error.message });
      });
      return;
    }

    state.activePhoto = foundPhoto;
    io.emit('photo-update', foundPhoto);
    broadcast();

    res.json({ success: true, activePhoto: foundPhoto });
  });

  // POST /api/photos/next
  app.post('/api/photos/next', (req, res) => {
    if (dispatchCommand) {
      dispatchCommand(decodeAdvancePhotoCommand('next')).then((result) => {
        if (!result || !state.activePhoto) {
          return res.status(500).json({ error: 'Could not transition to next photo.' });
        }
        return res.json({ success: true, activePhoto: state.activePhoto });
      }).catch((error) => {
        res.status(500).json({ error: error.message });
      });
      return;
    }

    const photo = getSmartPhoto('next');
    if (photo) {
      state.activePhoto = photo;
      io.emit('photo-update', state.activePhoto);
      broadcast();
      return res.json({ success: true, activePhoto: state.activePhoto });
    }
    res.status(500).json({ error: 'Could not transition to next photo.' });
  });

  // POST /api/photos/prev
  app.post('/api/photos/prev', (req, res) => {
    if (dispatchCommand) {
      dispatchCommand(decodeAdvancePhotoCommand('prev')).then((result) => {
        if (!result || !state.activePhoto) {
          return res.status(500).json({ error: 'Could not transition to previous photo.' });
        }
        return res.json({ success: true, activePhoto: state.activePhoto });
      }).catch((error) => {
        res.status(500).json({ error: error.message });
      });
      return;
    }

    const photo = getSmartPhoto('prev');
    if (photo) {
      state.activePhoto = photo;
      io.emit('photo-update', state.activePhoto);
      broadcast();
      return res.json({ success: true, activePhoto: state.activePhoto });
    }
    res.status(500).json({ error: 'Could not transition to previous photo.' });
  });
};
