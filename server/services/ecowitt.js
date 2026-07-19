// @ts-check

const DEFAULT_SOURCE = 'ecowitt-gw1200';
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 3_000;
const INHG_TO_HPA = 33.8638866667;
const DEFAULT_UNITS = Object.freeze({
  temperature: 'C',
  pressure: 'hPa',
  wind: 'km/h',
  rain: 'mm',
  light: 'lux'
});

const toFiniteNumber = (value) => {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTemperatureC = (value, unit) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return String(unit).toUpperCase() === 'F' ? (parsed - 32) * (5 / 9) : parsed;
};

const normalizePressureHpa = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return /INHG/i.test(String(value)) ? parsed * INHG_TO_HPA : parsed;
};

const roundMetric = (value, decimals = 1) => (
  value === null ? null : Number(value.toFixed(decimals))
);

const normalizeUnits = (units = {}) => ({
  ...DEFAULT_UNITS,
  ...units
});

const normalizeEcowittSettings = (settings = {}) => ({
  enabled: settings.enabled === true,
  baseUrl: String(settings.baseUrl || '').replace(/\/$/, ''),
  pollIntervalMs: Number.isFinite(Number(settings.pollIntervalMs)) ? Number(settings.pollIntervalMs) : DEFAULT_POLL_INTERVAL_MS,
  timeoutMs: Number.isFinite(Number(settings.timeoutMs)) ? Number(settings.timeoutMs) : DEFAULT_TIMEOUT_MS,
  units: normalizeUnits(settings.units)
});

const validateEcowittSettings = (settings = {}) => {
  const normalized = normalizeEcowittSettings(settings);
  let url = null;
  try {
    url = normalized.baseUrl ? new URL(normalized.baseUrl) : null;
  } catch (_error) {
    return { valid: false, error: 'Gateway URL must be a valid http or https URL.' };
  }
  if (url && !['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: 'Gateway URL must use http or https.' };
  }
  if (normalized.enabled && !url) {
    return { valid: false, error: 'A gateway URL is required when Ecowitt polling is enabled.' };
  }
  if (normalized.pollIntervalMs < 10_000 || normalized.timeoutMs < 500) {
    return { valid: false, error: 'Polling must be at least 10 seconds and timeout at least 500 milliseconds.' };
  }
  return { valid: true, settings: normalized };
};

const clonePayload = (payload) => (
  payload && typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : {}
);

function parseEcowittPayload(payload) {
  const indoor = payload?.wh25?.[0];
  if (!indoor || typeof indoor !== 'object') {
    return {
      temperatureC: null,
      humidityPercent: null,
      pressureAbsoluteHpa: null,
      pressureRelativeHpa: null
    };
  }

  return {
    temperatureC: roundMetric(normalizeTemperatureC(indoor.intemp, indoor.unit)),
    humidityPercent: roundMetric(toFiniteNumber(indoor.inhumi)),
    pressureAbsoluteHpa: roundMetric(normalizePressureHpa(indoor.abs)),
    pressureRelativeHpa: roundMetric(normalizePressureHpa(indoor.rel))
  };
}

const buildEnvironmentResponse = ({ indoor, metrics = {}, units = DEFAULT_UNITS, observedAt = null, stale = false, enabled = true }) => ({
  indoor,
  metrics,
  units: normalizeUnits(units),
  source: DEFAULT_SOURCE,
  observedAt,
  stale,
  enabled
});

function createTimeoutSignal(timeoutMs, AbortControllerImpl = AbortController) {
  const controller = new AbortControllerImpl();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeoutId) };
}

function createEcowittRuntime({
  settings = {},
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
  log = console,
  onReading = () => {}
} = {}) {
  let activeSettings = normalizeEcowittSettings(settings);
  let lastGood = null;
  let availability = activeSettings.enabled ? 'unknown' : 'disabled';
  let intervalId = null;

  const logTransition = (nextAvailability, error) => {
    if (availability === nextAvailability) return;
    availability = nextAvailability;
    if (nextAvailability === 'available') log.log('Ecowitt gateway available.');
    if (nextAvailability === 'recovered') log.log('Ecowitt gateway recovered.');
    if (nextAvailability === 'unavailable') log.warn(`Ecowitt gateway unavailable: ${error?.message || 'request failed'}`);
  };

  const readEnvironment = async () => {
    const { enabled, baseUrl, timeoutMs, units } = activeSettings;
    if (!enabled || !baseUrl) {
      return buildEnvironmentResponse({ indoor: null, units, enabled: false });
    }

    let timeout = null;
    try {
      timeout = createTimeoutSignal(timeoutMs);
      const response = await fetchImpl(`${baseUrl}/get_livedata_info`, { signal: timeout.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const indoor = parseEcowittPayload(payload);
      const observedAt = now();
      lastGood = buildEnvironmentResponse({
        indoor,
        metrics: clonePayload(payload),
        units,
        observedAt,
        enabled: true
      });
      onReading(lastGood);
      logTransition(availability === 'unavailable' ? 'recovered' : 'available');
      return lastGood;
    } catch (error) {
      logTransition('unavailable', error);
      return lastGood
        ? { ...lastGood, stale: true }
        : buildEnvironmentResponse({ indoor: null, units, enabled: true, stale: true });
    } finally {
      timeout?.clear();
    }
  };

  const start = () => {
    if (!activeSettings.enabled || intervalId) return;
    intervalId = setIntervalImpl(() => { readEnvironment(); }, activeSettings.pollIntervalMs);
  };

  const stop = () => {
    if (!intervalId) return;
    clearIntervalImpl(intervalId);
    intervalId = null;
  };

  const updateSettings = (nextSettings) => {
    const result = validateEcowittSettings(nextSettings);
    if (!result.valid) return result;
    stop();
    activeSettings = result.settings;
    availability = activeSettings.enabled ? 'unknown' : 'disabled';
    start();
    return result;
  };

  return { readEnvironment, start, stop, updateSettings };
}

module.exports = {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_UNITS,
  INHG_TO_HPA,
  buildEnvironmentResponse,
  createEcowittRuntime,
  normalizePressureHpa,
  normalizeEcowittSettings,
  normalizeTemperatureC,
  normalizeUnits,
  parseEcowittPayload,
  toFiniteNumber,
  validateEcowittSettings
};
