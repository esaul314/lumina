// @ts-check

const DEFAULT_ADAPTER_ID = 'ecowitt-local-http';
const LEGACY_DEVICE_ID = 'local-environment';
const LEGACY_PLACEHOLDER_URL = 'http://ecowitt.local';
const DEFAULT_CONNECTION = Object.freeze({
  pollIntervalMs: 60_000,
  timeoutMs: 3_000
});
const DEFAULT_UNITS = Object.freeze({
  temperature: 'C',
  pressure: 'hPa',
  wind: 'km/h',
  rain: 'mm',
  light: 'lux'
});

/**
 * @typedef {Record<string, unknown>} EnvironmentUnits
 */

/**
 * @typedef {Record<string, unknown> & {
 *   id?: unknown,
 *   name?: unknown,
 *   adapterId?: unknown,
 *   baseUrl?: unknown,
 *   pollIntervalMs?: unknown,
 *   timeoutMs?: unknown
 * }} EnvironmentDeviceInput
 */

/**
 * @typedef {object} EnvironmentDevice
 * @property {string} id
 * @property {string} name
 * @property {string} adapterId
 * @property {string} baseUrl
 * @property {number} pollIntervalMs
 * @property {number} timeoutMs
 */

/**
 * @typedef {Record<string, unknown> & {
 *   devices?: EnvironmentDeviceInput[],
 *   activeDeviceId?: unknown,
 *   enabled?: unknown,
 *   baseUrl?: unknown,
 *   pollIntervalMs?: unknown,
 *   timeoutMs?: unknown,
 *   units?: EnvironmentUnits
 * }} EnvironmentSettingsInput
 */

/**
 * @typedef {object} EnvironmentSettings
 * @property {string | null} activeDeviceId
 * @property {EnvironmentDevice[]} devices
 * @property {EnvironmentUnits} units
 */

/**
 * @typedef {object} RuntimeEnvironmentSettings
 * @property {boolean} enabled
 * @property {string} baseUrl
 * @property {number} pollIntervalMs
 * @property {number} timeoutMs
 * @property {EnvironmentUnits} units
 */

/**
 * @typedef {EnvironmentSettings & {
 *   enabled: boolean,
 *   baseUrl: string,
 *   pollIntervalMs: number,
 *   timeoutMs: number
 * }} LegacyEnvironmentSettings
 */

/**
 * @typedef {object} AdapterDeviceSettings
 * @property {boolean} enabled
 * @property {string} baseUrl
 * @property {number} pollIntervalMs
 * @property {number} timeoutMs
 * @property {EnvironmentUnits} units
 */

/**
 * @typedef {{valid: true, settings: EnvironmentSettings} | {valid: false, error: string}} EnvironmentValidationResult
 */

/**
 * @typedef {object} EnvironmentValidationOptions
 * @property {string[]} [adapterIds=[]]
 * @property {(adapterId: string, settings: AdapterDeviceSettings) => {valid: boolean, error?: string}} [validateDevice]
 */

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const normalizeUrl = value => String(value || '').trim().replace(/\/$/, '');
const normalizeUnits = (units = {}) => ({ ...DEFAULT_UNITS, ...units });
const slugify = value => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48);

const nextAvailableId = (preferredId, usedIds) => {
  const base = slugify(preferredId) || 'sensor-device';
  const suffixes = Array.from({ length: usedIds.size + 1 }, (_, index) => index + 1);
  return [base, ...suffixes.map(suffix => `${base}-${suffix}`)]
    .find(candidate => !usedIds.has(candidate));
};

/**
 * Normalize one untrusted device record into the canonical profile shape.
 *
 * @param {EnvironmentDeviceInput} [device={}]
 * @param {number} [index=0]
 * @param {Set<string>} [usedIds=new Set()]
 * @returns {EnvironmentDevice}
 */
const normalizeDevice = (device = {}, index = 0, usedIds = new Set()) => ({
  id: nextAvailableId(device.id || device.name || `sensor-device-${index + 1}`, usedIds),
  name: String(device.name || 'Local environment').trim(),
  adapterId: String(device.adapterId || DEFAULT_ADAPTER_ID).trim(),
  baseUrl: normalizeUrl(device.baseUrl),
  pollIntervalMs: toPositiveNumber(device.pollIntervalMs, DEFAULT_CONNECTION.pollIntervalMs),
  timeoutMs: toPositiveNumber(device.timeoutMs, DEFAULT_CONNECTION.timeoutMs)
});

