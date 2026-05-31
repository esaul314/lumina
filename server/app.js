const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Modular config and service imports
const { sendEmailAlert } = require('./services/notifier.js');
const { screensaverState } = require('./config/state.js');
const { defaultCuratedCollections } = require('./config/collections.js');
const {
  setCpuGovernor,
  getGnomeIdleTime,
  isAudioPlaying,
  launchChromiumKiosk,
  killChromiumKiosk
} = require('./services/system.js');
const {
  getIpLocation,
  classifyWeatherCode,
  fetchWeatherForecast
} = require('./services/weather.js');
const { analyzeSentiment } = require('./services/sentiment.js');
const { crawlAllCollections } = require('./services/crawler.js');
const {
  curry,
  pipe,
  prop,
  map,
  toLower,
  includes
} = require('./utils/fn.js');

// Global Weather Telemetry Cache
let serverWeatherData = null;
const getWeatherData = () => serverWeatherData;
const setWeatherData = (data) => { serverWeatherData = data; };

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve client built static production files
const rootDir = path.join(__dirname, '..');
app.use(express.static(path.join(rootDir, 'client/dist')));

// Curated collections persistence loader
const jsonPath = path.join(rootDir, 'curated_collections.json');
let curatedCollections;

if (fs.existsSync(jsonPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    curatedCollections = data.feeds || defaultCuratedCollections;
    
    // Safety check: ensure every standard category is populated
    for (const key of Object.keys(defaultCuratedCollections)) {
      if (!curatedCollections[key] || !Array.isArray(curatedCollections[key]) || curatedCollections[key].length === 0) {
        curatedCollections[key] = [...defaultCuratedCollections[key]];
      }
    }

    if (data.searchKeywords) {
      screensaverState.searchKeywords = data.searchKeywords;
    }
    console.log('Successfully loaded persisted curated collections from file!');
  } catch (err) {
    console.error('Failed to parse curated_collections.json, falling back to defaults:', err.message);
    curatedCollections = defaultCuratedCollections;
  }
} else {
  curatedCollections = defaultCuratedCollections;
  try {
    fs.writeFileSync(jsonPath, JSON.stringify({ 
      lastUpdated: 0, 
      feeds: curatedCollections, 
      searchKeywords: screensaverState.searchKeywords 
    }, null, 2), 'utf8');
    console.log('Created new curated_collections.json file from seed data.');
  } catch (err) {
    console.error('Failed to create curated_collections.json:', err.message);
  }
}

const hasWord = includes;

// Curried checker that matches a list of keywords against the lowercase photo title
const titleHasKeyword = curry((keywords, photo) => {
  const titleText = pipe(prop('title'), toLower)(photo);
  return keywords.some(word => hasWord(word, titleText));
});

// Composable curried checkers partially executed with specific weather lexicon arrays
const isNightPhoto = titleHasKeyword(['night', 'dark', 'twilight', 'midnight', 'stars', 'moon', 'sunset', 'evening', '3 am', 'eclipse', 'space', 'nebula', 'stardust']);
const isRainPhoto = titleHasKeyword(['rain', 'rainy', 'wet', 'storm', 'water', 'dewy', 'jungle', 'stream', 'lake', 'puddle', 'drizzle']);
const isSunnyPhoto = titleHasKeyword(['sun', 'sunny', 'clear', 'bright', 'golden', 'morning', 'summer', 'daylight', 'drenched', 'warm']);
const isCloudyPhoto = titleHasKeyword(['mist', 'cloud', 'cloudy', 'fog', 'foggy', 'mist-veiled', 'misty', 'hazy', 'overcast', 'moody', 'shadow', 'pale', 'eerie', 'familiar', 'empty', 'silent', 'deserted', 'abandoned', 'quiet']);
const isSnowyPhoto = titleHasKeyword(['snow', 'snowy', 'winter', 'ice', 'frozen', 'cold', 'alpine']);

/**
 * 🏷️ tagPhotosWithKeywords
 * Standard auto-tagging classifier composed with our functional checkers.
 */
