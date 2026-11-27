// Offline composition/resource-boundary regressions. The primary fixture is
// closed; badge composition below adds only task-owned files/loopback listeners.
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
function appFixture(mode, { historyEnabled = false, failAt = {}, realTransport = false, port, collectionWriter, weatherService = {}, environmentRefreshFactory, initialState, snapshotLoader, environmentSettings, environmentRead, historyStore } = {}) {
  const captured = {}, timers = [], intervals = [], effects = [], calls = [], imports = [], history = [];
  const hit = name => { calls.push(name); failAt[name]?.(); };
  const state = initialState ?? {};
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
    './services/photoComments.js': { createPhotoCommentStore: capture('comments', { read: () => ({ key: 'url:fixture', comment: '' }), write: (_photo, comment) => ({ key: 'url:fixture', comment }) }) },
    './services/notifier.js': { sendEmailAlert: () => hit('email') }, './config/state.js': { screensaverState: state, buildFeedConfigsFromKeywords: () => ({}) },
    './config/collections.js': { defaultCuratedCollections: collections, saveCuratedCollections: collectionWriter ?? ((...args) => effects.push(['persist', ...args])) },
    './config/collectionsCodec.js': { loadCollectionsSnapshot: snapshotLoader ?? (() => ({ collections, persistedState: { visionConfig: { apiUrl: 'https://vision.example.test' } } })) },
    './config/activeCategories.js': { loadActiveCategories: () => ['A'], createActiveCategoryDispatcher: ({ dispatchCommand }) => dispatchCommand },
    './domain/dispatch.js': { createDomainDispatcher: capture('domain', dispatcher) },
    './domain/poolRetention.js': { applyPoolPolicy: () => values => values },
    './domain/selectors.js': { getPhotoByUrl: require('./domain/selectors.js').getPhotoByUrl, buildBalancedFeed: ({ collections: values }) => values.A },
    './domain/snapshot.js': { syncLegacySnapshot: (...args) => effects.push(['snapshot', ...args]) },
    './runtime/activeFeed.js': { createActiveFeedRuntime: () => activeFeed },
    './runtime/poolSchedule.js': { createPoolScheduleRuntime: () => ({ start: () => hit('pool.start'), stop: () => hit('pool.stop') }) },
    './runtime/environmentRefresh.js': { createEnvironmentRefreshRuntime: options => {
      captured.daily = options;
      return environmentRefreshFactory ? environmentRefreshFactory(options)
        : { updateFeedsDaily: async () => {}, updateServerWeather: noop, updateNewsSentiment: noop };
    } },
    './runtime/idleDaemon.js': { createIdleDaemonRuntime: () => ({ notifyActivity: noop, start: () => hit('idle.start'), stop: () => hit('idle.stop') }) },
    './runtime/kioskControl.js': { createKioskControlRuntime: () => ({ getRuntimeContext: () => ({}), killKioskBrowser: () => hit('kiosk.stop') }) },
    './services/system.js': {}, './services/weather.js': weatherService, './services/googlePhotos.js': { getCachedMediaItems: () => [] },
    './services/sentiment.js': {}, './services/ecowitt.js': { createEcowittRuntime: capture('ecowitt', {}) }, './services/sensorHistory.js': { ...require('./services/sensorHistory.js'), createSensorHistoryStore: options => { hit('history.open'); history.push(options); return historyStore ?? { close: () => hit('history.close'), record: () => hit('history.record') }; } },
    './config/localSettings.js': {}, './services/sensorPlatform.js': { createSensorPlatform: () => ({ read: async () => environmentRead?.(), start: () => hit('sensor.start'), stop: () => hit('sensor.stop') }) },
    './domain/environmentSettings.js': { normalizeEnvironmentSettings: () => environmentSettings ?? ({}), toRuntimeSettings: () => ({}) },
    './services/crawler.js': {}, './utils/fn.js': require('./utils/fn.js'),
    './services/vision.js': { analyzeImageContent: async (...args) => { effects.push(['analyze', ...args]); return tags; } },
    './routes.js': capture('routes'), './sockets.js': capture('sockets')
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
  h.captured.domain.persistPoolPolicy(app.curatedCollections, h.state);
  h.captured.domain.persistEnvVars(entries);
  assert.deepEqual(h.effects, [['persist', app.curatedCollections, h.state], ['persist', app.curatedCollections, h.state, { throwOnError: true }], ['persist-env', entries]]);
});


