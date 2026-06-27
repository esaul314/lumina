const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('./config/configLoader.js');

// Modular config and service imports
const { sendEmailAlert } = require('./services/notifier.js');
const { screensaverState, buildFeedConfigsFromKeywords } = require('./config/state.js');
const { defaultCuratedCollections, saveCuratedCollections } = require('./config/collections.js');
const {
  setCpuGovernor,
  getGnomeIdleTime,
  isAudioPlaying,
  isSessionInhibited,
  launchChromiumKiosk,
  killChromiumKiosk
} = require('./services/system.js');
const {
  resolveActiveLocation,
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
  filter,
  reduce,
  toLower,
  includes,
  uniqBy
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
      } else {
        const usablePhotos = curatedCollections[key].filter(p => p.rating !== 1 && !p.isBroken);
        if (usablePhotos.length === 0) {
          console.warn(`Self-Healing: All photos in "${key}" are broken or banned. Re-seeding from defaults.`);
          curatedCollections[key] = [...defaultCuratedCollections[key]];
        }
      }
    }

    // Global Deduplication: Ensure each image URL is unique across all categories using functional reduce
    const seenUrls = new Set();
    let duplicatesRemoved = false;

    curatedCollections = reduce((acc, key) => {
      const list = curatedCollections[key];
      if (!Array.isArray(list)) {
        acc[key] = list;
        return acc;
      }
      const originalCount = list.length;
      const uniqueList = filter(photo => {
        if (!photo || !photo.url) return false;
        if (seenUrls.has(photo.url)) {
          duplicatesRemoved = true;
          return false;
        }
        seenUrls.add(photo.url);
        return true;
      }, list);

      if (uniqueList.length < originalCount) {
        console.log(`Global Deduplication: Cleaned ${originalCount - uniqueList.length} duplicate photos from category "${key}".`);
      }
      acc[key] = uniqueList;
      return acc;
    }, {}, Object.keys(curatedCollections));

    if (duplicatesRemoved) {
      saveCuratedCollections(curatedCollections, screensaverState);
    }

    // Make sure every photo in curatedCollections has its category attached
    for (const key of Object.keys(curatedCollections)) {
      if (Array.isArray(curatedCollections[key])) {
        curatedCollections[key] = curatedCollections[key].map(p => ({ ...p, category: key }));
      }
    }

    if (data.searchKeywords) {
      screensaverState.searchKeywords = data.searchKeywords;
    }

    if (data.feedConfigs) {
      screensaverState.feedConfigs = data.feedConfigs;
    } else if (screensaverState.searchKeywords) {
      screensaverState.feedConfigs = buildFeedConfigsFromKeywords(screensaverState.searchKeywords);
      saveCuratedCollections(curatedCollections, screensaverState);
    }

    // Restore persisted location settings so they survive server restarts
    if (data.locationSettings) {
      if (data.locationSettings.autoLocation !== undefined) {
        screensaverState.autoLocation = data.locationSettings.autoLocation;
      }
      if (data.locationSettings.manualLocation) {
        screensaverState.manualLocation = data.locationSettings.manualLocation;
      }
    }

    if (data.visionConfig) {
      screensaverState.visionConfig = data.visionConfig;
    }
    if (data.scaleMode) {
      screensaverState.scaleMode = data.scaleMode;
    }
    if (data.splitPortrait !== undefined) {
      screensaverState.splitPortrait = data.splitPortrait;
    }
    if (data.splitCropPercent !== undefined) {
      screensaverState.splitCropPercent = data.splitCropPercent;
    }
    if (data.excludedKeywords) {
      screensaverState.excludedKeywords = data.excludedKeywords;
    } else {
      screensaverState.excludedKeywords = [];
    }
    console.log('Successfully loaded persisted curated collections from file!');
  } catch (err) {
    console.error('Failed to parse curated_collections.json, falling back to defaults:', err.message);
    curatedCollections = defaultCuratedCollections;
    for (const key of Object.keys(curatedCollections)) {
      if (Array.isArray(curatedCollections[key])) {
        curatedCollections[key] = curatedCollections[key].map(p => ({ ...p, category: key }));
      }
    }
  }
} else {
  curatedCollections = defaultCuratedCollections;
  for (const key of Object.keys(curatedCollections)) {
    if (Array.isArray(curatedCollections[key])) {
      curatedCollections[key] = curatedCollections[key].map(p => ({ ...p, category: key }));
    }
  }
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

// Functional, curried helper that checks if a photo matches any excluded keyword
const matchesExclusion = curry((excludedList, photo) => {
  if (!excludedList || excludedList.length === 0) return false;
  const titleText = pipe(prop('title'), toLower)(photo);
  return excludedList.some(kw => includes(toLower(kw), titleText));
});

/**
 * 🏷&zwj; classifyAtmosphere
 * Curried classifier mapping title keywords to environmental attributes.
 */
const classifyAtmosphere = curry((defaultIsNight, photo) => ({
  isNight: photo.isNight !== undefined ? photo.isNight : (defaultIsNight || isNightPhoto(photo)),
  isRain: photo.isRain !== undefined ? photo.isRain : isRainPhoto(photo),
  isSunny: photo.isSunny !== undefined ? photo.isSunny : isSunnyPhoto(photo),
  isCloudy: photo.isCloudy !== undefined ? photo.isCloudy : isCloudyPhoto(photo),
  isSnowy: photo.isSnowy !== undefined ? photo.isSnowy : isSnowyPhoto(photo)
}));

/**
 * 🏷&zwj; tagSinglePhoto
 * Curried decorator that applies rating, isBroken, and classification to a photo.
 */
const tagSinglePhoto = curry((defaultIsNight, photo) => ({
  ...photo,
  source: photo.source || 'curated',
  rating: photo.rating !== undefined ? photo.rating : 10,
  isBroken: photo.isBroken || false,
  ...classifyAtmosphere(defaultIsNight, photo)
}));

/**
 * 🏷&zwj; tagPhotosWithKeywords
 * Declarative mapper that applies tagSinglePhoto to a photo list.
 */
function tagPhotosWithKeywords(photos, defaultIsNight = false) {
  return map(tagSinglePhoto(defaultIsNight), photos);
}

// Initial auto-tagging setup
for (const key of Object.keys(curatedCollections)) {
  const isCosmic = key === 'Cosmic Space';
  curatedCollections[key] = tagPhotosWithKeywords(curatedCollections[key], isCosmic);
}

const initialCategory = Object.keys(curatedCollections)[0] || 'Scenic Nature';
screensaverState.photosList = curatedCollections[initialCategory] ? curatedCollections[initialCategory].filter(p => p.rating !== 1 && !p.isBroken).map(p => ({ ...p, category: initialCategory })) : [];
screensaverState.activePhoto = screensaverState.photosList[0] || null;
screensaverState.hasUseApiToken = !!config.useapiToken;
const uniqByUrl = uniqBy(prop('url'));

/**
 * 🔀 shuffle
 * Pure functional wrapper for list shuffling using an immutable copy.
 */
const shuffle = (arr) => {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

/**
 * 🔀 interleave
 * Declarative interleaving of multiple lists (round-robin interleave layout).
 */
const interleave = (lists) => {
  if (lists.length === 0) return [];
  const maxLen = Math.max(...lists.map(l => l.length));
  return Array.from({ length: maxLen }).reduce((acc, _, i) => {
    lists.forEach(list => {
      acc.push(list[i % list.length]);
    });
    return acc;
  }, []);
};

/**
 * 🔄 combineFeedsBalanced
 * Combines active image feeds using a balanced round-robin interleave layout.
 */
function combineFeedsBalanced(categories, collections) {
  const lists = categories
    .map(cat => (collections[cat] || [])
      .filter(p => p.rating !== 1 && !p.isBroken && !matchesExclusion(screensaverState.excludedKeywords, p))
      .map(p => ({ ...p, category: cat }))
    )
    .filter(list => list.length > 0)
    .map(shuffle);

  if (lists.length === 0) return [];
  if (lists.length === 1) return uniqByUrl(lists[0]);

  return pipe(
    interleave,
    uniqByUrl
  )(lists);
}

/**
 * 🎯 selectWeightedRandomPhoto
 * Picks a photo from a list based on ratings. Rating=1 is blocked (Weight=0).
 * Scales ratings 2-10 linearly (2=0.2, 10=1.0).
 */
function selectWeightedRandomPhoto(photos, currentPhotoUrl = null) {
  // 1. Filter out banned images (rating = 1) and excluded images
  const activePhotos = photos.filter(p => p.rating !== 1 && !matchesExclusion(screensaverState.excludedKeywords, p));
  if (activePhotos.length === 0) return null;

  // 2. Avoid consecutive repeat if possible
  const candidatePhotos = (activePhotos.length > 1 && currentPhotoUrl)
    ? (() => {
        const withoutCurrent = activePhotos.filter(p => p.url !== currentPhotoUrl);
        return withoutCurrent.length > 0 ? withoutCurrent : activePhotos;
      })()
    : activePhotos;

  // 3. Compute cumulative weight map
  const { items: weightedItems, cumulative: totalWeight } = candidatePhotos.reduce((acc, photo) => {
    const r = photo.rating !== undefined ? photo.rating : 10;
    const w = r / 10;
    const nextCumulative = acc.cumulative + w;
    return {
      cumulative: nextCumulative,
      items: [...acc.items, { photo, threshold: nextCumulative }]
    };
  }, { cumulative: 0, items: [] });

  if (totalWeight === 0) return candidatePhotos[0];

  // 4. Random float select point
  const randomPoint = Math.random() * totalWeight;

  // 5. Cumulative distribution selector (using declarative find)
  const selected = weightedItems.find(item => item.threshold >= randomPoint);
  return selected ? selected.photo : candidatePhotos[candidatePhotos.length - 1];
}

function isTimeInSchedule(currentTimeStr, startStr, endStr) {
  const [curH, curM] = currentTimeStr.split(':').map(Number);
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);
  
  const curMinutes = curH * 60 + curM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes <= endMinutes) {
    return curMinutes >= startMinutes && curMinutes < endMinutes;
  } else {
    // Crosses midnight (e.g. 22:00 to 06:00)
    return curMinutes >= startMinutes || curMinutes < endMinutes;
  }
}

