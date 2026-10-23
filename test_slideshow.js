// Isolated browser regressions: no production daemon, cache, or external images.
process.env.NODE_ENV = 'test';

const assert = require('assert/strict');
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { chromium, expect } = require('@playwright/test');
const { createDomainDispatcher } = require('./server/domain/dispatch.js');
const { buildDomainState, buildSnapshot } = require('./server/domain/snapshot.js');
const { SOCKET_DURABLE_COMMAND_SPECS } = require('./server/domain/commands.js');

const INTERVAL = 120000;
const RETRY_DELAYS = [1000, 2000, 4000, 8000];
const photo = (id, orientation = 'landscape') => ({
  url: `/fixtures/${id}.svg`, title: id, category: 'Fixture', rating: 10,
  orientation, width: 640, height: orientation === 'portrait' ? 960 : 360
});
const landscapePhotos = () => ['a', 'b', 'c', 'broken'].map(id => photo(id));
const portraitPhotos = () => ['p1', 'p2', 'p3', 'broken'].map(id => photo(id, 'portrait'));

async function createFixture(photos) {
  const app = express();
  const server = http.createServer(app);
  // Clock jumps must not simulate Socket.IO heartbeat failure.
  const io = new Server(server, { pingInterval: 1000000000, pingTimeout: 1000000000 });
  const state = {
    currentCategory: 'Fixture', activePhoto: photos[0], photosList: photos,
    theme: 'Zen Retreat', scaleMode: 'cover', splitPortrait: true, splitCropPercent: 50,
    widgets: {}, slideshowInterval: INTERVAL, inactivityTimeout: 600000,
    alignTimeOfDay: false, alignWeather: false, nightPercentage: 50,
    searchKeywords: {}, feedConfigs: {}, poolPolicies: {}, excludedKeywords: [],
    autoLocation: false, manualLocation: {}, screensaverActive: false, splitSeed: 1
  };
  const collections = { Fixture: photos.map(row => ({ ...row })) };
  const events = [];
  const errors = [];
  const logs = [];
  const dispatcher = createDomainDispatcher({ state, collections, io });
  const dispatch = command => dispatcher.dispatchCommand(command, { rng: () => 0.5 });
  let slowResponse;

  app.head('/', (_req, res) => res.sendStatus(200));
  app.get('/api/state', (_req, res) => res.json(dispatcher.refreshSnapshot()));
  app.get('/api/pools', (_req, res) => res.json([]));
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
  app.use(express.static(path.join(__dirname, 'client/dist')));
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
    state, collections, events, errors, logs, dispatch, ...dispatcher,
    url: `http://127.0.0.1:${server.address().port}`,
    get slowPending() { return Boolean(slowResponse); },
    releaseSlow: () => slowResponse(),
    select: id => dispatch({ type: 'set-active-photo', payload: { url: `/fixtures/${id}.svg` } }),
    count: event => events.filter(entry => entry.event === event).length,
    close: () => new Promise(resolve => io.close(resolve))
  };
}

const activeBackground = () => document.querySelector(
  '.slide.active .single-slide-image, .slide.active .slide-half-image'
)?.style.backgroundImage || '';

async function withFixture(browser, run, photos = landscapePhotos()) {
  const fixture = await createFixture(photos);
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => fixture.errors.push(error));
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
    await page.goto(`${fixture.url}/?mode=tv`, { waitUntil: 'domcontentloaded' });
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
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
