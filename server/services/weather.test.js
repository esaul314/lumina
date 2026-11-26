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

function fixture(fetchImpl = async () => ok(record), realTimers = false, serviceSource = source) {
  const timers = new Map(), calls = [], warnings = [];
  const log = { log() {}, warn: (...args) => warnings.push(args), error() {} };
  const module = { exports: {} };
  const request = (...args) => { calls.push(args); return fetchImpl(...args); };
  compileFunction(serviceSource, ['module', 'require', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'console'])(
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

const forecast = Object.freeze({ current: { temperature_2m: 22.4, weather_code: 61 }, daily: { weather_code: [61] } });
const flush = () => new Promise(resolve => setImmediate(resolve));
for (const stage of ['fetch', 'body']) {
  test(`forecast whole-operation deadline settles stalled ${stage} and releases all owned resources`, async () => {
    let rejectLate;
    const pending = new Promise((_resolve, reject) => { rejectLate = reject; });
    const f = fixture(async () => stage === 'fetch' ? pending : { ok: true, json: () => pending });
    const result = f.fetchWeatherForecast(12, 34);
    // Observe the rejection before expiring to keep strict-runtime tests honest.
    const rejected = assert.rejects(result, /forecast deadline exceeded/i);
    await flush();
    assert.deepEqual([...f.timers.values()].map(({ ms }) => ms), [5000]);
    f.expire();
    await rejected; assertReleased(f);
    rejectLate(new Error('late forecast failure')); await flush();
  });
}

test('forecast success keeps query, raw fields, zero values and unknown numeric WMO fallback', async () => {
  const data = Object.freeze({ current: { temperature_2m: 0, weather_code: 777, is_day: 0 }, daily: ['legacy'], extra: 'retained' });
  const f = fixture(async () => ok(data));
  assert.equal(await f.fetchWeatherForecast(0, -180), data);
  const url = new URL(f.calls[0][0]);
  assert.equal(url.origin, 'https://api.open-meteo.com');
  assert.equal(url.pathname, '/v1/forecast');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    latitude: '0', longitude: '-180',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum', timezone: 'auto'
  });
  assert.deepEqual(f.classifyWeatherCode(777), { physicalMatch: 'Cloudy', physicalCond: 'Cloudy / Overcast' });
  assertReleased(f);
});

for (const [name, data] of [
  ['null', null], ['array', []], ['provider error', { error: true, ...forecast }],
  ['absent current', {}], ['array current', { current: [] }], ['null current', { current: null }],
  ['string temperature', { current: { ...forecast.current, temperature_2m: '22' } }],
  ['non-finite temperature', { current: { ...forecast.current, temperature_2m: Infinity } }],
  ['missing weather code', { current: { temperature_2m: 22 } }],
  ['non-finite code', { current: { ...forecast.current, weather_code: NaN } }]
]) {
  test(`malformed forecast ${name} rejects before cache admission`, async () => {
    const f = fixture(async () => ok(data));
    await assert.rejects(f.fetchWeatherForecast(12, 34), /Invalid Open-Meteo forecast/);
    assert.equal(f.calls.length, 1); assertReleased(f);
  });
}

for (const [name, fetchImpl, failure] of [
  ['HTTP denial', async () => ({ ok: false, status: 503, json: () => assert.fail('Denied body read') }), /status 503/],
  ['transport rejection', async () => { throw new Error('Fixture transport failure'); }, /Fixture transport failure/],
  ['malformed JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError('Fixture bad JSON'); } }), /Fixture bad JSON/],
  ['null rejection', async () => { throw null; }, value => value === null]
]) {
  test(`forecast ${name} cleans resources; next existing request recovers without retry`, async () => {
    let failed = true;
    const f = fixture((...args) => failed ? fetchImpl(...args) : ok(forecast));
    await assert.rejects(f.fetchWeatherForecast(12, 34), failure);
    assert.equal(f.calls.length, 1); assertReleased(f);
    failed = false;
    assert.equal(await f.fetchWeatherForecast(12, 34), forecast);
    assert.equal(f.calls.length, 2); assertReleased(f);
  });
}

for (const timeoutMs of [0, -1, NaN, Infinity]) {
  test(`invalid internal forecast deadline ${timeoutMs} retains finite default`, async () => {
    const f = fixture(async () => ok(forecast));
    const result = f.fetchWeatherForecast(12, 34, { timeoutMs });
    assert.equal([...f.timers.values()][0].ms, 5000);
    await result; assertReleased(f);
  });
}

test('deadline negative control fails settlement oracle for an abort-ignoring body, then cleans up', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const disabled = source.replace('return await Promise.race([lookup(), deadline]);',
    'return await Promise.race([lookup(), deadline.catch(() => new Promise(() => {}))]);');
  assert.notEqual(disabled, source);
  const f = fixture(async () => ({ ok: true, json: () => pending }), false, disabled);
  let settled = false;
  const result = f.fetchWeatherForecast(12, 34).finally(() => { settled = true; });
  await flush(); f.expire(); await flush();
  assert.throws(() => assert.equal(settled, true), assert.AssertionError, 'disabled deadline must fail prompt-settlement oracle');
  release(forecast); await result; assertReleased(f);
});

