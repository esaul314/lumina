// Closed service/composition fixtures: no private config, location lookup or I/O.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { compileFunction } = require('node:vm');
const http = require('node:http');
const { createEnvironmentRefreshRuntime } = require('../runtime/environmentRefresh.js');
const source = readFileSync(__filename.replace(/\.test\.js$/, '.js'), 'utf8');
const fallback = Object.freeze({ lat: 12, lon: 34, city: 'Configured', regionName: 'Region', country: 'Country' });
const record = Object.freeze({ success: true, latitude: 0, longitude: 0, city: ' City ', region: ' Region ', country: ' Country ' });
const expected = { lat: 0, lon: 0, city: 'City', regionName: 'Region', country: 'Country' };
const ok = data => ({ ok: true, json: async () => data });

function fixture(fetchImpl = async () => ok(record), realTimers = false) {
  const timers = new Map(), calls = [], warnings = [];
  const log = { log() {}, warn: (...args) => warnings.push(args), error() {} };
  const module = { exports: {} };
  const request = (...args) => { calls.push(args); return fetchImpl(...args); };
  compileFunction(source, ['module', 'require', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'console'])(
    module, name => {
      assert.equal(name, '../config/configLoader.js');
      return { location: fallback };
    }, request, AbortController,
    (callback, ms) => { const id = realTimers ? setTimeout(callback, ms) : {}; timers.set(id, { callback, ms }); return id; },
    id => { if (realTimers) clearTimeout(id); timers.delete(id); }, log
  );
  return {
    ...module.exports, calls, timers, warnings,
    expire() { assert.equal(timers.size, 1); [...timers.values()][0].callback(); }
  };
}

function assertReleased(f) {
  assert.equal(f.timers.size, 0);
  assert.ok(f.calls.every(([, options]) => options.signal.aborted));
}

test('HTTPS caller-IP lookup projects valid zero coordinates and owns request cleanup', async () => {
  const f = fixture();
  assert.deepEqual(await f.getIpLocation(), expected);
  assert.equal(f.calls.length, 1);
  const [url, options] = f.calls[0];
  assert.equal(url, 'https://ipwho.is/');
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Accept, 'application/json');
  assert.deepEqual(f.warnings, []);
  assertReleased(f);
  assert.deepEqual(record, { success: true, latitude: 0, longitude: 0, city: ' City ', region: ' Region ', country: ' Country ' });
});

for (const [name, data] of [
  ['null', null], ['array', [record]], ['provider failure', { ...record, success: false }],
  ['missing success', { ...record, success: undefined }], ['null success', { ...record, success: null }],
  ['non-boolean success', { ...record, success: 'true' }], ['missing country', { ...record, country: undefined, country_name: 'Legacy' }],
  ['missing latitude', { ...record, latitude: undefined }], ['null latitude', { ...record, latitude: null }],
  ['numeric string', { ...record, longitude: '0' }], ['NaN', { ...record, latitude: NaN }],
  ['infinite', { ...record, longitude: Infinity }], ['latitude overflow', { ...record, latitude: 90.01 }],
  ['latitude underflow', { ...record, latitude: -90.01 }], ['longitude overflow', { ...record, longitude: 180.01 }],
  ['longitude underflow', { ...record, longitude: -180.01 }], ['missing label', { ...record, region: undefined }],
  ['empty label', { ...record, city: '  ' }], ['non-string label', { ...record, country: 1 }]
]) {
  test(`invalid provider ${name} returns the exact configured fallback`, async () => {
    const f = fixture(async () => ok(data));
    assert.equal(await f.getIpLocation(), fallback);
    assert.equal(f.calls.length, 1);
    assert.equal(f.warnings.length, 1);
    assertReleased(f);
  });
}

for (const coordinates of [[90, 180], [-90, -180]]) {
  test(`geographic boundary ${coordinates} is valid`, async () => {
    const f = fixture(async () => ok({ ...record, latitude: coordinates[0], longitude: coordinates[1] }));
    assert.deepEqual(await f.getIpLocation(), { ...expected, lat: coordinates[0], lon: coordinates[1] });
    assertReleased(f);
  });
}

for (const status of [301, 401, 403, 429, 500]) {
  test(`rejected HTTP${status} does not consume the body, retry or alter fallback`, async () => {
    const f = fixture(async () => ({ ok: false, status, json: () => assert.fail('Rejected body decoded') }));
    assert.equal(await f.getIpLocation(), fallback);
    assert.equal(f.calls.length, 1);
    assertReleased(f);
  });
}

for (const [name, fetchImpl] of [
  ['transport rejection', async () => { throw new Error('transport'); }],
  ['JSON rejection', async () => ({ ok: true, json: async () => { throw new SyntaxError('body'); } })],
  ['non-Error rejection', async () => { throw null; }]
]) {
  test(`${name} is contained with one warning and full cleanup`, async () => {
    const f = fixture(fetchImpl);
    assert.equal(await f.getIpLocation(), fallback);
    assert.equal(f.warnings.length, 1);
    assertReleased(f);
  });
}

