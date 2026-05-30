/**
 * 🌌 LUMINA REGRESSION TEST SUITE & DIAGNOSTIC RUNNER
 * --------------------------------------------------
 * A lightweight, zero-dependency unit and integration testing framework.
 * Guards Lumina against regressions in core algorithms, spelling hotfixes,
 * weather alignment engines, and active API endpoints.
 */

// 1. Set environment to test to suppress side-effects (port binds/active daemons)
process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const { 
  tagPhotosWithKeywords, 
  getSmartPhoto, 
  screensaverState 
} = require('./server.js');

// Formatting constants for clean terminal reports
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const STATS = {
  passed: 0,
  failed: 0,
  total: 0
};

function logSuite(name) {
  console.log(`\n${COLORS.bold}${COLORS.cyan}=== SUITE: ${name} ===${COLORS.reset}`);
}

function assertTest(name, fn) {
  STATS.total++;
  try {
    fn();
    console.log(`  ${COLORS.green}✓ PASS:${COLORS.reset} ${name}`);
    STATS.passed++;
  } catch (err) {
    console.log(`  ${COLORS.red}✗ FAIL:${COLORS.reset} ${name}`);
    console.error(`    Assertion Error: ${err.message}`);
    STATS.failed++;
  }
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

// ============================================================================
// 1. UNIT TEST SUITE: Atmospheric Keyword Auto-Tagging
// ============================================================================
logSuite('Atmospheric Keyword Auto-Tagging');

assertTest('correctly tags night-themed titles', () => {
  const photos = [
    { title: 'Fluorescent Green Corridor in Midnight Sleep', author: 'Scarbor Siu' },
    { title: 'Serene Purple Twilight Beach', author: 'Sean Oulashin' },
    { title: 'Silent Deserted Warehouse Under Pale Night Light', author: 'Jorg Angeli' }
  ];
  
  const tagged = tagPhotosWithKeywords(photos);
  
  assert.strictEqual(tagged[0].isNight, true, 'Midnight should map to isNight=true');
  assert.strictEqual(tagged[1].isNight, true, 'Twilight should map to isNight=true');
  assert.strictEqual(tagged[2].isNight, true, 'Night should map to isNight=true');
});

assertTest('correctly tags weather-themed titles', () => {
  const photos = [
    { title: 'Empty Laundromat Window Glowing in the Rain', author: 'Benjamin Lehman' },
    { title: 'Monstera Leaves in Dewy Jungle Light', author: 'Kari Shea' },
    { title: 'Towering Sun-Drenched Redwoods', author: 'Jay Mantri' },
    { title: 'Snowy Peak Touched by Clouds', author: 'Benjamin Voros' }
  ];
  
  const tagged = tagPhotosWithKeywords(photos);
  
  assert.strictEqual(tagged[0].isRain, true, 'Rain should map to isRain=true');
  assert.strictEqual(tagged[1].isRain, true, 'Dewy should map to isRain=true');
  assert.strictEqual(tagged[2].isSunny, true, 'Sun-Drenched should map to isSunny=true');
  assert.strictEqual(tagged[3].isSnowy, true, 'Snowy should map to isSnowy=true');
  assert.strictEqual(tagged[3].isCloudy, true, 'Clouds should map to isCloudy=true');
});

// ============================================================================
// 2. UNIT TEST SUITE: Smart Wallpaper Selector Engine
// ============================================================================
logSuite('Smart Wallpaper Selector Engine');

assertTest('picks atmospheric photos when weather alignment is enabled', () => {
  const samplePhotos = [
    { url: 'url1', title: 'Sunny Meadow', isSunny: true, isRain: false, isNight: false },
    { url: 'url2', title: 'Rainy Alleyway', isSunny: false, isRain: true, isNight: false },
    { url: 'url3', title: 'Moody Fog', isSunny: false, isRain: false, isCloudy: true, isNight: false }
  ];
  
  // Set up mock server state
  screensaverState.photosList = samplePhotos;
  screensaverState.activePhoto = samplePhotos[0];
  screensaverState.alignWeather = true;
  screensaverState.physicalWeather = {
    temp: 10,
    condition: 'Rainy / Stormy',
    weatherMatch: 'Rainy'
  };

  // Run selector 20 times, should heavily prefer Rainy alleyway (url2)
  let pickedRainy = 0;
  for (let i = 0; i < 20; i++) {
    const nextPhoto = getSmartPhoto('next');
    if (nextPhoto && nextPhoto.url === 'url2') {
      pickedRainy++;
    }
  }

  // The selector engine has an 80% preference rate for weather match
  assert.ok(pickedRainy > 10, `Expected rainy photo to be picked most of the time (Picked count: ${pickedRainy}/20)`);
});

// ============================================================================
// 3. INTEGRATION TEST SUITE: Live Endpoint Verification
// ============================================================================
logSuite('Live Server Endpoint Smoke Tests');

async function runIntegrationTests() {
  const port = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${port}`;
  
  // Confirm that the server is alive on port 5000
  try {
    const config = await fetchJson(`${baseUrl}/api/config`);
    
    assertTest('GET /api/config successfully retrieves configuration and network data', () => {
      assert.ok(Array.isArray(config.localIps), 'localIps should be an array');
      assert.strictEqual(config.port, 5000, 'port should equal 5000');
      assert.ok(config.state, 'state object must be present');
    });

    const weather = await fetchJson(`${baseUrl}/api/weather`);
    assertTest('GET /api/weather serves live Open-Meteo telemetry geolocated to Montreal', () => {
      assert.ok(weather.location, 'location data should be populated');
      assert.strictEqual(weather.location.city, 'Verdun', 'City should be geolocated to Verdun');
      assert.ok(weather.current, 'current weather telemetry must be present');
      assert.ok(weather.daily, 'daily forecast arrays must be present');
    });

    const normalizedPhotos = await fetchJson(`${baseUrl}/api/photos?category=Liminal%20Space`);
    assertTest('GET /api/photos successfully normalizes category spelling (Liminal Space -> Liminal Spaces)', () => {
      assert.ok(Array.isArray(normalizedPhotos), 'photos list must be returned as an array');
      assert.ok(normalizedPhotos.length > 0, 'normalized list should not be empty');
      assert.ok(normalizedPhotos.every(p => p.url), 'every photograph must have a valid url attribute');
    });

    const aiNormalizedPhotos = await fetchJson(`${baseUrl}/api/photos?category=AI%20Creation`);
    assertTest('GET /api/photos successfully normalizes category spelling (AI Creation -> AI Creations)', () => {
      assert.ok(Array.isArray(aiNormalizedPhotos), 'AI Creations photos list must be returned as an array');
      assert.ok(aiNormalizedPhotos.length > 0, 'normalized AI Creations list should not be empty');
      assert.ok(aiNormalizedPhotos.every(p => p.url), 'every AI Creation photograph must have a valid url attribute');
    });
    
  } catch (err) {
    console.log(`  ${COLORS.yellow}⚠ SKIP:${COLORS.reset} Integration tests skipped (Lumina server is not actively listening on port 5000).`);
    console.log(`          (Launch the server in the background using ./launch.sh to run integration assertions)`);
  }

  // Test Runner Final Dashboard
  console.log(`\n${COLORS.bold}=======================================${COLORS.reset}`);
  console.log(`${COLORS.bold}📊 DIAGNOSTIC REPORT:${COLORS.reset}`);
  console.log(`  Total Executed Tests: ${STATS.total}`);
  console.log(`  Passed assertions   : ${COLORS.green}${STATS.passed}${COLORS.reset}`);
  console.log(`  Failed assertions   : ${STATS.failed > 0 ? COLORS.red : COLORS.reset}${STATS.failed}${COLORS.reset}`);
  console.log(`${COLORS.bold}=======================================${COLORS.reset}\n`);

  if (STATS.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run integration async test suite
runIntegrationTests();