test('composition binds private comments to the existing file and known-photo effect only', () => {
  const h = appFixture('test');
  h.exports.createApplication();
  assert.equal(h.captured.comments.jsonPath, path.join(__dirname, '../curated_collections.json'));
  assert.deepEqual(h.captured.domain.savePhotoComment({ url: 'photo-0', comment: 'Note' }), { key: 'url:fixture', comment: 'Note' });
  assert.throws(() => h.captured.domain.savePhotoComment({ url: 'unknown', comment: 'Note' }), /identity no longer available/);
  assert.deepEqual(h.captured.routes.readPhotoComment({ url: 'photo-0' }), { key: 'url:fixture', comment: '' });
  assert.deepEqual(h.effects, []);
});

// Reuse real composition adapters, command decoder/reducer and route registration.
// Only the codec sink is injected; no filesystem, provider or listener is opened.
test('strict policy failure/retry is narrow; unchanged patch/rating retain best-effort compatibility', async () => {
  const { createRequire } = require('node:module');
  let unavailable = true, durable = null, writes = 0;
  const writerFile = path.join(__dirname, 'config/collections.js');
  const writerRequire = createRequire(writerFile), writerModule = { exports: {} };
  compileFunction(fs.readFileSync(writerFile, 'utf8'), ['module', 'require', 'process', '__dirname', 'console'], { filename: writerFile })(
    writerModule, name => name === './collectionsCodec.js' ? { saveCollectionsSnapshot: ({ state }) => {
      writes += 1;
      if (unavailable) throw new Error('Fixture disk unavailable');
      durable = structuredClone(state);
    } } : writerRequire(name), { env: { NODE_ENV: 'isolated-fixture' } }, path.dirname(writerFile), quiet
  );
  // Bind the exact production adapters to the real writer and closed codec sink.
  const h = appFixture('test', { collectionWriter: writerModule.exports.saveCuratedCollections });
  const app = h.exports.createApplication();
  Object.assign(h.state, { currentCategory: 'A', photosList: app.curatedCollections.A,
    activePhoto: app.curatedCollections.A[0], widgets: { showWeather: true },
    searchKeywords: { A: ['forest'] }, feedConfigs: {}, poolPolicies: {}, excludedKeywords: [] });
  const dispatcher = require('./domain/dispatch.js').createDomainDispatcher({
    ...h.captured.domain,
    refreshActiveFeed() {}
  });
  const routeFile = path.join(__dirname, 'routes.js'), nativeRequire = createRequire(routeFile), routeModule = { exports: {} };
  compileFunction(fs.readFileSync(routeFile, 'utf8'), ['module', 'require'], { filename: routeFile })(
    routeModule, name => name === './services/googlePhotos.js' ? { getCachedMediaItems: () => [] }
      : name === './services/weather.js' ? {} : nativeRequire(name)
  );
  const routes = new Map();
  const fakeApp = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, (url, handler) => routes.set(method + url, handler)]));
  routeModule.exports({ ...h.captured.routes, app: fakeApp, state: h.state, collections: app.curatedCollections,
    dispatchCommand: dispatcher.dispatchCommand, broadcastStateSync: dispatcher.broadcastStateSync });
  const invoke = async (url, body, params = {}) => {
    const result = { status: 200 };
    const res = { status(code) { result.status = code; return res; }, json(value) { result.body = value; return res; } };
    await routes.get('patch' + url)({ body, params }, res);
    return result;
  };
  assert.equal((await invoke('/api/state', { widgets: { showWeather: false } })).status, 200);
  assert.equal(writes, 1); assert.equal(h.state.widgets.showWeather, false); assert.equal(durable, null);
  unavailable = false;
  assert.equal((await invoke('/api/state', { widgets: { showWeather: false } })).status, 200);
  assert.equal(writes, 1, 'no-op patch keeps legacy behavior, not a new durability guarantee');
  unavailable = true;
  const rating = { type: 'rate-photo', payload: { url: 'photo-0', rating: 4 } };
  await dispatcher.dispatchCommand(rating);
  assert.equal(writes, 2);
  unavailable = false;
  assert.deepEqual((await dispatcher.dispatchCommand(rating)).reducerResult.effects, []);
  assert.equal(writes, 2, 'unchanged rating does not gain strict retry behavior');
  unavailable = true;
  const policy = { policy: { maxPhotos: 500 } };
  const failed = await invoke('/api/pools/:name', policy, { name: 'A' });
  assert.equal(failed.status, 500); assert.match(failed.body.error, /Fixture disk unavailable/);
  assert.equal(h.state.poolPolicies.A.maxPhotos, 500); assert.equal(writes, 3); assert.equal(durable, null);
  unavailable = false;
  const retried = await invoke('/api/pools/:name', policy, { name: 'A' });
  assert.equal(retried.status, 200, JSON.stringify(retried.body));
  assert.equal(writes, 4); assert.equal(durable.poolPolicies.A.maxPhotos, 500);
});

