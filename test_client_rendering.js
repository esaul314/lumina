// Coherent rendering regressions; the root runner owns reports, counters,
// awaited order and failure exit. No second test framework or application state.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runClientRenderingTests({ logSuite, assertTest, importClientModule }) {
  logSuite('Client Rendering Helpers');

  const { toCssImageUrl } = await importClientModule('./client/src/state/cssImage.js');
  const { formatClockParts } = await importClientModule('./client/src/state/clock.js');
  const {
    DEFAULT_CONTAIN_CROP_PERCENT,
    DEFAULT_COVER_CROP_PERCENT,
    MAX_PHOTO_CROP_PERCENT,
    getDefaultPhotoCropPercent,
    getPhotoCropBlend
  } = await importClientModule('./client/src/state/photoCrop.js');
  const {
    MEDIA_RETRY_DELAYS_MS,
    buildMediaOriginProbeUrl,
    decideMediaFailure
  } = await importClientModule('./client/src/state/mediaRecovery.js');
  const {
    isEscapeKey,
    isScreensaverDismissalActivity
  } = await importClientModule('./client/src/state/screensaverActivity.js');
  const {
    DEFAULT_SWIPE_STATUS,
    SWIPE_THRESHOLD_PX,
    classifySwipe,
    getTouchClientX,
    getTriggeredSwipeStatus
  } = await importClientModule('./client/src/state/swipeGesture.js');
  const {
    DEFAULT_CROP_CONTAINER_HEIGHT,
    DEFAULT_CROP_SENSITIVITY,
    getPointerClientY,
    getTouchClientY,
    projectCropPosition
  } = await importClientModule('./client/src/state/cropDrag.js');
  const dashboardSource = fs.readFileSync(
    path.join(__dirname, 'client/src/components/Dashboard.jsx'),
    'utf8'
  );
  const frameSelectorsSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/frameSelectors.js'),
    'utf8'
  );
  const environmentRefreshSource = fs.readFileSync(
    path.join(__dirname, 'server/runtime/environmentRefresh.js'),
    'utf8'
  );
  const idleDaemonSource = fs.readFileSync(
    path.join(__dirname, 'server/runtime/idleDaemon.js'),
    'utf8'
  );
  const categorySelectionSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/categorySelection.js'),
    'utf8'
  );
  const jobStatusSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/jobStatus.js'),
    'utf8'
  );
  const feedMutationsSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/feedMutations.js'),
    'utf8'
  );
  const environmentHistorySource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/environmentHistory.js'),
    'utf8'
  );
  const photoCropSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/photoCrop.js'),
    'utf8'
  );
  const cssImageSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/cssImage.js'),
    'utf8'
  );
  const clockSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/clock.js'),
    'utf8'
  );
  const cropDragSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/cropDrag.js'),
    'utf8'
  );

  const clockOptions = { timeZone: 'UTC' };
  const morningClock = formatClockParts(
    new Date('2026-01-02T05:07:00.000Z'),
    'en-US',
    clockOptions
  );
  const afternoonClock = formatClockParts(
    new Date('2026-01-02T17:07:00.000Z'),
    'en-US',
    clockOptions
  );

  assertTest('formatClockParts keeps AM and PM separate from locale time punctuation', () => {
    assert.deepStrictEqual(morningClock, { time: '05:07', period: 'AM' });
    assert.deepStrictEqual(afternoonClock, { time: '05:07', period: 'PM' });
  });

  assertTest('formatClockParts does not inherit the clock digit tracking contract', () => {
    assert.notStrictEqual(morningClock.period, '');
    assert.notStrictEqual(afternoonClock.period, '');
    assert.strictEqual(morningClock.time.includes('AM'), false);
    assert.strictEqual(afternoonClock.time.includes('PM'), false);
  });

  assertTest('formatClockParts preserves caller formatter options at the pure boundary', () => {
    const twentyFourHourClock = formatClockParts(
      new Date('2026-01-02T17:07:00.000Z'),
      'en-US',
      { timeZone: 'UTC', hour12: false }
    );

    assert.deepStrictEqual(twentyFourHourClock, { time: '17:07', period: '' });
  });

  assertTest('formatClockParts exposes a local checked presentation contract', () => {
    assert.match(clockSource, /^\/\/ @ts-check/);
    assert.match(clockSource, /@typedef \{\{time: string, period: string\}\} ClockParts/);
    assert.match(clockSource, /@returns \{ClockParts\}/);
  });

  assertTest('photo crop helpers preserve pure baselines and blend math', () => {
    assert.strictEqual(DEFAULT_CONTAIN_CROP_PERCENT, 0);
    assert.strictEqual(DEFAULT_COVER_CROP_PERCENT, 100);
    assert.strictEqual(MAX_PHOTO_CROP_PERCENT, 200);
    assert.strictEqual(getDefaultPhotoCropPercent('contain'), 0);
    assert.strictEqual(getDefaultPhotoCropPercent('cover'), 100);
    assert.strictEqual(getDefaultPhotoCropPercent(null), 100);
    assert.strictEqual(getDefaultPhotoCropPercent(undefined), 100);
    assert.strictEqual(getPhotoCropBlend(0), 0);
    assert.strictEqual(getPhotoCropBlend(50), 0.5);
    assert.strictEqual(getPhotoCropBlend(MAX_PHOTO_CROP_PERCENT), 2);
  });

  assertTest('photo crop helpers expose a local checked scalar contract', () => {
    assert.match(photoCropSource, /^\/\/ @ts-check/);
    assert.match(photoCropSource, /@typedef \{'contain'\|'cover'\} PhotoScaleMode/);
    assert.match(photoCropSource, /@typedef \{number\} PhotoCropPercent/);
    assert.match(photoCropSource, /@param \{PhotoScaleMode\|null\|undefined\} scaleMode/);
    assert.match(photoCropSource, /@param \{PhotoCropPercent\} cropPercent/);
    assert.match(photoCropSource, /@returns \{PhotoCropPercent\}/);
  });

  assertTest('toCssImageUrl quotes and encodes whitespace-safe image URLs', () => {
    assert.strictEqual(
      toCssImageUrl('https://images.metmuseum.org/CRDImages/as/original/8 NEW DP257785r1_61E.jpg'),
      'url("https://images.metmuseum.org/CRDImages/as/original/8%20NEW%20DP257785r1_61E.jpg")'
    );
  });

  assertTest('toCssImageUrl preserves already-encoded paths', () => {
    assert.strictEqual(
      toCssImageUrl('https://example.com/already%20encoded/image.jpg'),
      'url("https://example.com/already%20encoded/image.jpg")'
    );
  });

  assertTest('toCssImageUrl exposes a checked pure presentation contract', () => {
    assert.match(cssImageSource, /^\/\/ @ts-check/);
    assert.match(cssImageSource, /@param \{unknown\} url/);
    assert.match(cssImageSource, /@returns \{string\}/);
    assert.strictEqual(toCssImageUrl(null), 'none');
    assert.strictEqual(toCssImageUrl('   '), 'none');
  });

  assertTest('media recovery uses bounded exponential retry delays', () => {
    assert.deepStrictEqual(MEDIA_RETRY_DELAYS_MS, [1000, 2000, 4000, 8000]);
    assert.deepStrictEqual(decideMediaFailure({ attempt: 0, hostReachable: false }), {
      action: 'retry',
      attempt: 1,
      delayMs: 1000
    });
    assert.deepStrictEqual(decideMediaFailure({ attempt: 3, hostReachable: true }), {
      action: 'retry',
      attempt: 4,
      delayMs: 8000
    });
  });

  assertTest('media recovery holds unreachable hosts and skips only reachable broken URLs', () => {
    assert.deepStrictEqual(decideMediaFailure({ attempt: 4, hostReachable: false }), {
      action: 'hold',
      attempt: 4
    });
    assert.deepStrictEqual(decideMediaFailure({ attempt: 4, hostReachable: true }), {
      action: 'skip',
      attempt: 4
    });
  });

  assertTest('media connectivity probes target only the image origin', () => {
    assert.strictEqual(
      buildMediaOriginProbeUrl('https://images.example.test/path/photo.jpg?size=large', 'http://localhost:5000'),
      'https://images.example.test'
    );
    assert.strictEqual(
      buildMediaOriginProbeUrl('/media/photo.jpg', 'http://localhost:5000'),
      'http://localhost:5000'
    );
    assert.strictEqual(buildMediaOriginProbeUrl('http://[invalid', 'http://localhost:5000'), null);
  });

  assertTest('screensaver activity treats Escape and ordinary input as dismissal signals', () => {
    assert.strictEqual(isEscapeKey({ key: 'Escape' }), true);
    assert.strictEqual(isEscapeKey({ code: 'Escape' }), true);
    assert.strictEqual(isEscapeKey({ key: 'Enter', code: 'Enter' }), false);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      event: { type: 'keydown', key: 'Enter' }
    }), true);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      event: { type: 'mousemove' }
    }), true);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      allowDismissal: false,
      event: { type: 'mousedown' }
    }), false, 'admin TV previews must not dismiss the kiosk screensaver');
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: false,
      event: { type: 'keydown', key: 'Escape' }
    }), false);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      event: null
    }), false);
    assert.strictEqual(isScreensaverDismissalActivity({
      screensaverActive: true,
      event: { type: 'wheel' }
    }), false);
  });

  assertTest('screensaver activity exposes a local checked event contract', () => {
    const screensaverActivitySource = fs.readFileSync(
      path.join(__dirname, 'client/src/state/screensaverActivity.js'),
      'utf8'
    );

    assert.match(screensaverActivitySource, /^\/\/ @ts-check/);
    assert.match(screensaverActivitySource, /@typedef \{\{key\?: string, code\?: string\}\} KeyboardActivity/);
    assert.match(screensaverActivitySource, /@typedef \{\{type\?: string\}\} ActivityEvent/);
    assert.match(
      screensaverActivitySource,
      /@typedef \{\{screensaverActive: boolean, allowDismissal\?: boolean, event\?: ActivityEvent\|null\}\} ScreensaverActivity/
    );
    assert.match(
      screensaverActivitySource,
      /@param \{KeyboardActivity\|null\|undefined\} event/
    );
    assert.match(screensaverActivitySource, /@param \{ScreensaverActivity\} input/);
  });

  assertTest('only an explicitly launched TV kiosk can dismiss the shared screensaver from input', () => {
    const appSource = fs.readFileSync(path.join(__dirname, 'client/src/App.jsx'), 'utf8');
    const dashboardSource = fs.readFileSync(path.join(__dirname, 'client/src/components/Dashboard.jsx'), 'utf8');

    assert.match(appSource, /get\('mode'\) === 'tv'/);
    assert.match(appSource, /allowScreensaverDismissal=\{isKioskSession\}/);
    assert.match(dashboardSource, /allowScreensaverDismissal = false/);
    assert.match(dashboardSource, /if \(!allowScreensaverDismissal \|\| !state\.screensaverActive/);
  });

  assertTest('active TV kiosk hides the cursor across the page after inactivity', () => {
    const dashboardSource = fs.readFileSync(path.join(__dirname, 'client/src/components/Dashboard.jsx'), 'utf8');
    const stylesSource = fs.readFileSync(path.join(__dirname, 'client/src/index.css'), 'utf8');

    assert.match(dashboardSource, /\}, \[allowScreensaverDismissal, isSettingsOpen, state\.screensaverActive\]\);/);
    assert.match(dashboardSource, /\}, 3000\);/);
    assert.match(dashboardSource, /document\.body\.classList\.add\('hide-cursor'\)/);
    assert.match(dashboardSource, /if \(!allowScreensaverDismissal \|\| !state\.screensaverActive \|\| showCursor\)/);
    assert.match(stylesSource, /\.hide-cursor,\s*\.hide-cursor \*\s*\{\s*cursor: none !important;/);
  });

  assertTest('swipe gesture projection keeps threshold and direction policy pure', () => {
    assert.strictEqual(DEFAULT_SWIPE_STATUS, 'Swipe left or right to change photo');
    assert.strictEqual(SWIPE_THRESHOLD_PX, 50);
    assert.strictEqual(getTouchClientX({ 0: { clientX: 120 } }), 120);
    assert.strictEqual(getTouchClientX({}), null);
    assert.strictEqual(getTouchClientX({ 0: { clientX: '120' } }), null);
    assert.strictEqual(classifySwipe(100, 50), null, 'exact threshold should remain inert');
    assert.deepStrictEqual(classifySwipe(100, 49), {
      direction: 'next',
      status: 'Swiped Left: Next Photo'
    });
    assert.deepStrictEqual(classifySwipe(100, 151), {
      direction: 'previous',
      status: 'Swiped Right: Previous Photo'
    });
    assert.strictEqual(classifySwipe('100', 49), null);
    assert.strictEqual(getTriggeredSwipeStatus('next'), 'Next Photo Triggered');
    assert.strictEqual(getTriggeredSwipeStatus('previous'), 'Previous Photo Triggered');
  });

  assertTest('swipe gesture projection exposes a checked event algebra', () => {
    const swipeGestureSource = fs.readFileSync(
      path.join(__dirname, 'client/src/state/swipeGesture.js'),
      'utf8'
    );

    assert.match(swipeGestureSource, /^\/\/ @ts-check/);
    assert.match(swipeGestureSource, /@typedef \{'next'\|'previous'\} SwipeDirection/);
    assert.match(
      swipeGestureSource,
      /@typedef \{\{direction: SwipeDirection, status: string\}\} SwipeDecision/
    );
    assert.match(swipeGestureSource, /@param \{unknown\} touches/);
    assert.match(swipeGestureSource, /@returns \{SwipeDecision\|null\}/);
  });

  assertTest('crop drag projection decodes coordinates and preserves bounded crop math', () => {
    assert.strictEqual(DEFAULT_CROP_CONTAINER_HEIGHT, 180);
    assert.strictEqual(DEFAULT_CROP_SENSITIVITY, 0.8);
    assert.strictEqual(getTouchClientY({ 0: { clientY: 120 } }), 120);
    assert.strictEqual(getTouchClientY({ 0: { clientY: '120' } }), null);
    assert.strictEqual(getPointerClientY({ clientY: 80 }), 80);
    assert.strictEqual(getPointerClientY({ touches: { 0: { clientY: 95 } } }), 95);
    assert.strictEqual(getPointerClientY({ touches: {} }), null);
    assert.strictEqual(projectCropPosition({
      startY: 100,
      startCropY: 50,
      clientY: 118,
      containerHeight: 180
    }), 42);
    assert.strictEqual(projectCropPosition({
      startY: 100,
      startCropY: 50,
      clientY: 0,
      containerHeight: 0
    }), 94);
    assert.strictEqual(projectCropPosition({
      startY: 100,
      startCropY: 50,
      clientY: -100,
      containerHeight: 180
    }), 100);
    assert.strictEqual(projectCropPosition({
      startY: 100,
      startCropY: 50,
      clientY: 400,
      containerHeight: 180
    }), 0);
    assert.strictEqual(projectCropPosition({
      startY: Number.NaN,
      startCropY: 50,
      clientY: 118
    }), null);
  });

  assertTest('crop drag projection exposes a checked coordinate algebra', () => {
    assert.match(cropDragSource, /^\/\/ @ts-check/);
    assert.match(cropDragSource, /@typedef \{\{startY: number, startCropY: number, clientY: number/);
    assert.match(cropDragSource, /@param \{unknown\} touches/);
    assert.match(cropDragSource, /@param \{unknown\} event/);
    assert.match(cropDragSource, /@returns \{CropPosition\|null\}/);
  });

  assertTest('Dashboard derives screensaver-dependent effects from canonical App state', () => {
    assert.strictEqual(dashboardSource.includes("socket.on('state-sync'"), false);
    assert.match(
      dashboardSource,
      /\}, \[state\.widgets\.particles, state\.screensaverActive\]\);/
    );
  });

  assertTest('Dashboard uses one preloaded image path with host-aware recovery', () => {
    assert.ok(dashboardSource.includes('decideMediaFailure'));
    assert.ok(dashboardSource.includes("method: 'HEAD'"));
    assert.strictEqual(dashboardSource.includes('Split slide primary image failed in DOM:'), false);
    assert.strictEqual(dashboardSource.includes('style={{ display: \'none\' }}'), false);
  });

  assertTest('App registers paired photo events through one declarative handler table', () => {
    const appSource = fs.readFileSync(
      path.join(__dirname, 'client/src/App.jsx'),
      'utf8'
    );

    assert.match(appSource, /\['photo-update', 'second-photo-update'\]\.map\(\(event\)/);
    assert.strictEqual(appSource.includes("socket.on('photo-update'"), false);
    assert.strictEqual(appSource.includes("socket.on('second-photo-update'"), false);
  });

  assertTest('frame selectors expose a stable checked snapshot contract', () => {
    assert.match(frameSelectorsSource, /^\/\/ @ts-check/);
    assert.match(frameSelectorsSource, /@typedef \{Record<string, unknown> & \{/);
    assert.match(frameSelectorsSource, /@param \{ClientSnapshot\|null\|undefined\} snapshot/);
    assert.match(frameSelectorsSource, /@returns \{PhotoEventProjection\|null\}/);
  });

  assertTest('category selection exposes a checked pure selection contract', () => {
    assert.match(categorySelectionSource, /^\/\/ @ts-check/);
    assert.match(categorySelectionSource, /@typedef \{string\[\]\} CategorySelection/);
    assert.match(categorySelectionSource, /@typedef \{Record<string, unknown> & \{/);
    assert.match(categorySelectionSource, /@param \{unknown\} category/);
    assert.match(categorySelectionSource, /@returns \{CategorySelection\}/);
  });

  assertTest('job status exposes a checked shared event contract', () => {
    assert.match(jobStatusSource, /^\/\/ @ts-check/);
    assert.match(jobStatusSource, /@typedef \{'recrawl'\|'vision-analysis'\} JobType/);
    assert.match(jobStatusSource, /@typedef \{object\} JobStatusEvent/);
    assert.match(jobStatusSource, /@param \{unknown\} job/);
    assert.match(jobStatusSource, /@returns \{JobStatusUpdate\|null\}/);
    assert.match(jobStatusSource, /@returns \{JobEventProjection\|null\}/);
  });

  assertTest('feed mutations expose checked pure snapshot contracts', () => {
    assert.match(feedMutationsSource, /^\/\/ @ts-check/);
    assert.match(feedMutationsSource, /@typedef \{Record<string, unknown> & \{/);
    assert.match(feedMutationsSource, /@param \{unknown\} selection/);
    assert.match(feedMutationsSource, /@param \{unknown\} configPatch/);
    assert.match(feedMutationsSource, /@returns \{ClientMutationSnapshot\|null\|undefined\}/);
  });

  assertTest('environment presentation exposes a checked pure status contract', () => {
    assert.match(environmentHistorySource, /^\/\/ @ts-check/);
    assert.match(environmentHistorySource, /@typedef \{object\} EnvironmentStatusSnapshot/);
    assert.match(environmentHistorySource, /@param \{unknown\} value/);
    assert.match(environmentHistorySource, /@returns \{EnvironmentStatus\}/);
  });

  assertTest('environment refresh weather projections expose checked local contracts', () => {
    assert.match(environmentRefreshSource, /^\/\/ @ts-check/);
    assert.match(environmentRefreshSource, /@typedef \{Record<string, unknown> & \{lat: number, lon: number\}\} WeatherLocation/);
    assert.match(environmentRefreshSource, /@typedef \{Record<string, unknown> & \{temperature_2m: number, weather_code: number\}\} CurrentWeatherSnapshot/);
    assert.match(environmentRefreshSource, /@param \{WeatherLocation\} location/);
    assert.match(environmentRefreshSource, /@returns \{WeatherDataSnapshot\}/);
    assert.match(environmentRefreshSource, /@param \{CurrentWeatherSnapshot \| null \| undefined\} currentWeather/);
    assert.match(environmentRefreshSource, /@returns \{PhysicalWeatherSnapshot \| null\}/);
  });

  assertTest('idle daemon projections expose checked inputs, state, and action contracts', () => {
    assert.match(idleDaemonSource, /^\/\/ @ts-check/);
    assert.match(idleDaemonSource, /@typedef \{object\} IdleDaemonState/);
    assert.match(idleDaemonSource, /@typedef \{object\} IdleDaemonNextState/);
    assert.match(idleDaemonSource, /@typedef \{object\} IdleDaemonInputs/);
    assert.match(idleDaemonSource, /@typedef \{object\} IdleDaemonObservation/);
    assert.match(idleDaemonSource, /@typedef \{'launch' \| 'kill' \| null\} IdleDaemonAction/);
    assert.match(idleDaemonSource, /@param \{IdleDaemonState\} currentState/);
    assert.match(idleDaemonSource, /@param \{IdleDaemonInputs\} inputs/);
    assert.match(idleDaemonSource, /@returns \{IdleDaemonTransition\}/);
    assert.match(idleDaemonSource, /@returns \{IdleDaemonInputs\}/);
    assert.match(idleDaemonSource, /The returned action is interpreted by the runtime shell/);
  });
}

module.exports = { runClientRenderingTests };
