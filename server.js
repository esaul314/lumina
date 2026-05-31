/**
 * 🌌 Lumina — Ambient Screensaver & Smart Display Entry Point
 * -----------------------------------------------------------
 * Re-structured as a thin bootstrapper facade. Sets up environment
 * parameters and launches the modular server application.
 */
require('dotenv').config();

const {
  startServer,
  tagPhotosWithKeywords,
  getSmartPhoto,
  screensaverState,
  curatedCollections,
  updateNewsSentiment,
  updateServerWeather
} = require('./server/app.js');

// Boot server daemons & listeners
startServer();

// Re-export core modules to maintain 100% backward-compatibility with existing unit/integration tests
module.exports = {
  tagPhotosWithKeywords,
  getSmartPhoto,
  screensaverState,
  curatedCollections,
  updateNewsSentiment,
  updateServerWeather
};
