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
    console.log('Successfully loaded persisted curated collections from file!');
  } catch (err) {
    console.error('Failed to parse curated_collections.json, falling back to defaults:', err.message);
    curatedCollections = defaultCuratedCollections;
  }
} else {
  curatedCollections = defaultCuratedCollections;
  try {
    fs.writeFileSync(jsonPath, JSON.stringify({ lastUpdated: 0, feeds: curatedCollections }, null, 2), 'utf8');
    console.log('Created new curated_collections.json file from seed data.');
  } catch (err) {
    console.error('Failed to create curated_collections.json:', err.message);
  }
}

/**
 * 🏷️ tagPhotosWithKeywords
 * Standard auto-tagging classifier. Scans picture titles to append atmospheric flags.
 */
function tagPhotosWithKeywords(photos, defaultIsNight = false) {
  return photos.map(photo => {
    const titleLower = (photo.title || '').toLowerCase();
    
    const isNight = defaultIsNight || 
                    titleLower.includes('night') || 
                    titleLower.includes('dark') || 
                    titleLower.includes('twilight') || 
                    titleLower.includes('midnight') || 
                    titleLower.includes('stars') || 
                    titleLower.includes('moon') || 
                    titleLower.includes('sunset') || 
                    titleLower.includes('evening') || 
                    titleLower.includes('3 am') || 
                    titleLower.includes('eclipse') ||
                    titleLower.includes('space') ||
                    titleLower.includes('nebula') ||
                    titleLower.includes('stardust');
                    
    const isRain = titleLower.includes('rain') || 
                   titleLower.includes('rainy') || 
                   titleLower.includes('wet') || 
                   titleLower.includes('storm') || 
                   titleLower.includes('water') ||
                   titleLower.includes('dewy') ||
                   titleLower.includes('jungle') ||
                   titleLower.includes('stream') ||
                   titleLower.includes('lake') ||
                   titleLower.includes('puddle') ||
                   titleLower.includes('drizzle');

    const isSunny = titleLower.includes('sun') ||
                    titleLower.includes('sunny') ||
                    titleLower.includes('clear') ||
                    titleLower.includes('bright') ||
                    titleLower.includes('golden') ||
                    titleLower.includes('morning') ||
                    titleLower.includes('summer') ||
                    titleLower.includes('daylight') ||
                    titleLower.includes('drenched') ||
                    titleLower.includes('warm');

    const isCloudy = titleLower.includes('mist') ||
                     titleLower.includes('cloud') ||
                     titleLower.includes('cloudy') ||
                     titleLower.includes('fog') ||
                     titleLower.includes('foggy') ||
                     titleLower.includes('mist-veiled') ||
                     titleLower.includes('misty') ||
                     titleLower.includes('hazy') ||
                     titleLower.includes('overcast') ||
                     titleLower.includes('moody') ||
                     titleLower.includes('shadow') ||
                     titleLower.includes('pale') ||
                     titleLower.includes('eerie') ||
                     titleLower.includes('familiar') ||
                     titleLower.includes('empty') ||
                     titleLower.includes('silent') ||
                     titleLower.includes('deserted') ||
                     titleLower.includes('abandoned') ||
                     titleLower.includes('quiet');

    const isSnowy = titleLower.includes('snow') ||
                    titleLower.includes('snowy') ||
                    titleLower.includes('winter') ||
                    titleLower.includes('ice') ||
                    titleLower.includes('frozen') ||
                    titleLower.includes('cold') ||
                    titleLower.includes('alpine');
                   
    return {
      url: photo.url,
      title: photo.title,
      author: photo.author,
      source: photo.source || 'curated',
      isNight: photo.isNight !== undefined ? photo.isNight : isNight,
      isRain: photo.isRain !== undefined ? photo.isRain : isRain,
      isSunny: photo.isSunny !== undefined ? photo.isSunny : isSunny,
      isCloudy: photo.isCloudy !== undefined ? photo.isCloudy : isCloudy,
      isSnowy: photo.isSnowy !== undefined ? photo.isSnowy : isSnowy
    };
  });
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
 * 🎯 getSmartPhoto
 * Dynamic weighted select algorithm mapping physical weather & news sentiment to wallpaper lists.
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

  if (candidates.length > 0) {
    if (candidates.length < list.length) {
      const randIdx = Math.floor(Math.random() * candidates.length);
      return candidates[randIdx];
    } else {
      const currentIndex = list.findIndex(p => p.url === screensaverState.activePhoto.url);
      const step = direction === 'next' ? 1 : -1;
      const nextIndex = (currentIndex + step + list.length) % list.length;
      return list[nextIndex];
    }
  }

  const currentIndex = list.findIndex(p => p.url === screensaverState.activePhoto.url);
  const step = direction === 'next' ? 1 : -1;
  const nextIndex = (currentIndex + step + list.length) % list.length;
  return list[nextIndex];
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

  const { updatedCollections, updatedAny } = await crawlAllCollections(curatedCollections);
  
  if (updatedAny) {
    for (const key of Object.keys(updatedCollections)) {
      curatedCollections[key] = updatedCollections[key];
    }

    try {
      fs.writeFileSync(jsonPath, JSON.stringify({ lastUpdated: now, feeds: curatedCollections }, null, 2), 'utf8');
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