/**
 * Normalize a device catalog while assigning deterministic unique ids.
 *
 * @param {EnvironmentDeviceInput[]} [devices=[]]
 * @returns {EnvironmentDevice[]}
 */
const normalizeDevices = (devices = []) => devices.reduce((normalized, device, index) => {
  const usedIds = new Set(normalized.map(({ id }) => id));
  return [...normalized, normalizeDevice(device, index, usedIds)];
}, []);

/**
 * @param {EnvironmentSettingsInput} settings
 * @returns {boolean}
 */
const hasLegacyDevice = settings => (
  settings.enabled === true
  || Boolean(normalizeUrl(settings.baseUrl) && normalizeUrl(settings.baseUrl) !== LEGACY_PLACEHOLDER_URL)
);

/**
 * @param {EnvironmentSettingsInput} settings
 * @returns {EnvironmentDevice}
 */
const legacyDeviceFrom = settings => normalizeDevice({
  id: LEGACY_DEVICE_ID,
  name: 'Local environment',
  adapterId: DEFAULT_ADAPTER_ID,
  baseUrl: settings.baseUrl,
  pollIntervalMs: settings.pollIntervalMs,
  timeoutMs: settings.timeoutMs
});

/**
 * Normalize legacy flat settings or the saved device catalog into one immutable
 * canonical settings value.
 *
 * @param {EnvironmentSettingsInput} [settings={}]
 * @returns {EnvironmentSettings}
 */
const normalizeEnvironmentSettings = (settings = {}) => {
  const devices = Array.isArray(settings.devices)
    ? normalizeDevices(settings.devices)
    : hasLegacyDevice(settings)
      ? [legacyDeviceFrom(settings)]
      : [];
  const requestedActiveId = settings.activeDeviceId ?? (
    !Array.isArray(settings.devices) && settings.enabled === true ? devices[0]?.id : null
  );
  const activeDeviceId = devices.some(({ id }) => id === requestedActiveId)
    ? requestedActiveId
    : null;

  return {
    activeDeviceId,
    devices,
    units: normalizeUnits(settings.units)
  };
};

/**
 * @param {EnvironmentSettings} settings
 * @returns {EnvironmentDevice | null}
 */
const getActiveDevice = settings => (
  settings.devices.find(({ id }) => id === settings.activeDeviceId) || null
);

/**
 * @param {string} name
 * @param {EnvironmentDevice[]} [devices=[]]
 * @returns {string}
 */
const createDeviceId = (name, devices = []) => nextAvailableId(
  name,
  new Set(devices.map(({ id }) => id))
);

/**
 * Return a normalized settings value with one device inserted or replaced.
 *
 * @param {EnvironmentSettings} settings
 * @param {EnvironmentDevice} device
 * @returns {EnvironmentSettings}
 */
const upsertDevice = (settings, device) => {
  const exists = settings.devices.some(({ id }) => id === device.id);
  const devices = exists
    ? settings.devices.map(current => current.id === device.id ? { ...current, ...device } : current)
    : [...settings.devices, device];
  return normalizeEnvironmentSettings({
    ...settings,
    devices,
    activeDeviceId: settings.activeDeviceId
  });
};

/**
 * @param {EnvironmentSettings} settings
 * @param {string} deviceId
 * @returns {EnvironmentSettings}
 */
const removeDevice = (settings, deviceId) => normalizeEnvironmentSettings({
  ...settings,
  devices: settings.devices.filter(({ id }) => id !== deviceId),
  activeDeviceId: settings.activeDeviceId === deviceId ? null : settings.activeDeviceId
});

/**
 * Select a saved device without mutating the catalog.
 *
 * @param {EnvironmentSettings} settings
 * @param {string | null} deviceId
 * @returns {EnvironmentSettings}
 */
const selectDevice = (settings, deviceId) => ({
  ...settings,
  activeDeviceId: settings.devices.some(({ id }) => id === deviceId) ? deviceId : null
});

/**
 * Project canonical settings into the single active adapter's runtime shape.
 *
 * @param {EnvironmentSettings} settings
 * @returns {RuntimeEnvironmentSettings}
 */
const toRuntimeSettings = settings => {
  const active = getActiveDevice(settings);
  return {
    enabled: Boolean(active),
    baseUrl: active?.baseUrl || '',
    pollIntervalMs: active?.pollIntervalMs ?? DEFAULT_CONNECTION.pollIntervalMs,
    timeoutMs: active?.timeoutMs ?? DEFAULT_CONNECTION.timeoutMs,
    units: normalizeUnits(settings.units)
  };
};

