// Isolated browser regressions: no production daemon, cache, or external images.
process.env.NODE_ENV = 'test';

const assert = require('assert/strict');
const http = require('http');
const fs = require('node:fs');
const os = require('node:os');
const { compileFunction } = require('node:vm');
const { createRequire } = require('node:module');
const { createPhotoCommentStore } = require('./server/services/photoComments.js');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { chromium, expect } = require('@playwright/test');
const { createDomainDispatcher } = require('./server/domain/dispatch.js');
const { buildDomainState, buildSnapshot } = require('./server/domain/snapshot.js');
const { SOCKET_DURABLE_COMMAND_SPECS, decodeStatePatchCommand } = require('./server/domain/commands.js');

const INTERVAL = 120000;
const RETRY_DELAYS = [1000, 2000, 4000, 8000];
const photo = (id, orientation = 'landscape') => ({
  url: `/fixtures/${id}.svg`, title: id, category: 'Fixture', rating: 10,
  orientation, width: 640, height: orientation === 'portrait' ? 960 : 360
});
const landscapePhotos = () => ['a', 'b', 'c', 'broken'].map(id => photo(id));
const portraitPhotos = () => ['p1', 'p2', 'p3', 'broken'].map(id => photo(id, 'portrait'));

// Keep the global test guard intact; only this closed codec may write fixture files.
function createFixtureCodec(directory) {
  const filename = path.join(__dirname, 'server/config/collectionsCodec.js');
  const module = { exports: {} }, nativeRequire = createRequire(filename);
  const inside = filename => assert.equal(path.dirname(path.resolve(filename)), directory, 'Codec I/O stays in the fixture directory');
  const fixtureFs = Object.fromEntries(['existsSync', 'readFileSync', 'writeFileSync', 'renameSync', 'rmSync'].map(method => [method, (...args) => {
    inside(args[0]);
    if (method === 'renameSync') inside(args[1]);
    return fs[method](...args);
  }]));
  compileFunction(fs.readFileSync(filename, 'utf8'), ['module', 'require', 'process'], { filename })(
    module, name => name === 'fs' ? fixtureFs : nativeRequire(name), { env: { NODE_ENV: 'isolated-browser-fixture' } }
  );
  return module.exports;
}

