// @ts-check

/**
 * @typedef {'Sunny' | 'Cloudy' | 'Rainy' | 'Snowy'} WeatherMatch
 * @typedef {'Sunny / Clear' | 'Cloudy / Overcast' | 'Rainy / Stormy' | 'Snowy / Wintry'} WeatherCondition
 * @typedef {object} WeatherClassification
 * @property {WeatherMatch} physicalMatch
 * @property {WeatherCondition} physicalCond
 */

const config = require('../config/configLoader.js');

/**
 * 🌦️ Weather & Geolocation Service
 * Fuses IP-based coordinates with real-time Open-Meteo meteorological metrics.
 * Maps physical conditions directly to environmental screen profiles.
 */

/**
 * @typedef {{lat: number, lon: number, city: string, regionName: string, country: string}} IpLocation
 * @typedef {{fetchImpl?: typeof fetch, timeoutMs?: number, log?: Pick<Console, 'log' | 'warn'>}} LocationLookupOptions
 */

/** Pure projection: an incomplete/invalid provider record is not a location.
 * @param {unknown} data
 * @returns {IpLocation | null}
 */
const projectIpLocation = data => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { latitude: lat, longitude: lon, city, region: regionName, country, success } =
    /** @type {Record<string, unknown>} */ (data);
  return success !== true
    || typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90
    || typeof lon !== 'number' || !Number.isFinite(lon) || Math.abs(lon) > 180
    || typeof city !== 'string' || !city.trim()
    || typeof regionName !== 'string' || !regionName.trim()
    || typeof country !== 'string' || !country.trim()
    ? null
    : { lat, lon, city: city.trim(), regionName: regionName.trim(), country: country.trim() };
};

/** Resolve automatic coordinates through ipwho.is's HTTPS caller-IP endpoint.
 * The deadline covers fetch AND JSON consumption, even if a transport ignores
 * cancellation. One attempt; every failure preserves the configured fallback.
 * @param {LocationLookupOptions} [options]
 */
async function getIpLocation({ fetchImpl = fetch, timeoutMs = 3_000, log = console } = {}) {
  const fallbackLocation = config.location;
  const controller = new AbortController();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  try {
    /** @type {Promise<never>} */
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('IP location deadline exceeded'));
      }, timeoutMs);
    });
    const lookup = async () => {
      const response = await fetchImpl('https://ipwho.is/', {
        signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('IP location request rejected');
      const location = projectIpLocation(await response.json());
      if (!location) throw new Error('Invalid IP location response');
      return location;
    };
    const location = await Promise.race([lookup(), deadline]);
    log.log('IP Geolocation: Automatic location resolved.');
    return location;
  } catch {
    log.warn('IP Geolocation: Lookup unavailable; using configured location.');
    return fallbackLocation;
  } finally {
    clearTimeout(timer);
    // ponytail: one request owns its timer and body; no retry service or cache.
    controller.abort();
  }
}

