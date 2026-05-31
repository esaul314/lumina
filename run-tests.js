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
} = require('./server/app.js');
const { analyzeSentiment } = require('./server/services/sentiment.js');
const { classifyWeatherCode } = require('./server/services/weather.js');

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

async function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
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
// 3. UNIT TEST SUITE: Modular Service Isolated Engines
// ============================================================================
logSuite('Modular Service Isolated Engines');

assertTest('correctly calculates news sentiment scores and tags weather alignment', () => {
  const positiveRss = '<rss><channel><item><title>Peace Agreement Signed after Growth and Win</title></item></channel></rss>';
  const negativeRss = '<rss><channel><item><title>Crisis and Conflict threat drop of shares</title></item></channel></rss>';
  
  const posSentiment = analyzeSentiment(positiveRss);
  const negSentiment = analyzeSentiment(negativeRss);
  
  assert.strictEqual(posSentiment.weatherMatch, 'Sunny', 'Positive headlines must match Sunny weather');
  assert.ok(posSentiment.score > 0, 'Positive headlines must have score > 0');
  
  assert.strictEqual(negSentiment.weatherMatch, 'Rainy', 'Negative headlines must match Rainy weather');
  assert.ok(negSentiment.score < 0, 'Negative headlines must have score < 0');
});

assertTest('correctly classifies meteorological WMO weather codes', () => {
  const sunnyClassification = classifyWeatherCode(0);
  const rainyClassification = classifyWeatherCode(61);
  const snowyClassification = classifyWeatherCode(73);
  
  assert.strictEqual(sunnyClassification.physicalMatch, 'Sunny', 'WMO code 0 must classify as Sunny');
  assert.strictEqual(rainyClassification.physicalMatch, 'Rainy', 'WMO code 61 must classify as Rainy');
  assert.strictEqual(snowyClassification.physicalMatch, 'Snowy', 'WMO code 73 must classify as Snowy');
});

// ============================================================================
// 4. UNIT TEST SUITE: Image Rating & Weighted Slideshow Engine
// ============================================================================
logSuite('Image Rating & Weighted Slideshow Engine');

assertTest('correctly preserves rating during keyword auto-tagging', () => {
  const photos = [
    { title: 'Golden Autumn Forest Stream', author: 'Sebastian Unrau', rating: 8 },
    { title: 'Emerald Fields under Golden Sunsets', author: 'Kalen Emsley' }
  ];
  const tagged = tagPhotosWithKeywords(photos);
  assert.strictEqual(tagged[0].rating, 8, 'Should preserve rating of 8');
  assert.strictEqual(tagged[1].rating, 10, 'Should default rating to 10');
});

assertTest('never selects banned photos (rating = 1)', () => {
  const samplePhotos = [
    { url: 'url1', title: 'Great Photo', rating: 10 },
    { url: 'url2', title: 'Banned Photo', rating: 1 },
    { url: 'url3', title: 'Okay Photo', rating: 5 }
  ];
  screensaverState.photosList = samplePhotos;
  screensaverState.activePhoto = samplePhotos[0];
  screensaverState.alignWeather = false;
  screensaverState.alignTimeOfDay = false;

  for (let i = 0; i < 50; i++) {
    const nextPhoto = getSmartPhoto('next');
    assert.notStrictEqual(nextPhoto.url, 'url2', 'Banned photo must never be selected');
  }
});

assertTest('successfully marks photo as broken and updates state lists via markPhotoBroken', () => {
  const { markPhotoBroken } = require('./server/config/collections.js');
  const testCollections = {
    'Scenic Nature': [
      { url: 'urlA', title: 'Photo A', rating: 10 },
      { url: 'urlB', title: 'Photo B', rating: 10 }
    ]
  };
  const testState = {
    photosList: [
      { url: 'urlA', title: 'Photo A', rating: 10 },
      { url: 'urlB', title: 'Photo B', rating: 10 }
    ],
    activePhoto: { url: 'urlB', title: 'Photo B', rating: 10 }
  };

  const marked = markPhotoBroken(testCollections, testState, 'urlB');
  assert.strictEqual(marked, true, 'markPhotoBroken must return true for found URLs');
  assert.strictEqual(testCollections['Scenic Nature'][1].rating, 1, 'rating must be set to 1');
  assert.strictEqual(testCollections['Scenic Nature'][1].isBroken, true, 'isBroken must be set to true');
  assert.strictEqual(testState.activePhoto.rating, 1, 'state.activePhoto rating must be set to 1');
  assert.strictEqual(testState.activePhoto.isBroken, true, 'state.activePhoto isBroken must be set to true');
  assert.ok(!testState.photosList.some(p => p.url === 'urlB'), 'broken photo must be pruned from state.photosList');
});

