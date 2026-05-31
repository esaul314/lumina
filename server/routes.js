const os = require('os');
const { getIpLocation, fetchWeatherForecast } = require('./services/weather.js');

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
      const loc = await getIpLocation();
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

        const validCategories = selectedCategories.filter(catName => !!collections[catName]);

        if (validCategories.length > 0) {
          state.currentCategory = validCategories.join(',');
          state.photosList = combineFeedsBalanced(validCategories, collections);
          
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
      const responsePhotos = combineFeedsBalanced(currentCats, collections);
      res.json(responsePhotos.length > 0 ? responsePhotos : (collections['Scenic Nature'] || []));
    } catch (error) {
      console.error('Failed to fetch photos from curated list', error.message);
      res.json(collections['Scenic Nature']);
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
