// Offline workflow regressions: no provider, cache, private state or application timers.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileFunction } = require('node:vm');
const { createImageAnalysisRunner, createVisionAnalysisJobService } = require('./visionAnalysis.js');
const { executeRecrawlPass } = require('./recrawl.js');
const { createEnvironmentRefreshRuntime } = require('../runtime/environmentRefresh.js');

const tags = Object.freeze({ isNight: false, isRain: true, isSunny: false, isCloudy: true, isSnowy: false });
const photos = (count, prefix = 'photo') => Array.from({ length: count }, (_, index) => ({ url: `${prefix}-${index}`, title: `Title ${index}` }));
const quiet = { log() {}, warn() {}, error() {} };
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function harness(collections = { A: photos(1) }, overrides = {}) {
  const events = [], progress = [], warnings = [];
  const runner = createImageAnalysisRunner({
    collections,
    analyzeImageContent: async (url, title) => { events.push(['analyze', url, title]); return tags; },
    persistCollections: value => { assert.equal(value, collections); events.push(['persist']); },
    refreshActiveFeedIfIncluded: categories => events.push(['refresh', categories]),
    broadcastStateSync: () => events.push(['broadcast']),
    getVisionConfig: () => ({ apiUrl: 'https://vision.example.test' }),
    // Opt in only with isolated effect doubles; app keeps the default test guard.
    isTestMode: () => false,
    log: { ...quiet, warn: message => warnings.push(message) },
    ...overrides
  });
  const run = (options = {}) => runner({
    emitProgress: value => { progress.push(value); events.push(['progress', value.phase, value.processedCount]); },
    ...options
  });
  return { collections, runner, run, events, progress, warnings };
}