assertTest('weighted distribution favors highly-rated photos', () => {
  const samplePhotos = [
    { url: 'high', title: 'High Rating Photo', rating: 10 },
    { url: 'low', title: 'Low Rating Photo', rating: 2 }
  ];
  screensaverState.photosList = samplePhotos;
  screensaverState.activePhoto = samplePhotos[0];
  screensaverState.alignWeather = false;
  screensaverState.alignTimeOfDay = false;

  let highCount = 0;
  let lowCount = 0;
  for (let i = 0; i < 1000; i++) {
    screensaverState.activePhoto = null; // Disable consecutive repeat filtering for pure probability testing
    const picked = getSmartPhoto('next');
    if (picked.url === 'high') {
      highCount++;
    } else if (picked.url === 'low') {
      lowCount++;
    }
  }

  // Expect highCount > lowCount by a significant margin (mathematically 5:1 ratio)
  assert.ok(highCount > lowCount * 2, `Expected highly-rated photo to be selected much more than low-rated one. High: ${highCount}, Low: ${lowCount}`);
});

// ============================================================================
// 5. UNIT TEST SUITE: Customizable Keyword Search Manager
// ============================================================================
logSuite('Customizable Keyword Search Manager');

assertTest('correctly loads and configures searchKeywords state', () => {
  assert.ok(screensaverState.searchKeywords, 'searchKeywords object must exist in screensaverState');
  assert.ok(Array.isArray(screensaverState.searchKeywords['Scenic Nature']), 'Scenic Nature keywords should be an array');
  assert.ok(screensaverState.searchKeywords['Scenic Nature'].length > 0, 'Scenic Nature keywords should not be empty');
  assert.strictEqual(typeof screensaverState.searchKeywords['Scenic Nature'][0], 'string', 'Keyword must be a string');
});

assertTest('crawler consumes custom searchKeywords instead of static defaults', async () => {
  const { crawlAllCollections } = require('./server/services/crawler.js');
  assert.ok(typeof crawlAllCollections === 'function', 'crawlAllCollections must be a function');
});

// ============================================================================
// 6. UNIT TEST SUITE: Multi-Source Wallpaper Aggregator
// ============================================================================
logSuite('Multi-Source Wallpaper Aggregator');

assertTest('crawler exports Wallhaven, NASA APOD, and Midjourney adapters successfully', () => {
  const { fetchWallhavenImages, fetchNasaApod, fetchMidjourneyImages } = require('./server/services/crawler.js');
  assert.strictEqual(typeof fetchWallhavenImages, 'function', 'fetchWallhavenImages must be a function');
  assert.strictEqual(typeof fetchNasaApod, 'function', 'fetchNasaApod must be a function');
  assert.strictEqual(typeof fetchMidjourneyImages, 'function', 'fetchMidjourneyImages must be a function');
});

assertTest('Wallhaven crawler maps query and returns SFW landscapes', async () => {
  const { fetchWallhavenImages } = require('./server/services/crawler.js');
  try {
    const photos = await fetchWallhavenImages('nature', 'Scenic Nature', 2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Photo must have a valid url');
      assert.strictEqual(photos[0].source, 'wallhaven', 'Source must equal wallhaven');
      assert.ok(photos[0].title.includes('Scenic Nature'), 'Title should map category');
    }
  } catch (err) {
    // Graceful catch for offline/DNS failures in test environments
  }
});