test('late non-cooperative forecast success never publishes after timeout; next trigger recovers', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let slow = true;
  const f = fixture(async () => ({ ok: true, json: () => slow ? pending : Promise.resolve(forecast) }));
  const prior = { location: fallback, current: forecast.current, daily: forecast.daily }, physical = { temp: 22, weatherMatch: 'Rainy' };
  let cache = prior, broadcasts = 0;
  const state = { autoLocation: false, manualLocation: fallback, physicalWeather: physical };
  const runtime = createEnvironmentRefreshRuntime({
    state, collections: {}, activeFeedRuntime: {}, jsonPath: 'unused',
    resolveActiveLocation: f.resolveActiveLocation, fetchWeatherForecast: f.fetchWeatherForecast,
    classifyWeatherCode: f.classifyWeatherCode, setWeatherData: value => { cache = value; },
    broadcastStateSync: () => { broadcasts += 1; }, log: { log() {}, error() {} }
  });
  const result = runtime.updateServerWeather();
  await flush(); f.expire(); assert.equal(await result, null);
  assert.equal(cache, prior); assert.equal(state.physicalWeather, physical); assert.equal(broadcasts, 0);
  release(forecast); await flush();
  assert.equal(cache, prior); assert.equal(broadcasts, 0); assertReleased(f);
  slow = false;
  assert.ok(await runtime.updateServerWeather());
  assert.equal(broadcasts, 1); assertReleased(f);
});

for (const stage of ['headers', 'body']) {
  test(`native forecast ${stage} stall aborts the actual connection and leaves no timer`, { timeout: 3000 }, async t => {
    let entered, closed;
    const requested = new Promise(resolve => { entered = resolve; });
    const disconnected = new Promise(resolve => { closed = resolve; });
    const server = http.createServer((req, res) => {
      if (req.url === '/ready') return res.end('ready');
      // Install close observation before the request can time out.
      res.once('close', closed);
      if (stage === 'body') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); }
      entered();
    });
    t.after(async () => {
      const stopped = new Promise(resolve => server.close(resolve));
      server.closeAllConnections(); await stopped;
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    await (await fetch(origin + '/ready')).text();
    const f = fixture((_url, options) => fetch(origin + '/forecast', options), true);
    const result = f.fetchWeatherForecast(12, 34, { timeoutMs: 500 });
    const rejected = assert.rejects(result, /forecast deadline exceeded/);
    await Promise.race([requested, result.then(() => assert.fail('Unexpected success'), () => assert.fail('Timeout before request arrival'))]);
    await rejected; await disconnected; assertReleased(f);
  });
}

for (const consumer of ['periodic', 'route']) {
  test(`${consumer} rejects a selection changed during location resolution before fetching`, async () => {
    const state = { autoLocation: false, manualLocation: { ...fallback } };
    const effects = [];
    const resolveLocation = async () => { state.manualLocation.city = 'Changed label'; return fallback; };
    const fetchWeather = async () => { effects.push('fetch'); return forecast; };
    if (consumer === 'periodic') {
      const runtime = createEnvironmentRefreshRuntime({
        state, collections: {}, activeFeedRuntime: {}, jsonPath: 'unused',
        resolveActiveLocation: resolveLocation, fetchWeatherForecast: fetchWeather,
        classifyWeatherCode: () => assert.fail('Unexpected classification'),
        setWeatherData: () => effects.push('cache'), broadcastStateSync: () => effects.push('broadcast'),
        log: { log() {}, error() {} }
      });
      assert.equal(await runtime.updateServerWeather(), null);
    } else {
      const { createRequire } = require('node:module'), path = require('node:path');
      const filename = path.resolve(__dirname, '../routes.js'), nativeRequire = createRequire(filename), moduleFixture = { exports: {} };
      compileFunction(readFileSync(filename, 'utf8'), ['module', 'require'], { filename })(
        moduleFixture, name => ['./services/weather.js', './services/googlePhotos.js'].includes(name) ? {} : nativeRequire(name));
      let weatherHandler;
      const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, (url, handler) => {
        if (method === 'get' && url === '/api/weather') weatherHandler = handler;
      }]));
      moduleFixture.exports({ app, state, collections: {}, getWeatherData: () => null, setWeatherData: () => effects.push('cache'),
        resolveWeatherLocation: resolveLocation, fetchWeather });
      const result = {};
      const response = { status(value) { result.status = value; return response; }, json(value) { result.body = value; } };
      await weatherHandler({}, response);
      assert.equal(result.status, 500); assert.match(result.body.message, /location changed/);
    }
    assert.deepEqual(effects, []);
  });
}

