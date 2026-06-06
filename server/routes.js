const os = require('os');
const fs = require('fs');
const path = require('path');
const { resolveActiveLocation, fetchWeatherForecast } = require('./services/weather.js');
const googlePhotos = require('./services/googlePhotos.js');
const {
  map,
  filter,
  reduce,
  prop,
  uniqBy
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
module.exports = function(app, state, collections, getWeatherData, setWeatherData, combineFeedsBalanced, getSmartPhoto, io, PORT) {
  
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
        return googlePhotos.getCachedMediaItems();
      }
      return shuffle(filter(p => p.rating !== 1 && !p.isBroken, collectionsObj[cat] || []));
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
      res.json(responsePhotos.length > 0 ? responsePhotos : (collections['Scenic Nature'] || []));
    } catch (error) {
      console.error('Failed to fetch photos from curated list', error.message);
      res.json(collections['Scenic Nature']);
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

    if (!Array.isArray(keywords) || !keywords.every(kw => typeof kw === 'string' && kw.trim().length > 0)) {
      return res.status(400).json({ error: 'Invalid parameter: "keywords" must be an array of non-empty strings.' });
    }

    // Update in state
    state.searchKeywords[category] = keywords.map(kw => kw.trim());

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
};