test('actual socket registration contains ignored listener promises; old boundary exits Node', () => {
  const { spawnSync } = require('node:child_process');
  const script = String.raw`
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const path = require('node:path');
    const { compileFunction } = require('node:vm');
    const { createRequire } = require('node:module');
    const filename = path.resolve('server/sockets.js'), nativeRequire = createRequire(filename);
    const commands = nativeRequire('./domain/commands.js');
    const policySpec = commands.SOCKET_COMMAND_LISTENER_SPECS.find(spec => spec.event === 'update-pool-policy');
    assert.ok(policySpec);
    const failure = new Error('Fixture socket failure'), logs = [], emitted = [], listeners = new Map();
    const mode = process.argv[1], negative = process.argv[2] === 'old';
    const spec = { ...policySpec,
      ...(mode === 'decode' ? { decode: () => { throw failure; } } : {}),
      ...(mode === 'callback' ? { afterDispatch: () => { throw failure; }, onError: () => { throw failure; } } : {})
    };
    let source = fs.readFileSync(filename, 'utf8');
    if (negative) source = source.replace(/socket.on\(event, \(payload\) => Promise.resolve\(\)[\s\S]*?\.catch\(buildSocketErrorLogger\(event\)\)\);/, 'socket.on(event, handler);');
    const moduleFixture = { exports: {} };
    compileFunction(source, ['module', 'require', 'console'], { filename })(moduleFixture, name =>
      name === './domain/commands.js' ? { ...commands, SOCKET_COMMAND_LISTENER_SPECS: [spec] }
      : ['./services/notifier.js', './services/googlePhotos.js', './services/system.js', './socketLegacyCompatibility.js'].includes(name)
        ? {} : nativeRequire(name),
      { log() {}, error: (...args) => logs.push(args) });
    moduleFixture.exports({
      io: { on: (_event, connected) => connected({ id: 'fixture', on: (event, handler) => listeners.set(event, handler), emit: (...args) => emitted.push(args) }) },
      state: {}, collections: {}, getLocalIpAddresses: () => [], port: 0,
      dispatchCommand: () => mode === 'null' ? Promise.reject(null) : mode === 'dispatch' ? Promise.reject(failure) : Promise.resolve({})
    });
    // Deliberately ignore the promise, just like Socket.IO/EventEmitter.
    listeners.get('update-pool-policy')({ name: 'A', policy: { maxPhotos: 500 } });
    setTimeout(() => {
      assert.equal(logs.length, 1);
      assert.match(logs[0][0], /update-pool-policy/);
      assert.equal(logs[0][1], mode === 'null' ? 'null' : failure.message);
      assert.equal(emitted.some(([event]) => event === 'state-sync'), true, 'initial sync only');
      assert.equal(emitted.length, 2, 'no success emitted after failure');
      process.stdout.write('survived');
    }, 25);
  `;
  for (const mode of ['dispatch', 'null', 'decode', 'callback']) {
    const result = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', script, mode, 'new'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'survived');
  }
  const negative = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', script, 'dispatch', 'old'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.equal(negative.status, 1); assert.match(negative.stderr, /Fixture socket failure/);
  assert.equal(negative.stdout, '', 'old registration demonstrably fails the survival oracle');
});

