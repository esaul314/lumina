// @ts-check

/**
 * @typedef {{temperature: string, pressure: string, wind: string, rain: string, light: string}} EcowittUnits
 */

/**
 * @typedef {Record<string, unknown> & {
 *   enabled?: unknown,
 *   baseUrl?: unknown,
 *   pollIntervalMs?: unknown,
 *   timeoutMs?: unknown,
 *   units?: Partial<EcowittUnits>
 * }} EcowittSettingsInput
 */

/**
 * @typedef {object} EcowittSettings
 * @property {boolean} enabled
 * @property {string} baseUrl
 * @property {number} pollIntervalMs
 * @property {number} timeoutMs
 * @property {EcowittUnits} units
 */

/**
 * @typedef {object} EcowittIndoorReading
 * @property {number | null} temperatureC
 * @property {number | null} humidityPercent
 * @property {number | null} pressureAbsoluteHpa
 * @property {number | null} pressureRelativeHpa
 */

/**
 * @typedef {Record<string, unknown> & {
 *   wh25?: Array<Record<string, unknown>>,
 *   common_list?: Array<Record<string, unknown>>
 * }} EcowittPayload
 */

/**
 * @typedef {object} EcowittEnvironmentResponse
 * @property {EcowittIndoorReading | null} indoor
 * @property {Record<string, unknown>} metrics
 * @property {EcowittUnits} units
 * @property {string} source
 * @property {string | null} observedAt
 * @property {boolean} stale
 * @property {boolean} enabled
 */

/**
 * @typedef {{valid: true, settings: EcowittSettings} | {valid: false, error: string}} EcowittValidationResult
 */

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

/** @param {unknown} value @returns {number | null} */
const toFiniteNumber = (value) => {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

/** @param {Array<number | null>} values @returns {number | null} */
const firstNonNull = (values) => values.find(value => value !== null) ?? null;

/** @param {unknown} value @returns {number | null} */
const normalizeMetricId = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return null;
  const parsed = Number.parseInt(text, text.startsWith('0x') ? 16 : 10);
  return Number.isFinite(parsed) ? parsed : null;
};

/** @param {unknown} value @param {unknown} unit @returns {number | null} */
const normalizeTemperatureC = (value, unit) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  const unitText = `${unit ?? ''} ${value ?? ''}`;
  return /\bF\b/i.test(unitText) ? (parsed - 32) * (5 / 9) : parsed;
};

/** @param {unknown} value @param {unknown} unit @returns {number | null} */
const normalizePressureHpa = (value, unit) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return /INHG/i.test(`${unit ?? ''} ${value ?? ''}`) ? parsed * INHG_TO_HPA : parsed;
};

/** @param {number | null} value @param {number} [decimals=1] @returns {number | null} */
const roundMetric = (value, decimals = 1) => (
  value === null ? null : Number(value.toFixed(decimals))
);

/** @param {Partial<EcowittUnits>} [units={}] @returns {EcowittUnits} */
const normalizeUnits = (units = {}) => ({
  ...DEFAULT_UNITS,
  ...units
});

/** @param {EcowittSettingsInput} [settings={}] @returns {EcowittSettings} */
const normalizeEcowittSettings = (settings = {}) => ({
  enabled: settings.enabled === true,
  baseUrl: String(settings.baseUrl || '').replace(/\/$/, ''),
  pollIntervalMs: Number.isFinite(Number(settings.pollIntervalMs)) ? Number(settings.pollIntervalMs) : DEFAULT_POLL_INTERVAL_MS,
  timeoutMs: Number.isFinite(Number(settings.timeoutMs)) ? Number(settings.timeoutMs) : DEFAULT_TIMEOUT_MS,
  units: normalizeUnits(settings.units)
});

/** @param {EcowittSettingsInput} [settings={}] @returns {EcowittValidationResult} */
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

/** @param {EcowittPayload} [payload={}] @returns {Map<number, Record<string, unknown>>} */
const indexCommonMetrics = (payload) => new Map(
  (Array.isArray(payload?.common_list) ? payload.common_list : [])
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => [normalizeMetricId(entry.id), entry])
    .filter(([id]) => id !== null)
);

/** @param {Record<string, unknown> | null} metric @param {(value: unknown, unit: unknown) => number | null} normalize @returns {number | null} */
const normalizeCommonMetric = (metric, normalize) => (
  metric ? normalize(metric.val, metric.unit) : null
);