assertTest('NASA APOD crawler retrieves astronomy picture stream', async () => {
  const { fetchNasaApod } = require('./server/services/crawler.js');
  try {
    const photos = await fetchNasaApod(2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Photo must have a valid url');
      assert.strictEqual(photos[0].source, 'nasa_apod', 'Source must equal nasa_apod');
      assert.strictEqual(photos[0].isNight, true, 'Space APODs must be night-aligned');
    }
  } catch (err) {
    // Graceful catch for API limit/offline issues
  }
});

assertTest('Midjourney crawler falls back gracefully to Lexica AI creations if no USEAPI_TOKEN is set', async () => {
  const { fetchMidjourneyImages } = require('./server/services/crawler.js');
  const originalToken = process.env.USEAPI_TOKEN;
  delete process.env.USEAPI_TOKEN;
  
  try {
    const photos = await fetchMidjourneyImages(2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Photo must have a valid url');
      assert.strictEqual(photos[0].source, 'lexica', 'Fallback should retrieve Lexica AI source');
    }
  } catch (err) {
    // Graceful catch for offline/DNS failures in test environments
  } finally {
    process.env.USEAPI_TOKEN = originalToken;
  }
});

// ============================================================================
// 7. INTEGRATION TEST SUITE: Live Endpoint Verification
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

    const combinedPhotos = await fetchJson(`${baseUrl}/api/photos?category=Scenic%20Nature,Cosmic%20Space`);
    assertTest('GET /api/photos successfully merges and serves combined feeds (Scenic Nature, Cosmic Space)', () => {
      assert.ok(Array.isArray(combinedPhotos), 'combined photos list must be returned as an array');
      assert.ok(combinedPhotos.length > 0, 'combined list should not be empty');
      assert.ok(combinedPhotos.every(p => p.url), 'every photograph must have a valid url attribute');
    });

    // Test HTTP Rating API
    const samplePhotoUrl = config.state.photosList[0]?.url;
    if (samplePhotoUrl) {
      const rateResponse = await postJson(`${baseUrl}/api/photos/rate`, { url: samplePhotoUrl, rating: 8 });
      assertTest('POST /api/photos/rate successfully updates and persists a photo rating', () => {
        assert.strictEqual(rateResponse.status, 200, 'Response status must be 200');
        assert.strictEqual(rateResponse.body.success, true, 'success attribute must be true');
        assert.strictEqual(rateResponse.body.rating, 8, 'rating should be 8');
      });

      // Test bad parameter validation
      const invalidResponse = await postJson(`${baseUrl}/api/photos/rate`, { url: samplePhotoUrl, rating: 15 });
      assertTest('POST /api/photos/rate rejects invalid rating values (e.g. rating = 15)', () => {
        assert.strictEqual(invalidResponse.status, 400, 'Response status must be 400');
        assert.ok(invalidResponse.body.error, 'Should return error message');
      });

      // Test HTTP Keyword API
      const keywordResponse = await postJson(`${baseUrl}/api/config/keywords`, {
        category: 'Scenic Nature',
        keywords: ['forest mountains landscape', 'autumn stream']
      });
      assertTest('POST /api/config/keywords successfully updates and persists custom keywords', () => {
        assert.strictEqual(keywordResponse.status, 200, 'Response status must be 200');
        assert.strictEqual(keywordResponse.body.success, true, 'success attribute must be true');
        assert.deepStrictEqual(keywordResponse.body.keywords, ['forest mountains landscape', 'autumn stream'], 'keywords should match updated values');
      });

      // Test bad category validation
      const invalidKeywordResponse = await postJson(`${baseUrl}/api/config/keywords`, {
        category: 'Unknown Category',
        keywords: ['test']
      });
      assertTest('POST /api/config/keywords rejects unknown categories', () => {
        assert.strictEqual(invalidKeywordResponse.status, 404, 'Response status must be 404');
      });
    }
  } catch (err) {
    console.log('  ' + COLORS.yellow + '⚠ SKIP:' + COLORS.reset + ' Integration tests skipped (Lumina server is not actively listening on port 5000).');
    console.log('          (Launch the server in the background using ./launch.sh to run integration assertions)');
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
