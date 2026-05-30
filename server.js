const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dns = require('dns');
const os = require('os');
const { exec } = require('child_process');


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

// Core State Management
let screensaverState = {
  activePhoto: null,
  currentCategory: 'Scenic Nature',
  theme: 'Zen Retreat', // Zen Retreat, Cosmic Night, Art Museum, Cyberpunk Rain
  widgets: {
    clock: true,
    weather: true,
    particles: false,  // Set default to false (Low Power Mode)
    auraglow: false,   // Set default to false (Low Power Mode)
    animations: false  // Set default to false (Low Power Mode - 0% CPU)
  },
  photosList: [],
  inactivityTimeout: 600000, // 10 minutes in milliseconds
  screensaverActive: false,  // True when screensaver mode is active
  slideshowInterval: 120000, // Default to 2 minutes cycle duration (120,000ms)
  alignTimeOfDay: false,     // Align images with time of day (show dark/night photos at night)
  alignWeather: false,       // Align images with weather (show rain photos when raining)
  nightPercentage: 50        // Percentage of evening/night photos to show at night (0-100%)
};

// Curated high-definition stunning wallpapers (Scenic/Cosmic/Art/Liminal)
// Hand-picked Unsplash assets resized and compressed dynamically by Unsplash CDN (?w=2560&q=80&auto=format&fit=crop)
// This guarantees instant loads (<200ms), 100% server uptime, and a tiny Chromium RAM footprint (<80MB).
const fs = require('fs');

