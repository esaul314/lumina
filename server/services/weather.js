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
 * 🛰️ fetchWeatherForecast
 * Connects to Open-Meteo's API to fetch the current and daily telemetry datasets.
 */
async function fetchWeatherForecast(lat, lon) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  const res = await fetch(weatherUrl);
  if (!res.ok) {
    throw new Error(`Open-Meteo API error: status ${res.status}`);
  }
  return res.json();
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
  fetchWeatherForecast
};
