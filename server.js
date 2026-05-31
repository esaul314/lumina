const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dns = require('dns');
const os = require('os');
const { exec } = require('child_process');

const { sendEmailAlert } = require('./server/services/notifier.js');
const { screensaverState } = require('./server/config/state.js');
const { defaultCuratedCollections } = require('./server/config/collections.js');
const {
  setCpuGovernor,
  getGnomeIdleTime,
  isAudioPlaying,
  launchChromiumKiosk,
  killChromiumKiosk
} = require('./server/services/system.js');
const {
  getIpLocation,
  classifyWeatherCode,
  fetchWeatherForecast
} = require('./server/services/weather.js');
const { analyzeSentiment } = require('./server/services/sentiment.js');
const { crawlAllCollections } = require('./server/services/crawler.js');

// Global Process Crash Boundaries (Self-Healing Interceptors)
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception intercepted:', err);
  sendEmailAlert(
    '⚠️ LUMINA SYSTEM ALERT: Uncaught Exception Intercepted',
    `Lumina has intercepted an uncaught exception on your smart display server.\n\nError Message:\n${err.message}\n\nStack Trace:\n${err.stack}\n\nAction: The daemon has successfully self-healed and continues running.`
  );
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Promise Rejection intercepted:', reason);
  sendEmailAlert(
    '⚠️ LUMINA SYSTEM ALERT: Unhandled Promise Rejection Intercepted',
    `Lumina has intercepted an unhandled promise rejection on your smart display server.\n\nReason:\n${reason}\n\nAction: The daemon has successfully self-healed and continues running.`
  );
});

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

// Serve client in production
app.use(express.static(path.join(__dirname, 'client/dist')));

// Curated high-definition wallpapers filesystem loader
const fs = require('fs');
const jsonPath = path.join(__dirname, 'curated_collections.json');
let curatedCollections;

