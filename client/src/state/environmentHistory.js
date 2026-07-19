export const formatEnvironmentMetric = (value, suffix = '') => {
  if (value === null || value === undefined || value === '') return '—';
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(1)}${suffix}` : '—';
};

export const convertTemperature = (value, unit = 'C') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return unit === 'F' ? (numericValue * 9) / 5 + 32 : numericValue;
};

export const convertPressure = (value, unit = 'hPa') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return unit === 'inHg' ? numericValue / 33.8638866667 : numericValue;
};

export const DEFAULT_ENVIRONMENT_DEVICE = Object.freeze({
  name: 'New sensor device',
  adapterId: 'ecowitt-local-http',
  baseUrl: '',
  pollIntervalMs: 60_000,
  timeoutMs: 3_000
});

const slugifyDeviceId = value => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48);

export const createEnvironmentDeviceId = (name, devices = []) => {
  const base = slugifyDeviceId(name) || 'sensor-device';
  const usedIds = new Set(devices.map(({ id }) => id));
  return [base, ...Array.from({ length: usedIds.size + 1 }, (_, index) => `${base}-${index + 1}`)]
    .find(candidate => !usedIds.has(candidate));
};

export const normalizeEnvironmentSettingsDraft = (settings = {}) => ({
  ...settings,
  activeDeviceId: settings.activeDeviceId ?? null,
  devices: Array.isArray(settings.devices) ? settings.devices.map(device => ({ ...device })) : [],
  units: { ...(settings.units || {}) }
});

export const createEnvironmentDevice = (settings, overrides = {}) => ({
  ...DEFAULT_ENVIRONMENT_DEVICE,
  ...overrides,
  id: createEnvironmentDeviceId(
    overrides.name || DEFAULT_ENVIRONMENT_DEVICE.name,
    settings.devices
  )
});

export const getActiveEnvironmentDevice = settings => (
  settings.devices.find(({ id }) => id === settings.activeDeviceId) || null
);

export const upsertEnvironmentDevice = (settings, device) => ({
  ...settings,
  devices: settings.devices.some(({ id }) => id === device.id)
    ? settings.devices.map(current => current.id === device.id ? { ...current, ...device } : current)
    : [...settings.devices, device]
});

export const removeEnvironmentDevice = (settings, deviceId) => ({
  ...settings,
  activeDeviceId: settings.activeDeviceId === deviceId ? null : settings.activeDeviceId,
  devices: settings.devices.filter(({ id }) => id !== deviceId)
});

export const selectEnvironmentDevice = (settings, deviceId) => ({
  ...settings,
  activeDeviceId: settings.devices.some(({ id }) => id === deviceId) ? deviceId : null
});

export const parseEnvironmentSettingsJson = (value) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { valid: true, value: parsed }
      : { valid: false, error: 'Configuration JSON must contain an object.' };
  } catch (error) {
    return { valid: false, error: `Invalid configuration JSON: ${error.message}` };
  }
};

export const formatEnvironmentTimestamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No reading yet' : date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

export const getEnvironmentStatus = (environment) => {
  if (!environment) return { label: 'Backend unavailable', color: '#ef4444' };
  if (!environment.enabled) return { label: 'Not configured', color: '#94a3b8' };
  if (environment.stale) return { label: 'Stale fallback', color: '#f59e0b' };
  if (environment.indoor) return { label: 'Online', color: '#10b981' };
  return { label: 'Waiting for device', color: '#f59e0b' };
};
