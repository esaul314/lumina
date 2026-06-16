const fs = require('fs');
const path = require('path');

/**
 * 🖼️ defaultCuratedCollections
 * Static seed database of high-definition wallpapers.
 * Automatically categorized, optimized with Unsplash CDN formats.
 */
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
  ],
  'AI Creations': [
    { url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2560&auto=format&fit=crop', title: 'Holographic Neon Mountain Peak', author: 'Google DeepMind AI' },
    { url: 'https://images.unsplash.com/photo-1617791160505-6f006e121980?q=80&w=2560&auto=format&fit=crop', title: 'Surreal Purple Digital Dreamscape', author: 'Google DeepMind AI' },
    { url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=2560&auto=format&fit=crop', title: 'Futuristic Cyberpunk Neon Megacity', author: 'Google DeepMind AI' },
    { url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=2560&auto=format&fit=crop', title: 'Cyberpunk Anime Street in Midnight Rain', author: 'Google DeepMind AI' },
    { url: 'https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2560&auto=format&fit=crop', title: 'Abstract Floating 3D Geometries', author: 'Google DeepMind AI' }
  ]
};

/**
 * 💾 saveCuratedCollections
 * Safely saves the collections, search keywords, and location settings to disk,
 * preserving any other properties in curated_collections.json.
 */
function saveCuratedCollections(collections, state) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const rootDir = path.join(__dirname, '..', '..');
    const jsonPath = path.join(rootDir, 'curated_collections.json');
    
    let fileData = {};
    if (fs.existsSync(jsonPath)) {
      try {
        fileData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (e) {
        // ignore
      }
    }
    
    fileData.lastUpdated = Date.now();
    if (collections) {
      fileData.feeds = collections;
    }
    if (state) {
      if (state.searchKeywords) {
        fileData.searchKeywords = state.searchKeywords;
      }
      if (state.autoLocation !== undefined) {
        if (!fileData.locationSettings) fileData.locationSettings = {};
        fileData.locationSettings.autoLocation = state.autoLocation;
      }
      if (state.manualLocation) {
        if (!fileData.locationSettings) fileData.locationSettings = {};
        fileData.locationSettings.manualLocation = state.manualLocation;
      }
      if (state.feedConfigs) {
        fileData.feedConfigs = state.feedConfigs;
      }
      if (state.visionConfig) {
        fileData.visionConfig = state.visionConfig;
      }
      if (state.scaleMode) {
        fileData.scaleMode = state.scaleMode;
      }
      if (state.splitPortrait !== undefined) {
        fileData.splitPortrait = state.splitPortrait;
      }
      if (state.splitCropPercent !== undefined) {
        fileData.splitCropPercent = state.splitCropPercent;
      }
      if (state.excludedKeywords) {
        fileData.excludedKeywords = state.excludedKeywords;
      }
    }
    
    fs.writeFileSync(jsonPath, JSON.stringify(fileData, null, 2), 'utf8');
    console.log('[Collections Config] Safely persisted curated_collections.json to disk.');
  } catch (err) {
    console.error('[Collections Config] Failed to write curated_collections.json:', err.message);
  }
}

/**
 * 💾 updatePhotoRating
 * Updates the rating of a photograph by its URL across all categories, state lists, and persists to disk.
 */
function updatePhotoRating(collections, state, url, rating) {
  let found = false;

  // 1. Update in the collections database
  for (const cat of Object.keys(collections)) {
    const arr = collections[cat];
    if (Array.isArray(arr)) {
      for (const photo of arr) {
        if (photo.url === url) {
          photo.rating = rating;
          found = true;
        }
      }
    }
  }

  // 2. Update in state.photosList
  if (state && Array.isArray(state.photosList)) {
    for (const photo of state.photosList) {
      if (photo.url === url) {
        photo.rating = rating;
      }
    }
    if (rating === 1) {
      state.photosList = state.photosList.filter(p => p.url !== url);
    }
  }

  // 3. Update in state.activePhoto
  if (state && state.activePhoto && state.activePhoto.url === url) {
    state.activePhoto.rating = rating;
  }

  // 4. Save to curated_collections.json
  if (found) {
    saveCuratedCollections(collections, state);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Collections Config] Saved photo rating ${rating} to curated_collections.json for URL: ${url}`);
    }
  }

  return found;
}

/**
 * 🛑 markPhotoBroken
 * Sets photo rating to 1 and isBroken to true. Persists changes.
 */
function markPhotoBroken(collections, state, url) {
  let found = false;

  // 1. Update in the collections database
  for (const cat of Object.keys(collections)) {
    const arr = collections[cat];
    if (Array.isArray(arr)) {
      for (const photo of arr) {
        if (photo.url === url) {
          photo.rating = 1;
          photo.isBroken = true;
          found = true;
        }
      }
    }
  }

  // 2. Update in state.photosList
  if (state && Array.isArray(state.photosList)) {
    for (const photo of state.photosList) {
      if (photo.url === url) {
        photo.rating = 1;
        photo.isBroken = true;
      }
    }
    // Filter out of state.photosList
    state.photosList = state.photosList.filter(p => p.url !== url);
  }

  // 3. Update in state.activePhoto
  if (state && state.activePhoto && state.activePhoto.url === url) {
    state.activePhoto.rating = 1;
    state.activePhoto.isBroken = true;
  }

  // 4. Save to curated_collections.json
  if (found) {
    saveCuratedCollections(collections, state);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Collections Config] Marked photo as broken (rating=1, isBroken=true) for URL: ${url}`);
    }
  }

  return found;
}

