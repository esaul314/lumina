const config = require('./configLoader.js');

function collectKeywordStrings(kws) {
  if (Array.isArray(kws)) {
    return kws.flatMap(item => {
      if (typeof item === 'string') {
        return [item];
      }
      if (item && typeof item === 'object') {
        const itemKws = Array.isArray(item.keywords) ? item.keywords : [item.keywords];
        return itemKws.filter(kw => typeof kw === 'string');
      }
      return [];
    });
  }
  return typeof kws === 'string' ? [kws] : [];
}

function buildFeedConfigsFromKeywords(keywordsMap) {
  const configs = {};
  for (const [category, kws] of Object.entries(keywordsMap)) {
    const keywords = collectKeywordStrings(kws);
    configs[category] = {
      unsplash: { enabled: true, keywords: [...keywords] },
      wallhaven: { enabled: true, keywords: [...keywords] },
      tumblrTags: { enabled: false, tags: [...keywords] }
    };
    
    // Add default integrations for built-in categories
    if (category === 'Scenic Nature') {
      configs[category].reddit = { enabled: true, subreddits: ['EarthPorn', 'landscapephotography'] };
      configs[category].tumblr = { enabled: true, blogs: ['scenic-nature-lands', 'earthlandscape', 'nature-scenery'] };
      configs[category].tumblrTags = { enabled: false, tags: ['landscape', 'nature', 'mountains'] };
      configs[category].picsum = { enabled: true };
      configs[category].bing = { enabled: true };
    } else if (category === 'Cosmic Space') {
      configs[category].reddit = { enabled: true, subreddits: ['spaceporn', 'Astrophotography'] };
      configs[category].tumblr = { enabled: true, blogs: ['nasaimages', 'cosmic-space-explorer'] };
      configs[category].tumblrTags = { enabled: false, tags: ['space', 'nebula', 'astrophotography'] };
      configs[category].nasaApod = { enabled: true };
    } else if (category === 'Abstract Art') {
      configs[category].tumblr = { enabled: true, blogs: ['abstractartgallery', 'generative-art'] };
      configs[category].tumblrTags = { enabled: false, tags: ['abstract', 'generative art', 'minimalism'] };
    } else if (category === 'Liminal Spaces') {
      configs[category].tumblr = { enabled: true, blogs: ['liminal-spaces', 'emptycorridors'] };
      configs[category].tumblrTags = { enabled: false, tags: ['liminal spaces', 'empty rooms', 'backrooms'] };
    } else if (category === 'AI Creations') {
      configs[category].tumblr = { enabled: true, blogs: ['aiartgenerator', 'midjourneycreations'] };
      configs[category].tumblrTags = { enabled: false, tags: ['ai art', 'midjourney', 'surreal landscape'] };
      configs[category].midjourney = { enabled: true };
    }
  }
  return configs;
}

const defaultKeywords = {
  'Scenic Nature': ['scenic nature landscape mountains forest'],
  'Cosmic Space': ['cosmic space nebula galaxy stars'],
  'Abstract Art': ['abstract art painting minimalist geometric'],
  'Liminal Spaces': ['liminal spaces empty corridor backrooms'],
  'AI Creations': ['surreal digital art generative midjourney cyberpunk futuristic']
};

let _activePhoto = null;

/**
 * 🌌 screensaverState
 * Central reactive configuration state of the Lumina smart display network.
 * Synchronized in real-time with both screensaver client and remote control view.
 */
const screensaverState = {
  get activePhoto() {
    return _activePhoto;
  },
  set activePhoto(val) {
    _activePhoto = val;
    this.activeSecondPhoto = null;
  },
  activeSecondPhoto: null,
  currentCategory: 'Scenic Nature',
  theme: 'Zen Retreat', // Zen Retreat, Cosmic Night, Art Museum, Cyberpunk Rain
  scaleMode: 'cover',
  splitPortrait: false,
  splitCropPercent: 50,
  widgets: {
    clock: true,
    weather: true,
    particles: false,  // Default: Low Power Mode
    auraglow: false,   // Default: Low Power Mode
    animations: false  // Default: Low Power Mode (0% CPU)
  },
  photosList: [],
  inactivityTimeout: 600000, // 10 minutes
  screensaverActive: false,
  slideshowInterval: 120000, // 2 minutes
  alignTimeOfDay: false,     // evening/night image alignment
  alignWeather: false,       // rainy image alignment
  allowOpenAiFallback: false, // strict token budget consent gate
  nightPercentage: 50,
  searchKeywords: { ...defaultKeywords },
  feedConfigs: buildFeedConfigsFromKeywords(defaultKeywords),
  excludedKeywords: [],
  autoLocation: false,
  manualLocation: {
    ...config.location
  },
  newsSentiment: {
    score: 0,
    label: 'Overcast / Calm',
    weatherMatch: 'Cloudy',
    headlinesCount: 0
  },
  physicalWeather: {
    temp: 15,
    condition: 'Cloudy / Overcast',
    weatherMatch: 'Cloudy'
  }
};

module.exports = { screensaverState, buildFeedConfigsFromKeywords };
