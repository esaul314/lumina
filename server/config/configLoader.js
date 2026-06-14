const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const examplePath = path.join(rootDir, 'config.json.example');
const configPath = path.join(rootDir, 'config.json');

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
    config = {
      ...config,
      ...userConfig,
      location: {
        ...config.location,
        ...(userConfig.location || {})
      }
    };
  } catch (err) {
    console.warn('Warning: Could not parse user config.json, falling back to defaults:', err.message);
  }
}

module.exports = config;