test('actual weather composition retains periodic cache, cold HTTP fails/retries, and location edits discard obsolete work', async t => {
  const { createRequire } = require('node:module');
  const { createEnvironmentRefreshRuntime } = require('./runtime/environmentRefresh.js');
  const locationA = { lat: 12, lon: 34, city: 'Fixture A', regionName: 'Region', country: 'Country' };
  const locationB = { ...locationA, lat: 13, city: 'Fixture B' };
  const forecast = { current: { temperature_2m: 22.4, weather_code: 61 }, daily: { weather_code: [61] } };
  let respond = async () => ({ ok: true, json: async () => forecast });
  const weatherService = loadIsolated(path.join(__dirname, 'services/weather.js'),
    { '../config/configLoader.js': { location: locationA } },
    { fetch: (...args) => respond(...args), AbortController, setTimeout, clearTimeout, console: quiet });
  const h = appFixture('test', { weatherService, environmentRefreshFactory: createEnvironmentRefreshRuntime });
  const app = h.exports.createApplication();
  Object.assign(h.state, { autoLocation: false, manualLocation: locationA });
  await app.updateServerWeather();
  const prior = h.captured.routes.getWeatherData(), physical = h.state.physicalWeather;
  const broadcasts = () => h.effects.filter(([kind, event]) => kind === 'emit' && event === 'state-sync').length;
  const count = broadcasts();
  respond = async () => { throw null; };
  assert.equal(await app.updateServerWeather(), null);
  assert.equal(h.captured.routes.getWeatherData(), prior);
  assert.equal(h.state.physicalWeather, physical);
  assert.equal(broadcasts(), count);

  // Actual registered route on a private loopback Express fixture, no production listener.
  const file = path.join(__dirname, 'routes.js'), nativeRequire = createRequire(file), moduleFixture = { exports: {} };
  compileFunction(fs.readFileSync(file, 'utf8'), ['module', 'require', 'console'], { filename: file })(
    moduleFixture, name => name === './services/weather.js' ? weatherService
      : name === './services/googlePhotos.js' ? { getCachedMediaItems: () => [] } : nativeRequire(name), quiet);
  const express = require('express'), http = require('node:http'), routeApp = express();
  moduleFixture.exports({ ...h.captured.routes, app: routeApp });
  const server = http.createServer(routeApp);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { const closed = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await closed; });
  const request = () => fetch('http://127.0.0.1:' + server.address().port + '/api/weather');
  // A populated cache never fetches, even during provider outage.
  assert.deepEqual(await (await request()).json(), prior);
  h.captured.routes.setWeatherData(null);
  const failed = await request();
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).error, 'Failed to fetch weather data');
  assert.equal(h.captured.routes.getWeatherData(), null);
  let releaseBody, bodyEntered, requestSignal;
  const bodyStarted = new Promise(resolve => { bodyEntered = resolve; });
  const stalledBody = new Promise(resolve => { releaseBody = resolve; });
  respond = async (_url, { signal }) => {
    requestSignal = signal;
    return { ok: true, json: () => { bodyEntered(); return stalledBody; } };
  };
  const stalledHttp = request(); await bodyStarted;
  const began = Date.now();
  const timedOut = await stalledHttp;
  assert.equal(timedOut.status, 500);
  assert.match((await timedOut.json()).message, /forecast deadline exceeded/);
  assert.ok(Date.now() - began < 8000, 'cold HTTP completes within finite forecast budget plus scheduling allowance');
  assert.equal(requestSignal.aborted, true);
  assert.equal(h.captured.routes.getWeatherData(), null);
  releaseBody(forecast); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.captured.routes.getWeatherData(), null, 'late body cannot poison cache');
  for (const invalid of [
    { ok: false, status: 503 },
    { ok: true, json: async () => { throw new SyntaxError('Fixture invalid JSON'); } },
    { ok: true, json: async () => ({ current: { temperature_2m: null, weather_code: 61 } }) }
  ]) {
    respond = async () => invalid;
    assert.equal((await request()).status, 500);
    assert.equal(h.captured.routes.getWeatherData(), null);
    assert.equal(h.state.physicalWeather, physical);
    assert.equal(broadcasts(), count);
  }
  respond = async () => ({ ok: true, json: async () => forecast });
  assert.equal((await request()).status, 200);
  assert.equal(h.captured.routes.getWeatherData().location.city, locationA.city);

  // Hold an old periodic refresh, invalidate through the actual location trigger,
  // and recover B before releasing A. A must not overwrite B or broadcast success.
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  respond = async () => { entered(); await held; return { ok: true, json: async () => forecast }; };
  const old = app.updateServerWeather(); await started;
  h.state.manualLocation = locationB;
  respond = async () => { throw new Error('Fixture unavailable'); };
  await h.captured.domain.triggerWeatherUpdate();
  assert.equal(h.captured.routes.getWeatherData(), null, 'location edits invalidate old cache even if refresh fails');
  respond = async () => ({ ok: true, json: async () => forecast });
  await app.updateServerWeather();
  const fresh = h.captured.routes.getWeatherData(), beforeLate = broadcasts();
  release(); assert.equal(await old, null);
  assert.equal(h.captured.routes.getWeatherData(), fresh);
  assert.equal(fresh.location.city, locationB.city);
  assert.equal(broadcasts(), beforeLate);

  // The cold route has the same stale-selection boundary as periodic refresh.
  h.captured.routes.setWeatherData(null);
  h.state.manualLocation = locationA;
  let routeEntered, routeRelease;
  const routeStarted = new Promise(resolve => { routeEntered = resolve; });
  const routeHeld = new Promise(resolve => { routeRelease = resolve; });
  respond = async () => { routeEntered(); await routeHeld; return { ok: true, json: async () => forecast }; };
  const oldHttp = request(); await routeStarted;
  h.state.manualLocation = locationB;
  respond = async () => ({ ok: true, json: async () => forecast });
  await h.captured.domain.triggerWeatherUpdate();
  const latest = h.captured.routes.getWeatherData();
  routeRelease();
  const obsolete = await oldHttp;
  assert.equal(obsolete.status, 500);
  assert.match((await obsolete.json()).message, /location changed/);
  assert.equal(h.captured.routes.getWeatherData(), latest);
  assert.equal(latest.location.city, locationB.city);
});

