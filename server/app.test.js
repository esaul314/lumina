// Offline composition/resource-boundary regressions. No private config, files,
// providers, native listeners or real timers are used by this closed fixture.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileFunction } = require('node:vm');
const tags = Object.freeze({ isNight: false, isRain: true, isSunny: false, isCloudy: true, isSnowy: false });
const photos = count => Array.from({ length: count }, (_, i) => ({ url: `photo-${i}`, title: `Title ${i}` }));
const quiet = { log() {}, warn() {}, error() {} };

function loadIsolated(filename, dependencies, globals = {}, onImport = () => {}, asMain = false) {
  const module = { exports: {} };
  const requireFixture = request => {
    onImport(request);
    assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`);
    return dependencies[request];
  };
  requireFixture.main = asMain ? module : undefined;
  compileFunction(fs.readFileSync(filename, 'utf8'), ['module', 'require', ...Object.keys(globals)], { filename })(
    module, requireFixture, ...Object.values(globals)
  );
  return module.exports;
}
// App is executed with closed fixture imports, fake timers and the actual vision
// job module. No private config load, history DB, provider or service is touched.
function appFixture(mode, { historyEnabled = false, failAt = {}, realTransport = false, port } = {}) {
  const captured = {}, timers = [], intervals = [], effects = [], calls = [], imports = [], history = [];
  const hit = name => { calls.push(name); failAt[name]?.(); };
  const state = {};
  const collections = { A: photos(1) };
  const processFixture = { env: { NODE_ENV: mode } };
  const vision = loadIsolated(path.join(__dirname, 'jobs/visionAnalysis.js'), {
    './jobService.js': require('./jobs/jobService.js'), '../utils/asyncReduce.js': require('./utils/asyncReduce.js')
  }, { process: processFixture, console: quiet });
  const capture = (name, result) => options => { captured[name] = options; return result; };
  const noop = () => {};
  const app = { use: noop };
  let io = { emit: (...args) => effects.push(['emit', ...args]), close: async () => hit('io.close') };
  const server = realTransport
    ? require('node:http').createServer((_request, response) => response.end('fixture'))
    : Object.assign(new (require('node:events').EventEmitter)(), { listening: false });
  const nativeListen = realTransport ? server.listen.bind(server) : null;
  const nativeClose = realTransport ? server.close.bind(server) : null;
  const nativeCloseConnections = realTransport ? server.closeAllConnections.bind(server) : null;
  server.listen = (...args) => {
    hit('listen');
    if (realTransport) return nativeListen(args[0], '127.0.0.1', args.at(-1));
    server.listening = true;
    if (typeof args.at(-1) === 'function') args.at(-1)();
    return server;
  };
  server.close = callback => {
    hit('http.close');
    if (realTransport) return nativeClose(callback);
    server.listening = false; callback?.(); return server;
  };
  server.closeAllConnections = () => { hit('http.connections.close'); nativeCloseConnections?.(); };
  const dispatcher = { dispatchCommand: noop, broadcastStateSync: noop, refreshSnapshot: noop };
  const activeFeed = { getActiveCategories: () => ['A'], refreshActiveFeedIfIncluded: categories => effects.push(['refresh', categories]) };
  const fakeJob = { getLatestJob: () => null };
  const dependencies = {
    express: Object.assign(() => app, { json: noop, static: noop }), http: { createServer: () => server },
    'socket.io': { Server: function (_server, options) { if (realTransport) io = new (require('socket.io').Server)(server, options); return io; } }, cors: noop, path, os: { networkInterfaces: () => ({}) },
    './config/configLoader.js': { port: port ?? (realTransport ? 0 : undefined), sensorHistory: { enabled: historyEnabled } }, './config/env.js': { readEnvVar: () => '', persistEnvVars: entries => effects.push(['persist-env', entries]) },
    './jobs/recrawl.js': { createRecrawlJobService: capture('recrawl', fakeJob), executeRecrawlPass: capture('recrawlPass', Promise.resolve()) },
    './jobs/visionAnalysis.js': {
      createImageAnalysisRunner: options => { captured.runnerOptions = options; captured.runner = vision.createImageAnalysisRunner(options); return captured.runner; },
      createVisionAnalysisJobService: capture('manual', fakeJob)
    },
    './services/notifier.js': { sendEmailAlert: () => hit('email') }, './config/state.js': { screensaverState: state },
    './config/collections.js': { saveCuratedCollections: (...args) => effects.push(['persist', ...args]) },
    './config/collectionsCodec.js': { loadCollectionsSnapshot: () => ({ collections, persistedState: { visionConfig: { apiUrl: 'https://vision.example.test' } } }) },
    './config/activeCategories.js': { loadActiveCategories: () => ['A'], createActiveCategoryDispatcher: ({ dispatchCommand }) => dispatchCommand },
    './domain/dispatch.js': { createDomainDispatcher: capture('domain', dispatcher) },
    './domain/poolRetention.js': { applyPoolPolicy: () => values => values },
    './domain/selectors.js': { buildBalancedFeed: ({ collections: values }) => values.A },
    './domain/snapshot.js': { syncLegacySnapshot: (...args) => effects.push(['snapshot', ...args]) },
    './runtime/activeFeed.js': { createActiveFeedRuntime: () => activeFeed },
    './runtime/poolSchedule.js': { createPoolScheduleRuntime: () => ({ start: () => hit('pool.start'), stop: () => hit('pool.stop') }) },
    './runtime/environmentRefresh.js': { createEnvironmentRefreshRuntime: capture('daily', { updateFeedsDaily: async () => {}, updateServerWeather: noop, updateNewsSentiment: noop }) },
    './runtime/idleDaemon.js': { createIdleDaemonRuntime: () => ({ notifyActivity: noop, start: () => hit('idle.start'), stop: () => hit('idle.stop') }) },
    './runtime/kioskControl.js': { createKioskControlRuntime: () => ({ getRuntimeContext: () => ({}), killKioskBrowser: () => hit('kiosk.stop') }) },
    './services/system.js': {}, './services/weather.js': {}, './services/googlePhotos.js': { getCachedMediaItems: () => [] },
    './services/sentiment.js': {}, './services/ecowitt.js': { createEcowittRuntime: capture('ecowitt', {}) }, './services/sensorHistory.js': { createSensorHistoryStore: options => { hit('history.open'); history.push(options); return { close: () => hit('history.close'), record: () => hit('history.record') }; } },
    './config/localSettings.js': {}, './services/sensorPlatform.js': { createSensorPlatform: () => ({ start: () => hit('sensor.start'), stop: () => hit('sensor.stop') }) },
    './domain/environmentSettings.js': { normalizeEnvironmentSettings: () => ({}), toRuntimeSettings: () => ({}) },
    './services/crawler.js': {}, './utils/fn.js': require('./utils/fn.js'),
    './services/vision.js': { analyzeImageContent: async (...args) => { effects.push(['analyze', ...args]); return tags; } },
    './routes.js': noop, './sockets.js': capture('sockets')
  };
  const exports = loadIsolated(path.join(__dirname, 'app.js'), dependencies, {
    process: processFixture, console: quiet, __dirname,
    setTimeout: (fn, delay) => { const handle = { fn, delay }; timers.push(handle); return handle; },
    setInterval: (fn, delay) => { const handle = { fn, delay }; intervals.push(handle); return handle; },
    clearTimeout: handle => { hit('timeout.clear'); handle.cleared = true; },
    clearInterval: handle => { hit('interval.clear'); handle.cleared = true; }
  }, request => imports.push(request));
  return { exports, captured, timers, intervals, effects, state, calls, imports, history };
}

test('app binds and exports the same runner for daily, recrawl, manual and legacy callbacks and reads config live', async () => {
  const { exports, captured, timers, effects, state } = appFixture('test');
  const trigger = exports.triggerImageAnalysisBackground;
  assert.equal(trigger, captured.runner);
  for (const caller of ['daily', 'recrawl', 'manual', 'sockets']) assert.equal(captured[caller].triggerImageAnalysisBackground, trigger);
  await captured.domain.runCrawler({ categories: ['A'] });
  assert.equal(captured.recrawlPass.triggerImageAnalysisBackground, trigger);
  const replacement = { apiUrl: 'https://replacement.example.test' };
  state.visionConfig = replacement;
  assert.equal(captured.runnerOptions.getVisionConfig(), replacement);
  Object.defineProperty(state, 'visionConfig', { get() { throw new Error('Test guard must precede config reads'); } });
  assert.equal(await trigger({ requireConfigured: true }), undefined);
  assert.equal(await trigger(), undefined);
  assert.deepEqual(timers, []);
  assert.deepEqual(effects, [], 'NODE_ENV=test must suppress real analysis and every downstream effect');
});

test('bootstrap10-second callback executes the bound runner with the concrete persistence/refresh/broadcast capabilities', async () => {
  const { exports, timers, effects, state } = appFixture('production');
  exports.startServer();
  const startup = timers.filter(({ delay }) => delay === 10000);
  assert.equal(startup.length, 1);
  startup[0].fn();
  await new Promise(setImmediate);
  assert.deepEqual(effects.map(([effect]) => effect), ['analyze', 'persist', 'refresh', 'snapshot', 'emit']);
  assert.equal(effects[1][1], exports.curatedCollections);
  assert.equal(effects[1][2], state, 'app preserves the original persistence state argument');
  assert.deepEqual(effects[2], ['refresh', ['A']]);
  assert.equal(effects[4][1], 'state-sync');
  assert.equal(effects[4][2], state);
});


test('bare app import and export inventory do not load any effectful dependency', () => {
  const imports = [];
  const exports = loadIsolated(path.join(__dirname, 'app.js'), {}, {}, name => imports.push(name));
  assert.equal(typeof exports.createApplication, 'function');
  assert.ok(Object.keys(exports).includes('startServer'));
  assert.ok(Object.keys(exports).includes('screensaverState'));
  assert.deepEqual(imports, []);
});

test('explicit construction defers owned history, daemon schedules and listening until start', () => {
  const h = appFixture('production', { historyEnabled: true });
  assert.deepEqual(h.imports, [], 'the legacy facade is initially lazy');
  const application = h.exports.createApplication();
  assert.ok(h.imports.includes('./services/googlePhotos.js'), 'source adapters are constructed explicitly, not advertised as pure');
  assert.equal(application.server.listening, false);
  assert.deepEqual(h.timers, []);
  assert.deepEqual(h.intervals, []);
  assert.deepEqual(h.history, []);
  assert.deepEqual(h.calls, []);
  application.startServer();
  assert.equal(h.history.length, 1);
  assert.deepEqual(h.timers.map(({ delay }) => delay), [3000, 5000, 5000, 10000]);
  assert.deepEqual(h.intervals.map(({ delay }) => delay), [900000, 1800000, 14400000]);
  assert.deepEqual(h.calls, ['history.open', 'idle.start', 'pool.start', 'sensor.start', 'listen']);
  assert.equal(application.server.listening, true);
});

test('test-mode start still creates no owned timer, history store, poller or listener', () => {
  const h = appFixture('test', { historyEnabled: true });
  const application = h.exports.createApplication();
  application.startServer();
  assert.deepEqual([h.timers, h.intervals, h.history, h.calls], [[], [], [], []]);
  assert.equal(application.server.listening, false);
});

test('legacy getters share one default application and stable function/state identities without starting it', () => {
  const h = appFixture('production', { historyEnabled: true });
  const first = h.exports.triggerImageAnalysisBackground;
  assert.equal(first, h.exports.triggerImageAnalysisBackground);
  assert.equal(first, h.captured.runner);
  assert.equal(h.exports.screensaverState, h.state);
  assert.equal(h.exports.server, h.exports.server);
  assert.equal(h.exports.startServer, h.exports.startServer);
  assert.deepEqual([h.timers, h.intervals, h.history, h.calls], [[], [], [], []]);
});

test('server entrypoint retains the startServer facade and helper re-export identities', () => {
  const h = appFixture('production');
  const facade = loadIsolated(path.join(__dirname, '../server.js'), {
    dotenv: { config() {} }, './server/app.js': h.exports
  });
  assert.equal(h.calls.filter(name => name === 'listen').length, 1);
  assert.equal(facade.tagPhotosWithKeywords, h.exports.tagPhotosWithKeywords);
  assert.equal(facade.screensaverState, h.exports.screensaverState);
  assert.equal(facade.curatedCollections, h.exports.curatedCollections);
  assert.equal(facade.updateServerWeather, h.exports.updateServerWeather);
});


test('the lazy facade retains writable and configurable CommonJS export behavior', () => {
  const h = appFixture('test');
  const replacement = () => ['replacement'];
  h.exports.tagPhotosWithKeywords = replacement;
  assert.equal(h.exports.tagPhotosWithKeywords, replacement);
  assert.equal(h.exports.screensaverState, h.state);
  assert.deepEqual(h.timers, []);
  delete h.exports.tagPhotosWithKeywords;
  assert.equal(Object.hasOwn(h.exports, 'tagPhotosWithKeywords'), false);
});

test('typed consumers retain concrete legacy callable exports rather than an any or missing-member facade', () => {
  const ts = require('typescript');
  const filename = path.resolve(__dirname, '../facade-consumer.fixture.ts');
  const source = [
    "import app = require('./server/app.js');",
    'const start: () => void = app.startServer;',
    'const factory = app.createApplication;',
    'const stop: () => Promise<void> = app.stopServer;',
    'const tag = app.tagPhotosWithKeywords;',
    '// @ts-expect-error The zero-argument start contract must not degrade to any.',
    "app.startServer('unexpected');"
  ].join('\n');
  const options = { allowJs: true, checkJs: false, strict: true, noEmit: true, skipLibCheck: true,
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10 };
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.readFile = name => path.resolve(name) === filename ? source : read(name);
  host.fileExists = name => path.resolve(name) === filename || exists(name);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).filter(error => error.file && path.resolve(error.file.fileName) === filename);
  assert.deepEqual(diagnostics.map(error => ts.flattenDiagnosticMessageText(error.messageText, ' ')), []);
});


const flush = () => new Promise(setImmediate);
const sourceEntrypoint = (h, process) => loadIsolated(path.join(__dirname, '../server.js'), {
  dotenv: { config() {} }, './server/app.js': h.exports
}, { process, console: quiet }, () => {}, true);

test('start is idempotent and concurrent stop joins unconditional owned teardown', async () => {
  const h = appFixture('production', { historyEnabled: true }), app = h.exports.createApplication();
  app.startServer(); app.startServer();
  for (const name of ['history.open', 'idle.start', 'pool.start', 'sensor.start', 'listen']) {
    assert.equal(h.calls.filter(call => call === name).length, 1, name);
  }
  assert.equal(h.timers.length, 4); assert.equal(h.intervals.length, 3);
  const one = app.stopServer(), two = app.stopServer(); assert.equal(one, two); await one;
  assert.ok([...h.timers, ...h.intervals].every(handle => handle.cleared));
  assert.equal(app.server.listening, false);
  for (const name of ['idle.stop', 'pool.stop', 'sensor.stop', 'kiosk.stop', 'history.close', 'io.close', 'http.close']) {
    assert.equal(h.calls.includes(name), true, name);
  }
  await app.stopServer();
  assert.equal(h.calls.filter(call => call === 'history.close').length, 1);
});

test('stop before start never acquires resources and disposal stays terminal without a restart controller', async () => {
  const h = appFixture('production', { historyEnabled: true }), app = h.exports.createApplication();
  await app.stopServer(); await app.stopServer();
  assert.deepEqual([h.timers, h.intervals, h.history], [[], [], []]);
  assert.throws(() => app.startServer(), /stopped.*fresh lifetime/);
  assert.equal(h.calls.includes('listen'), false);
});

for (const stage of ['idle.start', 'pool.start', 'sensor.start', 'listen']) {
  test(`partial startup failure at ${stage} still tears down every owned boundary`, async () => {
    const failure = new Error(stage), h = appFixture('production', { historyEnabled: true,
      failAt: { [stage]: () => { throw failure; } } });
    const app = h.exports.createApplication();
    assert.throws(() => app.startServer(), error => error === failure);
    await app.stopServer();
    assert.ok([...h.timers, ...h.intervals].every(handle => handle.cleared));
    assert.equal(app.server.listening, false);
    for (const name of ['idle.stop', 'pool.stop', 'sensor.stop', 'kiosk.stop', 'history.close', 'io.close', 'http.close']) {
      assert.equal(h.calls.includes(name), true, name);
    }
  });
}

test('cleanup failures cannot skip sibling teardown and remaining resources can be retried', async () => {
  const failed = new Set(), h = appFixture('production', { historyEnabled: true,
    failAt: Object.fromEntries(['interval.clear', 'sensor.stop', 'history.close'].map(name => [name, () => {
      if (!failed.has(name)) { failed.add(name); throw new Error(name); }
    }])) });
  const app = h.exports.createApplication(); app.startServer();
  await assert.rejects(app.stopServer(), error => error instanceof AggregateError && error.errors.length === 3);
  for (const name of ['io.close', 'http.close', 'kiosk.stop', 'idle.stop', 'pool.stop']) assert.equal(h.calls.includes(name), true);
  assert.equal(h.intervals.filter(handle => !handle.cleared).length, 1);
  await app.stopServer();
  assert.ok([...h.timers, ...h.intervals].every(handle => handle.cleared));
  assert.equal(h.calls.filter(name => name === 'history.close').length, 2);
});

test('queued schedules and a listen retry cannot restart a stopped application', async () => {
  const h = appFixture('production'), app = h.exports.createApplication(); app.startServer();
  const errorHandler = app.server.listeners('error')[0];
  app.server.emit('error', Object.assign(new Error('busy'), { code: 'EADDRINUSE' }));
  assert.equal(h.timers.some(({ delay }) => delay === 1000), true);
  await app.stopServer();
  const calls = [...h.calls], count = h.timers.length;
  [...h.timers, ...h.intervals].forEach(({ fn }) => fn());
  errorHandler(Object.assign(new Error('late'), { code: 'EADDRINUSE' }));
  await flush();
  assert.deepEqual(h.calls, calls);
  assert.equal(h.timers.length, count);
});

test('late sensor callbacks cannot write an already closed history resource', async () => {
  const h = appFixture('production', { historyEnabled: true }), app = h.exports.createApplication();
  app.startServer(); await app.stopServer();
  h.captured.ecowitt.onReading({ indoor: null });
  assert.equal(h.calls.includes('history.record'), false);
});

test('real loopback HTTP and Engine.IO handles close idempotently, including keepalive clients', async () => {
  const h = appFixture('production', { realTransport: true, historyEnabled: true }), app = h.exports.createApplication();
  try {
    app.startServer();
    if (!app.server.listening) await new Promise(resolve => app.server.once('listening', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    assert.equal(await (await fetch(origin, { signal: AbortSignal.timeout(1000) })).text(), 'fixture');
    const handshake = await fetch(origin + '/socket.io/?EIO=4&transport=polling', { signal: AbortSignal.timeout(1000) });
    assert.match(await handshake.text(), /^0\{/);
    await app.stopServer(); await app.stopServer();
    assert.equal(app.server.listening, false);
    await assert.rejects(fetch(origin, { signal: AbortSignal.timeout(1000) }));
  } finally { await app.stopServer(); }
});

test('real transport can be stopped immediately during listen startup without leaving a late listener', async () => {
  const h = appFixture('production', { realTransport: true }), app = h.exports.createApplication();
  try {
    app.startServer(); await app.stopServer(); await flush();
    assert.equal(app.server.listening, false);
  } finally { await app.stopServer(); }
});

test('native entrypoint owns signal shutdown, while ordinary facade imports own no process handlers', async () => {
  const h = appFixture('production'), signals = new Map(), exits = [];
  sourceEntrypoint(h, { once: (name, fn) => signals.set(name, fn), exit: code => exits.push(code) });
  assert.deepEqual([...signals.keys()], ['SIGTERM', 'SIGINT']);
  signals.get('SIGTERM')(); await flush();
  assert.deepEqual(exits, [0]);
  assert.equal(h.exports.server.listening, false);
  assert.equal(h.calls.includes('io.close'), true);
});

test('native entrypoint exits failed startup only after owned cleanup', async () => {
  const h = appFixture('production', { failAt: { listen: () => { throw new Error('listen failed'); } } }), exits = [];
  sourceEntrypoint(h, { once() {}, exit: code => exits.push([code, h.calls.includes('io.close')]) });
  await flush(); assert.deepEqual(exits, [[1, true]]);
});

test('a fatal asynchronous server error exits through the same native cleanup owner', async () => {
  const h = appFixture('production'), exits = [];
  sourceEntrypoint(h, { once() {}, exit: code => exits.push(code) });
  h.exports.server.emit('error', Object.assign(new Error('fatal'), { code: 'EACCES' }));
  await flush(); assert.deepEqual(exits, [1]); assert.equal(h.calls.includes('io.close'), true);
});

test('a real occupied loopback port uses a cancellable retry and leaves no listener after stop', async () => {
  const occupied = require('node:http').createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  const h = appFixture('production', { realTransport: true, port: occupied.address().port });
  const app = h.exports.createApplication();
  try {
    const failure = new Promise(resolve => app.server.once('error', resolve));
    app.startServer(); assert.equal((await failure).code, 'EADDRINUSE');
    const retry = h.timers.find(({ delay }) => delay === 1000); assert.ok(retry);
    await app.stopServer(); retry.fn(); await flush();
    assert.equal(retry.cleared, true); assert.equal(app.server.listening, false);
    assert.equal(h.calls.filter(name => name === 'listen').length, 1);
  } finally {
    await app.stopServer();
    await new Promise(resolve => occupied.close(resolve));
    occupied.closeAllConnections();
  }
});


test('composition supplies the real existing collection and environment writers to the dispatcher', () => {
  const h = appFixture('test'), app = h.exports.createApplication(), entries = Object.freeze({ FIXTURE_KEY: 'fixture' });
  h.captured.domain.persistCollections(app.curatedCollections, h.state);
  h.captured.domain.persistEnvVars(entries);
  assert.deepEqual(h.effects, [['persist', app.curatedCollections, h.state], ['persist-env', entries]]);
});
