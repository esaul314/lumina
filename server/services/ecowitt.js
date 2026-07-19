// @ts-check

const DEFAULT_SOURCE = 'ecowitt-gw1200';
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 3_000;
const INHG_TO_HPA = 33.8638866667;
const ECOWITT_LOCAL_HTTP_ADAPTER = Object.freeze({
  id: 'ecowitt-local-http',
  aliases: Object.freeze([DEFAULT_SOURCE]),
  label: 'Ecowitt-compatible LAN gateway',
  description: 'Local weather telemetry through Ecowitt\'s generic HTTP API.',
  protocol: 'Ecowitt LAN HTTP',
  transport: 'http-poll',
  endpoint: '/get_livedata_info',
  capabilities: Object.freeze([
    'temperature',
    'humidity',
    'pressure',
    'gateway-payload'
  ]),
  compatibility: Object.freeze({
    summary: 'GW1100, GW1200, GW2000, GW3000, and compatible WN/WS consoles exposing the generic LAN API.',
    models: Object.freeze([
      'GW1100', 'GW1200', 'GW2000', 'GW3000',
      'WS6210', 'WN1700', 'WN1820', 'WN1821', 'WN1920', 'WN1980',
      'WS3800', 'WS3820', 'WS3900', 'WS3910'
    ])
  })
});
const COMMON_METRIC_IDS = Object.freeze({
  indoorTemperature: 0x01,
  indoorHumidity: 0x06,
  pressureAbsolute: 0x08,
  pressureRelative: 0x09
});
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

const firstNonNull = (values) => values.find(value => value !== null) ?? null;

const normalizeMetricId = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return null;
  const parsed = Number.parseInt(text, text.startsWith('0x') ? 16 : 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTemperatureC = (value, unit) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  const unitText = `${unit ?? ''} ${value ?? ''}`;
  return /\bF\b/i.test(unitText) ? (parsed - 32) * (5 / 9) : parsed;
};

const normalizePressureHpa = (value, unit) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return /INHG/i.test(`${unit ?? ''} ${value ?? ''}`) ? parsed * INHG_TO_HPA : parsed;
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
    return { valid: false, error: 'A gateway URL is required when local sensor polling is enabled.' };
  }
  if (normalized.pollIntervalMs < 10_000 || normalized.timeoutMs < 500) {
    return { valid: false, error: 'Polling must be at least 10 seconds and timeout at least 500 milliseconds.' };
  }
  return { valid: true, settings: normalized };
};

const clonePayload = (payload) => (
  payload && typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : {}
);

const indexCommonMetrics = (payload) => new Map(
  (Array.isArray(payload?.common_list) ? payload.common_list : [])
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => [normalizeMetricId(entry.id), entry])
    .filter(([id]) => id !== null)
);

const normalizeCommonMetric = (metric, normalize) => (
  metric ? normalize(metric.val, metric.unit) : null
);

function parseEcowittPayload(payload) {
  const indoor = payload?.wh25?.[0];
  const wh25 = indoor && typeof indoor === 'object' ? indoor : {};
  const common = indexCommonMetrics(payload);
  const commonMetric = id => common.get(id) || null;

  return {
    temperatureC: roundMetric(firstNonNull([
      normalizeTemperatureC(wh25.intemp, wh25.unit),
      normalizeCommonMetric(commonMetric(COMMON_METRIC_IDS.indoorTemperature), normalizeTemperatureC)
    ])),
    humidityPercent: roundMetric(firstNonNull([
      toFiniteNumber(wh25.inhumi),
      normalizeCommonMetric(commonMetric(COMMON_METRIC_IDS.indoorHumidity), toFiniteNumber)
    ])),
    pressureAbsoluteHpa: roundMetric(firstNonNull([
      normalizePressureHpa(wh25.abs),
      normalizeCommonMetric(commonMetric(COMMON_METRIC_IDS.pressureAbsolute), normalizePressureHpa)
    ])),
    pressureRelativeHpa: roundMetric(firstNonNull([
      normalizePressureHpa(wh25.rel),
      normalizeCommonMetric(commonMetric(COMMON_METRIC_IDS.pressureRelative), normalizePressureHpa)
    ]))
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
    if (nextAvailability === 'available') log.log('Ecowitt-compatible LAN gateway available.');
    if (nextAvailability === 'recovered') log.log('Ecowitt-compatible LAN gateway recovered.');
    if (nextAvailability === 'unavailable') log.warn(`Ecowitt-compatible LAN gateway unavailable: ${error?.message || 'request failed'}`);
  };

  const readEnvironment = async () => {
    const { enabled, baseUrl, timeoutMs, units } = activeSettings;
    if (!enabled || !baseUrl) {
      return buildEnvironmentResponse({ indoor: null, units, enabled: false });
    }

    let timeout = null;
    try {
      timeout = createTimeoutSignal(timeoutMs);
      const response = await fetchImpl(`${baseUrl}${ECOWITT_LOCAL_HTTP_ADAPTER.endpoint}`, { signal: timeout.signal });
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

  Object.defineProperty(readEnvironment, 'adapterDescriptor', {
    value: ECOWITT_LOCAL_HTTP_ADAPTER,
    writable: false,
    enumerable: false,
    configurable: false
  });

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

  return {
    readEnvironment,
    start,
    stop,
    validateSettings: validateEcowittSettings,
    updateSettings
  };
}

module.exports = {
  COMMON_METRIC_IDS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_SOURCE,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_UNITS,
  ECOWITT_LOCAL_HTTP_ADAPTER,
  INHG_TO_HPA,
  buildEnvironmentResponse,
  createEcowittRuntime,
  indexCommonMetrics,
  normalizeMetricId,
  normalizePressureHpa,
  normalizeEcowittSettings,
  normalizeTemperatureC,
  normalizeUnits,
  parseEcowittPayload,
  toFiniteNumber,
  validateEcowittSettings
};
