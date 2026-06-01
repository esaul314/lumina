/**
 * 🌌 screensaverState
 * Central reactive configuration state of the Lumina smart display network.
 * Synchronized in real-time with both screensaver client and remote control view.
 */
const screensaverState = {
  activePhoto: null,
  currentCategory: 'Scenic Nature',
  theme: 'Zen Retreat', // Zen Retreat, Cosmic Night, Art Museum, Cyberpunk Rain
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
  visionConfig: {
    apiUrl: '',
    apiKey: '',
    model: '',
    fallbackUrl: '',
    fallbackApiKey: '',
    fallbackModel: ''
  },
  nightPercentage: 50,
  searchKeywords: {
    'Scenic Nature': ['scenic nature landscape mountains forest'],
    'Cosmic Space': ['cosmic space nebula galaxy stars'],
    'Abstract Art': ['abstract art painting minimalist geometric'],
    'Liminal Spaces': ['liminal spaces empty corridor backrooms'],
    'AI Creations': ['surreal digital art generative midjourney cyberpunk futuristic']
  },
  autoLocation: false,
  manualLocation: {
    lat: 45.45,
    lon: -73.56,
    city: 'Verdun',
    regionName: 'Quebec',
    country: 'Canada'
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

module.exports = { screensaverState };
