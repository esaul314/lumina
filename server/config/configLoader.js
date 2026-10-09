// @ts-check

const fs = require('fs');
const path = require('path');
require('./env.js');
const { projectConfigOverrides } = require('./configLoaderProjections.js');

/** @typedef {Record<string, unknown>} ConfigRecord */
/** @typedef {ConfigRecord & {units?: ConfigRecord}} EcowittConfig */
/** @typedef {ConfigRecord & {
 *   location?: ConfigRecord;
 *   ecowitt?: EcowittConfig;
 *   sensorHistory?: ConfigRecord;
 * }} AppConfig */

const rootDir = path.join(__dirname, '..', '..');
const examplePath = path.join(rootDir, 'config.json.example');
const configPath = path.join(rootDir, 'config.json');
/** @type {AppConfig} */
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
    /** @type {AppConfig} */
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const projection = projectConfigOverrides(config, userConfig);
    const { ignoredSecretKeys } = projection;
    if (ignoredSecretKeys.length > 0) {
      console.warn(`Warning: Secret config keys must be stored in .env and will be ignored: ${ignoredSecretKeys.join(', ')}`);
    }

    config = projection.config;
  } catch (err) {
    console.warn('Warning: Could not parse user config.json, falling back to defaults:', err.message);
  }
}

module.exports = config;