async function createFixture(photos, { screensaverActive = false, widgets = {} } = {}) {
  const app = express();
  const server = http.createServer(app);
  // Clock jumps must not simulate Socket.IO heartbeat failure.
  const io = new Server(server, { pingInterval: 1000000000, pingTimeout: 1000000000 });
  const state = {
    currentCategory: 'Fixture', activePhoto: photos[0], photosList: photos,
    theme: 'Zen Retreat', scaleMode: 'cover', splitPortrait: true, splitCropPercent: 50,
    widgets: { ...widgets }, slideshowInterval: INTERVAL, inactivityTimeout: 600000,
    alignTimeOfDay: false, alignWeather: false, nightPercentage: 50,
    searchKeywords: {}, feedConfigs: {}, poolPolicies: {}, excludedKeywords: [],
    autoLocation: false, manualLocation: {}, screensaverActive, splitSeed: 1
  };
  const collections = { Fixture: photos.map(row => ({ ...row })) };
  const commentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-browser-comments-'));
  const commentPath = path.join(commentDir, 'collections.json');
  fs.writeFileSync(commentPath, JSON.stringify({ feeds: collections }));
  const commentStore = createPhotoCommentStore({ jsonPath: commentPath });
  const fixtureCodec = createFixtureCodec(commentDir);
  const events = [];
  const errors = [];
  const logs = [];
  // Explicit fixture-owned sinks; the real codec is closed over task-owned I/O.
  const persistence = { collections: [], env: [] };
  const dispatcher = createDomainDispatcher({
    state, collections, io,
    savePhotoComment: ({ url, comment }) => commentStore.write({ url }, comment),
    persistCollections: (savedCollections, savedState) => {
      persistence.collections.push(structuredClone({ collections: savedCollections, state: savedState }));
      fixtureCodec.saveCollectionsSnapshot({ jsonPath: commentPath, collections: savedCollections, state: savedState });
    },
    persistEnvVars: entries => persistence.env.push(structuredClone(entries))
  });
  const dispatch = command => dispatcher.dispatchCommand(command, { rng: () => 0.5 });
  let slowResponse;

  const weather = {
    location: { city: 'Fixture City', regionName: 'Fixture Region' },
    current: { temperature_2m: 21, weather_code: 0, relative_humidity_2m: 50 },
    daily: {
      time: ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'],
      temperature_2m_max: [21, 22, 23, 24], temperature_2m_min: [11, 12, 13, 14],
      weather_code: [0, 0, 1, 2]
    }
  };
  app.use(express.json());
  app.head('/', (_req, res) => res.sendStatus(200));
  app.get('/api/weather', (_req, res) => res.json(weather));
  app.patch('/api/state', async (req, res, next) => {
    try {
      events.push({ event: 'patch-state', payload: req.body });
      await dispatch(decodeStatePatchCommand(req.body));
      res.json(dispatcher.refreshSnapshot());
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/state', (_req, res) => res.json(dispatcher.refreshSnapshot()));
  app.get('/api/pools', (_req, res) => res.json([]));
  // Compile only the real route module with closed external-service adapters.
  const routesPath = path.join(__dirname, 'server/routes.js');
  const routeModule = { exports: {} }, nativeRequire = createRequire(routesPath);
  compileFunction(fs.readFileSync(routesPath, 'utf8'), ['module', 'require'], { filename: routesPath })(
    routeModule, name => name === './services/googlePhotos.js' ? { getCachedMediaItems: () => [] }
      : name === './services/weather.js' ? {} : nativeRequire(name)
  );
  routeModule.exports({ app, state, collections, io, port: 0, dispatchCommand: dispatch,
    readPhotoComment: row => commentStore.read(row), getWeatherData: () => weather, setWeatherData() {} });
  app.get('/api/*', (_req, res) => res.json({}));
  app.get('/fixtures/:id.svg', (req, res) => {
    if (req.params.id === 'broken') return res.sendStatus(404);
    const height = photos.find(row => row.url === req.path)?.height || 360;
    const respond = () => res.type('svg').send(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${height}"><rect width="640" height="${height}" fill="#345678"/></svg>`
    );
    if (req.params.id === 'slow') slowResponse = respond;
    else respond();
  });
  app.use(express.static(process.env.LUMINA_TEST_DIST || path.join(__dirname, 'client/dist')));
  io.on('connection', socket => {
    const supported = new Set(['next-photo', 'mark-photo-broken', 'report-photo-metadata']);
    SOCKET_DURABLE_COMMAND_SPECS.filter(spec => supported.has(spec.event)).forEach(spec => {
      socket.on(spec.event, payload => {
        events.push({ event: spec.event, payload });
        const command = spec.decode(payload);
        if (command) void dispatch(command).catch(error => errors.push(error));
      });
    });
    dispatcher.broadcastStateSync();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    state, collections, weather, events, errors, logs, persistence, dispatch, commentStore, readPersisted: () => JSON.parse(fs.readFileSync(commentPath, 'utf8')),
    readReconstructed: () => fixtureCodec.loadCollectionsSnapshot({ jsonPath: commentPath,
      defaultCollections: {}, defaultState: {}, buildFeedConfigsFromKeywords: () => ({}) }).collections,
    ...dispatcher,
    url: `http://127.0.0.1:${server.address().port}`,
    get slowPending() { return Boolean(slowResponse); },
    releaseSlow: () => slowResponse(),
    select: id => dispatch({ type: 'set-active-photo', payload: { url: `/fixtures/${id}.svg` } }),
    count: event => events.filter(entry => entry.event === event).length,
    close: () => new Promise(resolve => io.close(() => { fs.rmSync(commentDir, { recursive: true, force: true }); resolve(); }))
  };
}

const activeBackground = () => document.querySelector(
  '.slide.active .single-slide-image, .slide.active .slide-half-image'
)?.style.backgroundImage || '';

async function withFixture(browser, run, photos = landscapePhotos(), options = {}) {
  const fixture = await createFixture(photos, options);
  const context = await browser.newContext();
  context.on('page', opened => opened.on('pageerror', error => fixture.errors.push(error)));
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('console', message => fixture.logs.push(message.text()));
  try {
    // No third-party telemetry, fonts, weather, or image requests in this suite.
    await context.route('**/*', route => new URL(route.request().url()).origin === fixture.url
      ? route.continue()
      : route.abort());
    await page.clock.install();
    await page.addInitScript(() => {
      window.slideChanges = [];
      window.retryWaits = [];
      const setTimeoutImpl = window.setTimeout;
      window.setTimeout = (callback, delay, ...args) => {
        // Observe Promise-resolver retry waits, not image deadline callbacks.
        if ([1000, 2000, 4000, 8000].includes(delay)
          && typeof callback === 'function' && callback.toString().includes('[native code]')) {
          window.retryWaits.push({ delay, at: Date.now() });
        }
        return setTimeoutImpl(callback, delay, ...args);
      };
      new MutationObserver(() => {
        const image = document.querySelector('.slide.active .single-slide-image, .slide.active .slide-half-image');
        const url = image?.style.backgroundImage;
        if (url && window.slideChanges.at(-1)?.url !== url) {
          window.slideChanges.push({ url, at: Date.now() });
        }
      }).observe(document, { subtree: true, childList: true, attributes: true });
    });
    await page.goto(`${fixture.url}/${options.preview ? '' : '?mode=tv'}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(activeBackground)).toContain(photos[0].url);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 20));
    const shown = id => expect.poll(() => page.evaluate(activeBackground)).toContain(`/fixtures/${id}.svg`);
    const elapsed = async ms => {
      const remaining = await page.evaluate(ms => window.slideChanges.at(-1).at + ms - Date.now(), ms);
      assert.ok(remaining >= 0, `Cannot rewind clock by ${-remaining}ms`);
      await page.clock.fastForward(remaining);
    };
    await run({ fixture, page, shown, elapsed });
    assert.deepStrictEqual(fixture.errors, []);
    assert.ok(await page.locator('.slide').count() <= 2, 'Slide DOM must stay bounded');
  } catch (error) {
    console.error('Fixture diagnostics:', {
      events: fixture.events.map(({ event, payload }) => ({ event, url: payload?.url })),
      logs: fixture.logs.slice(-8)
    });
    throw error;
  } finally {
    await context.close();
    await fixture.close();
  }
}

async function exhaustRetries({ page }) {
  for (const delay of RETRY_DELAYS) {
    await expect.poll(() => page.evaluate(() => window.retryWaits.at(-1)?.delay)).toBe(delay);
    await page.clock.fastForward(delay);
  }
}

const cases = [
  ['newly displayed primary receives its full interval', async env => {
    const { fixture, elapsed, shown } = env;
    await elapsed(INTERVAL - 100);
    await fixture.select('b');
    await shown('b');
    await elapsed(INTERVAL - 1);
    assert.strictEqual(fixture.count('next-photo'), 0);
    await elapsed(INTERVAL + 1000);
    await expect.poll(() => fixture.count('next-photo')).toBe(1);
    assert.strictEqual(fixture.count('mark-photo-broken'), 0);
  }],
  ['slow loading does not consume the new primary display time', async ({ fixture, page, shown, elapsed }) => {
    await elapsed(10000);
    await fixture.select('slow');
    await expect.poll(() => fixture.slowPending).toBe(true);
    await page.clock.fastForward(5000);
    await shown('a');
    fixture.releaseSlow();
    await shown('slow');
    await elapsed(INTERVAL - 1);
    assert.strictEqual(fixture.count('next-photo'), 0);
    await elapsed(INTERVAL + 1000);
    await expect.poll(() => fixture.count('next-photo')).toBe(1);
  }, [...landscapePhotos(), photo('slow')]],
  ['metadata and repeated snapshots keep the original deadline', async ({ fixture, page, elapsed }) => {
    await elapsed(INTERVAL - 100);
    await fixture.dispatch({ type: 'set-photo-crop', payload: { url: '/fixtures/a.svg', cropPercent: 70 } });
    await fixture.dispatch({ type: 'report-photo-metadata', payload: { url: '/fixtures/a.svg', orientation: 'landscape', width: 1280, height: 720 } });
    fixture.collections.Fixture[0].title = 'Updated title';
    fixture.state.photosList.find(row => row.url === '/fixtures/a.svg').title = 'Updated title';
    fixture.broadcastStateSync();
    fixture.broadcastStateSync();
    await expect.poll(() => page.evaluate(() => {
      const { width, cropPercent, title } = window.__state.currentFrame.primary;
      return { width, cropPercent, title };
    })).toEqual({ width: 1280, cropPercent: 70, title: 'Updated title' });
    await elapsed(INTERVAL + 1000);
    await expect.poll(() => fixture.count('next-photo')).toBe(1);
  }],
  ['interval changes replace the previous timer', async ({ fixture, page, elapsed }) => {
    await elapsed(INTERVAL - 100);
    await fixture.dispatch({ type: 'patch-state', payload: { slideshowInterval: 30000 } });
    await expect.poll(() => page.evaluate(() => window.__state.slideshowInterval)).toBe(30000);
    await page.clock.fastForward(29999);
    assert.strictEqual(fixture.count('next-photo'), 0);
    await page.clock.fastForward(2);
    await expect.poll(() => fixture.count('next-photo')).toBe(1);
  }],
  ['unmounting the TV clears its rotation timer', async ({ fixture, page, elapsed }) => {
    await elapsed(INTERVAL - 100);
    await page.getByRole('button', { name: /Switch to Remote/ }).evaluate(button => button.click());
    await expect(page.locator('.slideshow-container')).toHaveCount(0);
    await page.clock.fastForward(INTERVAL * 2);
    assert.strictEqual(fixture.count('next-photo'), 0);
  }],
  ['a primary failure reports once and the server selects exactly one healthy replacement', async env => {
    const { fixture, shown, elapsed } = env;
    await fixture.select('broken');
    await exhaustRetries(env);
    await expect.poll(() => fixture.count('mark-photo-broken')).toBe(1);
    await expect.poll(() => fixture.state.activePhoto.url).not.toContain('broken');
    const replacement = fixture.state.activePhoto.url.split('/').at(-1).replace('.svg', '');
    await shown(replacement);
    assert.strictEqual(fixture.count('next-photo'), 0);
    await elapsed(INTERVAL - 1);
    assert.strictEqual(fixture.count('next-photo'), 0);
  }],
  ['cancelled preloaders never emit late broken-image reports', async env => {
    const { fixture, page, shown } = env;
    await fixture.select('broken');
    await expect.poll(() => page.evaluate(() => window.retryWaits.at(-1)?.delay)).toBe(1000);
    await fixture.select('b');
    await shown('b');
    await page.clock.fastForward(20000);
    assert.strictEqual(fixture.count('mark-photo-broken'), 0);
    assert.strictEqual(fixture.count('next-photo'), 0);
    await shown('b');
  }],
  ['unreachable hosts hold the displayed image without marking it broken', async env => {
    const { fixture, page, shown } = env;
    await page.route(`${fixture.url}/`, route => route.request().method() === 'HEAD' ? route.abort() : route.continue());
    await fixture.select('broken');
    await exhaustRetries(env);
    await expect.poll(() => fixture.logs.some(line => line.startsWith('Holding current wallpaper'))).toBe(true);
    await shown('a');
    assert.strictEqual(fixture.count('mark-photo-broken'), 0);
    assert.strictEqual(fixture.count('next-photo'), 0);
  }],
  ['secondary and layout changes do not postpone primary rotation', async ({ fixture, page, elapsed }) => {
    await elapsed(INTERVAL - 100);
    const oldSecondary = fixture.state.activeSecondPhoto.url;
    const changedPair = Array.from({ length: 16 }, (_, index) => fixture.state.splitSeed + index + 1)
      .map(splitSeed => buildSnapshot(buildDomainState({ ...fixture.state, splitSeed }, fixture.collections)))
      .find(snapshot => snapshot.activeSecondPhoto.url !== oldSecondary);
    assert.ok(changedPair, 'Fixture must supply a different stable pair');
    fixture.state.splitSeed = changedPair.splitSeed;
    fixture.broadcastStateSync();
    const secondaryUrl = fixture.state.activeSecondPhoto.url;
    await expect.poll(() => page.locator('.slide.active .slide-half-image').nth(1).getAttribute('style')).toContain(secondaryUrl);
    await fixture.dispatch({ type: 'patch-state', payload: { splitPortrait: false } });
    await expect(page.locator('.slide.active .single-slide-image')).toHaveCount(1);
    await elapsed(INTERVAL + 1000);
    await expect.poll(() => fixture.count('next-photo')).toBe(1);
  }, portraitPhotos().filter(row => !row.url.includes('broken'))],
  ['a secondary failure preserves the healthy primary', async env => {
    const { fixture, page, elapsed } = env;
    // Keep only the primary and a broken portrait as pairing candidates.
    await elapsed(1000);
    const rows = [photo('p1', 'portrait'), photo('broken', 'portrait')];
    fixture.collections.Fixture = rows;
    fixture.state.photosList = rows.map(row => ({ ...row }));
    fixture.broadcastStateSync();
    await exhaustRetries(env);
    await expect.poll(() => fixture.count('mark-photo-broken')).toBe(1);
    await expect.poll(() => page.locator('.slide.active .single-slide-image').getAttribute('style')).toContain('/fixtures/p1.svg');
    assert.strictEqual(fixture.state.activePhoto.url, '/fixtures/p1.svg');
    assert.strictEqual(fixture.count('next-photo'), 0);
  }, portraitPhotos().filter(row => !row.url.includes('broken'))],
  ['a single-image pool keeps a stable frame across repeated timer ticks', async ({ fixture, page }) => {
    await page.clock.fastForward(INTERVAL + 1000);
    await expect.poll(() => fixture.count('next-photo')).toBe(1);
    await page.clock.fastForward(INTERVAL);
    await expect.poll(() => fixture.count('next-photo')).toBe(2);
    assert.strictEqual(fixture.state.activePhoto.url, '/fixtures/a.svg');
    assert.strictEqual(await page.locator('.slide').count(), 1);
  }, [photo('a')]]
];

const cursorCases = [
  ['active kiosk hides the cursor on the page and settings after inactivity', async ({ page }) => {
    await page.locator('.desktop-settings-btn').evaluate(button => button.click());
    await expect(page.locator('.desktop-settings-drawer')).toHaveClass(/open/);
    await page.clock.fastForward(2999);
    await expect(page.locator('body')).not.toHaveClass(/hide-cursor/);
    await page.clock.fastForward(1);
    await expect(page.locator('body')).toHaveClass(/hide-cursor/);
    for (const selector of ['body', '.desktop-settings-btn', '.desktop-settings-drawer']) {
      assert.strictEqual(await page.locator(selector).evaluate(element => getComputedStyle(element).cursor), 'none');
    }
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 40 })));
    await expect(page.locator('body')).not.toHaveClass(/hide-cursor/);
    await page.clock.fastForward(2999);
    await expect(page.locator('body')).not.toHaveClass(/hide-cursor/);
    await page.clock.fastForward(1);
    await expect(page.locator('body')).toHaveClass(/hide-cursor/);
  }, { screensaverActive: true }],
  ['activation rearms the kiosk cursor timer and deactivation restores the page', async ({ fixture, page }) => {
    await page.clock.fastForward(4000);
    await expect(page.locator('body')).not.toHaveClass(/hide-cursor/);
    fixture.state.screensaverActive = true;
    fixture.broadcastStateSync();
    await expect.poll(() => page.evaluate(() => window.__state.screensaverActive)).toBe(true);
    await page.clock.fastForward(2999);
    await expect(page.locator('body')).not.toHaveClass(/hide-cursor/);
    await page.clock.fastForward(1);
    await expect(page.locator('body')).toHaveClass(/hide-cursor/);
    fixture.state.screensaverActive = false;
    fixture.broadcastStateSync();
    await expect(page.locator('body')).not.toHaveClass(/hide-cursor/);
  }, {}],
  ['admin TV preview never hides the page-wide cursor', async ({ page }) => {
    await page.clock.fastForward(4000);
    await expect(page.locator('body')).not.toHaveClass(/hide-cursor/);
    assert.notStrictEqual(await page.locator('body').evaluate(element => getComputedStyle(element).cursor), 'none');
  }, { screensaverActive: true, preview: true }]
];


const weatherCases = [
  ['legacy snapshots show the location by default and keep weather visible', async ({ page }) => {
    await expect(page.locator('.weather-city')).toHaveText(/Fixture City, Fixture Region/);
    await expect(page.locator('.weather-temp')).toHaveText('21°C');
    await expect(page.locator('.forecast-day')).toHaveCount(3);
  }, { widgets: { weather: true } }],
  ['admin toggles sync to the TV and survive a fresh page load without changing weather data', async ({ page, fixture }) => {
    const before = JSON.stringify({ weather: fixture.weather, location: fixture.state.manualLocation, photos: fixture.state.photosList });
    const remote = await page.context().newPage();
    remote.on('pageerror', error => fixture.errors.push(error));
    await remote.goto(fixture.url + '/?mode=remote');
    await remote.getByRole('button', { name: 'System', exact: true }).click();
    const control = remote.getByRole('switch', { name: 'Show weather location', exact: true });
    await expect(control).toHaveAttribute('aria-checked', 'true');
    await control.focus();
    await control.press('Space');
    await expect(control).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.weather-city')).toHaveCount(0);
    await expect(page.locator('.weather-temp')).toHaveText('21°C');
    await expect(page.locator('.forecast-day')).toHaveCount(3);
    assert.deepStrictEqual(fixture.events.filter(({ event }) => event === 'patch-state').at(-1).payload, { widgets: { weatherLocation: false } });
    const firstSaved = fixture.persistence.collections.at(-1);
    assert.strictEqual(firstSaved.state.widgets.weatherLocation, false);
    assert.deepStrictEqual(fixture.persistence.env, []);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.weather-temp')).toHaveText('21°C');
    await expect(page.locator('.weather-city')).toHaveCount(0);
    await remote.reload({ waitUntil: 'domcontentloaded' });
    await remote.getByRole('button', { name: 'System', exact: true }).click();
    await expect(control).toHaveAttribute('aria-checked', 'false');
    await control.click();
    await expect(page.locator('.weather-city')).toHaveText(/Fixture City, Fixture Region/);
    // TV settings use the same REST mutation boundary, not a second state owner.
    await page.locator('.desktop-settings-btn').evaluate(button => button.click());
    const tvControl = page.getByRole('switch', { name: 'Show weather location', exact: true });
    await tvControl.press('Enter');
    await expect(control).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.weather-city')).toHaveCount(0);
    await fixture.dispatch({ type: 'patch-state', payload: { widgets: { weather: false } } });
    await expect(page.locator('.weather-widget')).toHaveCount(0);
    await fixture.dispatch({ type: 'patch-state', payload: { widgets: { weather: true } } });
    await expect(page.locator('.weather-temp')).toHaveText('21°C');
    await expect(page.locator('.weather-city')).toHaveCount(0);
    assert.strictEqual(JSON.stringify({ weather: fixture.weather, location: fixture.state.manualLocation, photos: fixture.state.photosList }), before);
    assert.strictEqual(firstSaved.state.widgets.weatherLocation, false);
    assert.strictEqual(fixture.persistence.collections.at(-1).state.widgets.weatherLocation, false);
    await remote.close();
  }, { widgets: { weather: true, weatherLocation: true } }]
];

// The same real REST/interpreter/store path is used by the isolated browser fixture.
const openComment = async page => {
  const details = page.locator('.photo-comment-disclosure');
  if (!await details.evaluate(element => element.open)) await details.locator('summary').click();
};
const commentCases = [
  ['private comment create/edit/clear is durable plain text and absent from TV/state', async ({ page, fixture }) => {
    const remote = await page.context().newPage();
    await remote.goto(fixture.url + '/?mode=remote');
    await openComment(remote);
    const text = remote.getByRole('textbox', { name: 'Private photo comment', exact: true });
    await expect(text).toBeEnabled();
    const before = JSON.stringify(fixture.collections);
    for (const comment of ['<script>window.commentInjected = true</script>\nPrivate note', 'Edited private note']) {
      await text.fill(comment);
      await remote.getByRole('button', { name: 'Save comment', exact: true }).click();
      await expect(remote.getByRole('status')).toHaveText('Comment saved');
      await remote.reload();
      await openComment(remote);
      await expect(text).toHaveValue(comment);
      assert.equal(fixture.commentStore.read(fixture.collections.Fixture[0]).comment, comment);
    }
    assert.equal(await remote.evaluate(() => window.commentInjected), undefined);
    assert.ok(!JSON.stringify(fixture.refreshSnapshot()).includes('Edited private note'));
    fixture.state.splitSeed += 1;
    fixture.broadcastStateSync();
    await expect.poll(() => page.evaluate(() => window.__state.splitSeed)).toBe(fixture.state.splitSeed);
    assert.ok(!(await page.evaluate(() => JSON.stringify(window.__state))).includes('Edited private note'));
    assert.ok(!(await page.locator('body').innerText()).includes('Edited private note'));
    assert.equal(JSON.stringify(fixture.collections), before);
    await remote.getByRole('button', { name: 'Clear comment', exact: true }).click();
    await expect(text).toHaveValue('');
    await remote.reload();
    await openComment(remote);
    await expect(text).toHaveValue('');
    assert.equal(fixture.commentStore.read(fixture.collections.Fixture[0]).comment, '');
    await remote.close();
  }],
  ['comment read/save errors retain drafts and allow retry without false success', async ({ page, fixture }) => {
    const remote = await page.context().newPage();
    let failRead = true, failSave = true;
    await remote.route('**/api/admin/photo-comment**', route => {
      const method = route.request().method();
      return (method === 'GET' ? failRead : failSave)
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Injected comment failure"}' })
        : route.continue();
    });
    await remote.goto(fixture.url + '/?mode=remote');
    await openComment(remote);
    const text = remote.getByRole('textbox', { name: 'Private photo comment', exact: true });
    await expect(remote.getByRole('alert')).toHaveText('Injected comment failure');
    await expect(text).toBeDisabled();
    failRead = false;
    await remote.getByRole('button', { name: 'Retry loading comment' }).click();
    await expect(text).toBeEnabled();
    await text.fill('Unsaved private draft');
    await remote.getByRole('button', { name: 'Save comment', exact: true }).click();
    await expect(remote.getByRole('alert')).toHaveText('Injected comment failure');
    await remote.locator('.photo-comment-disclosure summary').click();
    await expect(text).not.toBeVisible();
    await expect(remote.getByRole('status')).toHaveText('Comment not saved');
    await openComment(remote);
    await expect(text).toHaveValue('Unsaved private draft');
    assert.equal(fixture.commentStore.read(fixture.collections.Fixture[0]).comment, '');
    failSave = false;
    await remote.getByRole('button', { name: 'Save comment', exact: true }).click();
    await expect(remote.getByRole('status')).toHaveText('Comment saved');
    await text.fill('Draft after saved comment');
    failSave = true;
    await remote.getByRole('button', { name: 'Clear comment', exact: true }).click();
    await expect(remote.getByRole('alert')).toHaveText('Injected comment failure');
    await expect(text).toHaveValue('Draft after saved comment');
    assert.equal(fixture.commentStore.read(fixture.collections.Fixture[0]).comment, 'Unsaved private draft');
    await remote.close();
  }],
  ['left/right selection keeps separate drafts and isolates delayed save responses', async ({ page, fixture }) => {
    const remote = await page.context().newPage();
    await remote.goto(fixture.url + '/?mode=remote');
    await openComment(remote);
    const text = remote.getByRole('textbox', { name: 'Private photo comment', exact: true });
    await expect(text).toBeEnabled();
    await text.fill('Left draft');
    await remote.getByRole('button', { name: 'Select right photo', exact: true }).click();
    await openComment(remote);
    await expect(text).toHaveValue('');
    await expect(text).toBeEnabled();
    await text.fill('Right draft');
    const rightUrl = fixture.state.activeSecondPhoto.url;
    const rightRating = remote.getByRole('group', { name: 'Photo rating (Right Photo)', exact: true });
    await rightRating.getByRole('button', { name: /^Set rating 5 for / }).click();
    await expect(rightRating.getByText('5 / 10', { exact: true })).toBeVisible();
    await rightRating.getByRole('button', { name: 'Reset to unrated', exact: true }).click();
    await expect(rightRating.getByText('Unrated', { exact: true })).toBeVisible();
    assert.equal(fixture.collections.Fixture.find(row => row.url === rightUrl).rating, null);
    assert.equal(fixture.collections.Fixture[0].rating, 10);
    await remote.getByRole('button', { name: 'Select left photo', exact: true }).press('Enter');
    await expect(text).toHaveValue('Left draft');
    let release;
    await remote.route('**/api/admin/photo-comment', async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      await new Promise(resolve => { release = resolve; });
      await route.continue();
    });
    await remote.getByRole('button', { name: 'Save comment', exact: true }).click();
    await expect(text).toBeDisabled();
    await remote.getByRole('button', { name: 'Select right photo', exact: true }).click();
    await openComment(remote);
    await expect(text).toHaveValue('Right draft');
    await expect.poll(() => typeof release).toBe('function');
    release();
    await expect.poll(() => fixture.commentStore.read(fixture.collections.Fixture[0]).comment).toBe('Left draft');
    await expect(text).toHaveValue('Right draft');
    await remote.getByRole('button', { name: 'Select left photo', exact: true }).click();
    await expect(text).toHaveValue('Left draft');
    await expect(remote.getByRole('button', { name: 'Save comment', exact: true })).toBeDisabled();
    await remote.close();
  }, portraitPhotos().filter(row => !row.url.includes('broken'))],
  ['a delayed read cannot overwrite the newly selected portrait comment', async ({ page, fixture }) => {
    const remote = await page.context().newPage();
    let first = true, release;
    await remote.route('**/api/admin/photo-comment?*', async route => {
      if (!first) return route.continue();
      first = false;
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"comment":"Old delayed response"}' });
    });
    await remote.goto(fixture.url + '/?mode=remote');
    await openComment(remote);
    const text = remote.getByRole('textbox', { name: 'Private photo comment', exact: true });
    await expect(text).toBeDisabled();
    await expect.poll(() => typeof release).toBe('function');
    await remote.getByRole('button', { name: 'Select right photo', exact: true }).click();
    await openComment(remote);
    await expect(text).toBeEnabled();
    await text.fill('New portrait draft');
    // Register before releasing so a fast response cannot race the observer.
    const settled = remote.waitForResponse(response => response.url().includes('photo-comment') && response.status() === 200);
    release();
    await settled;
    await expect(text).toHaveValue('New portrait draft');
    await remote.close();
  }, portraitPhotos().filter(row => !row.url.includes('broken'))]
,
  ['compact comment disclosure preserves drafts, cues and keyboard/touch layout without writes', async ({ page, fixture }) => {
    const remote = await page.context().newPage();
    const text = remote.getByRole('textbox', { name: 'Private photo comment', exact: true });
    const disclosure = remote.locator('.photo-comment-disclosure summary');
    let writes = 0;
    remote.on('request', request => { if (request.method() === 'PATCH') writes += 1; });
    for (const width of [320, 1280]) {
      await remote.setViewportSize({ width, height: 850 });
      await remote.goto(fixture.url + '/?mode=remote');
      await expect(remote.getByRole('status')).toHaveText('No comment');
      await expect(text).not.toBeVisible();
      await expect(disclosure).toHaveText('Add comment');
      assert.ok((await disclosure.boundingBox()).height >= 44);
      await disclosure.focus();
      await disclosure.press('Enter');
      await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
      await text.fill('Private draft retained');
      await disclosure.press('Space');
      await expect(text).not.toBeVisible();
      await expect(remote.getByRole('status')).toHaveText('Unsaved comment');
      await disclosure.press('Enter');
      await expect(text).toHaveValue('Private draft retained');
      const panel = remote.locator('.remote-card').first();
      assert.ok(await panel.evaluate(element => element.scrollWidth <= element.clientWidth), 'Curation card fits viewport');
      const buttons = remote.locator('.photo-rating-control .image-feeds-rating-scale button');
      for (const button of await buttons.all()) {
        const box = await button.boundingBox();
        assert.ok(box.height >= 44 && box.width >= 40, 'Rating touch target');
      }
      if (width === 320) {
        await remote.screenshot({ path: '.agents/instruction-archives/curation-20261126/expanded-320.png', fullPage: true });
        await disclosure.click();
        await remote.screenshot({ path: '.agents/instruction-archives/curation-20261126/compact-320.png', fullPage: true });
      }
    }
    assert.equal(writes, 0, 'Disclosure and typing do not save');
    assert.equal(fixture.commentStore.read(fixture.collections.Fixture[0]).comment, '');
    await remote.close();
  }],
  ['both admin rating surfaces distinguish unrated, reset explicitly and preserve legacy 10/ban', async ({ page, fixture }) => {
    const remote = await page.context().newPage();
    await remote.setViewportSize({ width: 320, height: 850 });
    await remote.goto(fixture.url + '/?mode=remote');
    const rating = remote.getByRole('group', { name: 'Photo rating', exact: true });
    await openComment(remote);
    await remote.getByRole('textbox', { name: 'Private photo comment', exact: true }).fill('PRIVATE_CURATION_NOTE');
    await remote.getByRole('button', { name: 'Save comment', exact: true }).click();
    await expect(remote.getByRole('status')).toHaveText('Comment saved');
    await remote.locator('.photo-comment-disclosure summary').click();
    await expect(rating.getByText('Unrated', { exact: true })).toBeVisible();
    await expect(rating.locator('button[aria-pressed="true"]')).toHaveCount(0);
    await rating.getByRole('button', { name: 'Set rating 4 for a', exact: true }).click();
    await expect(rating.getByText('4 / 10')).toBeVisible();
    assert.equal(fixture.readPersisted().feeds.Fixture[0].rating, 4, 'Intermediate rating4 must reach disk before reset');
    assert.equal(fixture.readReconstructed().Fixture[0].rating, 4);
    await remote.getByRole('button', { name: 'Image Feeds', exact: true }).click();
    await expect(rating.getByText('4 / 10')).toBeVisible();
    await rating.getByRole('button', { name: 'Reset to unrated', exact: true }).click();
    await expect(rating.getByText('Unrated', { exact: true })).toBeVisible();
    assert.equal(fixture.collections.Fixture[0].rating, null);
    assert.equal(fixture.persistence.collections.at(-1).collections.Fixture[0].rating, null);
    assert.equal(fixture.readPersisted().feeds.Fixture[0].rating, null);
    assert.equal(fixture.readReconstructed().Fixture[0].rating, null);
    assert.equal(fixture.commentStore.read(fixture.collections.Fixture[0]).comment, 'PRIVATE_CURATION_NOTE');
    assert.ok(!JSON.stringify(fixture.refreshSnapshot()).includes('PRIVATE_CURATION_NOTE'));
    await remote.reload();
    await expect(rating.getByText('Unrated', { exact: true })).toBeVisible();
    await remote.getByRole('button', { name: 'Direct Control', exact: true }).click();
    await expect(remote.locator('.photo-comment-disclosure summary')).toHaveText('View/edit comment');
    await expect(remote.getByRole('textbox', { name: 'Private photo comment', exact: true })).not.toBeVisible();
    await expect(remote.getByRole('status')).toHaveText('Comment saved');
    await expect(rating.locator('button[aria-pressed="true"]')).toHaveCount(0);
    await rating.getByRole('button', { name: 'Set rating 1 for a', exact: true }).click();
    await expect.poll(() => fixture.state.photosList.some(row => row.url === '/fixtures/a.svg')).toBe(false);
    await expect(rating.getByRole('button', { name: 'Set rating 10 for b', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await remote.close();
  }, [{ ...photo('a'), rating: null }, photo('b'), photo('c')]]

];

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.LUMINA_CHROMIUM_PATH || '/usr/bin/chromium-browser',
    headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    for (const [name, run, photos] of cases) {
      await withFixture(browser, run, photos);
      console.log(`PASS: ${name}`);
    }
    console.log(`${cases.length} slideshow browser regressions passed.`);
    for (const [name, run, options] of cursorCases) {
      await withFixture(browser, run, landscapePhotos(), options);
      console.log(`PASS: ${name}`);
    }
    console.log(`${cursorCases.length} cursor browser regressions passed.`);
    for (const [name, run, options] of weatherCases) {
      await withFixture(browser, run, landscapePhotos(), options);
      console.log(`PASS: ${name}`);
    }
    console.log(`${weatherCases.length} weather-location browser regressions passed.`);
    for (const [name, run, photos] of commentCases) {
      await withFixture(browser, run, photos || landscapePhotos());
      console.log(`PASS: ${name}`);
    }
    console.log(`${commentCases.length} private comment browser regressions passed.`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