for (const stage of ['fetch', 'body']) {
  test(`one three-second deadline bounds a stalled ${stage}, even without cooperative abort`, async () => {
    let rejectLate;
    const pending = new Promise((_resolve, reject) => { rejectLate = reject; });
    const f = fixture(async () => stage === 'fetch' ? pending : { ok: true, json: () => pending });
    const result = f.getIpLocation();
    await Promise.resolve();
    assert.deepEqual([...f.timers.values()].map(({ ms }) => ms), [3000]);
    f.expire();
    assert.equal(await result, fallback);
    assertReleased(f);
    rejectLate(new Error('Late failure must remain handled'));
    await Promise.resolve();
    assert.equal(f.warnings.length, 1);
  });
}

test('a failed automatic lookup does not poison the next successful attempt', async () => {
  let denied = true;
  const f = fixture(async () => denied ? { ok: false } : ok(record));
  assert.equal(await f.getIpLocation(), fallback);
  denied = false;
  assert.deepEqual(await f.getIpLocation(), expected);
  assert.equal(f.calls.length, 2);
  assertReleased(f);
});

test('explicit manual coordinates bypass all lookup effects and retain object identity', async () => {
  const f = fixture(() => assert.fail('Manual location must not query a provider'));
  const manualLocation = Object.freeze({ ...fallback, lat: -8, lon: 9, city: 'Manual' });
  const state = Object.freeze({ autoLocation: false, manualLocation });
  assert.equal(await f.resolveActiveLocation(state), manualLocation);
  assert.equal(f.calls.length, 0);
  assertReleased(f);
});

for (const state of [null, {}, { autoLocation: true, manualLocation: fallback }, { autoLocation: false, manualLocation: null }]) {
  test(`automatic resolution preserves existing selection semantics: ${JSON.stringify(state)}`, async () => {
    const f = fixture();
    assert.deepEqual(await f.resolveActiveLocation(state), expected);
    assert.equal(f.calls.length, 1);
    assertReleased(f);
  });
}

for (const mode of ['automatic', 'fallback', 'manual']) {
  test(`${mode} location reaches actual weather cache/classification/broadcast composition`, async () => {
    const f = fixture(async () => mode === 'fallback' ? { ok: false } : ok(record));
    const state = { autoLocation: mode !== 'manual', manualLocation: fallback };
    const weather = { current: { temperature_2m: 22.4, weather_code: 61 }, daily: ['forecast'] };
    const effects = [];
    const runtime = createEnvironmentRefreshRuntime({
      state, collections: {}, activeFeedRuntime: {}, jsonPath: 'unused',
      resolveActiveLocation: f.resolveActiveLocation,
      fetchWeatherForecast: async (...coordinates) => { effects.push(['forecast', coordinates]); return weather; },
      classifyWeatherCode: f.classifyWeatherCode,
      setWeatherData: data => effects.push(['cache', data]), broadcastStateSync: () => effects.push(['broadcast']),
      log: { log() {}, error() {} }
    });
    const location = mode === 'automatic' ? expected : fallback;
    const result = await runtime.updateServerWeather();
    assert.deepEqual(effects, [
      ['forecast', [location.lat, location.lon]], ['cache', { location, current: weather.current, daily: weather.daily }], ['broadcast']
    ]);
    assert.deepEqual(result.location, location);
    assert.deepEqual(state.physicalWeather, { temp: 22, condition: 'Rainy / Stormy', weatherMatch: 'Rainy' });
    assert.equal(f.calls.length, mode === 'manual' ? 0 : 1);
    assertReleased(f);
  });
}

for (const stage of ['headers', 'body']) {
  test(`native fetch cancels a stalled ${stage} through the whole-operation deadline`, { timeout: 3000 }, async t => {
    let sawRequest;
    const requested = new Promise(resolve => { sawRequest = resolve; });
    const server = http.createServer((request, response) => {
      if (request.url === '/ready') return response.end('ready');
      if (stage === 'body') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write('{');
      }
      sawRequest();
    });
    t.after(async () => {
      const closed = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await closed;
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    // Qualify the stalled phase, not a cold connection's admission scheduling.
    await (await fetch(`http://127.0.0.1:${port}/ready`)).text();
    const f = fixture((_url, options) => fetch(`http://127.0.0.1:${port}/fixture`, options), true);
    const result = f.getIpLocation({ timeoutMs: 500 });
    await Promise.race([requested, result.then(() => { throw new Error('Deadline won before fixture request arrival'); })]);
    assert.equal(await result, fallback);
    assertReleased(f);
  });
}