// Execute actual module source with closed effect imports, without global cache patches.
function loadIsolated(filename, dependencies, globals = {}) {
  const module = { exports: {} };
  compileFunction(fs.readFileSync(filename, 'utf8'), ['module', 'require', ...Object.keys(globals)], { filename })(
    module,
    request => {
      assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`);
      return dependencies[request];
    },
    ...Object.values(globals)
  );
  return module.exports;
}

test('success preserves photo/array/metadata identity and applies only the five vision tags in effect order', async () => {
  const unchanged = { ...photos(1)[0], ...tags, rating: 8, loved: true, comment: 'Keep', cropPercent: 41, custom: { album: 7 } };
  const changed = { url: 'changed', title: 'Original', isNight: true, source: 'fixture', analyzedAt: 12 };
  const banned = Object.freeze({ url: 'banned', rating: 1 });
  const broken = Object.freeze({ url: 'broken', isBroken: true });
  const group = [unchanged, changed, banned, broken];
  const before = structuredClone(unchanged), metadata = unchanged.custom;
  const h = harness({ A: group });
  const result = await h.run();
  assert.deepEqual(result, { categories: ['A'], processedCount: 2, taggedCount: 2, changedCount: 1, categoryCounts: [{ name: 'A', photoCount: 4 }] });
  assert.equal(h.collections.A, group);
  assert.equal(group[0], unchanged);
  assert.equal(group[1], changed);
  assert.equal(unchanged.custom, metadata);
  assert.deepEqual(unchanged, before);
  assert.deepEqual(changed, { url: 'changed', title: 'Original', source: 'fixture', analyzedAt: 12, ...tags });
  assert.deepEqual(h.events, [
    ['progress', 'scanning', 0], ['analyze', 'photo-0', 'Title 0'], ['progress', 'analyzing', 1],
    ['analyze', 'changed', 'Original'], ['progress', 'analyzing', 2], ['persist'], ['refresh', ['A']],
    ['progress', 'persisting', undefined], ['broadcast']
  ]);
});

test('unrelated analysis fields never overwrite original metadata; missing tag fields retain undefined assignment semantics', async () => {
  const photo = { url: 'one', title: 'Original', rating: 9, isRain: true, isSnowy: false, model: 'saved' };
  const h = harness({ A: [photo] }, { analyzeImageContent: async () => ({ isNight: true, rating: 1, title: 'Replaced', model: 'provider' }) });
  assert.equal((await h.run()).changedCount, 1);
  assert.deepEqual(photo, { url: 'one', title: 'Original', rating: 9, model: 'saved', isNight: true, isRain: undefined, isSunny: undefined, isCloudy: undefined, isSnowy: undefined });
});

test('unchanged successful tags still persist, refresh and broadcast once', async () => {
  const h = harness({ A: [{ url: 'unchanged', ...tags }] });
  const result = await h.run();
  assert.equal(result.changedCount, 0);
  assert.equal(result.taggedCount, 1);
  assert.deepEqual(h.events.slice(-4), [['persist'], ['refresh', ['A']], ['progress', 'persisting', undefined], ['broadcast']]);
});

test('direct scopes preserve duplicates and order, ignore non-array/missing pools, and do not normalize names', async () => {
  const requested = Object.freeze(['B', 'missing', 'B', ' A ', 'Empty', 'invalid']);
  const h = harness({ A: photos(1, 'a'), B: photos(1, 'b'), Empty: [], invalid: {} });
  const result = await h.run({ categories: requested });
  assert.deepEqual(result, { categories: ['B', 'B', 'Empty'], processedCount: 2, taggedCount: 2, changedCount: 1, categoryCounts: [{ name: 'B', photoCount: 1 }, { name: 'B', photoCount: 1 }, { name: 'Empty', photoCount: 0 }] });
  assert.deepEqual(h.events.filter(([type]) => type === 'analyze').map(([, url]) => url), ['b-0', 'b-0']);
  assert.deepEqual(requested, ['B', 'missing', 'B', ' A ', 'Empty', 'invalid']);
});

test('an explicit invalid-only background scope stays empty instead of falling back to active or global pools', async () => {
  const h = harness();
  assert.deepEqual(await h.run({ categories: ['missing', ' A '] }), {
    categories: [], processedCount: 0, taggedCount: 0, changedCount: 0, categoryCounts: []
  });
  assert.deepEqual(h.events, [['progress', 'scanning', 0]]);
});

for (const categories of [[], null, 'A', undefined]) {
  test(`empty/non-array scope (${String(categories)}) includes every key, counting non-array pools as empty`, async () => {
    const h = harness({ A: photos(1), B: null, C: [] });
    const result = await h.run({ categories });
    assert.deepEqual(result.categories, ['A', 'B', 'C']);
    assert.deepEqual(result.categoryCounts, [{ name: 'A', photoCount: 1 }, { name: 'B', photoCount: 0 }, { name: 'C', photoCount: 0 }]);
    assert.equal(result.processedCount, 1);
  });
}

for (const collections of [{}, { A: [] }, { A: [{ url: 'banned', rating: 1 }, { url: 'broken', isBroken: true }] }]) {
  test(`no eligible candidates emits scanning only without persistence (${JSON.stringify(collections)})`, async () => {
    const h = harness(collections);
    assert.equal((await h.run()).processedCount, 0);
    assert.deepEqual(h.events, [['progress', 'scanning', 0]]);
    assert.equal(h.progress[0].message, 'No eligible photos found for vision analysis.');
  });
}

test('only numeric rating1 and truthy broken flags skip; similar legacy values are not silently normalized', async () => {
  const h = harness({ A: [{ url: 'string-rating', rating: '1' }, { url: 'zero-broken', isBroken: 0 }, { url: 'truthy-broken', isBroken: 'yes' }] });
  assert.equal((await h.run()).processedCount, 2);
});

test('progress emits scanning, first, each25 and final exactly once, then persisting', async () => {
  const h = harness({ A: photos(51) });
  await h.run();
  assert.deepEqual(h.progress.map(({ phase, processedCount }) => [phase, processedCount]), [
    ['scanning', 0], ['analyzing', 1], ['analyzing', 25], ['analyzing', 50], ['analyzing', 51], ['persisting', undefined]
  ]);
  assert.deepEqual(h.progress[2], { phase: 'analyzing', message: 'Processed 25 of 51 photos...', processedCount: 25, totalCount: 51, taggedCount: 25, changedCount: 25 });
  const single = harness();
  await single.run();
  assert.equal(single.progress[0].message, 'Scanning 1 photo for vision analysis...');
  assert.equal(single.progress[1].message, 'Processed 1 of 1 photo...');
  const boundary = harness({ A: photos(25) });
  await boundary.run();
  assert.deepEqual(boundary.progress.filter(p => p.phase === 'analyzing').map(p => p.processedCount), [1, 25]);
});

test('partial success resets consecutive falsy failures across categories and retains aggregate progress', async () => {
  const values = [null, false, tags, undefined, 0, tags, null, false];
  const h = harness({ A: photos(2, 'a'), B: photos(6, 'b') }, { analyzeImageContent: async () => values.shift() });
  const result = await h.run();
  assert.equal(result.processedCount, 8);
  assert.equal(result.taggedCount, 2);
  assert.equal(result.changedCount, 2);
  assert.equal(h.warnings.length, 0);
  assert.deepEqual(h.progress.at(-2), { phase: 'analyzing', message: 'Processed 8 of 8 photos...', processedCount: 8, totalCount: 8, taggedCount: 2, changedCount: 2 });
  assert.equal(h.events.filter(([event]) => event === 'persist').length, 1);
});

test('three falsy failures span categories and skips; abort precedes final progress and every persistence effect', async () => {
  const values = [tags, null, false, undefined];
  const h = harness({ A: photos(2, 'a'), B: [{ url: 'skip', rating: 1 }, ...photos(3, 'b')] }, {
    analyzeImageContent: async () => values.shift()
  });
  await assert.rejects(h.run(), /Aborting background analysis after 3 consecutive API failures/);
  assert.equal(values.length, 0);
  assert.equal(h.collections.A[0].isRain, true, 'earlier in-memory tags survive failure');
  assert.equal(h.collections.B[3].isRain, undefined, 'later work is not visited');
  assert.deepEqual(h.events, [['progress', 'scanning', 0], ['progress', 'analyzing', 1]]);
  assert.equal(h.warnings.length, 1);
});

test('exactly three failed candidates do not emit a false final progress event', async () => {
  let calls = 0;
  const h = harness({ A: photos(3) }, { analyzeImageContent: async () => { calls++; return null; } });
  await assert.rejects(h.run(), /3 consecutive API failures/);
  assert.equal(calls, 3);
  assert.deepEqual(h.progress.map(p => p.processedCount), [0, 1]);
});

test('one or two falsy results finish without tags, persistence, refresh or state emission', async () => {
  const h = harness({ A: photos(2) }, { analyzeImageContent: async () => null });
  assert.deepEqual(await h.run(), { categories: ['A'], processedCount: 2, taggedCount: 0, changedCount: 0, categoryCounts: [{ name: 'A', photoCount: 2 }] });
  assert.deepEqual(h.progress.map(p => p.processedCount), [0, 1, 2]);
  assert.equal(h.events.some(([event]) => ['persist', 'refresh', 'broadcast'].includes(event)), false);
});

test('analyzer rejection propagates unchanged after prior tags, before subsequent work, final progress or persistence', async () => {
  const failure = new Error('analyzer threw');
  let calls = 0;
  const h = harness({ A: photos(3) }, { analyzeImageContent: async () => { if (++calls === 2) throw failure; return tags; } });
  await assert.rejects(h.run(), error => error === failure);
  assert.equal(calls, 2);
  assert.equal(h.collections.A[0].isRain, true);
  assert.equal(h.collections.A[1].isRain, undefined);
  assert.deepEqual(h.progress.map(p => p.processedCount), [0, 1]);
  assert.equal(h.events.some(([event]) => event === 'persist'), false);
  assert.deepEqual(h.warnings, []);
});

test('network effects are sequential, recheck eligibility, and resolve later category arrays at visit time', async () => {
  const pending = deferred(), started = deferred();
  const collections = { A: photos(3, 'a'), B: photos(1, 'old') };
  const seen = [];
  const h = harness(collections, { analyzeImageContent: async url => {
    seen.push(url);
    if (url === 'a-0') { started.resolve(); await pending.promise; }
    return tags;
  } });
  const run = h.run();
  await started.promise;
  assert.deepEqual(seen, ['a-0'], 'only one request may be in flight');
  collections.A[1].rating = 1;
  collections.A[2].isBroken = true;
  collections.B = photos(1, 'new');
  pending.resolve();
  const result = await run;
  assert.deepEqual(seen, ['a-0', 'new-0']);
  assert.equal(result.processedCount, 2);
  assert.equal(h.progress[0].totalCount, 4, 'scan total remains the initial projection');
});

test('the live photo iterator sees replacement/removal/appends during an awaited request', async () => {
  const blocked = deferred(), entered = deferred(), seen = [];
  const group = photos(3);
  const h = harness({ A: group }, { analyzeImageContent: async url => {
    seen.push(url);
    if (url === 'photo-0') { entered.resolve(); await blocked.promise; }
    return tags;
  } });
  const run = h.run();
  await entered.promise;
  group.splice(1, 1);
  group[1] = { url: 'replacement' };
  group.push({ url: 'appended' });
  blocked.resolve();
  assert.equal((await run).processedCount, 3);
  assert.deepEqual(seen, ['photo-0', 'replacement', 'appended']);
});

test('a sparse array retains the native iteration failure before persistence instead of silently dropping holes', async () => {
  const group = photos(1);
  group.length = 2;
  const h = harness({ A: group });
  await assert.rejects(h.run(), TypeError);
  assert.deepEqual(h.progress.map(p => p.processedCount), [0, 1]);
  assert.equal(h.events.some(([event]) => event === 'persist'), false);
});

test('independent background callers still overlap; this move does not add a shared scheduler or lock', async () => {
  const blocked = deferred(), bothEntered = deferred();
  let calls = 0;
  const h = harness(undefined, { analyzeImageContent: async () => {
    if (++calls === 2) bothEntered.resolve();
    await blocked.promise;
    return tags;
  } });
  const first = h.run(), second = h.run();
  await bothEntered.promise;
  assert.equal(calls, 2);
  blocked.resolve();
  const results = await Promise.all([first, second]);
  assert.deepEqual(results.map(result => result.taggedCount), [1, 1]);
  assert.deepEqual(results.map(result => result.changedCount), [1, 0]);
  assert.equal(h.events.filter(([event]) => event === 'persist').length, 2);
});

test('absent config skips background work but rejects manual work before progress; each run reads current config', async () => {
  let config, reads = 0;
  const h = harness({ A: photos(1) }, { getVisionConfig: () => { reads++; return config; } });
  assert.deepEqual(await h.run({ categories: ['A', 'A'] }), { categories: ['A', 'A'], processedCount: 0, taggedCount: 0, changedCount: 0, categoryCounts: [] });
  await assert.rejects(h.run({ requireConfigured: true }), /^Error: Vision API is not configured\.$/);
  assert.deepEqual(h.events, []);
  assert.equal(h.warnings.length, 1);
  config = { apiUrl: 'https://vision.example.test' };
  assert.equal((await h.run()).taggedCount, 1);
  config = {};
  assert.equal((await h.run()).processedCount, 0);
  assert.equal(reads, 4);
});

for (const stage of ['persistCollections', 'refreshActiveFeedIfIncluded', 'persisting', 'broadcastStateSync']) {
  test(`${stage} failure preserves exact persistence/refresh/progress/emission order`, async () => {
    const failure = new Error(stage), order = [];
    const effect = name => () => { order.push(name); if (name === stage) throw failure; };
    const h = harness(undefined, {
      persistCollections: effect('persistCollections'),
      refreshActiveFeedIfIncluded: effect('refreshActiveFeedIfIncluded'),
      broadcastStateSync: effect('broadcastStateSync')
    });
    await assert.rejects(h.run({ emitProgress: ({ phase }) => { if (phase === 'persisting') effect(phase)(); } }), error => error === failure);
    const stages = ['persistCollections', 'refreshActiveFeedIfIncluded', 'persisting', 'broadcastStateSync'];
    assert.deepEqual(order, stages.slice(0, stages.indexOf(stage) + 1));
    assert.equal(h.collections.A[0].isRain, true);
  });
}

test('scanning and analyzing progress failures stop before later effects without converting the thrown error', async () => {
  for (const phase of ['scanning', 'analyzing']) {
    const failure = new Error(phase);
    const h = harness();
    await assert.rejects(h.run({ emitProgress: p => { if (p.phase === phase) throw failure; } }), error => error === failure);
    assert.equal(h.events.filter(([event]) => event === 'analyze').length, phase === 'scanning' ? 0 : 1);
    assert.equal(h.events.some(([event]) => event === 'persist'), false);
  }
});

test('manual job uses the real workflow, normalized scope and live progress/result, without changing background scope rules', async () => {
  const h = harness({ A: photos(2, 'a'), B: photos(1, 'b') });
  const statuses = [];
  const service = createVisionAnalysisJobService({
    collections: h.collections, io: { emit: (_event, job) => statuses.push(job) },
    getActiveCategories: () => ['A'], triggerImageAnalysisBackground: h.runner,
    createJobId: () => 'offline-vision'
  });
  await service.submit({ categories: ['B', 'B', 'missing'], requestedBy: 'socket' });
  await service.waitForIdle();
  const latest = service.getLatestJob();
  assert.equal(latest.status, 'succeeded');
  assert.equal(latest.requestedBy, 'socket');
  assert.deepEqual(latest.result, { categories: ['B'], processedCount: 1, taggedCount: 1, changedCount: 1, categoryCounts: [{ name: 'B', photoCount: 1 }] });
  assert.deepEqual(statuses.map(job => job.progress.phase), ['queued', 'starting', 'scanning', 'analyzing', 'persisting', 'complete']);
  assert.deepEqual(h.events.filter(([event]) => event === 'analyze').map(([, url]) => url), ['b-0']);
});

for (const mode of ['missing-config', 'three-failures', 'thrown']) {
  test(`manual job reports real ${mode} as a terminal error and does not persist`, async () => {
    const h = harness({ A: photos(4) }, {
      getVisionConfig: () => mode === 'missing-config' ? null : { apiUrl: 'https://vision.example.test' },
      analyzeImageContent: async () => { if (mode === 'thrown') throw new Error('offline throw'); return null; }
    });
    const service = createVisionAnalysisJobService({
      collections: h.collections, io: { emit() {} }, getActiveCategories: () => ['A'], triggerImageAnalysisBackground: h.runner
    });
    await service.submit();
    await service.waitForIdle();
    assert.equal(service.getLatestJob().status, 'failed');
    assert.match(service.getLatestJob().error, mode === 'missing-config' ? /not configured/ : mode === 'thrown' ? /offline throw/ : /3 consecutive API failures/);
    assert.equal(h.events.some(([event]) => event === 'persist'), false);
  });
}

test('recrawl schedules the shared scoped runner detached and retains newly crawled metadata through analysis', async () => {
  const blocked = deferred(), entered = deferred();
  const h = harness({ A: photos(1, 'old'), B: photos(1, 'untouched') }, { analyzeImageContent: async () => { entered.resolve(); await blocked.promise; return tags; } });
  let pending, payload;
  const state = { feedConfigs: {}, searchKeywords: {}, photosList: [] };
  const result = await executeRecrawlPass({
    state, collections: h.collections, categories: ['A'], getActiveCategories: () => ['A'],
    crawlCollections: async () => ({ updatedAny: true, updatedCollections: { A: [{ url: 'fresh', comment: 'Keep', cropPercent: 31 }] } }),
    persistCollections() {}, buildActiveFeed: () => h.collections.A, broadcastStateSync() {},
    triggerImageAnalysisBackground: options => { payload = options; pending = h.runner(options); return pending; }
  });
  await entered.promise;
  assert.deepEqual(payload, { categories: ['A'] });
  assert.equal(result.updatedAny, true, 'crawl returned while analysis is still blocked');
  const fresh = h.collections.A[0];
  assert.equal(fresh.isRain, undefined);
  blocked.resolve();
  await pending;
  assert.equal(h.collections.A[0], fresh);
  assert.deepEqual(fresh, { url: 'fresh', comment: 'Keep', cropPercent: 31, category: 'A', ...tags });
  assert.equal(h.collections.B[0].isRain, undefined);
});

test('daily changed-feed path schedules the same global background runner without requiring config', async () => {
  const h = harness({ A: photos(1), B: photos(1, 'other') });
  let pending, payload;
  const runtime = createEnvironmentRefreshRuntime({
    state: {}, collections: h.collections, activeFeedRuntime: { refreshActiveFeed() {} }, jsonPath: 'unused-fixture',
    fsImpl: { existsSync: () => false }, now: () => 100, readNewsRss: async () => null,
    crawlCollections: async () => ({ updatedAny: true, updatedCollections: { A: [{ url: 'daily', loved: true }] } }),
    persistCollections() {}, broadcastStateSync() {}, log: quiet,
    triggerImageAnalysisBackground: (...args) => { payload = args; pending = h.runner(...args); return pending; }
  });
  assert.equal((await runtime.updateFeedsDaily()).updatedAny, true);
  await pending;
  assert.deepEqual(payload, []);
  assert.equal(h.collections.A[0].loved, true);
  assert.equal(h.collections.A[0].isRain, true);
  assert.equal(h.collections.B[0].isRain, true, 'daily analysis remains global');
});

test('legacy add-category uses the real injected global workflow without requiring app or waiting for analysis', async () => {
  const blocked = deferred(), entered = deferred();
  const h = harness({}, { analyzeImageContent: async () => { entered.resolve(); await blocked.promise; return tags; } });
  let pending, payload;
  const { createSocketLegacyCompatibility } = loadIsolated(path.join(__dirname, '../socketLegacyCompatibility.js'), {
    './services/googlePhotos.js': {}, './config/env.js': {},
    './domain/commands.js': require('../domain/commands.js'),
    './config/collections.js': { saveCuratedCollections() {} },
    './services/crawler.js': { crawlAllCollections: async () => ({ updatedAny: true, updatedCollections: { New: [{ url: 'legacy', comment: 'Keep' }] } }) }
  }, { console: quiet });
  const legacy = createSocketLegacyCompatibility({
    state: { currentCategory: 'Old' }, collections: h.collections, broadcast() {},
    triggerImageAnalysisBackground: (...args) => { payload = args; pending = h.runner(...args); return pending; }
  });
  await legacy.addPool({ payload: { name: 'New', keywords: ['forest'] } });
  await entered.promise;
  assert.deepEqual(payload, []);
  assert.equal(h.collections.New[0].isRain, undefined);
  blocked.resolve();
  await pending;
  assert.deepEqual(h.collections.New[0], { url: 'legacy', comment: 'Keep', ...tags });
});
