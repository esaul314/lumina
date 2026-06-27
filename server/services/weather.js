const config = require('../config/configLoader.js');

/**
 * 🌦️ Weather & Geolocation Service
 * Fuses IP-based coordinates with real-time Open-Meteo meteorological metrics.
 * Maps physical conditions directly to environmental screen profiles.
 */

/**
 * 📍 getIpLocation
 * Resolves local IP coordinates. Falls back to configured location to guarantee correct screensaver telemetry.
 */
async function getIpLocation() {
  const fallbackLocation = config.location;

  try {
    console.log('IP Geolocation: Querying live IP coordinates...');
    const res = await fetch('http://ip-api.com/json/');
    if (!res.ok) {
      console.warn(`IP Geolocation: Query failed with status ${res.status}. Falling back to default coordinates.`);
      return fallbackLocation;
    }

    const data = await res.json();
    if (data && data.status === 'success' && data.lat !== undefined && data.lon !== undefined) {
      console.log(`IP Geolocation: Located successfully to ${data.city}, ${data.regionName}, ${data.country}.`);
      return {
        lat: data.lat,
        lon: data.lon,
        city: data.city || 'Verdun',
        regionName: data.regionName || 'Quebec',
        country: data.country || 'Canada'
      };
    }

    console.warn('IP Geolocation: API responded with unsuccessful status, falling back.');
    return fallbackLocation;
  } catch (err) {
    console.warn('IP Geolocation: Service failed or request timed out:', err.message);
    return fallbackLocation;
  }
}

// WMO weather code to environmental mapping dictionary
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
 * Standard WMO Code classification mapping for smart environmental wallpapers.
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
 */
async function resolveActiveLocation(state) {
  if (state && state.autoLocation === false && state.manualLocation) {
    console.log('IP Geolocation: Using manual coordinates overrides:', state.manualLocation.city);
    return state.manualLocation;
  }
  return await getIpLocation();
}

module.exports = {
  getIpLocation,
  resolveActiveLocation,
  classifyWeatherCode,
  fetchWeatherForecast
};
