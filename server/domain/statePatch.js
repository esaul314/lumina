// @ts-check

/** @typedef {import('./types').StatePatchPayload} StatePatchPayload */

const STATE_PATCH_FIELDS = [
  'theme',
  'inactivityTimeout',
  'slideshowInterval',
  'scaleMode',
  'splitPortrait',
  'splitCropPercent',
  'alignTimeOfDay',
  'alignWeather',
  'nightPercentage',
  'allowOpenAiFallback'
];

/** Only primitive strings are trimmed; all other inputs become ''.
 * @param {unknown} value
 * @returns {string}
 */
const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

/** Native nullish-to-empty String/parseFloat coercion; no coordinate range check.
 * Non-finite parses return the original fallback alias. Coercion failures escape.
 * @template F
 * @param {unknown} value
 * @param {F} fallback
 * @returns {number | F}
 */
const normalizeCoordinate = (value, fallback) => {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Fresh raw accumulator following the exported mutable field list; no value
 * normalization, including caller-added fields. Read each field in list order, twice when first defined;
 * inherited properties and original value aliases survive, even if a second
 * getter read returns undefined. Nullish payloads yield {}; native failures escape.
 * Record assertions describe native property access, not validation/boxing code.
 * @param {unknown} [payload]
 * @returns {Record<string, unknown>}
 */
const pickStatePatchFields = (payload) => STATE_PATCH_FIELDS.reduce((patch, field) => (
  /** @type {Record<string, unknown> | null | undefined} */ (payload)?.[field] === undefined
    ? patch
    : { ...patch, [field]: /** @type {Record<string, unknown>} */ (payload)[field] }
), /** @type {Record<string, unknown>} */ ({}));

/**
 * Fresh six-field string record, reading/trimming each field in declared order.
 * Only undefined selects {}; null fails at native property access, primitives
 * are boxed and getters can throw. Assertions permit those unvalidated reads.
 * @param {unknown} [config]
 * @returns {NonNullable<StatePatchPayload['visionConfig']>}
 */
const normalizeVisionConfig = (config = {}) => ({
  apiUrl: trimString(/** @type {Record<string, unknown>} */ (config).apiUrl),
  apiKey: trimString(/** @type {Record<string, unknown>} */ (config).apiKey),
  model: trimString(/** @type {Record<string, unknown>} */ (config).model),
  fallbackUrl: trimString(/** @type {Record<string, unknown>} */ (config).fallbackUrl),
  fallbackApiKey: trimString(/** @type {Record<string, unknown>} */ (config).fallbackApiKey),
  fallbackModel: trimString(/** @type {Record<string, unknown>} */ (config).fallbackModel)
});

/**
 * Fresh location using existing coordinate/text fallbacks. Destructure all five
 * fields once before conversion; no mutation or range validation. Only undefined
 * selects {}; null fails at native destructuring and getters/coercion can throw.
 * The record assertion permits that native operation, not input normalization.
 * @param {unknown} [manualLocation]
 * @returns {NonNullable<StatePatchPayload['manualLocation']>}
 */
const normalizeManualLocation = (manualLocation = {}) => {
  const { lat, lon, city, regionName, country } = /** @type {Record<string, unknown>} */ (manualLocation);

  return {
    lat: normalizeCoordinate(lat, 45.45),
    lon: normalizeCoordinate(lon, -73.56),
    city: trimString(city) || 'Verdun',
    regionName: trimString(regionName) || 'Quebec',
    country: trimString(country) || 'Canada'
  };
};

/** Identify supported durable display preferences, including explicit false/no-op retries.
 * Public command decoding supplies an own-enumerable widget record; preserve its
 * existing truthiness semantics without widening persistence for unrelated patches.
 * @param {unknown} patch @returns {boolean}
 */
const hasDurableDisplayPreference = (patch) => {
  const widgets = /** @type {{widgets?: unknown} | null | undefined} */ (patch)?.widgets;
  return widgets !== null && typeof widgets === 'object' && !Array.isArray(widgets)
    && (Object.prototype.propertyIsEnumerable.call(widgets, 'qrcode')
      || (Object.prototype.propertyIsEnumerable.call(widgets, 'blueLightFilter')
        && typeof /** @type {Record<string, unknown>} */ (widgets).blueLightFilter === 'boolean'));
};

module.exports = {
  hasDurableDisplayPreference,
  normalizeManualLocation,
  normalizeVisionConfig,
  pickStatePatchFields,
  STATE_PATCH_FIELDS
};
