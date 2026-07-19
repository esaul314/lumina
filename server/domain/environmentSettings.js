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

const normalizeDevice = (device = {}, index = 0, usedIds = new Set()) => ({
  id: nextAvailableId(device.id || device.name || `sensor-device-${index + 1}`, usedIds),
  name: String(device.name || 'Local environment').trim(),
  adapterId: String(device.adapterId || DEFAULT_ADAPTER_ID).trim(),
  baseUrl: normalizeUrl(device.baseUrl),
  pollIntervalMs: toPositiveNumber(device.pollIntervalMs, DEFAULT_CONNECTION.pollIntervalMs),
  timeoutMs: toPositiveNumber(device.timeoutMs, DEFAULT_CONNECTION.timeoutMs)
});

const normalizeDevices = (devices = []) => devices.reduce((normalized, device, index) => {
  const usedIds = new Set(normalized.map(({ id }) => id));
  return [...normalized, normalizeDevice(device, index, usedIds)];
}, []);

const hasLegacyDevice = settings => (
  settings.enabled === true
  || Boolean(normalizeUrl(settings.baseUrl) && normalizeUrl(settings.baseUrl) !== LEGACY_PLACEHOLDER_URL)
);

const legacyDeviceFrom = settings => normalizeDevice({
  id: LEGACY_DEVICE_ID,
  name: 'Local environment',
  adapterId: DEFAULT_ADAPTER_ID,
  baseUrl: settings.baseUrl,
  pollIntervalMs: settings.pollIntervalMs,
  timeoutMs: settings.timeoutMs
});

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

const getActiveDevice = settings => (
  settings.devices.find(({ id }) => id === settings.activeDeviceId) || null
);

const createDeviceId = (name, devices = []) => nextAvailableId(
  name,
  new Set(devices.map(({ id }) => id))
);

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

const removeDevice = (settings, deviceId) => normalizeEnvironmentSettings({
  ...settings,
  devices: settings.devices.filter(({ id }) => id !== deviceId),
  activeDeviceId: settings.activeDeviceId === deviceId ? null : settings.activeDeviceId
});

const selectDevice = (settings, deviceId) => ({
  ...settings,
  activeDeviceId: settings.devices.some(({ id }) => id === deviceId) ? deviceId : null
});

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

const decodeEnvironmentSettings = (current, payload = {}) => (
  Array.isArray(payload.devices) || hasOwn(payload, 'activeDeviceId')
    ? normalizeEnvironmentSettings({
      ...current,
      ...payload,
      units: { ...current.units, ...(payload.units || {}) }
    })
    : applyLegacyPatch(current, payload)
);

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