function tagPhotosWithKeywords(photos, defaultIsNight = false) {
  return map(photo => ({
    url: photo.url,
    title: photo.title,
    author: photo.author,
    source: photo.source || 'curated',
    rating: photo.rating !== undefined ? photo.rating : 10,
    isNight: photo.isNight !== undefined ? photo.isNight : (defaultIsNight || isNightPhoto(photo)),
    isRain: photo.isRain !== undefined ? photo.isRain : isRainPhoto(photo),
    isSunny: photo.isSunny !== undefined ? photo.isSunny : isSunnyPhoto(photo),
    isCloudy: photo.isCloudy !== undefined ? photo.isCloudy : isCloudyPhoto(photo),
    isSnowy: photo.isSnowy !== undefined ? photo.isSnowy : isSnowyPhoto(photo)
  }), photos);
}

// Initial auto-tagging setup
for (const key of Object.keys(curatedCollections)) {
  const isCosmic = key === 'Cosmic Space';
  curatedCollections[key] = tagPhotosWithKeywords(curatedCollections[key], isCosmic);
}

screensaverState.photosList = [...curatedCollections['Scenic Nature']];
screensaverState.activePhoto = curatedCollections['Scenic Nature'][0];

/**
 * 🔄 combineFeedsBalanced
 * Combines active image feeds using a balanced round-robin interleave layout.
 */
function combineFeedsBalanced(categories, collections) {
  const lists = categories.map(cat => {
    const list = [...(collections[cat] || [])];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }).filter(list => list.length > 0);

  if (lists.length === 0) return [];
  if (lists.length === 1) return lists[0];

  const combined = [];
  const maxLen = Math.max(...lists.map(l => l.length));
  
  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < lists.length; j++) {
      const list = lists[j];
      combined.push(list[i % list.length]);
    }
  }

  const finalPhotos = [];
  for (const photo of combined) {
    if (finalPhotos.length > 0 && finalPhotos[finalPhotos.length - 1].url === photo.url) {
      continue;
    }
    finalPhotos.push(photo);
  }
  return finalPhotos;
}

/**
 * 🎯 selectWeightedRandomPhoto
 * Picks a photo from a list based on ratings. Rating=1 is blocked (Weight=0).
 * Scales ratings 2-10 linearly (2=0.2, 10=1.0).
 */
function selectWeightedRandomPhoto(photos, currentPhotoUrl = null) {
  // 1. Filter out banned images (rating = 1)
  let activePhotos = photos.filter(p => p.rating !== 1);
  if (activePhotos.length === 0) return null;

  // 2. Avoid consecutive repeat if possible
  if (activePhotos.length > 1 && currentPhotoUrl) {
    const withoutCurrent = activePhotos.filter(p => p.url !== currentPhotoUrl);
    if (withoutCurrent.length > 0) {
      activePhotos = withoutCurrent;
    }
  }

  // 3. Compute cumulative weight map
  const totalWeight = activePhotos.reduce((sum, photo) => {
    const r = photo.rating !== undefined ? photo.rating : 10;
    return sum + (r / 10);
  }, 0);

  if (totalWeight === 0) return activePhotos[0];

  // 4. Random float select point
  let randomPoint = Math.random() * totalWeight;

  // 5. Cumulative distribution selector
  for (const photo of activePhotos) {
    const r = photo.rating !== undefined ? photo.rating : 10;
    const w = r / 10;
    if (randomPoint < w) {
      return photo;
    }
    randomPoint -= w;
  }
  return activePhotos[activePhotos.length - 1]; // Fallback
}

/**
 * 🎯 getSmartPhoto
 * Dynamic weighted select algorithm mapping physical weather & news sentiment to wallpaper lists,
 * resolved through a Cumulative Distribution Function (CDF) rating-weighted engine.
 */
