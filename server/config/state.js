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
  nightPercentage: 50,
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