// WMO weather code to environmental mapping dictionary
/** @type {Readonly<Record<number, WeatherClassification>>} */
const weatherCodeMap = {
  0: { physicalMatch: 'Sunny', physicalCond: 'Sunny / Clear' },
  1: { physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' },
  2: { physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' },
  3: { physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' },
  45: { physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' },
  48: { physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' },
  51: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  53: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  55: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  56: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  57: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  61: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  63: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  65: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  67: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  80: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  81: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  82: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  95: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  96: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  99: { physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' },
  71: { physicalMatch: 'Snowy', physicalCond: 'Snowy / Wintry' },
  73: { physicalMatch: 'Snowy', physicalCond: 'Snowy / Wintry' },
  75: { physicalMatch: 'Snowy', physicalCond: 'Snowy / Wintry' },
  77: { physicalMatch: 'Snowy', physicalCond: 'Snowy / Wintry' },
  85: { physicalMatch: 'Snowy', physicalCond: 'Snowy / Wintry' },
  86: { physicalMatch: 'Snowy', physicalCond: 'Snowy / Wintry' }
};

/**
 * 🌦️ classifyWeatherCode
 * Pure WMO classification projection for smart environmental wallpapers.
 * Unknown codes retain the existing cloudy/overcast fallback.
 *
 * @param {number} code
 * @returns {WeatherClassification}
 */
function classifyWeatherCode(code) {
  return weatherCodeMap[code] || { physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' };
}

/**
 * Normalize consumed daily columns without compacting their original indices.
 * Slot zero remains the provider's today slot, even when it is unavailable.
 * Unused provider fields stay opaque; only the four consumed columns are admitted.
 * @param {unknown} input
 */
const projectDailyForecast = input => {
  const daily = /** @type {Record<string, unknown>} */ (
    input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  );
  const times = Array.isArray(daily.time) ? daily.time : [];
  const rows = Array.from(times, (time, index) => {
    const maximum = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[index] : undefined;
    const minimum = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[index] : undefined;
    const code = Array.isArray(daily.weather_code) ? daily.weather_code[index] : undefined;
    const validDate = typeof time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(time)
      && Number.isFinite(Date.parse(time)) && new Date(time).toISOString().slice(0, 10) === time;
    return validDate && typeof maximum === 'number' && Number.isFinite(maximum)
      && typeof minimum === 'number' && Number.isFinite(minimum) && minimum <= maximum
      && typeof code === 'number' && Number.isFinite(code) ? { time, maximum, minimum, code } : null;
  });
  // ponytail: unavailable slots preserve alignment; no index marker or second cache.
  return { ...daily, time: rows.map(row => row?.time ?? null),
    temperature_2m_max: rows.map(row => row?.maximum ?? null),
    temperature_2m_min: rows.map(row => row?.minimum ?? null), weather_code: rows.map(row => row?.code ?? null) };
};

/**
 * @typedef {{current: Record<string, unknown> & {temperature_2m: number, weather_code: number}, daily?: unknown}} WeatherForecast
 * @typedef {{fetchImpl?: typeof fetch, timeoutMs?: number}} ForecastLookupOptions
 */

/** Admit current observations independently of unavailable daily slots.
 * Unknown finite WMO codes retain the existing fallback classification.
 * @param {unknown} data
 * @returns {WeatherForecast}
 */
function validateWeatherForecast(data) {
  const record = /** @type {Record<string, unknown> | null} */ (
    data && typeof data === 'object' && !Array.isArray(data) ? data : null
  );
  const current = /** @type {Record<string, unknown> | null} */ (
    record?.current && typeof record.current === 'object' && !Array.isArray(record.current) ? record.current : null
  );
  if (!record || record.error || !current
    || typeof current.temperature_2m !== 'number' || !Number.isFinite(current.temperature_2m)
    || typeof current.weather_code !== 'number' || !Number.isFinite(current.weather_code)) {
    throw new Error('Invalid Open-Meteo forecast response');
  }
  return /** @type {WeatherForecast} */ ({ ...record, daily: projectDailyForecast(record.daily) });
}

/**
 * One forecast attempt with a whole-operation deadline, including body decoding.
 * Race observes late outcomes even when a transport ignores cancellation.
 * @param {number} lat
 * @param {number} lon
 * @param {ForecastLookupOptions} [options]
 */
async function fetchWeatherForecast(lat, lon, { fetchImpl = fetch, timeoutMs = 5_000 } = {}) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  const controller = new AbortController();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  try {
    /** @type {Promise<never>} */
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Open-Meteo forecast deadline exceeded'));
        controller.abort();
      }, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5_000);
    });
    const lookup = async () => {
      const response = await fetchImpl(weatherUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`Open-Meteo API error: status ${response.status}`);
      return validateWeatherForecast(await response.json());
    };
    return await Promise.race([lookup(), deadline]);
  } finally {
    clearTimeout(timer);
    // ponytail: request-local cleanup, not a retry service or shared controller.
    controller.abort();
  }
}

/**
 * 📍 resolveActiveLocation
 * Resolves active location coordinates based on central state settings.
 * @param {LocationLookupOptions} [options]
 */
async function resolveActiveLocation(state, options) {
  if (state && state.autoLocation === false && state.manualLocation) {
    (options?.log ?? console).log('IP Geolocation: Using configured manual location.');
    return state.manualLocation;
  }
  return getIpLocation(options);
}

module.exports = {
  getIpLocation,
  resolveActiveLocation,
  classifyWeatherCode,
  fetchWeatherForecast,
  validateWeatherForecast,
  projectDailyForecast
};