// Badge contract: actual app adapters, REST/socket registration and codec, with
// only task-owned paths. No daemon, private configuration or provider is opened.
async function withBadgeFixture(run, { raw, disabledWriter = false, oldCodec = false, oldDefault = false } = {}) {
  const os = require('node:os'), http = require('node:http');
  const { createRequire } = require('node:module');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-badge-'));
  let server;
  try {
  const jsonPath = path.join(dir, 'collections.json');
  const codecFile = path.join(__dirname, 'config/collectionsCodec.js');
  const codecModule = { exports: {} }, writerModule = { exports: {} };
  let failWrite = false, writes = 0;
  const source = fs.readFileSync(codecFile, 'utf8');
  // Disable only the badge serialization seam to reproduce the old weather-only writer.
  // No Git history/HEAD dependency: the negative control must survive candidate commits.
  const code = oldCodec ? source.replace(', qrcode: widgets.qrcode === true', '') : source;
  if (oldCodec) assert.notEqual(code, source, 'negative control must disable the writer field');
  compileFunction(code, ['module', 'require', 'process'], { filename: codecFile })(
    codecModule, createRequire(codecFile), { env: { NODE_ENV: 'isolated-fixture' } }
  );
  const codec = codecModule.exports;
  const writerFile = path.join(__dirname, 'config/collections.js');
  compileFunction(fs.readFileSync(writerFile, 'utf8'), ['module', 'require', 'process', '__dirname', 'console'], { filename: writerFile })(
    writerModule, name => name === './collectionsCodec.js' ? { saveCollectionsSnapshot: options => {
      writes += 1;
      if (failWrite) throw new Error('Fixture disk unavailable');
      if (!disabledWriter) codec.saveCollectionsSnapshot({ ...options, jsonPath });
    } } : createRequire(writerFile)(name), { env: { NODE_ENV: 'isolated-fixture' } }, path.dirname(writerFile), quiet
  );
  const defaultState = () => {
    const defaults = loadIsolated(path.join(__dirname, 'config/state.js'), {
      './configLoader.js': { location: {} }, '../utils/keywordSpecs.js': require('./utils/keywordSpecs.js')
    }).screensaverState;
    if (oldDefault) defaults.widgets.qrcode = true;
    return defaults;
  };
  const reconstruct = () => {
    const h = appFixture('test', { initialState: defaultState(), collectionWriter: writerModule.exports.saveCuratedCollections,
      snapshotLoader: options => codec.loadCollectionsSnapshot({ ...options, jsonPath }) });
    h.exports.createApplication();
    return h;
  };
  if (raw !== undefined) fs.writeFileSync(jsonPath, JSON.stringify(raw));
  const h = reconstruct();
  const dispatcher = require('./domain/dispatch.js').createDomainDispatcher(h.captured.domain);
  const express = require('express'), app = express(); app.use(express.json());
  const routesFile = path.join(__dirname, 'routes.js'), routes = { exports: {} };
  compileFunction(fs.readFileSync(routesFile, 'utf8'), ['module', 'require'], { filename: routesFile })(routes,
    name => name === './services/googlePhotos.js' ? { getCachedMediaItems: () => [] }
      : name === './services/weather.js' ? {} : createRequire(routesFile)(name));
  routes.exports({ ...h.captured.routes, app, dispatchCommand: dispatcher.dispatchCommand, broadcastStateSync: dispatcher.broadcastStateSync });
  const socketsFile = path.join(__dirname, 'sockets.js'), sockets = { exports: {} };
  compileFunction(fs.readFileSync(socketsFile, 'utf8'), ['module', 'require', 'console'], { filename: socketsFile })(sockets,
    name => ['./services/googlePhotos.js', './services/notifier.js', './services/system.js'].includes(name) ? {} : createRequire(socketsFile)(name), quiet);
  let connection;
  const listeners = new Map(), socketEvents = [];
  sockets.exports({ ...h.captured.sockets, io: { on: (_event, callback) => { connection = callback; }, emit() {} },
    dispatchCommand: dispatcher.dispatchCommand, broadcastStateSync: dispatcher.broadcastStateSync });
  connection({ id: 'badge-fixture', on: (event, listener) => listeners.set(event, listener), emit: (...args) => socketEvents.push(args) });
  server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const patch = async body => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/state`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      return { status: response.status, body: await response.json() };
    };
    await run({ h, patch, reconstruct, jsonPath, listeners, socketEvents, defaultState, dir,
      disk: () => JSON.parse(fs.readFileSync(jsonPath, 'utf8')), writes: () => writes,
      fail: value => { failWrite = value; } });
  } finally {
    try {
      server?.closeAllConnections();
      if (server?.listening) await new Promise(resolve => server.close(resolve));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

for (const value of [undefined, false, true]) {
  test(`badge cold startup and fresh reconstruction preserve ${String(value)}`, () => withBadgeFixture(async f => {
    assert.equal(f.defaultState().widgets.qrcode, false);
    assert.equal(f.h.state.widgets.qrcode, value === true);
    assert.equal(f.reconstruct().state.widgets.qrcode, value === true);
  }, value === undefined ? {} : { raw: { widgets: { qrcode: value, weatherLocation: false, clock: false } } }));
}

const badgeRoundtrip = async f => {
  for (const desired of [true, false]) {
    assert.equal((await f.patch({ widgets: { qrcode: !desired } })).status, 200);
    assert.equal(f.disk().widgets.qrcode, !desired, 'different intermediate durable value');
    const result = await f.patch({ widgets: { qrcode: desired } });
    assert.equal(result.status, 200); assert.equal(result.body.widgets.qrcode, desired);
    assert.equal(f.disk().widgets.qrcode, desired, 'acknowledgement requires disk');
    assert.equal(f.reconstruct().state.widgets.qrcode, desired);
    // Same release path: source/package is replaced while this existing data file
    // is retained. A separate Node process must reconstruct from that latest file.
    const script = 'const c=require(\'./server/config/collectionsCodec.js\');console.log(JSON.stringify(c.loadCollectionsSnapshot({jsonPath:process.argv[1],defaultCollections:{},defaultState:{widgets:{qrcode:false}},buildFeedConfigsFromKeywords:()=>({})}).persistedState.widgets.qrcode));';
    const restored = require('node:child_process').execFileSync(process.execPath, ['-e', script, f.jsonPath], { encoding: 'utf8' });
    assert.equal(JSON.parse(restored), desired);
    assert.equal((await f.patch({ widgets: { clock: false } })).status, 200);
    assert.equal(f.disk().widgets.qrcode, desired, 'unrelated setting save preserves badge');
  }
};
test('badge REST saves acknowledge durable booleans across restart and release-style reconstruction', () => withBadgeFixture(badgeRoundtrip));
test('badge disabled-writer control fails the durable roundtrip oracle', () =>
  assert.rejects(withBadgeFixture(badgeRoundtrip, { disabledWriter: true }), assert.AssertionError));
test('badge legacy codec control fails the same roundtrip oracle', () =>
  assert.rejects(withBadgeFixture(badgeRoundtrip, { oldCodec: true }), assert.AssertionError));

test('badge actual socket toggle sets explicit visibility, not inversion, and survives reconstruction', () => withBadgeFixture(async f => {
  for (const visible of [true, true, false, false]) {
    const before = f.writes();
    f.listeners.get('toggle-widget')({ widgetName: 'qrcode', visible });
    // Registration deliberately returns no promise; wait for its dispatched effect.
    await new Promise(setImmediate);
    assert.equal(f.writes(), before + 1);
    assert.equal(f.disk().widgets.qrcode, visible);
    assert.equal(f.reconstruct().state.widgets.qrcode, visible);
  }
}));

test('badge disk failure returns500, identical retry persists after memory already applied, unrelated no-op stays best effort', () => withBadgeFixture(async f => {
  f.fail(true);
  const oldBytes = fs.readFileSync(f.jsonPath);
  const failed = await f.patch({ widgets: { qrcode: true } });
  assert.equal(failed.status, 500); assert.equal(f.h.state.widgets.qrcode, true);
  assert.deepEqual(fs.readFileSync(f.jsonPath), oldBytes);
  f.fail(false);
  assert.equal((await f.patch({ widgets: { qrcode: true } })).status, 200);
  assert.equal(f.disk().widgets.qrcode, true); assert.equal(f.reconstruct().state.widgets.qrcode, true);
  const before = f.writes();
  assert.equal((await f.patch({ widgets: { clock: f.h.state.widgets.clock } })).status, 200);
  assert.equal(f.writes(), before);
}));

// The fresh-state oracle must detect the prior default, not only missing bytes.
test('badge old-default control fails fresh default oracle', () =>
  assert.rejects(withBadgeFixture(async f => assert.equal(f.defaultState().widgets.qrcode, false), { oldDefault: true }), assert.AssertionError));

const trendSettings = { activeDeviceId: 'room', devices: [{ id: 'room', adapterId: 'ecowitt-local-http', baseUrl: 'http://sensor.example.test' }] };
const trendService = require('./services/sensorHistory.js');
const trendEnvironment = (now = Date.now()) => ({ enabled: true, stale: false, source: 'ecowitt-gw1200',
  device: trendService.environmentDeviceKey(trendSettings), observedAt: new Date(now).toISOString(),
  indoor: { temperatureC: 22, humidityPercent: 50 }, units: { temperature: 'C' } });
const trendWeather = { location: { lat: 12, lon: 34 } };
const trendRow = env => ({ observed_at: new Date(Date.parse(env.observedAt) - 86400000).toISOString(), source: env.source,
  device: env.device, latitude: 12, longitude: 34, indoor_temperature_c: 20, indoor_humidity_percent: 55 });

test('indoor elapsed selector is bounded, comparable and finite; missing values never become zero', () => {
  const now = Date.now(), environment = trendEnvironment(now), row = trendRow(environment);
  const select = (env = environment, rows = [row], weather = trendWeather) => trendService.selectIndoorTrend({ environment: env, readings: rows, weather, now });
  assert.equal(select().temperatureC, 2); assert.equal(select().humidityPercent, -5);
  for (const patch of [{ stale: true }, { enabled: false }, { device: 'GW1200' }, { device: 4 }, { observedAt: null },
    { observedAt: new Date(now + 1).toISOString() }, { observedAt: new Date(now - 600001).toISOString() }]) assert.equal(select({ ...environment, ...patch }), null);
  for (const patch of [{ source: 'other' }, { device: 'other' }, { latitude: null }, { longitude: 35 },
    { observed_at: new Date(now - 82800000 + 1).toISOString() }, { observed_at: 'invalid' },
    { indoor_temperature_c: null, indoor_humidity_percent: null }, { indoor_temperature_c: '', indoor_humidity_percent: '50' }]) assert.equal(select(environment, [{ ...row, ...patch }]), null);
  assert.equal(select(environment, []), null); assert.equal(select(environment, [null]), null);
  assert.equal(select(environment, [row], { location: { lat: null, lon: 34 } }), null);
  assert.equal(select({ ...environment, indoor: { temperatureC: null, humidityPercent: null } }), null);
  assert.equal(select({ ...environment, indoor: { temperatureC: Number.MAX_VALUE, humidityPercent: null } }, [{ ...row, indoor_temperature_c: -Number.MAX_VALUE }]), null);
  const boundary = { ...row, observed_at: new Date(now - 90000000).toISOString() };
  assert.equal(select(environment, [boundary]).temperatureC, 2);
  assert.equal(select(environment, [boundary, row]).referenceAt, row.observed_at);
  const missing = trendService.normalizeSensorSnapshot({ environment: { ...environment, indoor: { temperatureC: null, humidityPercent: false } } });
  assert.equal(missing.indoorTemperatureC, null); assert.equal(missing.indoorHumidityPercent, null);
  const key = trendService.environmentDeviceKey(trendSettings); assert(!key.includes('sensor.example'));
  assert.notEqual(key, trendService.environmentDeviceKey({ ...trendSettings, devices: [{ ...trendSettings.devices[0], baseUrl: 'http://different.example.test' }] }));
  assert.notEqual(key, trendService.environmentDeviceKey({ activeDeviceId: 'other', devices: [{ ...trendSettings.devices[0], id: 'other' }] }));
});

test('actual environment route + app + SQLite history produces comparisons, silence on failure and recovery without a new resource', async () => {
  const { createRequire } = require('node:module');
  const store = trendService.createSensorHistoryStore();
  let current = trendEnvironment(), fail = false, changeDuringRead = null;
  const settings = structuredClone(trendSettings);
  const historical = { ...current, observedAt: new Date(Date.parse(current.observedAt) - 86400000).toISOString(), indoor: { temperatureC: 20, humidityPercent: 55 } };
  store.record({ environment: historical, weather: trendWeather });
  const h = appFixture('production', { historyEnabled: true, environmentSettings: settings, environmentRead: async () => { changeDuringRead?.(); return current; },
    historyStore: { ...store, history: query => { if (fail) throw new Error('Fixture history unavailable'); return store.history(query); } } });
  const application = h.exports.createApplication(); application.startServer();
  h.captured.routes.setWeatherData(trendWeather);
  const routeFile = path.join(__dirname, 'routes.js'), routes = { exports: {} }, requireRoute = createRequire(routeFile);
  compileFunction(fs.readFileSync(routeFile, 'utf8'), ['module', 'require'], { filename: routeFile })(routes,
    name => name === './services/googlePhotos.js' ? { getCachedMediaItems: () => [] } : name === './services/weather.js' ? {} : requireRoute(name));
  const app = require('express')(); routes.exports({ ...h.captured.routes, app });
  const server = require('node:http').createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const get = async () => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/environment`);
      assert.equal(response.status, 200); return response.json();
    };
    const firstTrendResponse = await get();
    assert.equal(firstTrendResponse.trend?.temperatureC, 2, JSON.stringify(firstTrendResponse));
    fail = true; assert.equal((await get()).trend, null);
    fail = false; assert.equal((await get()).trend.humidityPercent, -5);
    current = { ...current, stale: true }; assert.equal((await get()).trend, null);
    current = trendEnvironment(); h.captured.routes.setWeatherData({ location: { lat: 13, lon: 34 } });
    assert.equal((await get()).trend, null);
    h.captured.routes.setWeatherData(trendWeather);
    h.captured.ecowitt.onReading(current);
    assert.equal(store.history({ limit: 1 })[0].device, current.device, 'actual recording stores comparison identity');
    assert.equal((await get()).trend.temperatureC, 2);
    const changedSettings = { ...settings, devices: [{ ...settings.devices[0], baseUrl: 'http://other.example.test' }] };
    store.record({ environment: { ...historical, device: trendService.environmentDeviceKey(changedSettings) }, weather: trendWeather });
    changeDuringRead = () => { settings.devices[0].baseUrl = changedSettings.devices[0].baseUrl; };
    const relabelled = await get();
    assert.equal(relabelled.device, null); assert.equal(relabelled.trend, null, 'in-flight old reading cannot compare as new device');
    // Guard-disabled source identity would turn the wrong-device row into a comparison.
    const wrong = { ...trendRow(current), device: 'another-device' };
    assert.equal(trendService.selectIndoorTrend({ environment: current, weather: trendWeather, readings: [wrong], now: Date.now() }), null);
    assert.equal(trendService.selectIndoorTrend({ environment: current, weather: trendWeather, readings: [{ ...wrong, device: current.device }], now: Date.now() }).temperatureC, 2);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await application.stopServer();
  }
});

