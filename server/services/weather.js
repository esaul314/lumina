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

/**
 * 🌦️ classifyWeatherCode
 * Standard WMO Code classification mapping for smart environmental wallpapers.
 */
function classifyWeatherCode(code) {
  let physicalMatch = 'Cloudy';
  let physicalCond = 'Cloudy / Overcast';

  if (code === 0) {
    physicalMatch = 'Sunny';
    physicalCond = 'Sunny / Clear';
  } else if ([1, 2, 3, 45, 48].includes(code)) {
    physicalMatch = 'Cloudy';
    physicalCond = 'Cloudy / Overcast';
  } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
    physicalMatch = 'Rainy';
    physicalCond = 'Rainy / Stormy';
  } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
    physicalMatch = 'Snowy';
    physicalCond = 'Snowy / Wintry';
  }

  return { physicalMatch, physicalCond };
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