function getSmartPhoto(direction = 'next') {
  const list = screensaverState.photosList;
  if (!list || list.length === 0) return null;

  let isNight = false;
  if (serverWeatherData && serverWeatherData.current) {
    isNight = serverWeatherData.current.is_day === 0;
  } else {
    const hour = new Date().getHours();
    isNight = hour >= 18 || hour < 6;
  }

  const physicalMatch = screensaverState.physicalWeather?.weatherMatch || 'Cloudy';
  const newsMatch = screensaverState.newsSentiment?.weatherMatch || 'Cloudy';

  let candidates = [...list];

  if (screensaverState.alignWeather) {
    let weatherCandidates = [];
    if (physicalMatch === 'Snowy') {
      weatherCandidates = list.filter(p => p.isSnowy);
    } else if (physicalMatch === 'Rainy') {
      weatherCandidates = list.filter(p => p.isRain);
    } else {
      if (newsMatch === 'Rainy') {
        weatherCandidates = list.filter(p => p.isRain || p.isCloudy);
      } else if (newsMatch === 'Sunny') {
        weatherCandidates = list.filter(p => p.isSunny);
      } else {
        weatherCandidates = list.filter(p => p.isCloudy);
      }
    }
    if (weatherCandidates.length > 0 && Math.random() < 0.8) {
      candidates = weatherCandidates;
    }
  }

  if (screensaverState.alignTimeOfDay && isNight) {
    const nightPhotos = candidates.filter(p => p.isNight);
    const nightThreshold = (screensaverState.nightPercentage || 50) / 100;
    if (nightPhotos.length > 0 && Math.random() < nightThreshold) {
      candidates = nightPhotos;
    }
  }

  // Delegate selection to the weighted CDF probability engine
  const currentPhotoUrl = screensaverState.activePhoto?.url;
  return selectWeightedRandomPhoto(candidates, currentPhotoUrl);
}

/**
 * 📰 updateNewsSentiment
 * Scrapes headlines, performs functional sentiment parsing, and syncs remote state.
 */
async function updateNewsSentiment() {
  try {
    console.log('News Sentiment: Fetching headlines from Google News RSS...');
    const res = await fetch('https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en');
    if (!res.ok) {
      console.warn('News Sentiment: Failed to fetch Google News RSS');
      return;
    }
    const text = await res.text();
    screensaverState.newsSentiment = analyzeSentiment(text);
    console.log(`News Sentiment: Success! Score=${screensaverState.newsSentiment.score.toFixed(3)} (${screensaverState.newsSentiment.label}) -> Correlated weather mood: ${screensaverState.newsSentiment.weatherMatch}`);
    io.emit('state-sync', screensaverState);
  } catch (err) {
    console.error('Failed to update news sentiment:', err.message);
  }
}

/**
 * 🌦️ updateServerWeather
 * Resolves geolocation, queries live forecasts, and classifies weather profile status.
 */
async function updateServerWeather() {
  try {
    const loc = await getIpLocation();
    const data = await fetchWeatherForecast(loc.lat, loc.lon);
    if (data && !data.error) {
      serverWeatherData = {
        location: loc,
        current: data.current,
        daily: data.daily
      };
      
      if (data.current) {
        const { physicalMatch, physicalCond } = classifyWeatherCode(data.current.weather_code);
        screensaverState.physicalWeather = {
          temp: Math.round(data.current.temperature_2m),
          condition: physicalCond,
          weatherMatch: physicalMatch
        };
      }
      console.log('Server weather cache updated successfully.');
      io.emit('state-sync', screensaverState);
    }
  } catch (err) {
    console.error('Failed to update server weather cache:', err.message);
  }
}

/**
 * 🗓️ updateFeedsDaily
 * Background cron-like daily scraper update check.
 */
async function updateFeedsDaily() {
  console.log('Checking for daily dynamic feed updates...');
  let lastUpdated = 0;
  let fileData = {};
  if (fs.existsSync(jsonPath)) {
    try {
      fileData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      lastUpdated = fileData.lastUpdated || 0;
    } catch (e) {}
  }

  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  if (now - lastUpdated < ONE_DAY && lastUpdated > 0) {
    console.log('Feeds were updated less than 24 hours ago. Skipping daily update.');
    return;
  }

  const { updatedCollections, updatedAny } = await crawlAllCollections(curatedCollections, screensaverState.searchKeywords);
  
  if (updatedAny) {
    for (const key of Object.keys(updatedCollections)) {
      curatedCollections[key] = updatedCollections[key];
    }

    try {
      fs.writeFileSync(jsonPath, JSON.stringify({ 
        lastUpdated: now, 
        feeds: curatedCollections, 
        searchKeywords: screensaverState.searchKeywords 
      }, null, 2), 'utf8');
      console.log('Successfully saved updated feeds to curated_collections.json');
    } catch (err) {
      console.error('Failed to write curated_collections.json:', err.message);
    }

    const activeCategory = screensaverState.currentCategory;
    const currentCats = activeCategory ? activeCategory.split(',') : [];
    const combinedPhotos = combineFeedsBalanced(currentCats, curatedCollections);
    screensaverState.photosList = combinedPhotos.length > 0 ? combinedPhotos : (curatedCollections['Scenic Nature'] || []);
    io.emit('state-sync', screensaverState);
  }
}