test('disabled identity/freshness/numeric guards fail the same silent-trend oracle', () => {
  const { createRequire } = require('node:module'), filename = path.join(__dirname, 'services/sensorHistory.js');
  const source = fs.readFileSync(filename, 'utf8'), now = Date.now(), current = trendEnvironment(now);
  const probes = [
    ['row.device === environment.device', 'true', current, { ...trendRow(current), device: 'other' }],
    ['now - current <= TREND_FRESH_MS', 'true', trendEnvironment(now - 600001), trendRow(trendEnvironment(now - 600001))],
    ["typeof value === 'number' && Number.isFinite(value)", 'Number.isFinite(Number(value))', { ...current, indoor: { temperatureC: null, humidityPercent: null } }, trendRow(current)]
  ];
  for (const [guard, disabled, environment, row] of probes) {
    const candidate = trendService.selectIndoorTrend({ environment, readings: [row], weather: trendWeather, now });
    assert.equal(candidate, null);
    const code = source.replace(guard, disabled); assert.notEqual(code, source);
    const module = { exports: {} };
    compileFunction(code, ['module', 'require'], { filename })(module, createRequire(filename));
    assert.notEqual(module.exports.selectIndoorTrend({ environment, readings: [row], weather: trendWeather, now }), null);
  }
});