test('unrelated state edits and identity replacement do not discard a same-selection forecast', async () => {
  const state = { autoLocation: false, manualLocation: { ...fallback } };
  const effects = [];
  const runtime = createEnvironmentRefreshRuntime({
    state, collections: {}, activeFeedRuntime: {}, jsonPath: 'unused',
    resolveActiveLocation: async () => {
      state.manualLocation = { ...fallback };
      state.theme = 'Other';
      return fallback;
    },
    fetchWeatherForecast: async () => forecast,
    classifyWeatherCode: () => ({ physicalMatch: 'Rainy', physicalCond: 'Rainy / Stormy' }),
    setWeatherData: () => effects.push('cache'), broadcastStateSync: () => effects.push('broadcast'),
    log: { log() {}, error() {} }
  });
  assert.ok(await runtime.updateServerWeather());
  assert.deepEqual(effects, ['cache', 'broadcast']);
});

for (const [name, response] of [
  ['HTTP', async () => ({ ok: false, status: 503 })],
  ['JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError('Fixture malformed JSON'); } })],
  ['current validation', async () => ok({ current: { temperature_2m: NaN, weather_code: 61 } })],
  ['transport', async () => { throw new Error('Fixture offline'); }]
]) {
  test(`periodic ${name} failure preserves cache/physical state and next trigger recovers`, async () => {
    let fail = true;
    const f = fixture((...args) => fail ? response(...args) : ok(forecast));
    const prior = { location: fallback, current: forecast.current, daily: forecast.daily };
    const physical = { temp: 22, condition: 'Rainy / Stormy', weatherMatch: 'Rainy' };
    const state = { autoLocation: false, manualLocation: fallback, physicalWeather: physical };
    let cache = prior, broadcasts = 0;
    const errors = [];
    const runtime = createEnvironmentRefreshRuntime({
      state, collections: {}, activeFeedRuntime: {}, jsonPath: 'unused',
      resolveActiveLocation: f.resolveActiveLocation, fetchWeatherForecast: f.fetchWeatherForecast,
      classifyWeatherCode: f.classifyWeatherCode, setWeatherData: value => { cache = value; },
      broadcastStateSync: () => { broadcasts += 1; }, log: { log() {}, error: (...args) => errors.push(args) }
    });
    assert.equal(await runtime.updateServerWeather(), null);
    assert.equal(cache, prior); assert.equal(state.physicalWeather, physical);
    assert.equal(broadcasts, 0); assert.equal(errors.length, 1); assertReleased(f);
    fail = false;
    assert.ok(await runtime.updateServerWeather());
    assert.notEqual(cache, prior); assert.equal(broadcasts, 1); assertReleased(f);
  });
}

test('classification failure cannot partially replace an otherwise valid cached forecast', async () => {
  const prior = { marker: 'prior' }, physical = { marker: 'physical' };
  const state = { physicalWeather: physical }, effects = [];
  let cache = prior;
  const runtime = createEnvironmentRefreshRuntime({
    state, collections: {}, activeFeedRuntime: {}, jsonPath: 'unused',
    resolveActiveLocation: async () => fallback, fetchWeatherForecast: async () => forecast,
    classifyWeatherCode: () => { throw new Error('Fixture projection failure'); },
    setWeatherData: value => { cache = value; effects.push('cache'); }, broadcastStateSync: () => effects.push('broadcast'),
    log: { log() {}, error() {} }
  });
  assert.equal(await runtime.updateServerWeather(), null);
  assert.equal(state.physicalWeather, physical); assert.equal(cache, prior); assert.deepEqual(effects, []);
});
