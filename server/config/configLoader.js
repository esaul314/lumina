const fs = require('fs');
const path = require('path');
require('./env.js');

const rootDir = path.join(__dirname, '..', '..');
const examplePath = path.join(rootDir, 'config.json.example');
const configPath = path.join(rootDir, 'config.json');
const deprecatedSecretKeys = ['nasaApiKey', 'useapiToken', 'googleClientId', 'googleClientSecret', 'tumblrApiKey'];

let config = {};

// Load defaults from config.json.example
try {
  config = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
} catch (err) {
  console.error('Fatal: Could not load config.json.example default template!', err.message);
}

// Merge user config.json overrides
if (fs.existsSync(configPath)) {
  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const ignoredSecretKeys = deprecatedSecretKeys.filter((key) => userConfig[key] !== undefined);
    if (ignoredSecretKeys.length > 0) {
      console.warn(`Warning: Secret config keys must be stored in .env and will be ignored: ${ignoredSecretKeys.join(', ')}`);
    }

    const sanitizedConfig = { ...userConfig };
    ignoredSecretKeys.forEach((key) => delete sanitizedConfig[key]);

    config = {
      ...config,
      ...sanitizedConfig,
      location: {
        ...config.location,
        ...(sanitizedConfig.location || {})
      },
      ecowitt: {
        ...config.ecowitt,
        ...(sanitizedConfig.ecowitt || {})
      },
      sensorHistory: {
        ...config.sensorHistory,
        ...(sanitizedConfig.sensorHistory || {})
      }
    };
  } catch (err) {
    console.warn('Warning: Could not parse user config.json, falling back to defaults:', err.message);
  }
}

module.exports = config;
