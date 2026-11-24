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

function loadIsolated(filename, dependencies, globals = {}, onImport = () => {}) {
  const module = { exports: {} };
  compileFunction(fs.readFileSync(filename, 'utf8'), ['module', 'require', ...Object.keys(globals)], { filename })(
    module,
    request => {
      onImport(request);
      assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`);
      return dependencies[request];
    },
    ...Object.values(globals)
  );
  return module.exports;
}
// App is executed with closed fixture imports, fake timers and the actual vision
// job module. No private config load, history DB, provider or service is touched.
function appFixture(mode, { historyEnabled = false } = {}) {
  const captured = {}, timers = [], intervals = [], effects = [], calls = [], imports = [], history = [];
  const state = {};
  const collections = { A: photos(1) };
  const processFixture = { env: { NODE_ENV: mode } };
  const vision = loadIsolated(path.join(__dirname, 'jobs/visionAnalysis.js'), {
    './jobService.js': require('./jobs/jobService.js'), '../utils/asyncReduce.js': require('./utils/asyncReduce.js')
  }, { process: processFixture, console: quiet });
  const capture = (name, result) => options => { captured[name] = options; return result; };
  const noop = () => {};
  const app = { use: noop };
  const io = { emit: (...args) => effects.push(['emit', ...args]) };
  const server = { on: noop, listening: false, listen: (...args) => { calls.push('listen'); server.listening = true; if (typeof args.at(-1) === 'function') args.at(-1)(); } };
  const dispatcher = { dispatchCommand: noop, broadcastStateSync: noop, refreshSnapshot: noop };
  const activeFeed = { getActiveCategories: () => ['A'], refreshActiveFeedIfIncluded: categories => effects.push(['refresh', categories]) };
  const fakeJob = { getLatestJob: () => null };
  const dependencies = {
    express: Object.assign(() => app, { json: noop, static: noop }), http: { createServer: () => server },
    'socket.io': { Server: function () { return io; } }, cors: noop, path, os: { networkInterfaces: () => ({}) },
    './config/configLoader.js': { sensorHistory: { enabled: historyEnabled } }, './config/env.js': { readEnvVar: () => '' },
    './jobs/recrawl.js': { createRecrawlJobService: capture('recrawl', fakeJob), executeRecrawlPass: capture('recrawlPass', Promise.resolve()) },
    './jobs/visionAnalysis.js': {
      createImageAnalysisRunner: options => { captured.runnerOptions = options; captured.runner = vision.createImageAnalysisRunner(options); return captured.runner; },
      createVisionAnalysisJobService: capture('manual', fakeJob)
    },
    './services/notifier.js': {}, './config/state.js': { screensaverState: state },
    './config/collections.js': { saveCuratedCollections: (...args) => effects.push(['persist', ...args]) },
    './config/collectionsCodec.js': { loadCollectionsSnapshot: () => ({ collections, persistedState: { visionConfig: { apiUrl: 'https://vision.example.test' } } }) },
    './config/activeCategories.js': { loadActiveCategories: () => ['A'], createActiveCategoryDispatcher: ({ dispatchCommand }) => dispatchCommand },
    './domain/dispatch.js': { createDomainDispatcher: capture('domain', dispatcher) },
    './domain/poolRetention.js': { applyPoolPolicy: () => values => values },
    './domain/selectors.js': { buildBalancedFeed: ({ collections: values }) => values.A },
    './domain/snapshot.js': { syncLegacySnapshot: (...args) => effects.push(['snapshot', ...args]) },
    './runtime/activeFeed.js': { createActiveFeedRuntime: () => activeFeed },
    './runtime/poolSchedule.js': { createPoolScheduleRuntime: () => ({ start: () => calls.push('pool.start') }) },
    './runtime/environmentRefresh.js': { createEnvironmentRefreshRuntime: capture('daily', { updateFeedsDaily: async () => {}, updateServerWeather: noop, updateNewsSentiment: noop }) },
    './runtime/idleDaemon.js': { createIdleDaemonRuntime: () => ({ notifyActivity: noop, start: () => calls.push('idle.start') }) },
    './runtime/kioskControl.js': { createKioskControlRuntime: () => ({ getRuntimeContext: () => ({}) }) },
    './services/system.js': {}, './services/weather.js': {}, './services/googlePhotos.js': { getCachedMediaItems: () => [] },
    './services/sentiment.js': {}, './services/ecowitt.js': { createEcowittRuntime: () => ({}) }, './services/sensorHistory.js': { createSensorHistoryStore: options => { history.push(options); return {}; } },
    './config/localSettings.js': {}, './services/sensorPlatform.js': { createSensorPlatform: () => ({ start: () => calls.push('sensor.start') }) },
    './domain/environmentSettings.js': { normalizeEnvironmentSettings: () => ({}), toRuntimeSettings: () => ({}) },
    './services/crawler.js': {}, './utils/fn.js': require('./utils/fn.js'),
    './services/vision.js': { analyzeImageContent: async (...args) => { effects.push(['analyze', ...args]); return tags; } },
    './routes.js': noop, './sockets.js': capture('sockets')
  };
  const exports = loadIsolated(path.join(__dirname, 'app.js'), dependencies, {
    process: processFixture, console: quiet, __dirname,
    setTimeout: (fn, delay) => { const handle = { fn, delay }; timers.push(handle); return handle; },
    setInterval: (fn, delay) => { const handle = { fn, delay }; intervals.push(handle); return handle; }
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
  assert.deepEqual(h.calls, ['idle.start', 'pool.start', 'sensor.start', 'listen']);
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
