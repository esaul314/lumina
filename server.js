/**
 * 🌌 Lumina — Ambient Screensaver & Smart Display Entry Point
 * -----------------------------------------------------------
 * Re-structured as a thin bootstrapper facade. Sets up environment
 * parameters and launches the modular server application.
 */
require('dotenv').config();

const {
  startServer,
  stopServer,
  server,
  tagPhotosWithKeywords,
  getSmartPhoto,
  screensaverState,
  curatedCollections,
  updateNewsSentiment,
  updateServerWeather
} = require('./server/app.js');

// Native process ownership is separate from the importable application facade.
const isEntryPoint = require.main === module;
const shutdown = (code = 0) => {
  void stopServer().then(
    () => process.exit(code),
    error => { console.error('Lumina shutdown failed:', error); process.exit(1); }
  );
};
if (isEntryPoint) {
  process.once('SIGTERM', () => shutdown());
  process.once('SIGINT', () => shutdown());
  server.on('error', error => { if (error.code !== 'EADDRINUSE') shutdown(1); });
}
try {
  startServer();
} catch (error) {
  if (!isEntryPoint) throw error;
  console.error('Lumina startup failed:', error);
  shutdown(1);
}

// Re-export core modules to maintain 100% backward-compatibility with existing unit/integration tests
module.exports = {
  stopServer,
  tagPhotosWithKeywords,
  getSmartPhoto,
  screensaverState,
  curatedCollections,
  updateNewsSentiment,
  updateServerWeather
};