// Daemon-specific interval bindings (disabled under test suites)
if (process.env.NODE_ENV !== 'test') {
  setInterval(updateServerWeather, 15 * 60 * 1000);
  setTimeout(updateServerWeather, 3000);
  setInterval(updateNewsSentiment, 30 * 60 * 1000);
  setTimeout(updateNewsSentiment, 5000);

  setTimeout(() => {
    updateFeedsDaily().catch(err => console.error('Error in initial feed update:', err));
  }, 5000);

  setInterval(() => {
    updateFeedsDaily().catch(err => console.error('Error in scheduled feed update:', err));
  }, 4 * 60 * 60 * 1000);
}

// Subprocess State Management helpers for Sockets
let isBrowserRunning = false;
let manualOverride = false;
let PORT = process.env.PORT || 5000;

function launchKioskBrowser() {
  if (isBrowserRunning) return;
  console.log('Lumina System Idle: Spawning Fullscreen Kiosk Screensaver...');
  isBrowserRunning = true;

  setCpuGovernor('performance');
  launchChromiumKiosk(PORT, 'tv', () => {
    isBrowserRunning = false;
  });
}

function killKioskBrowser() {
  if (!isBrowserRunning) return;
  console.log('Lumina System Active: Dismissing Kiosk Browser...');
  isBrowserRunning = false;
  manualOverride = false;

  setCpuGovernor('schedutil');
  killChromiumKiosk();
}

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

// Wire up modular controllers
require('./routes.js')(app, screensaverState, curatedCollections, getWeatherData, setWeatherData, combineFeedsBalanced, getSmartPhoto, io, PORT);
require('./sockets.js')(io, screensaverState, curatedCollections, combineFeedsBalanced, getSmartPhoto, launchKioskBrowser, killKioskBrowser, getLocalIpAddresses, PORT);

// Mutter DBus Idle polling every 2 seconds
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      const idleMs = await getGnomeIdleTime();
      const isIdle = idleMs >= screensaverState.inactivityTimeout;
      const isMoviePlaying = await isAudioPlaying();

      const isActuallyIdle = isIdle && !isMoviePlaying;
      const shouldBeActive = isActuallyIdle || manualOverride;
      
      if (shouldBeActive && !isBrowserRunning) {
        launchKioskBrowser();
      } else if (!shouldBeActive && isBrowserRunning) {
        killKioskBrowser();
      }

      if (screensaverState.screensaverActive !== shouldBeActive) {
        screensaverState.screensaverActive = shouldBeActive;
        io.emit('state-sync', screensaverState);
      }
    } catch (err) {
      // Fallback
    }
  }, 2000);
}

// Self-healing EADDRINUSE conflict recovery boundary
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const fallbackPort = parseInt(PORT, 10) + 1;
    console.error(`Self-Healing: Port ${PORT} is already bound! Trying fallback port ${fallbackPort}...`);
    sendEmailAlert(
      '⚠️ LUMINA SYSTEM WARNING: Port Collision Intercepted',
      `Port collision detected on default port ${PORT}.\n\nAction: Lumina is automatically healing by binding to fallback port ${fallbackPort}.`
    );
    PORT = fallbackPort;
    setTimeout(() => {
      server.listen(PORT, '0.0.0.0');
    }, 1000);
  } else {
    console.error('Core Server Error:', err.message);
  }
});

// Bootstrapper initialization handler
function startServer() {
  if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Lumina Core backend running at http://localhost:${PORT}`);
      console.log(`Mobile Remote accessible at your local network IPs:`);
      getLocalIpAddresses().forEach(ip => console.log(`  http://${ip}:${PORT}`));
    });
  }
}

module.exports = {
  app,
  server,
  io,
  startServer,
  tagPhotosWithKeywords,
  getSmartPhoto,
  screensaverState,
  curatedCollections,
  updateNewsSentiment,
  updateServerWeather
};
