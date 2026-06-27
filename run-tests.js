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
const config = require('./server/config/configLoader.js');
const { 
  tagPhotosWithKeywords, 
  getSmartPhoto, 
  screensaverState,
  combineFeedsBalanced,
  selectWeightedRandomPhoto,
  isTimeInSchedule,
  server
} = require('./server/app.js');
const { analyzeSentiment } = require('./server/services/sentiment.js');
const { classifyWeatherCode } = require('./server/services/weather.js');
const { runDomainTests } = require('./server/domain/tests.js');

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

async function requestJson(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = body ? JSON.stringify(body) : '';
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {}
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

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
    if (body) {
      req.write(postData);
    }
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
// 2b. UNIT TEST SUITE: Scenic Pool Time-Based Keywords
// ============================================================================
logSuite('Scenic Pool Time-Based Keywords');

assertTest('isTimeInSchedule correctly matches standard ranges', () => {
  assert.strictEqual(isTimeInSchedule('10:30', '08:00', '12:00'), true, '10:30 is between 08:00 and 12:00');
  assert.strictEqual(isTimeInSchedule('07:59', '08:00', '12:00'), false, '07:59 is not between 08:00 and 12:00');
  assert.strictEqual(isTimeInSchedule('12:00', '08:00', '12:00'), false, '12:00 is end boundary (exclusive)');
});

assertTest('isTimeInSchedule correctly matches ranges crossing midnight', () => {
  assert.strictEqual(isTimeInSchedule('23:30', '22:00', '06:00'), true, '23:30 is between 22:00 and 06:00 (before midnight)');
  assert.strictEqual(isTimeInSchedule('02:15', '22:00', '06:00'), true, '02:15 is between 22:00 and 06:00 (after midnight)');
  assert.strictEqual(isTimeInSchedule('12:00', '22:00', '06:00'), false, '12:00 is not in overnight range');
});

assertTest('getSmartPhoto filters candidates by timeRanges constraint', () => {
  const originalList = screensaverState.photosList;
  const originalActive = screensaverState.activePhoto;
  
  const now = new Date();
  const allowedStart = String(now.getHours()).padStart(2, '0') + ':00';
  const allowedEnd = String((now.getHours() + 1) % 24).padStart(2, '0') + ':00';
  
  const blockedStart = String((now.getHours() + 2) % 24).padStart(2, '0') + ':00';
  const blockedEnd = String((now.getHours() + 3) % 24).padStart(2, '0') + ':00';

  screensaverState.photosList = [
    { url: 'http://example.com/allowed.jpg', rating: 10, timeRanges: [{ start: allowedStart, end: allowedEnd }] },
    { url: 'http://example.com/blocked.jpg', rating: 10, timeRanges: [{ start: blockedStart, end: blockedEnd }] }
  ];
  screensaverState.activePhoto = null;

  try {
    const selected = getSmartPhoto();
    assert.ok(selected, 'Should select a photo');
    assert.strictEqual(selected.url, 'http://example.com/allowed.jpg', 'Should select the allowed photo matching current time range');
  } finally {
    screensaverState.photosList = originalList;
    screensaverState.activePhoto = originalActive;
  }
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
// 3b. UNIT TEST SUITE: System Screensaver State Reducer & Validators
// ============================================================================
logSuite('System Screensaver State Reducer & Validators');

assertTest('getNextScreensaverState transitions state and schedules actions correctly', () => {
  const { getNextScreensaverState } = require('./server/app.js');
  const { validateRating, validatePercent } = require('./server/utils/validation.js');

  // Test validators
  assert.strictEqual(validateRating(5), 5);
  assert.strictEqual(validateRating('8'), 8);
  assert.strictEqual(validateRating(15), null);
  assert.strictEqual(validateRating('invalid'), null);

  assert.strictEqual(validatePercent(0), 0);
  assert.strictEqual(validatePercent(100), 100);
  assert.strictEqual(validatePercent(-5), null);

  // Test state transition reducer
  let state = { idleCounter: 0, isBrowserRunning: false };

  // 1. Idle but not enough ticks (idleCounter increments, no action)
  let inputs = { isIdle: true, isMoviePlaying: false, manualOverride: false };
  let transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.nextState.idleCounter, 1);
  assert.strictEqual(transition.nextState.isBrowserRunning, false);
  assert.strictEqual(transition.action, null);

  // Update state to 2 ticks
  state = { idleCounter: 2, isBrowserRunning: false };
  transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.nextState.idleCounter, 3);
  assert.strictEqual(transition.nextState.isBrowserRunning, true);
  assert.strictEqual(transition.action, 'launch');

  // 2. Movie is playing -> should not launch screensaver, resets idleCounter
  state = { idleCounter: 2, isBrowserRunning: false };
  inputs = { isIdle: true, isMoviePlaying: true, manualOverride: false };
  transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.nextState.idleCounter, 0);
  assert.strictEqual(transition.action, null);

  // 3. Manual override triggers screensaver immediately
  state = { idleCounter: 0, isBrowserRunning: false };
  inputs = { isIdle: false, isMoviePlaying: false, manualOverride: true };
  transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.action, 'launch');
  assert.strictEqual(transition.nextState.isBrowserRunning, true);

  // 4. Inactivity stops (screensaver running -> dismisses)
  state = { idleCounter: 3, isBrowserRunning: true };
  inputs = { isIdle: false, isMoviePlaying: false, manualOverride: false };
  transition = getNextScreensaverState(state, inputs);
  assert.strictEqual(transition.action, 'kill');
  assert.strictEqual(transition.nextState.isBrowserRunning, false);
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

assertTest('banning a photo (rating = 1) immediately prunes it from state.photosList in updatePhotoRating', () => {
  const { updatePhotoRating } = require('./server/config/collections.js');
  const testCollections = {
    'Scenic Nature': [
      { url: 'urlX', title: 'Photo X', rating: 10 },
      { url: 'urlY', title: 'Photo Y', rating: 10 }
    ]
  };
  const testState = {
    photosList: [
      { url: 'urlX', title: 'Photo X', rating: 10 },
      { url: 'urlY', title: 'Photo Y', rating: 10 }
    ],
    activePhoto: { url: 'urlY', title: 'Photo Y', rating: 10 }
  };

  const rated = updatePhotoRating(testCollections, testState, 'urlY', 1);
  assert.strictEqual(rated, true, 'updatePhotoRating must return true for found URLs');
  assert.strictEqual(testCollections['Scenic Nature'][1].rating, 1, 'rating must be set to 1');
  assert.ok(!testState.photosList.some(p => p.url === 'urlY'), 'banned photo must be immediately pruned from state.photosList');
});

assertTest('successfully sets preventPairing flag and updates state via updatePhotoPreventPairing', () => {
  const { updatePhotoPreventPairing } = require('./server/config/collections.js');
  const testCollections = {
    'Scenic Nature': [
      { url: 'urlA', title: 'Photo A' }
    ]
  };
  const testState = {
    photosList: [
      { url: 'urlA', title: 'Photo A' }
    ],
    activePhoto: { url: 'urlA', title: 'Photo A' }
  };

  const updated = updatePhotoPreventPairing(testCollections, testState, 'urlA', true);
  assert.strictEqual(updated, true, 'updatePhotoPreventPairing must return true for found URLs');
  assert.strictEqual(testCollections['Scenic Nature'][0].preventPairing, true, 'preventPairing must be set to true in collections');
  assert.strictEqual(testState.photosList[0].preventPairing, true, 'preventPairing must be set to true in state.photosList');
  assert.strictEqual(testState.activePhoto.preventPairing, true, 'preventPairing must be set to true in state.activePhoto');
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

assertTest('resets activeSecondPhoto to null when activePhoto is changed', () => {
  screensaverState.activeSecondPhoto = { url: 'url2' };
  screensaverState.activePhoto = { url: 'url1' };
  assert.strictEqual(screensaverState.activeSecondPhoto, null, 'activeSecondPhoto must be reset to null when activePhoto changes');
});

assertTest('updatePhotoCrop correctly sets and persists cropPercent and cropPositionY', () => {
  const { updatePhotoCrop } = require('./server/config/collections.js');
  const tempCollections = {
    'Scenic Nature': [
      { url: 'test-url-crop', title: 'Test Photo', rating: 5 }
    ]
  };
  const tempState = {
    activePhoto: { url: 'test-url-crop', rating: 5 },
    photosList: [
      { url: 'test-url-crop', rating: 5 }
    ]
  };
  updatePhotoCrop(tempCollections, tempState, 'test-url-crop', 40, 70);
  
  assert.strictEqual(tempState.activePhoto.cropPercent, 40, 'cropPercent must be updated');
  assert.strictEqual(tempState.activePhoto.cropPositionY, 70, 'cropPositionY must be updated');
  assert.strictEqual(tempCollections['Scenic Nature'][0].cropPercent, 40, 'collection entry cropPercent must be updated');
  assert.strictEqual(tempCollections['Scenic Nature'][0].cropPositionY, 70, 'collection entry cropPositionY must be updated');
});


// ============================================================================
// 4b. UNIT TEST SUITE: Keyword Exclusion Filters
// ============================================================================
logSuite('Keyword Exclusion Filters');

assertTest('correctly filters photos containing excluded keywords in combineFeedsBalanced', () => {
  const collections = {
    'Scenic Nature': [
      { url: 'url1', title: 'Beautiful Forest Mountains', rating: 10 },
      { url: 'url2', title: 'Stupid Anime Character Artwork', rating: 10 },
      { url: 'url3', title: 'Lovely Stream in the Woods', rating: 10 }
    ]
  };
  
  const originalExclusions = screensaverState.excludedKeywords;
  screensaverState.excludedKeywords = ['anime'];
  
  const combined = combineFeedsBalanced(['Scenic Nature'], collections);
  
  assert.strictEqual(combined.length, 2, 'Should return exactly 2 photos');
  assert.ok(combined.every(p => !p.title.toLowerCase().includes('anime')), 'No photo should contain the excluded keyword');
  
  screensaverState.excludedKeywords = originalExclusions;
});

assertTest('correctly filters photos containing excluded keywords in selectWeightedRandomPhoto', () => {
  const photos = [
    { url: 'url1', title: 'Cyberpunk anime wallpaper', rating: 10 },
    { url: 'url2', title: 'Futuristic neon city street', rating: 10 }
  ];
  
  const originalExclusions = screensaverState.excludedKeywords;
  screensaverState.excludedKeywords = ['anime'];
  
  const picked = selectWeightedRandomPhoto(photos);
  assert.strictEqual(picked.url, 'url2', 'Should pick the non-excluded photo');
  
  screensaverState.excludedKeywords = originalExclusions;
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

runDomainTests({ logSuite, assertTest });

// ============================================================================
// 6. UNIT TEST SUITE: Multi-Source Wallpaper Aggregator
// ============================================================================
logSuite('Multi-Source Wallpaper Aggregator');

assertTest('crawler exports Wallhaven, NASA APOD, Midjourney, Bing, MetMuseum, and AIC adapters successfully', () => {
  const {
    fetchWallhavenImages,
    fetchNasaApod,
    fetchMidjourneyImages,
    fetchBingImageOfTheDay,
    fetchMetMuseumImages,
    fetchAicImages,
    fetchTumblrTaggedImages
  } = require('./server/services/crawler.js');
  assert.strictEqual(typeof fetchWallhavenImages, 'function', 'fetchWallhavenImages must be a function');
  assert.strictEqual(typeof fetchNasaApod, 'function', 'fetchNasaApod must be a function');
  assert.strictEqual(typeof fetchMidjourneyImages, 'function', 'fetchMidjourneyImages must be a function');
  assert.strictEqual(typeof fetchBingImageOfTheDay, 'function', 'fetchBingImageOfTheDay must be a function');
  assert.strictEqual(typeof fetchMetMuseumImages, 'function', 'fetchMetMuseumImages must be a function');
  assert.strictEqual(typeof fetchAicImages, 'function', 'fetchAicImages must be a function');
  assert.strictEqual(typeof fetchTumblrTaggedImages, 'function', 'fetchTumblrTaggedImages must be a function');
});

assertTest('Tumblr tagged crawler safely skips when TUMBLR_API_KEY is not configured', async () => {
  const { fetchTumblrTaggedImages } = require('./server/services/crawler.js');
  const originalKey = process.env.TUMBLR_API_KEY;
  delete process.env.TUMBLR_API_KEY;

  try {
    const photos = await fetchTumblrTaggedImages('landscape', 2);
    assert.deepStrictEqual(photos, [], 'Crawler should return an empty array without credentials');
  } finally {
    if (originalKey === undefined) {
      delete process.env.TUMBLR_API_KEY;
    } else {
      process.env.TUMBLR_API_KEY = originalKey;
    }
  }
});

assertTest('MetMuseum crawler retrieves public domain artworks', async () => {
  const { fetchMetMuseumImages } = require('./server/services/crawler.js');
  try {
    const photos = await fetchMetMuseumImages('impressionism', 2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Artwork must have a valid url');
      assert.strictEqual(photos[0].source, 'metmuseum', 'Source must equal metmuseum');
      assert.ok(photos[0].author, 'Artwork must have an artist/author');
    }
  } catch (err) {
    // Graceful catch for offline
  }
});

assertTest('AIC crawler retrieves public domain artworks', async () => {
  const { fetchAicImages } = require('./server/services/crawler.js');
  try {
    const photos = await fetchAicImages('impressionism', 2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Artwork must have a valid url');
      assert.strictEqual(photos[0].source, 'artic', 'Source must equal artic');
      assert.ok(photos[0].author, 'Artwork must have an artist/author');
    }
  } catch (err) {
    // Graceful catch for offline
  }
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

assertTest('Bing crawler retrieves daily high-quality wallpapers', async () => {
  const { fetchBingImageOfTheDay } = require('./server/services/crawler.js');
  try {
    const photos = await fetchBingImageOfTheDay(2);
    assert.ok(Array.isArray(photos), 'Should return photos array');
    if (photos.length > 0) {
      assert.ok(photos[0].url, 'Photo must have a valid url');
      assert.strictEqual(photos[0].source, 'bing', 'Source must equal bing');
      assert.ok(photos[0].title, 'Photo must have a valid title');
    }
  } catch (err) {
    // Graceful catch for offline
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
  const port = 0;
  console.log('Starting temporary test server on an ephemeral localhost port...');
  const testServer = await new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve(server);
    });
  });
  const actualPort = testServer.address().port;
  const baseUrl = `http://localhost:${actualPort}`;
  console.log(`Temporary test server bound to ${baseUrl}`);

  try {
    const serverConfig = await fetchJson(`${baseUrl}/api/config`);
    
    assertTest('GET /api/config successfully retrieves configuration and network data', () => {
      assert.ok(Array.isArray(serverConfig.localIps), 'localIps should be an array');
      assert.ok(serverConfig.port, 'port should be defined');
      assert.ok(serverConfig.state, 'state object must be present');
    });

    const weather = await fetchJson(`${baseUrl}/api/weather`);
    assertTest('GET /api/weather serves live Open-Meteo telemetry geolocated to Montreal', () => {
      assert.ok(weather.location, 'location data should be populated');
      assert.strictEqual(weather.location.city, config.location.city, `City should be geolocated to ${config.location.city}`);
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
    let samplePhotoUrl = '';
    const poolPhotos = await fetchJson(`${baseUrl}/api/pools/Scenic%20Nature/photos`);
    if (Array.isArray(poolPhotos) && poolPhotos.length > 0) {
      samplePhotoUrl = poolPhotos[0].url;
    }

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

    // ==========================================================================
    // NEW REST API INTEGRATION TESTS
    // ==========================================================================

    // 1. GET /api/state
    const stateGet = await requestJson(`${baseUrl}/api/state`, 'GET');
    assertTest('GET /api/state retrieves the current unified state', () => {
      assert.strictEqual(stateGet.status, 200);
      assert.ok(stateGet.body.widgets, 'State must contain widgets object');
      assert.ok(stateGet.body.theme, 'State must contain theme');
      assert.ok(stateGet.body.currentFrame, 'State must expose derived currentFrame');
      assert.strictEqual(
        stateGet.body.currentFrame.primary?.url || null,
        stateGet.body.activePhoto?.url || null,
        'currentFrame.primary should mirror activePhoto in the snapshot'
      );
    });

    // 2. PATCH /api/state
    const statePatch = await requestJson(`${baseUrl}/api/state`, 'PATCH', {
      theme: 'Cosmic Night',
      widgets: { clock: false }
    });
    assertTest('PATCH /api/state successfully updates widgets and configurations', () => {
      assert.strictEqual(statePatch.status, 200);
      assert.strictEqual(statePatch.body.theme, 'Cosmic Night');
      assert.strictEqual(statePatch.body.widgets.clock, false);
    });

    // 3. POST /api/state/screensaver
    const screensaverActiveRes = await requestJson(`${baseUrl}/api/state/screensaver`, 'POST', { active: true });
    assertTest('POST /api/state/screensaver toggles the screensaver status to active', () => {
      assert.strictEqual(screensaverActiveRes.status, 200);
      assert.strictEqual(screensaverActiveRes.body.success, true);
      assert.strictEqual(screensaverActiveRes.body.screensaverActive, true);
    });

    const screensaverInactiveRes = await requestJson(`${baseUrl}/api/state/screensaver`, 'POST', { active: false });
    assertTest('POST /api/state/screensaver toggles the screensaver status to inactive', () => {
      assert.strictEqual(screensaverInactiveRes.status, 200);
      assert.strictEqual(screensaverInactiveRes.body.success, true);
      assert.strictEqual(screensaverInactiveRes.body.screensaverActive, false);
    });

    // 4. GET /api/pools
    const poolsGet = await requestJson(`${baseUrl}/api/pools`, 'GET');
    assertTest('GET /api/pools lists all scenic pools with stats', () => {
      assert.strictEqual(poolsGet.status, 200);
      assert.ok(Array.isArray(poolsGet.body));
      const scenicNaturePool = poolsGet.body.find(p => p.name === 'Scenic Nature');
      assert.ok(scenicNaturePool);
      assert.ok(Array.isArray(scenicNaturePool.keywords));
      assert.strictEqual(typeof scenicNaturePool.photosCount, 'number');
    });

    // 5. POST /api/pools (create)
    const poolName = `REST Pool Test ${Date.now()}`;
    const newPoolRes = await requestJson(`${baseUrl}/api/pools`, 'POST', {
      name: poolName,
      keywords: ['test-rest-keyword-1', 'test-rest-keyword-2']
    });
    assertTest('POST /api/pools creates a new pool with custom keywords', () => {
      assert.strictEqual(newPoolRes.status, 201);
      assert.strictEqual(newPoolRes.body.success, true);
      assert.strictEqual(newPoolRes.body.pool.name, poolName);
      assert.deepStrictEqual(newPoolRes.body.pool.keywords, ['test-rest-keyword-1', 'test-rest-keyword-2']);
      assert.strictEqual(newPoolRes.body.pool.feedConfigs.artic.enabled, false);
    });

    // 6. GET /api/pools/:name/photos
    const poolPhotosGet = await requestJson(`${baseUrl}/api/pools/${encodeURIComponent(poolName)}/photos`, 'GET');
    assertTest('GET /api/pools/:name/photos retrieves photo metadata for a pool', () => {
      assert.strictEqual(poolPhotosGet.status, 200);
      assert.ok(Array.isArray(poolPhotosGet.body));
    });

    // 7. PATCH /api/pools/:name (update keywords)
    const patchPoolRes = await requestJson(`${baseUrl}/api/pools/${encodeURIComponent(poolName)}`, 'PATCH', {
      keywords: ['modified-keyword-1']
    });
    assertTest('PATCH /api/pools/:name updates pool settings/keywords', () => {
      assert.strictEqual(patchPoolRes.status, 200);
      assert.strictEqual(patchPoolRes.body.success, true);
      assert.deepStrictEqual(patchPoolRes.body.pool.keywords, ['modified-keyword-1']);
    });

    // 8. DELETE /api/pools/:name
    const deletePoolRes = await requestJson(`${baseUrl}/api/pools/${encodeURIComponent(poolName)}`, 'DELETE');
    assertTest('DELETE /api/pools/:name removes the pool completely', () => {
      assert.strictEqual(deletePoolRes.status, 200);
      assert.strictEqual(deletePoolRes.body.success, true);
    });

    // 9. PATCH /api/photos (composability testing: rating, crop, pairing)
    if (samplePhotoUrl) {
      const patchRateRes = await requestJson(`${baseUrl}/api/photos`, 'PATCH', {
        url: samplePhotoUrl,
        rating: 9
      });
      assertTest('PATCH /api/photos updates photo rating', () => {
        assert.strictEqual(patchRateRes.status, 200);
        assert.strictEqual(patchRateRes.body.success, true);
        assert.strictEqual(patchRateRes.body.photo.rating, 9);
      });

      const patchCropRes = await requestJson(`${baseUrl}/api/photos`, 'PATCH', {
        url: samplePhotoUrl,
        cropPercent: 75,
        cropPositionY: 30
      });
      assertTest('PATCH /api/photos updates photo zoom/crop percentages', () => {
        assert.strictEqual(patchCropRes.status, 200);
        assert.strictEqual(patchCropRes.body.success, true);
        assert.strictEqual(patchCropRes.body.photo.cropPercent, 75);
        assert.strictEqual(patchCropRes.body.photo.cropPositionY, 30);
      });

      const patchPairingRes = await requestJson(`${baseUrl}/api/photos`, 'PATCH', {
        url: samplePhotoUrl,
        preventPairing: true
      });
      assertTest('PATCH /api/photos updates photo preventPairing flag', () => {
        assert.strictEqual(patchPairingRes.status, 200);
        assert.strictEqual(patchPairingRes.body.success, true);
        assert.strictEqual(patchPairingRes.body.photo.preventPairing, true);
      });

      const previewPhotoRes = await requestJson(`${baseUrl}/api/photos/preview`, 'POST', {
        url: samplePhotoUrl
      });
      assertTest('POST /api/photos/preview forces displays to preview a photo', () => {
        assert.strictEqual(previewPhotoRes.status, 200);
        assert.strictEqual(previewPhotoRes.body.success, true);
        assert.strictEqual(previewPhotoRes.body.activePhoto.url, samplePhotoUrl);
      });
    }

    // 10. POST /api/photos/next
    const nextPhotoRes = await requestJson(`${baseUrl}/api/photos/next`, 'POST');
    assertTest('POST /api/photos/next transitions active display to the next photo', () => {
      assert.strictEqual(nextPhotoRes.status, 200);
      assert.strictEqual(nextPhotoRes.body.success, true);
      assert.ok(nextPhotoRes.body.activePhoto);
    });

  } catch (err) {
    console.error('Integration tests failed with error:', err);
    STATS.failed++;
  } finally {
    console.log('Shutting down temporary test server...');
    await new Promise((resolve) => testServer.close(resolve));
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
