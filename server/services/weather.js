/**
 * 🌦️ Weather & Geolocation Service
 * Fuses IP-based coordinates with real-time Open-Meteo meteorological metrics.
 * Maps physical conditions directly to environmental screen profiles.
 */

/**
 * 📍 getIpLocation
 * Resolves local IP coordinates. Hardcoded to Verdun, Montreal, Canada 
 * to guarantee 100% correct screensaver telemetry.
 */
async function getIpLocation() {
  return {
    lat: 45.45,
    lon: -73.56,
    city: 'Verdun',
    regionName: 'Quebec',
    country: 'Canada'
  };
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

module.exports = {
  getIpLocation,
  classifyWeatherCode,
  fetchWeatherForecast
};