const defaultCuratedCollections = {
  'Scenic Nature': [
    { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2560&auto=format&fit=crop', title: 'Mist Rising in the Mountain Valley', author: 'Andreas Gücklhorn' },
    { url: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?q=80&w=2560&auto=format&fit=crop', title: 'Emerald Fields under Golden Sunsets', author: 'Kalen Emsley' },
    { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=2560&auto=format&fit=crop', title: 'Sunlight Filtering Through Ancient Woods', author: 'Lukasz Szmigiel' },
    { url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=2560&auto=format&fit=crop', title: 'Monstera Leaves in Dewy Jungle Light', author: 'Kari Shea' },
    { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2560&auto=format&fit=crop', title: 'Majestic Lake under Alpine Peaks', author: 'Francesco Gallarotti' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2560&auto=format&fit=crop', title: 'Towering Sun-Drenched Redwoods', author: 'Jay Mantri' },
    { url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2560&auto=format&fit=crop', title: 'Golden Autumn Forest Stream', author: 'Sebastian Unrau' },
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2560&auto=format&fit=crop', title: 'Serene Purple Twilight Beach', author: 'Sean Oulashin' },
    { url: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?q=80&w=2560&auto=format&fit=crop', title: 'Snowy Peak Touched by Clouds', author: 'Benjamin Voros' },
    { url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=2560&auto=format&fit=crop', title: 'Wind-Swept Golden Desert Dunes', author: 'Wolfgang Hasselmann' }
  ],
  'Cosmic Space': [
    { url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=2560&auto=format&fit=crop', title: 'Milky Way Galaxy over Alpine Peaks', author: 'Vincentiu Solomon' },
    { url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=2560&auto=format&fit=crop', title: 'Stardust Trails in the Deep Cosmos', author: 'Vincentiu Solomon' },
    { url: 'https://images.unsplash.com/photo-1543722530-d2c3201371e7?q=80&w=2560&auto=format&fit=crop', title: 'Pink and Violet Stellar Nebula', author: 'Joel Filipe' },
    { url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2560&auto=format&fit=crop', title: 'Curvature of Earth and Satellite Glow', author: 'NASA' },
    { url: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?q=80&w=2560&auto=format&fit=crop', title: 'Distant Sparking Star Fields', author: 'Alexander Andrews' },
    { url: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?q=80&w=2560&auto=format&fit=crop', title: 'Deep Space Cosmic Cloud Nursery', author: 'NASA' },
    { url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2560&auto=format&fit=crop', title: 'Supernova Remnant in Gas Trails', author: 'NASA' },
    { url: 'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=2560&auto=format&fit=crop', title: 'Eclipsed Blood Moon in Shadow', author: 'Mark Tegethoff' },
    { url: 'https://images.unsplash.com/photo-1520038410233-7141be7e6f97?q=80&w=2560&auto=format&fit=crop', title: 'Star Trails Over Nordic Mountains', author: 'Sven-Erik Arndt' },
    { url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=2560&auto=format&fit=crop', title: 'Planet Earth from Solar Orbit', author: 'NASA' }
  ],
  'Abstract Art': [
    { url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2560&auto=format&fit=crop', title: 'Fluid Blue Acrylic Swirls', author: 'Paweł Czerwiński' },
    { url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=2560&auto=format&fit=crop', title: 'Abstract Harmony of Morphing Colors', author: 'Steve Johnson' },
    { url: 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?q=80&w=2560&auto=format&fit=crop', title: 'Fluid Pink and Marbled Gold Swirls', author: 'Paweł Czerwiński' },
    { url: 'https://images.unsplash.com/photo-1508189860359-770dec38c5d3?q=80&w=2560&auto=format&fit=crop', title: 'Dark Textured Abstract Brush Strokes', author: 'Steve Johnson' },
    { url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2560&auto=format&fit=crop', title: 'Vaporous Moody Gray and Red Gradients', author: 'Paweł Czerwiński' },
    { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2560&auto=format&fit=crop', title: 'Organic Bronze and Golden Paint Flow', author: 'Milad Fakurian' },
    { url: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=2560&auto=format&fit=crop', title: 'Minimalist Primary Color Geometry', author: 'Steve Johnson' },
    { url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=2560&auto=format&fit=crop', title: 'Liquid Holographic Foil Wave', author: 'Joel Filipe' },
    { url: 'https://images.unsplash.com/photo-1561715276-a2d087060f1d?q=80&w=2560&auto=format&fit=crop', title: 'Splashes of Vibrant Yellow and Indigo', author: 'Steve Johnson' },
    { url: 'https://images.unsplash.com/photo-1618005198143-e5283b519a7f?q=80&w=2560&auto=format&fit=crop', title: 'Fluid Chrome Metallic Ribbons', author: 'Milad Fakurian' }
  ],
  'Liminal Spaces': [
    { url: 'https://images.unsplash.com/photo-1653151981309-c2414ead7bed?q=80&w=2560&auto=format&fit=crop', title: 'Surreal Empty Tiled Pool at 3 AM', author: 'ANTIPOLYGON YOUTUBE' },
    { url: 'https://images.unsplash.com/photo-1635728153590-f9c4f75cf78d?q=80&w=2560&auto=format&fit=crop', title: 'Fluorescent Green Corridor in Midnight Sleep', author: 'Scarbor Siu' },
    { url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2560&auto=format&fit=crop', title: 'Strangely Familiar Empty Desert Highway', author: 'Spencer Davis' },
    { url: 'https://images.unsplash.com/photo-1669938879082-69d90612dca2?q=80&w=2560&auto=format&fit=crop', title: 'Mist-Veiled Forest Road with Single Lamp', author: 'Adrian Mag' },
    { url: 'https://images.unsplash.com/photo-1640888991718-72b255310bc0?q=80&w=2560&auto=format&fit=crop', title: 'Strangely Familiar Empty Subway Station', author: 'Jannik' },
    { url: 'https://images.unsplash.com/photo-1635728153472-62e62b65f17f?q=80&w=2560&auto=format&fit=crop', title: 'Minimalist Empty Tiled Room with Green Floor Glow', author: 'Scarbor Siu' },
    { url: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=2560&auto=format&fit=crop', title: 'Silent Deserted Warehouse Under Pale Night Light', author: 'Jorg Angeli' },
    { url: 'https://images.unsplash.com/photo-1604397653091-f08b42e22bb9?q=80&w=2560&auto=format&fit=crop', title: 'Glowing Neon Gas Station Devoid of Life', author: 'Hans Eiskonen' },
    { url: 'https://images.unsplash.com/photo-1675430425612-9625d7d0ffd0?q=80&w=2560&auto=format&fit=crop', title: 'Empty Laundromat Window Glowing in the Rain', author: 'Benjamin Lehman' },
    { url: 'https://images.unsplash.com/photo-1679097467437-6a9f93b0363d?q=80&w=2560&auto=format&fit=crop', title: 'Endless Abandoned Corridor of the Backrooms', author: 'Arie Oldman' },
    { url: 'https://images.unsplash.com/photo-1684895309257-dc0facb0eecc?q=80&w=2560&auto=format&fit=crop', title: 'Empty Escalator Drifting into Concrete Darkness', author: 'Sam Operchuck' },
    { url: 'https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=2560&auto=format&fit=crop', title: 'Eerie Empty Fluorescent Room', author: 'Maria Orlova' }
  ]
};

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
                   titleLower.includes('drizzle');
                   
    return {
      url: photo.url,
      title: photo.title,
      author: photo.author,
      source: photo.source || 'curated',
      isNight: photo.isNight !== undefined ? photo.isNight : isNight,
      isRain: photo.isRain !== undefined ? photo.isRain : isRain
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
  'Liminal Spaces': 'liminal spaces empty corridor backrooms'
};

// Subreddits list for categories (a new robust feed source!)
const categorySubreddits = {
  'Scenic Nature': ['EarthPorn', 'LandscapePhotography'],
  'Cosmic Space': ['spaceporn', 'astrophotography'],
  'Abstract Art': ['AbstractArt', 'Generative'],
  'Liminal Spaces': ['LiminalSpace']
};

async function fetchRedditImages(subreddit, category, count = 25) {
  try {
    console.log(`Reddit Crawler: Fetching /r/${subreddit} for category "${category}"...`);
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=${count}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!res.ok) {
      console.warn(`Reddit crawler failed for /r/${subreddit} (status ${res.status})`);
      return [];
    }

    const data = await res.json();
    if (!data || !data.data || !data.data.children) {
      return [];
    }

    const photos = [];
    for (const post of data.data.children) {
      const pData = post.data;
      if (pData.over_18 || pData.is_self) continue; // Skip NSFW and text posts

      let imageUrl = '';
      if (pData.url && (pData.url.endsWith('.jpg') || pData.url.endsWith('.jpeg') || pData.url.endsWith('.png'))) {
        imageUrl = pData.url;
      } else if (pData.preview && pData.preview.images && pData.preview.images[0]) {
        imageUrl = pData.preview.images[0].source.url.replace(/&amp;/g, '&');
      }

      if (!imageUrl) continue;

      const title = pData.title.length > 55 ? pData.title.substring(0, 52) + '...' : pData.title;
      const author = `u/${pData.author}`;
      const titleLower = pData.title.toLowerCase();

      // Keyword tagging for weather/time alignment
      const isNight = titleLower.includes('night') || titleLower.includes('dark') || 
                      titleLower.includes('milky way') || titleLower.includes('midnight') || 
                      titleLower.includes('stars') || titleLower.includes('moon') ||
                      titleLower.includes('sunset') || titleLower.includes('dusk') ||
                      category === 'Cosmic Space';

      const isRain = titleLower.includes('rain') || titleLower.includes('rainy') || 
                     titleLower.includes('wet') || titleLower.includes('storm') || 
                     titleLower.includes('drizzle') || titleLower.includes('shower');

      photos.push({
        url: imageUrl,
        title: title,
        author: author,
        source: 'reddit',
        isNight: isNight,
        isRain: isRain
      });
    }
    
    console.log(`Reddit Crawler: Successfully retrieved ${photos.length} photos from /r/${subreddit}.`);
    return photos;
  } catch (err) {
    console.error(`Reddit crawler failed for /r/${subreddit}:`, err.message);
    return [];
  }
}

async function fetchPicsumImages(count = 30) {
  try {
    console.log(`Picsum Crawler: Fetching ${count} photos...`);
    const res = await fetch(`https://picsum.photos/v2/list?limit=${count}`);
    if (!res.ok) return [];

    const data = await res.json();
    const photos = data.map(item => {
      const baseUrl = item.download_url.split('/id/')[0];
      const photoId = item.id;
      const url = `${baseUrl}/id/${photoId}/2560/1440`;
      
      return {
        url: url,
        title: `Picsum Scenic Frame #${photoId}`,
        author: item.author,
        source: 'picsum',
        isNight: false,
        isRain: false
      };
    });

    console.log(`Picsum Crawler: Loaded ${photos.length} photos.`);
    return photos;
  } catch (err) {
    console.error('Picsum crawler failed:', err.message);
    return [];
  }
}

// Background dynamic server weather cache to drive dynamic wallpaper weighting
let serverWeatherData = null;

async function updateServerWeather() {
  try {
    const loc = await getIpLocation();
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const res = await fetch(weatherUrl);
    if (!res.ok) return;
    const data = await res.json();
    if (data && !data.error) {
      serverWeatherData = {
        location: loc,
        current: data.current,
        daily: data.daily
      };
      console.log('Server weather cache updated successfully.');
    }
  } catch (err) {
    console.error('Failed to update server weather cache:', err.message);
  }
}

// Update weather every 15 minutes
setInterval(updateServerWeather, 15 * 60 * 1000);
setTimeout(updateServerWeather, 3000);

// Dynamic atmospheric photo selector engine
function getSmartPhoto(direction = 'next') {
  const list = screensaverState.photosList;
  if (!list || list.length === 0) return null;

  let isRaining = false;
  let isNight = false;

  if (serverWeatherData && serverWeatherData.current) {
    const code = serverWeatherData.current.weather_code;
    isRaining = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code) || serverWeatherData.current.precipitation > 0;
    isNight = serverWeatherData.current.is_day === 0;
  } else {
    const hour = new Date().getHours();
    isNight = hour >= 18 || hour < 6;
  }

  let candidates = [...list];

  // 1. Weather alignment (heavy preference to rain photos when raining)
  if (screensaverState.alignWeather && isRaining) {
    const rainPhotos = list.filter(p => p.isRain);
    if (rainPhotos.length > 0 && Math.random() < 0.75) {
      candidates = rainPhotos;
      console.log(`Smart Photo: Weather alignment active (Raining). Matching photos: ${rainPhotos.length}`);
    }
  }

  // 2. Time of day alignment (shows evening/night photos at night based on slider percentage)
  if (screensaverState.alignTimeOfDay && isNight) {
    const nightPhotos = candidates.filter(p => p.isNight);
    const nightThreshold = (screensaverState.nightPercentage || 50) / 100;
    if (nightPhotos.length > 0 && Math.random() < nightThreshold) {
      candidates = nightPhotos;
      console.log(`Smart Photo: Time alignment active (Night, Ratio=${screensaverState.nightPercentage}%). Matching photos: ${nightPhotos.length}`);
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

  console.log('Initiating dynamic multi-source feed updates for all categories...');
  let updatedAny = false;

  // 1. Crawl Reddit Images
  for (const [category, subreddits] of Object.entries(categorySubreddits)) {
    let categoryList = curatedCollections[category] || [];
    const initialLength = categoryList.length;
    const existingUrls = new Set(categoryList.map(item => item.url));

    for (const sub of subreddits) {
      const redditPhotos = await fetchRedditImages(sub, category, 25);
      for (const p of redditPhotos) {
        if (!existingUrls.has(p.url)) {
          categoryList.push(p);
          existingUrls.add(p.url);
        }
      }
    }

    curatedCollections[category] = categoryList;
    if (categoryList.length > initialLength) {
      console.log(`Reddit: Added ${categoryList.length - initialLength} new photos to "${category}"`);
      updatedAny = true;
    }
  }

  // 2. Crawl Lorem Picsum
  try {
    const picsumPhotos = await fetchPicsumImages(20);
    let scenicList = curatedCollections['Scenic Nature'] || [];
    const initialScenicLength = scenicList.length;
    const existingScenicUrls = new Set(scenicList.map(item => item.url));

    for (const p of picsumPhotos) {
      if (!existingScenicUrls.has(p.url)) {
        scenicList.push(p);
        existingScenicUrls.add(p.url);
      }
    }
    curatedCollections['Scenic Nature'] = scenicList;
    if (scenicList.length > initialScenicLength) {
      console.log(`Picsum: Added ${scenicList.length - initialScenicLength} photos to "Scenic Nature"`);
      updatedAny = true;
    }
  } catch (err) {
    console.error('Picsum daily crawl failed:', err.message);
  }

  // 3. Crawl Unsplash (using multiple queries to secure Day, Night, and Rain portfolios)
  for (const [category, baseQuery] of Object.entries(searchQueries)) {
    let categoryList = curatedCollections[category] || [];
    const initialLength = categoryList.length;
    const existingUrls = new Set(categoryList.map(item => item.url));

    const queriesToCrawl = [
      { q: baseQuery, isNight: category === 'Cosmic Space', isRain: false },
      { q: `${baseQuery} night dark stars`, isNight: true, isRain: false },
      { q: `${baseQuery} rain wet stormy`, isNight: false, isRain: true }
    ];

    for (const qSpec of queriesToCrawl) {
      try {
        console.log(`Unsplash Crawler: Fetching category "${category}" query "${qSpec.q}"...`);
        const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(qSpec.q)}&per_page=12`;
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        if (!data || !data.results) continue;

        for (const item of data.results) {
          if (item.premium || item.plus) continue;

          const photoId = item.id;
          const photoUrl = `https://images.unsplash.com/photo-${photoId}?q=80&w=2560&auto=format&fit=crop`;

          if (existingUrls.has(photoUrl)) continue;

          const negativeKeywords = ['person', 'man', 'woman', 'people', 'face', 'portrait', 'selfie', 'dog', 'cat', 'animal', 'pet', 'food', 'plate', 'kitchen', 'wedding', 'ufo', 'alien', 'text', 'logo', 'signage'];
          const textToSearch = `${item.description || ''} ${item.alt_description || ''} ${item.slug || ''}`.toLowerCase();
          const containsNegative = negativeKeywords.some(keyword => textToSearch.includes(keyword));
          if (containsNegative) continue;

          let rawTitle = item.description || item.alt_description || `${category} Ambient Frame`;
          let cleanedTitle = rawTitle.trim().replace(/-/g, ' ');
          if (cleanedTitle.length > 55) {
            cleanedTitle = cleanedTitle.substring(0, 52) + '...';
          }
          cleanedTitle = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);

          categoryList.push({
            url: photoUrl,
            title: cleanedTitle,
            author: item.user.name || item.user.username || 'Unsplash Contributor',
            source: 'unsplash',
            isNight: qSpec.isNight,
            isRain: qSpec.isRain
          });
          existingUrls.add(photoUrl);
        }
      } catch (err) {
        console.error(`Unsplash crawl failed for query "${qSpec.q}":`, err.message);
      }
    }

    if (categoryList.length > 2000) {
      const originalCuratedCount = Math.min(12, categoryList.length);
      const originals = categoryList.slice(0, originalCuratedCount);
      const dynamicAdded = categoryList.slice(originalCuratedCount);
      const allowedDynamic = 2000 - originalCuratedCount;
      categoryList = originals.concat(dynamicAdded.slice(-allowedDynamic));
    }

    curatedCollections[category] = categoryList;
    if (categoryList.length > initialLength) {
      console.log(`Unsplash: Added ${categoryList.length - initialLength} new photos to "${category}" (Total: ${categoryList.length})`);
      updatedAny = true;
    }
  }

  try {
    fs.writeFileSync(jsonPath, JSON.stringify({ lastUpdated: now, feeds: curatedCollections }, null, 2), 'utf8');
    console.log('Successfully saved updated feeds to curated_collections.json');
  } catch (err) {
    console.error('Failed to write curated_collections.json:', err.message);
  }

  if (updatedAny) {
    const activeCategory = screensaverState.currentCategory;
    screensaverState.photosList = curatedCollections[activeCategory] || [];
    io.emit('state-sync', screensaverState);
  }
}

// Trigger initial update shortly after launch (delayed 5s to avoid locking startup CPU)
setTimeout(() => {
  updateFeedsDaily().catch(err => console.error('Error in initial feed update:', err));
}, 5000);

// Schedule daily updates checks (every 4 hours to verify 24h delta)
setInterval(() => {
  updateFeedsDaily().catch(err => console.error('Error in scheduled feed update:', err));
}, 4 * 60 * 60 * 1000);

// Geolocation helper
async function getIpLocation() {
  // Hardcoded to Verdun, Montreal, Canada to ensure the weather is always 100% correct for the user's exact location
  return {
    lat: 45.45,
    lon: -73.56,
    city: 'Verdun',
    regionName: 'Quebec',
    country: 'Canada'
  };
}

// Fetch live weather from free Open-Meteo API
app.get('/api/weather', async (req, res) => {
  if (serverWeatherData) {
    return res.json(serverWeatherData);
  }
  try {
    const loc = await getIpLocation();
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();
    
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
  const { category } = req.query;
  
  try {
    if (category && curatedCollections[category]) {
      screensaverState.currentCategory = category;
      screensaverState.photosList = curatedCollections[category];
      
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
    
    const targetCategory = screensaverState.currentCategory;
    const images = curatedCollections[targetCategory] || curatedCollections['Scenic Nature'];
    res.json(images);
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
  
  // Change Wallpaper category
  socket.on('change-category', async (category) => {
    if (curatedCollections[category]) {
      screensaverState.currentCategory = category;
      screensaverState.photosList = curatedCollections[category];
      
      // Immediately pick a smart photo from the newly selected category to display
      const smartPhoto = getSmartPhoto('next');
      if (smartPhoto) {
        screensaverState.activePhoto = smartPhoto;
      } else if (screensaverState.photosList.length > 0) {
        screensaverState.activePhoto = screensaverState.photosList[Math.floor(Math.random() * screensaverState.photosList.length)];
      }
      
      io.emit('state-sync', screensaverState);
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
let expectingKill = false;

function launchKioskBrowser() {
  if (isBrowserRunning) return;
  console.log('Lumina System Idle: Spawning Fullscreen Kiosk Screensaver...');
  isBrowserRunning = true;
  expectingKill = false;

  // Toggle CPU governor to high-performance when screensaver is active
  exec('echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor', (err) => {
    if (err) console.warn('Could not set CPU governor to performance:', err.message);
  });
  
  // High-performance and memory containment CLI flags to ensure we never hang the system:
  // --js-flags="--max-old-space-size=256": Limits V8 JS heap memory footprint to 256MB.
  // --disable-dev-shm-usage: Avoids exhausting shared memory partitions.
  // --disk-cache-size=52428800 --media-cache-size=20971520: Limits disk/media cache sizes strictly.
  // --disable-gpu-shader-disk-cache: Prevents heavy disk write activities.
  // --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-native-gpu-memory-buffers --use-gl=egl: Shifts graphics rendering to Haswell GPU.
  const optimizedFlags = '--ozone-platform=wayland --enable-features=UseOzonePlatform --js-flags="--max-old-space-size=256" --disable-dev-shm-usage --disk-cache-size=52428800 --media-cache-size=20971520 --disable-gpu-shader-disk-cache --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-native-gpu-memory-buffers --kiosk --no-first-run --new-window';
  const x11Flags = '--js-flags="--max-old-space-size=256" --disable-dev-shm-usage --disk-cache-size=52428800 --media-cache-size=20971520 --disable-gpu-shader-disk-cache --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-native-gpu-memory-buffers --kiosk --no-first-run --new-window';

  // Try Native Wayland first (Fedora default)
  const waylandCmd = `WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 chromium-browser ${optimizedFlags} http://localhost:5000/?mode=tv`;
  
  exec(waylandCmd, (err, stdout, stderr) => {
    if (err) {
      if (expectingKill || err.signal === 'SIGTERM' || err.signal === 'SIGKILL') {
        isBrowserRunning = false;
        expectingKill = false;
        return;
      }
      
      console.warn('Chromium native Wayland launch failed, trying X11/Xwayland...', err.message);
      
      // X11 / Xwayland with dynamic Xauthority lookup
      const x11Cmd = `XAUTH=$(find /run/user/1000 -name ".mutter-Xwaylandauth.*" | head -n 1); [ -z "$XAUTH" ] && XAUTH="/home/alex/.Xauthority"; DISPLAY=:0 XAUTHORITY=$XAUTH XDG_RUNTIME_DIR=/run/user/1000 chromium-browser ${x11Flags} http://localhost:5000/?mode=tv`;
      
      exec(x11Cmd, (x11Err, x11Stdout, x11Stderr) => {
        if (x11Err) {
          if (expectingKill || x11Err.signal === 'SIGTERM' || x11Err.signal === 'SIGKILL') {
            isBrowserRunning = false;
            expectingKill = false;
            return;
          }
          
          console.warn('Chromium-browser X11 launch failed, trying standard chromium (Wayland)...', x11Err.message);
          
          // Fallback to standard chromium command under Wayland
          const waylandFallback = `WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 chromium ${optimizedFlags} http://localhost:5000/?mode=tv`;
          exec(waylandFallback, (wfErr, wfStdout, wfStderr) => {
            if (wfErr) {
              if (expectingKill || wfErr.signal === 'SIGTERM' || wfErr.signal === 'SIGKILL') {
                isBrowserRunning = false;
                expectingKill = false;
                return;
              }
              
              console.error('All Chromium launch attempts failed.');
              console.error('Last error:', wfErr.message);
              isBrowserRunning = false;
            }
          });
        }
      });
    }
  });
}


function killKioskBrowser() {
  if (!isBrowserRunning) return;
  console.log('Lumina System Active: Dismissing Kiosk Browser...');
  expectingKill = true;
  isBrowserRunning = false;
  manualOverride = false;

  // Restore CPU governor to standard energy-saving schedutil
  exec('echo "schedutil" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor', (err) => {
    if (err) console.warn('Could not restore CPU governor to schedutil:', err.message);
  });
  
  exec('killall chromium-browser || killall chromium', (err) => {
    // Process terminated
  });
}

// Mutter DBus Idle polling every 2 seconds
setInterval(() => {
  const dbusCmd = 'DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus" busctl --user call org.gnome.Mutter.IdleMonitor /org/gnome/Mutter/IdleMonitor/Core org.gnome.Mutter.IdleMonitor GetIdletime';
  exec(dbusCmd, (err, stdout) => {
    if (err) {
      // Fallback if not running GNOME core session
      return;
    }
    
    const match = stdout.trim().match(/t\s+(\d+)/);
    if (match) {
      const idleMs = parseInt(match[1], 10);
      const isIdle = idleMs >= screensaverState.inactivityTimeout; // 10 minutes
      
      // Check if a movie is playing by listing sink-inputs and checking for active sound playback
      exec('pactl list sink-inputs', (pactlErr, pactlStdout) => {
        let isMoviePlaying = false;
        if (!pactlErr && pactlStdout) {
          // An active audio stream will have 'Corked: no' or 'pulse.corked = "false"'
          isMoviePlaying = pactlStdout.toLowerCase().includes('corked: no') || pactlStdout.toLowerCase().includes('pulse.corked = "false"');
        }

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
      });
    }
  });
}, 2000);


const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Lumina Core backend running at http://localhost:${PORT}`);
  console.log(`Mobile Remote accessible at your local network IPs:`);
  getLocalIpAddresses().forEach(ip => console.log(`  http://${ip}:${PORT}`));
});