/**
 * 🕰️ filterByTime
 * Curried filter that restricts candidates based on time range schedules.
 */
const filterByTime = curry((timeStr, list) =>
  list.filter(p => !p.timeRanges || p.timeRanges.length === 0 ||
    p.timeRanges.some(tr => isTimeInSchedule(timeStr, tr.start, tr.end)))
);

/**
 * 🌦️ filterByWeather
 * Curried filter that restricts candidates to map physical weather or news sentiment.
 */
const filterByWeather = curry((alignWeather, physicalMatch, newsMatch, list) => {
  if (!alignWeather) return list;
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
  return weatherCandidates.length > 0 && Math.random() < 0.8 ? weatherCandidates : list;
});

/**
 * 🌌 filterByNight
 * Curried filter that restricts candidates based on evening/night photo ratio sliders.
 */
const filterByNight = curry((alignTimeOfDay, isNight, nightPercentage, list) => {
  if (!alignTimeOfDay || !isNight) return list;
  const nightPhotos = list.filter(p => p.isNight);
  const nightThreshold = (nightPercentage || 50) / 100;
  return nightPhotos.length > 0 && Math.random() < nightThreshold ? nightPhotos : list;
});

/**
 * 🎯 getSmartPhoto
 * Dynamic weighted select algorithm mapping physical weather & news sentiment to wallpaper lists,
 * resolved through a Cumulative Distribution Function (CDF) rating-weighted engine.
 */
