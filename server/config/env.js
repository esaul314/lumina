const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.join(__dirname, '..', '..');
const ENV_PATH = path.join(rootDir, '.env');

dotenv.config({ path: ENV_PATH });

function normalizeEnvValue(value) {
  return String(value ?? '').trim();
}

function readEnvVar(name, fallback = '') {
  const value = process.env[name];
  return value === undefined ? fallback : normalizeEnvValue(value);
}

function serializeEnvValue(value) {
  return JSON.stringify(normalizeEnvValue(value));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