if (fs.existsSync(jsonPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    curatedCollections = data.feeds || defaultCuratedCollections;
    
    // Safety guard: ensure every category exists and has photos, otherwise fall back to seed data
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

function tagPhotosWithKeywords(photos, defaultIsNight = false) {
  return photos.map(photo => {
    const titleLower = (photo.title || '').toLowerCase();
    
    // Check night keywords
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
                    
    // Check rain keywords
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

    // Check sunny keywords
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

    // Check cloudy/foggy/moody keywords
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

    // Check snowy keywords
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

// Auto-tag loaded feeds on startup
for (const key of Object.keys(curatedCollections)) {
  const isCosmic = key === 'Cosmic Space';
  curatedCollections[key] = tagPhotosWithKeywords(curatedCollections[key], isCosmic);
}

screensaverState.photosList = [...curatedCollections['Scenic Nature']];
screensaverState.activePhoto = curatedCollections['Scenic Nature'][0];

// Search queries mapping for Unsplash keyless napi search (restored!)
const searchQueries = {
  'Scenic Nature': 'scenic nature landscape mountains forest',
  'Cosmic Space': 'cosmic space nebula galaxy stars',
  'Abstract Art': 'abstract art painting minimalist geometric',
  'Liminal Spaces': 'liminal spaces empty corridor backrooms',
  'AI Creations': 'surreal digital art generative midjourney cyberpunk futuristic'
};

// Subreddits list for categories (a new robust feed source!)
// Background dynamic server weather cache to drive dynamic wallpaper weighting
let serverWeatherData = null;

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

if (process.env.NODE_ENV !== 'test') {
  // Update weather every 15 minutes, news every 30 minutes
  setInterval(updateServerWeather, 15 * 60 * 1000);
  setTimeout(updateServerWeather, 3000);
  setInterval(updateNewsSentiment, 30 * 60 * 1000);
  setTimeout(updateNewsSentiment, 5000);
}

// Combines multiple categories with equal representation in a round-robin interleaved fashion
function combineFeedsBalanced(categories, collections) {
  // 1. Get the list of photos for each selected category and shuffle each individually
  const lists = categories.map(cat => {
    const list = [...(collections[cat] || [])];
    // Fisher-Yates shuffle to randomize photos for this specific run
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }).filter(list => list.length > 0);

  if (lists.length === 0) return [];
  if (lists.length === 1) return lists[0];

  // 2. Interleave them in round-robin fashion to guarantee perfectly balanced representation (e.g. 50-50, 33-33-33)
  const combined = [];
  const maxLen = Math.max(...lists.map(l => l.length));
  
  for (let i = 0; i < maxLen; i++) {
    for (let j = 0; j < lists.length; j++) {
      const list = lists[j];
      combined.push(list[i % list.length]);
    }
  }

  // Deduplicate consecutive identical URLs (in case of modulo wrap-arounds for very small collections)
  const finalPhotos = [];
  for (const photo of combined) {
    if (finalPhotos.length > 0 && finalPhotos[finalPhotos.length - 1].url === photo.url) {
      continue;
    }
    finalPhotos.push(photo);
  }

  return finalPhotos;
}

// Dynamic atmospheric photo selector engine (Fused Weather & Sentiment Alignment)
function getSmartPhoto(direction = 'next') {
  const list = screensaverState.photosList;
  if (!list || list.length === 0) return null;

  let isNight = false;

  // Determine current day/night state
  if (serverWeatherData && serverWeatherData.current) {
    isNight = serverWeatherData.current.is_day === 0;
  } else {
    const hour = new Date().getHours();
    isNight = hour >= 18 || hour < 6;
  }

  // Determine physical and sentiment weather states
  const physicalMatch = screensaverState.physicalWeather?.weatherMatch || 'Cloudy';
  const newsMatch = screensaverState.newsSentiment?.weatherMatch || 'Cloudy';

  let candidates = [...list];

  // 1. Environmental Weather Smart Alignment (Physical + Sentiment Fusion!)
  if (screensaverState.alignWeather) {
    let weatherCandidates = [];
    
    // Physical weather gets primary preference
    if (physicalMatch === 'Snowy') {
      weatherCandidates = list.filter(p => p.isSnowy);
      console.log(`Smart Photo [Weather]: Snowy conditions active. Matching snowy photos: ${weatherCandidates.length}`);
    } else if (physicalMatch === 'Rainy') {
      weatherCandidates = list.filter(p => p.isRain);
      console.log(`Smart Photo [Weather]: Rainy conditions active. Matching rainy photos: ${weatherCandidates.length}`);
    } else {
      // If the physical weather is Clear or Cloudy, we fuse it with news sentiment!
      // News sentiment weather is either Rainy, Cloudy, or Sunny.
      const targetMatch = newsMatch; 
      if (targetMatch === 'Rainy') {
        weatherCandidates = list.filter(p => p.isRain || p.isCloudy);
        console.log(`Smart Photo [News-Weather Fusion]: News sentiment is stormy/tense -> matching Rainy/Moody photos: ${weatherCandidates.length}`);
      } else if (targetMatch === 'Sunny') {
        weatherCandidates = list.filter(p => p.isSunny);
        console.log(`Smart Photo [News-Weather Fusion]: News sentiment is positive/sunny -> matching Sunny photos: ${weatherCandidates.length}`);
      } else {
        weatherCandidates = list.filter(p => p.isCloudy);
        console.log(`Smart Photo [News-Weather Fusion]: News sentiment is neutral/calm -> matching Cloudy/Moody photos: ${weatherCandidates.length}`);
      }
    }

    // Apply with a 80% preference probability to maintain some surprise/variety
    if (weatherCandidates.length > 0 && Math.random() < 0.8) {
      candidates = weatherCandidates;
    }
  }

  // 2. Time of day alignment (shows evening/night photos at night based on slider percentage)
  if (screensaverState.alignTimeOfDay && isNight) {
    const nightPhotos = candidates.filter(p => p.isNight);
    const nightThreshold = (screensaverState.nightPercentage || 50) / 100;
    if (nightPhotos.length > 0 && Math.random() < nightThreshold) {
      candidates = nightPhotos;
      console.log(`Smart Photo [Time]: Time alignment active (Night, Ratio=${screensaverState.nightPercentage}%). Matching night photos: ${nightPhotos.length}`);
    }
  }

  if (candidates.length > 0) {
    // If we narrowed down the list, select a random candidate from that narrowed atmospheric subset
    if (candidates.length < list.length) {
      const randIdx = Math.floor(Math.random() * candidates.length);
      return candidates[randIdx];
    } else {
      // Regular sequential fallback if no atmospheric filtering happened
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

// Background daily updater of high quality multi-source photographs
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

if (process.env.NODE_ENV !== 'test') {
  // Trigger initial update shortly after launch (delayed 5s to avoid locking startup CPU)
  setTimeout(() => {
    updateFeedsDaily().catch(err => console.error('Error in initial feed update:', err));
  }, 5000);

  // Schedule daily updates checks (every 4 hours to verify 24h delta)
  setInterval(() => {
    updateFeedsDaily().catch(err => console.error('Error in scheduled feed update:', err));
  }, 4 * 60 * 60 * 1000);
}

// Fetch live weather from free Open-Meteo API
app.get('/api/weather', async (req, res) => {
  if (serverWeatherData) {
    return res.json(serverWeatherData);
  }
  try {
    const loc = await getIpLocation();
    const weatherData = await fetchWeatherForecast(loc.lat, loc.lon);
    
    serverWeatherData = {
      location: loc,
      current: weatherData.current,
      daily: weatherData.daily
    };
    res.json(serverWeatherData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather data', message: error.message });
  }
});

// Serve highly curated majestic images locally
app.get('/api/photos', async (req, res) => {
  let { category } = req.query;
  
  try {
    if (category) {
      // Split the category parameter by commas to support combined feeds
      const selectedCategories = category.split(',').map(c => {
        let catName = c.trim();
        if (catName === 'Liminal Space' || catName === 'Liminal Spaces') {
          return 'Liminal Spaces';
        }
        if (catName === 'AI Creation' || catName === 'AI Creations') {
          return 'AI Creations';
        }
        return catName;
      });

      const validCategories = selectedCategories.filter(catName => !!curatedCollections[catName]);

      if (validCategories.length > 0) {
        screensaverState.currentCategory = validCategories.join(',');
        screensaverState.photosList = combineFeedsBalanced(validCategories, curatedCollections);
        
        // Immediately pick a smart starting photo from the newly selected category
        const smartPhoto = getSmartPhoto('next');
        if (smartPhoto) {
          screensaverState.activePhoto = smartPhoto;
        } else if (screensaverState.photosList.length > 0) {
          screensaverState.activePhoto = screensaverState.photosList[Math.floor(Math.random() * screensaverState.photosList.length)];
        }
        
        // Broadcast unified state-sync to all clients to keep remote and TV dashboard highlighted perfectly
        io.emit('state-sync', screensaverState);
      }
    }
    
    // For the JSON response:
    // Serve the balanced and randomized combined photos list
    const currentCats = screensaverState.currentCategory ? screensaverState.currentCategory.split(',') : [];
    const responsePhotos = combineFeedsBalanced(currentCats, curatedCollections);
    res.json(responsePhotos.length > 0 ? responsePhotos : (curatedCollections['Scenic Nature'] || []));
  } catch (error) {
    console.error('Failed to fetch photos from curated list', error.message);
    res.json(curatedCollections['Scenic Nature']);
  }
});

// Get local network IP addresses for QR code mapping
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

app.get('/api/config', (req, res) => {
  res.json({
    localIps: getLocalIpAddresses(),
    port: PORT,
    state: screensaverState
  });
});

// Socket.IO sync logic
io.on('connection', (socket) => {
  console.log('Device connected to Lumina network:', socket.id);
  
  // Sync immediately on connect
  socket.emit('state-sync', screensaverState);
  socket.emit('ip-info', {
    localIps: getLocalIpAddresses(),
    port: PORT
  });
  
  // Toggle Widget event
  socket.on('toggle-widget', ({ widgetName, visible }) => {
    if (screensaverState.widgets[widgetName] !== undefined) {
      screensaverState.widgets[widgetName] = visible;
      io.emit('state-sync', screensaverState);
    }
  });

  // Client media loading failure notifier (Self-Healing Alert Trigger)
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
    
    // Split the category parameter by commas to support combined feeds
    const selectedCategories = category.split(',').map(c => {
      let catName = c.trim();
      if (catName === 'Liminal Space' || catName === 'Liminal Spaces') {
        return 'Liminal Spaces';
      }
      if (catName === 'AI Creation' || catName === 'AI Creations') {
        return 'AI Creations';
      }
      return catName;
    });

    const validCategories = selectedCategories.filter(catName => !!curatedCollections[catName]);

    if (validCategories.length > 0) {
      screensaverState.currentCategory = validCategories.join(',');
      screensaverState.photosList = combineFeedsBalanced(validCategories, curatedCollections);
      
      // Immediately pick a smart photo from the newly selected category to display
      const smartPhoto = getSmartPhoto('next');
      if (smartPhoto) {
        screensaverState.activePhoto = smartPhoto;
        console.log(`[SOCKET EVENT] Selected smart starting photo: "${smartPhoto.title}"`);
      } else if (screensaverState.photosList.length > 0) {
        screensaverState.activePhoto = screensaverState.photosList[Math.floor(Math.random() * screensaverState.photosList.length)];
        console.log(`[SOCKET EVENT] Selected random starting photo: "${screensaverState.activePhoto.title}"`);
      }
      
      console.log(`[SOCKET EVENT] Broadcasting state-sync with categories: "${screensaverState.currentCategory}"`);
      io.emit('state-sync', screensaverState);
    } else {
      console.error(`[SOCKET EVENT] ERROR: None of the categories in "${category}" exist in curatedCollections keys:`, Object.keys(curatedCollections));
    }
  });

  // Toggle time of day alignment
  socket.on('toggle-align-time', (enabled) => {
    screensaverState.alignTimeOfDay = enabled;
    console.log(`Align Time of Day changed to: ${enabled}`);
    io.emit('state-sync', screensaverState);
  });

  // Toggle weather alignment
  socket.on('toggle-align-weather', (enabled) => {
    screensaverState.alignWeather = enabled;
    console.log(`Align Weather changed to: ${enabled}`);
    io.emit('state-sync', screensaverState);
  });

  // Change night photo percentage selection
  socket.on('change-night-percentage', (percentage) => {
    if (typeof percentage === 'number' && percentage >= 0 && percentage <= 100) {
      screensaverState.nightPercentage = percentage;
      console.log(`Night Photo Percentage changed to: ${percentage}%`);
      io.emit('state-sync', screensaverState);
    }
  });

  // Change slideshow transition interval
  socket.on('change-interval', (intervalMs) => {
    if (intervalMs && typeof intervalMs === 'number') {
      screensaverState.slideshowInterval = intervalMs;
      io.emit('state-sync', screensaverState);
    }
  });

  // Change individual active photo
  socket.on('set-active-photo', (photo) => {
    screensaverState.activePhoto = photo;
    io.emit('photo-update', photo);
  });
  
  // Trigger Next Photo
  socket.on('next-photo', () => {
    const photo = getSmartPhoto('next');
    if (photo) {
      screensaverState.activePhoto = photo;
      io.emit('photo-update', screensaverState.activePhoto);
    }
  });

  // Trigger Prev Photo
  socket.on('prev-photo', () => {
    const photo = getSmartPhoto('prev');
    if (photo) {
      screensaverState.activePhoto = photo;
      io.emit('photo-update', screensaverState.activePhoto);
    }
  });

  // Update Mood Theme
  socket.on('change-theme', (themeName) => {
    screensaverState.theme = themeName;
    io.emit('state-sync', screensaverState);
  });

  // Update screensaver active state
  socket.on('set-screensaver-active', (active) => {
    if (active) {
      manualOverride = true;
      if (!isBrowserRunning) {
        launchKioskBrowser();
      }
    } else {
      manualOverride = false;
      if (isBrowserRunning) {
        killKioskBrowser();
      }
    }
    screensaverState.screensaverActive = active;
    io.emit('state-sync', screensaverState);
  });
  
  socket.on('disconnect', () => {
    console.log('Device disconnected:', socket.id);
  });
});

// --- SYSTEM-WIDE SCREENSAVER DAEMON LOGIC ---
let isBrowserRunning = false;
let manualOverride = false;

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

if (process.env.NODE_ENV !== 'test') {
  // Mutter DBus Idle polling every 2 seconds
  setInterval(async () => {
    try {
      const idleMs = await getGnomeIdleTime();
      const isIdle = idleMs >= screensaverState.inactivityTimeout;
      const isMoviePlaying = await isAudioPlaying();

      // Screensaver activates if system is idle AND no movie is playing (unless manually forced)
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
      // Fallback if not running GNOME core session or D-Bus is unavailable
    }
  }, 2000);
}


let PORT = process.env.PORT || 5000;

// Port Conflict Interceptor (Self-Healing Network Listener)
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

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Lumina Core backend running at http://localhost:${PORT}`);
    console.log(`Mobile Remote accessible at your local network IPs:`);
    getLocalIpAddresses().forEach(ip => console.log(`  http://${ip}:${PORT}`));
  });
}

// Export internal functions for unit testing in test environments
module.exports = {
  tagPhotosWithKeywords,
  getSmartPhoto,
  screensaverState,
  curatedCollections,
  updateNewsSentiment,
  updateServerWeather
};
