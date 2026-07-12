// @ts-check

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

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeCoordinate = (value, fallback) => {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickStatePatchFields = (payload) => STATE_PATCH_FIELDS.reduce((patch, field) => (
  payload?.[field] === undefined
    ? patch
    : { ...patch, [field]: payload[field] }
), /** @type {Record<string, unknown>} */ ({}));

const normalizeVisionConfig = (config = {}) => ({
  apiUrl: trimString(config.apiUrl),
  apiKey: trimString(config.apiKey),
  model: trimString(config.model),
  fallbackUrl: trimString(config.fallbackUrl),
  fallbackApiKey: trimString(config.fallbackApiKey),
  fallbackModel: trimString(config.fallbackModel)
});

const normalizeManualLocation = (manualLocation = {}) => {
  const { lat, lon, city, regionName, country } = manualLocation;

  return {
    lat: normalizeCoordinate(lat, 45.45),
    lon: normalizeCoordinate(lon, -73.56),
    city: trimString(city) || 'Verdun',
    regionName: trimString(regionName) || 'Quebec',
    country: trimString(country) || 'Canada'
  };
};

module.exports = {
  normalizeManualLocation,
  normalizeVisionConfig,
  pickStatePatchFields,
  STATE_PATCH_FIELDS
};