function getSmartPhoto(_direction = 'next') {
  const list = screensaverState.photosList;
  if (!list || list.length === 0) return null;

  const isNight = serverWeatherData?.current
    ? serverWeatherData.current.is_day === 0
    : (() => {
        const hour = new Date().getHours();
        return hour >= 18 || hour < 6;
      })();

  const physicalMatch = screensaverState.physicalWeather?.weatherMatch || 'Cloudy';
  const newsMatch = screensaverState.newsSentiment?.weatherMatch || 'Cloudy';

  const now = new Date();
  const hourStr = String(now.getHours()).padStart(2, '0');
  const minStr = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hourStr}:${minStr}`;

  // Composed pipeline of pure functional filters
  const candidates = pipe(
    filterByTime(currentTimeStr),
    filterByWeather(screensaverState.alignWeather, physicalMatch, newsMatch),
    filterByNight(screensaverState.alignTimeOfDay, isNight, screensaverState.nightPercentage)
  )(list);

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
    const loc = await resolveActiveLocation(screensaverState);
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

const { analyzeImageContent } = require('./services/vision.js');

async function triggerImageAnalysisBackground() {
  if (process.env.NODE_ENV === 'test') return;
  console.log('[Vision Service] Starting background content analysis for curated collections...');
  
  let totalAnalyzed = 0;
  
  // Scrape through all categories
  for (const key of Object.keys(curatedCollections)) {
    const photos = curatedCollections[key];
    if (!Array.isArray(photos)) continue;
    
    for (const photo of photos) {
      if (photo.rating === 1 || photo.isBroken) continue;
      
      // Analyze actual image content
      const analysis = await analyzeImageContent(photo.url, photo.title);
      if (analysis) {
        // Update tags in collections database
        photo.isNight = analysis.isNight;
        photo.isRain = analysis.isRain;
        photo.isSunny = analysis.isSunny;
        photo.isCloudy = analysis.isCloudy;
        photo.isSnowy = analysis.isSnowy;
        totalAnalyzed++;
      }
    }
  }
  
  if (totalAnalyzed > 0) {
    console.log(`[Vision Service] Finished background image analysis. Analyzed ${totalAnalyzed} images.`);
    // Persist to curated_collections.json
    saveCuratedCollections(curatedCollections, screensaverState);
    
    // Recalculate photos list & broadcast state sync so connected TVs get aligned photos immediately!
    const activeCategory = screensaverState.currentCategory;
    const currentCats = activeCategory ? activeCategory.split(',') : [];
    const combinedPhotos = combineFeedsBalanced(currentCats, curatedCollections);
    screensaverState.photosList = combinedPhotos.length > 0 ? combinedPhotos : (curatedCollections['Scenic Nature'] || []).filter(p => p.rating !== 1 && !p.isBroken);
    io.emit('state-sync', screensaverState);
  } else {
    console.log('[Vision Service] All active images are already precisely analyzed.');
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
    } catch (e) {
      console.warn('Could not parse persisted curated collections for last update check:', e.message);
    }
  }

  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  if (now - lastUpdated < ONE_DAY && lastUpdated > 0) {
    console.log('Feeds were updated less than 24 hours ago. Skipping daily update.');
    return;
  }

  const { updatedCollections, updatedAny } = await crawlAllCollections(
    curatedCollections,
    screensaverState.feedConfigs,
    screensaverState.searchKeywords,
    screensaverState.excludedKeywords
  );
  
  if (updatedAny) {
    for (const key of Object.keys(updatedCollections)) {
      curatedCollections[key] = updatedCollections[key].map(p => ({ ...p, category: key }));
    }

    saveCuratedCollections(curatedCollections, screensaverState);

    const activeCategory = screensaverState.currentCategory;
    const currentCats = activeCategory ? activeCategory.split(',') : [];
    const combinedPhotos = combineFeedsBalanced(currentCats, curatedCollections);
    screensaverState.photosList = combinedPhotos.length > 0 ? combinedPhotos : (curatedCollections['Scenic Nature'] || []).filter(p => p.rating !== 1 && !p.isBroken).map(p => ({ ...p, category: 'Scenic Nature' }));
    io.emit('state-sync', screensaverState);
    
    // Trigger vision analysis for any new crawl results
    triggerImageAnalysisBackground().catch(err => console.error('Error in background image analysis:', err));
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

  setTimeout(() => {
    triggerImageAnalysisBackground().catch(err => console.error('Error in initial background image analysis:', err));
  }, 10000);

  setInterval(() => {
    updateFeedsDaily().catch(err => console.error('Error in scheduled feed update:', err));
  }, 4 * 60 * 60 * 1000);
}

// Subprocess State Management helpers for Sockets
let isBrowserRunning = false;
let manualOverride = false;
let PORT = config.port || 5000;

function launchKioskBrowser(forceManual = false) {
  if (forceManual) manualOverride = true;
  if (isBrowserRunning) return;
  console.log('Lumina System Idle: Spawning Fullscreen Kiosk Screensaver...');
  isBrowserRunning = true;

  setCpuGovernor('performance');
  killChromiumKiosk().then(() => {
    launchChromiumKiosk(PORT, 'tv', () => {
      isBrowserRunning = false;
      // If the browser died unexpectedly and manualOverride is still set, clear it
      // so the idle daemon can take over cleanly
      if (manualOverride) {
        manualOverride = false;
        screensaverState.screensaverActive = false;
        io.emit('state-sync', screensaverState);
      }
    });
  });
}

function killKioskBrowser(forceManual = false) {
  if (forceManual) manualOverride = false;
  if (!isBrowserRunning) return;
  console.log('Lumina System Active: Dismissing Kiosk Browser...');
  isBrowserRunning = false;

  setCpuGovernor('schedutil');
  killChromiumKiosk();
}

/** setManualOverride — lets socket handlers arm/disarm the manual override flag */
function setManualOverride(value) {
  manualOverride = !!value;
}

function getLocalIpAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface && iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address);
}

// Wire up modular controllers
const triggerWeatherUpdate = async () => {
  serverWeatherData = null; // Clear cache
  await updateServerWeather();
};

require('./routes.js')(app, screensaverState, curatedCollections, getWeatherData, setWeatherData, combineFeedsBalanced, getSmartPhoto, io, PORT, launchKioskBrowser, killKioskBrowser, setManualOverride);
require('./sockets.js')(io, screensaverState, curatedCollections, combineFeedsBalanced, getSmartPhoto, launchKioskBrowser, killKioskBrowser, setManualOverride, getLocalIpAddresses, PORT, triggerWeatherUpdate);

// Mutter DBus Idle polling every 2 seconds with audio/inhibition checks and a 6-second debounce buffer
if (process.env.NODE_ENV !== 'test') {
  let idleCounter = 0;
  setInterval(async () => {
    try {
      const idleMs = await getGnomeIdleTime();
      const isIdle = idleMs >= screensaverState.inactivityTimeout;
      const isPulseAudioPlaying = await isAudioPlaying();
      const isGnomeInhibited = await isSessionInhibited();
      const isMoviePlaying = isPulseAudioPlaying || isGnomeInhibited;

      const isActuallyIdle = isIdle && !isMoviePlaying;
      
      if (isActuallyIdle) {
        idleCounter++;
      } else {
        idleCounter = 0;
      }

      // Must be consecutively idle for at least 3 polling cycles (6 seconds) to prevent flickering/brief buffering activation
      const shouldBeActive = (idleCounter >= 3) || manualOverride;
      
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
      console.log('Mobile Remote accessible at your local network IPs:');
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
  updateServerWeather,
  triggerImageAnalysisBackground,
  combineFeedsBalanced,
  selectWeightedRandomPhoto,
  isTimeInSchedule
};
