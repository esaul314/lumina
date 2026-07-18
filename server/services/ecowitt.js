// @ts-check

const DEFAULT_SOURCE = 'ecowitt-gw1200';
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 3_000;
const INHG_TO_HPA = 33.8638866667;

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

const buildEnvironmentResponse = ({ indoor, observedAt = null, stale = false, enabled = true }) => ({
  indoor,
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
  const enabled = settings.enabled === true;
  const baseUrl = String(settings.baseUrl || '').replace(/\/$/, '');
  const timeoutMs = Number.isFinite(settings.timeoutMs) ? settings.timeoutMs : DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = Number.isFinite(settings.pollIntervalMs)
    ? settings.pollIntervalMs
    : DEFAULT_POLL_INTERVAL_MS;
  let lastGood = null;
  let availability = enabled ? 'unknown' : 'disabled';
  let intervalId = null;

  const logTransition = (nextAvailability, error) => {
    if (availability === nextAvailability) return;
    availability = nextAvailability;
    if (nextAvailability === 'available') log.log('Ecowitt gateway available.');
    if (nextAvailability === 'recovered') log.log('Ecowitt gateway recovered.');
    if (nextAvailability === 'unavailable') log.warn(`Ecowitt gateway unavailable: ${error?.message || 'request failed'}`);
  };

  const readEnvironment = async () => {
    if (!enabled || !baseUrl) {
      return buildEnvironmentResponse({ indoor: null, enabled: false });
    }

    let timeout = null;
    try {
      timeout = createTimeoutSignal(timeoutMs);
      const response = await fetchImpl(`${baseUrl}/get_livedata_info`, { signal: timeout.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const indoor = parseEcowittPayload(await response.json());
      const observedAt = now();
      lastGood = buildEnvironmentResponse({ indoor, observedAt, enabled: true });
      onReading(lastGood);
      logTransition(availability === 'unavailable' ? 'recovered' : 'available');
      return lastGood;
    } catch (error) {
      logTransition('unavailable', error);
      return lastGood
        ? { ...lastGood, stale: true }
        : buildEnvironmentResponse({ indoor: null, enabled: true, stale: true });
    } finally {
      timeout?.clear();
    }
  };

  const start = () => {
    if (!enabled || intervalId) return;
    intervalId = setIntervalImpl(() => { readEnvironment(); }, pollIntervalMs);
  };

  const stop = () => {
    if (!intervalId) return;
    clearIntervalImpl(intervalId);
    intervalId = null;
  };

  return { readEnvironment, start, stop };
}

module.exports = {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  INHG_TO_HPA,
  buildEnvironmentResponse,
  createEcowittRuntime,
  normalizePressureHpa,
  normalizeTemperatureC,
  parseEcowittPayload,
  toFiniteNumber
};