/**
 * Project canonical settings into the flat compatibility response used by the
 * existing config and REST clients.
 *
 * @param {EnvironmentSettings} settings
 * @returns {LegacyEnvironmentSettings}
 */
const projectLegacySettings = settings => {
  const active = getActiveDevice(settings);
  const legacyDevice = active || settings.devices[0] || null;
  return {
    enabled: Boolean(active),
    baseUrl: legacyDevice?.baseUrl || '',
    pollIntervalMs: legacyDevice?.pollIntervalMs ?? DEFAULT_CONNECTION.pollIntervalMs,
    timeoutMs: legacyDevice?.timeoutMs ?? DEFAULT_CONNECTION.timeoutMs,
    activeDeviceId: settings.activeDeviceId,
    devices: settings.devices.map(device => ({ ...device })),
    units: normalizeUnits(settings.units)
  };
};

/**
 * Apply a legacy flat patch through the same immutable catalog algebra.
 *
 * @param {EnvironmentSettings} settings
 * @param {EnvironmentSettingsInput} [patch={}]
 * @returns {EnvironmentSettings}
 */
const applyLegacyPatch = (settings, patch = {}) => {
  const active = getActiveDevice(settings) || settings.devices[0] || null;
  const shouldCreate = !active && (patch.enabled === true || Boolean(normalizeUrl(patch.baseUrl)));
  const baseDevice = active || (shouldCreate ? legacyDeviceFrom(patch) : null);
  const nextDevice = baseDevice && {
    ...baseDevice,
    ...Object.fromEntries(
      ['baseUrl', 'pollIntervalMs', 'timeoutMs']
        .filter(key => hasOwn(patch, key))
        .map(key => [key, patch[key]])
    )
  };
  const withDevice = nextDevice ? upsertDevice(settings, nextDevice) : settings;
  const nextActiveId = patch.enabled === false
    ? null
    : patch.enabled === true
      ? nextDevice?.id || null
      : withDevice.activeDeviceId;

  return normalizeEnvironmentSettings({
    ...withDevice,
    activeDeviceId: nextActiveId,
    units: { ...settings.units, ...(patch.units || {}) }
  });
};

/**
 * Decode either the catalog form or legacy flat form without mutating current.
 *
 * @param {EnvironmentSettings} current
 * @param {EnvironmentSettingsInput} [payload={}]
 * @returns {EnvironmentSettings}
 */
const decodeEnvironmentSettings = (current, payload = {}) => (
  Array.isArray(payload.devices) || hasOwn(payload, 'activeDeviceId')
    ? normalizeEnvironmentSettings({
      ...current,
      ...payload,
      units: { ...current.units, ...(payload.units || {}) }
    })
    : applyLegacyPatch(current, payload)
);

/**
 * Validate the canonical catalog against registered adapter capabilities.
 *
 * @param {EnvironmentSettings} settings
 * @param {EnvironmentValidationOptions} [options={}]
 * @returns {EnvironmentValidationResult}
 */
const validateEnvironmentSettings = (settings, { adapterIds = [], validateDevice = () => ({ valid: true }) } = {}) => {
  if (settings.devices.length > 20) return { valid: false, error: 'No more than 20 sensor devices may be saved.' };
  if (settings.activeDeviceId && !getActiveDevice(settings)) return { valid: false, error: 'The active sensor device does not exist.' };

  const invalidDevice = settings.devices.find(device => (
    !device.id
    || !device.name
    || device.name.length > 80
    || !adapterIds.includes(device.adapterId)
  ));
  if (invalidDevice) return { valid: false, error: 'Each sensor device requires a name and a registered adapter.' };

  const failedValidation = settings.devices
    .map(device => ({ device, result: validateDevice(device.adapterId, {
      enabled: true,
      baseUrl: device.baseUrl,
      pollIntervalMs: device.pollIntervalMs,
      timeoutMs: device.timeoutMs,
      units: settings.units
    }) }))
    .find(({ result }) => !result?.valid);

  return failedValidation
    ? { valid: false, error: `${failedValidation.device.name}: ${failedValidation.result.error}` }
    : { valid: true, settings };
};

module.exports = {
  DEFAULT_ADAPTER_ID,
  DEFAULT_CONNECTION,
  DEFAULT_UNITS,
  LEGACY_DEVICE_ID,
  applyLegacyPatch,
  createDeviceId,
  decodeEnvironmentSettings,
  getActiveDevice,
  normalizeDevice,
  normalizeEnvironmentSettings,
  projectLegacySettings,
  removeDevice,
  selectDevice,
  toRuntimeSettings,
  upsertDevice,
  validateEnvironmentSettings
};