/**
 * Project a vendor payload into Lumina's stable indoor metric vocabulary.
 *
 * @param {EcowittPayload} [payload={}] vendor payload
 * @returns {EcowittIndoorReading} canonical indoor reading
 */
function parseEcowittPayload(payload = {}) {
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

/**
 * Build the public adapter response without mutating its input projections.
 *
 * @param {{indoor: EcowittIndoorReading | null, metrics?: Record<string, unknown>, units?: Partial<EcowittUnits>, observedAt?: string | null, stale?: boolean, enabled?: boolean}} input
 * @returns {EcowittEnvironmentResponse}
 */
const buildEnvironmentResponse = ({ indoor, metrics = {}, units = DEFAULT_UNITS, observedAt = null, stale = false, enabled = true }) => ({
  indoor,
  metrics,
  units: normalizeUnits(units),
  source: DEFAULT_SOURCE,
  observedAt,
  stale,
  enabled
});

const activeSourceKey = ({ enabled, baseUrl }) => (
  enabled && baseUrl ? baseUrl : null
);

const updateResponseUnits = (response, units) => (
  response ? { ...response, units: normalizeUnits(units) } : null
);

function createTimeoutSignal(timeoutMs, AbortControllerImpl = AbortController) {
  const controller = new AbortControllerImpl();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const clear = () => clearTimeout(timeoutId);
  return {
    signal: controller.signal,
    clear,
    abort: () => {
      clear();
      controller.abort();
    }
  };
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
  let settingsGeneration = 0;
  const inFlightRequests = new Set();

  const buildEmptyResponse = ({ stale = false } = {}) => buildEnvironmentResponse({
    indoor: null,
    units: activeSettings.units,
    enabled: activeSettings.enabled && Boolean(activeSettings.baseUrl),
    stale
  });

  const logTransition = (nextAvailability, error) => {
    if (availability === nextAvailability) return;
    availability = nextAvailability;
    if (nextAvailability === 'available') log.log('Ecowitt-compatible LAN gateway available.');
    if (nextAvailability === 'recovered') log.log('Ecowitt-compatible LAN gateway recovered.');
    if (nextAvailability === 'unavailable') log.warn(`Ecowitt-compatible LAN gateway unavailable: ${error?.message || 'request failed'}`);
  };

  const readEnvironment = async () => {
    const { enabled, baseUrl, timeoutMs } = activeSettings;
    const readGeneration = settingsGeneration;
    if (!enabled || !baseUrl) {
      return buildEnvironmentResponse({ indoor: null, units: activeSettings.units, enabled: false });
    }

    let timeout = null;
    try {
      timeout = createTimeoutSignal(timeoutMs);
      inFlightRequests.add(timeout);
      const response = await fetchImpl(`${baseUrl}${ECOWITT_LOCAL_HTTP_ADAPTER.endpoint}`, { signal: timeout.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      if (readGeneration !== settingsGeneration) return buildEmptyResponse();
      const indoor = parseEcowittPayload(payload);
      const observedAt = now();
      lastGood = buildEnvironmentResponse({
        indoor,
        metrics: clonePayload(payload),
        units: activeSettings.units,
        observedAt,
        enabled: true
      });
      onReading(lastGood);
      logTransition(availability === 'unavailable' ? 'recovered' : 'available');
      return lastGood;
    } catch (error) {
      if (readGeneration !== settingsGeneration) return buildEmptyResponse();
      logTransition('unavailable', error);
      return lastGood
        ? { ...lastGood, stale: true }
        : buildEnvironmentResponse({ indoor: null, units: activeSettings.units, enabled: true, stale: true });
    } finally {
      inFlightRequests.delete(timeout);
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
    const sourceChanged = activeSourceKey(activeSettings) !== activeSourceKey(result.settings);
    stop();
    if (sourceChanged) {
      settingsGeneration += 1;
      inFlightRequests.forEach(request => request.abort());
      inFlightRequests.clear();
    }
    activeSettings = result.settings;
    lastGood = sourceChanged ? null : updateResponseUnits(lastGood, activeSettings.units);
    if (sourceChanged) availability = activeSettings.enabled ? 'unknown' : 'disabled';
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
