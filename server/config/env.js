// @ts-check

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/**
 * @typedef {Record<string, unknown>} EnvironmentEntries
 */

const rootDir = path.join(__dirname, '..', '..');
const ENV_PATH = path.join(rootDir, '.env');

dotenv.config({ path: ENV_PATH });

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeEnvValue(value) {
  return String(value ?? '').trim();
}

/**
 * @param {string} name
 * @param {string} [fallback]
 * @returns {string}
 */
function readEnvVar(name, fallback = '') {
  const value = process.env[name];
  return value === undefined ? fallback : normalizeEnvValue(value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function serializeEnvValue(value) {
  return JSON.stringify(normalizeEnvValue(value));
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Purely replace or append one normalized environment assignment.
 *
 * @param {string} content
 * @param {string} name
 * @param {unknown} value
 * @returns {string}
 */
function upsertEnvVarInContent(content, name, value) {
  const normalizedContent = content || '';
  const line = `${name}=${serializeEnvValue(value)}`;
  const pattern = new RegExp(`^${escapeRegex(name)}=.*$`, 'm');

  if (pattern.test(normalizedContent)) {
    return normalizedContent.replace(pattern, line);
  }

  const trimmed = normalizedContent.trimEnd();
  return trimmed ? `${trimmed}\n${line}` : `${line}`;
}

/**
 * @param {EnvironmentEntries} entries
 * @returns {void}
 */
function persistEnvVars(entries) {
  let nextContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';

  Object.entries(entries).forEach(([name, value]) => {
    const normalized = normalizeEnvValue(value);
    nextContent = upsertEnvVarInContent(nextContent, name, normalized);
    process.env[name] = normalized;
  });

  fs.writeFileSync(ENV_PATH, `${nextContent.trimEnd()}\n`, 'utf8');
}

module.exports = {
  ENV_PATH,
  readEnvVar,
  persistEnvVars,
  upsertEnvVarInContent
};