/**
 * 💾 updatePhotoCrop
 * Updates the crop percentage of a photograph by its URL and persists to disk.
 */
function updatePhotoCrop(collections, state, url, cropPercent) {
  let found = false;

  // 1. Update in the collections database
  for (const cat of Object.keys(collections)) {
    const arr = collections[cat];
    if (Array.isArray(arr)) {
      for (const photo of arr) {
        if (photo.url === url) {
          photo.cropPercent = cropPercent;
          found = true;
        }
      }
    }
  }

  // 2. Update in state.photosList
  if (state && Array.isArray(state.photosList)) {
    for (const photo of state.photosList) {
      if (photo.url === url) {
        photo.cropPercent = cropPercent;
      }
    }
  }

  // 3. Update in state.activePhoto
  if (state && state.activePhoto && state.activePhoto.url === url) {
    state.activePhoto.cropPercent = cropPercent;
  }

  // 4. Save to curated_collections.json
  if (found) {
    saveCuratedCollections(collections, state);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Collections Config] Saved photo cropPercent ${cropPercent}% for URL: ${url}`);
    }
  }

  return found;
}

/**
 * 💾 updatePhotoPreventPairing
 * Updates the preventPairing flag of a photograph by its URL and persists to disk.
 */
function updatePhotoPreventPairing(collections, state, url, preventPairing) {
  let found = false;

  // 1. Update in the collections database
  for (const cat of Object.keys(collections)) {
    const arr = collections[cat];
    if (Array.isArray(arr)) {
      for (const photo of arr) {
        if (photo.url === url) {
          photo.preventPairing = !!preventPairing;
          found = true;
        }
      }
    }
  }

  // 2. Update in state.photosList
  if (state && Array.isArray(state.photosList)) {
    for (const photo of state.photosList) {
      if (photo.url === url) {
        photo.preventPairing = !!preventPairing;
      }
    }
  }

  // 3. Update in state.activePhoto
  if (state && state.activePhoto && state.activePhoto.url === url) {
    state.activePhoto.preventPairing = !!preventPairing;
  }

  // 4. Save to curated_collections.json
  if (found) {
    saveCuratedCollections(collections, state);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Collections Config] Saved photo preventPairing ${preventPairing} for URL: ${url}`);
    }
  }

  return found;
}

module.exports = { defaultCuratedCollections, updatePhotoRating, markPhotoBroken, saveCuratedCollections, updatePhotoCrop, updatePhotoPreventPairing };

