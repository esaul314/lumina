// Offline source-boundary regressions; no global fetch, private cache or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { crawlAllCollections, fetchUnsplashImages, fetchAicImages } = require('./crawler.js');

const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const denied = (status) => ({ ok: false, status, json: async () => { throw Error('Must not decode a rejected response'); } });
const reddit = (id) => ok({ data: { children: [{ data: { title: 'Sunny fixture', author: 'fixture', url: `https://example.test/${id}.jpg` } }] } });
const unsplash = (id) => ok({ results: [{ width: 1200, height: 800, urls: { raw: `https://images.unsplash.com/${id}` }, description: 'Fixture image' }] });
const cached = () => ({
  A: [{ url: 'https://example.test/cached.jpg', title: 'Saved', rating: 10, loved: true, comment: 'Keep me' }],
  B: [{ url: 'https://example.test/legacy.jpg', title: 'Legacy', cropPercent: 42 }]
});
const feeds = () => Object.fromEntries(['A', 'B'].map(category => [category, {
  reddit: { enabled: true, subreddits: ['first', 'second', 'third'] },
  unsplash: { enabled: true, keywords: ['forest', { keywords: ['mist', 'rain'], timeStart: '06:00', timeEnd: '10:00' }] }
}]));
const crawl = (fetchImpl, collections = cached(), options = {}) => crawlAllCollections(
  collections, feeds(), null, [], null, () => new Date('2026-11-24T00:00:00Z'),
  { fetchImpl, requestTimeoutMs: 1000, ...options }
);

for (const [status, kind] of [[401, 'authentication'], [403, 'policy'], [429, 'rate-limit'], [503, 'service']]) {
  test(`HTTP${status} stops each rejected source once across variants, queries and pools`, async () => {
    const calls = [];
    const input = cached(), before = structuredClone(input);
    const result = await crawl(async url => { calls.push(url); return denied(status); }, input);
    assert.equal(calls.filter(url => url.includes('reddit.com')).length, 1);
    assert.equal(calls.filter(url => url.includes('unsplash.com')).length, 1);
    assert.deepEqual(result.providerFailures, [
      { provider: 'reddit', kind, status }, { provider: 'unsplash', kind, status }
    ]);
    assert.equal(result.updatedAny, false);
    assert.deepEqual(result.updatedCollections, before);
    assert.deepEqual(input, before);
  });
}

test('a rejected source does not suppress healthy sources, timed keywords or a fresh recovery pass', async () => {
  const calls = [];
  const partial = await crawl(async url => {
    calls.push(url);
    return url.includes('reddit.com') ? denied(403) : unsplash(String(calls.length));
  });
  assert.equal(partial.providerFailures.length, 1);
  assert.equal(partial.updatedAny, true);
  assert.ok(partial.updatedCollections.A.some(photo => photo.queryKeyword === 'mist'
    && photo.timeRanges[0].start === '06:00'));
  assert.equal(partial.updatedCollections.A[0].comment, 'Keep me');
  const recovered = await crawl(async url => url.includes('reddit.com') ? reddit('recovered') : ok({ results: [] }));
  assert.deepEqual(recovered.providerFailures, []);
  assert.ok(recovered.updatedCollections.A.some(photo => photo.url.endsWith('recovered.jpg')));
});


test('the declarative parameter traversal retains legacy iterable inputs', async () => {
  const configs = { A: { reddit: { enabled: true, subreddits: new Set(['first', 'second']) } } };
  const calls = [];
  const result = await crawlAllCollections(cached(), configs, null, [], null, undefined, {
    fetchImpl: async url => { calls.push(url); return ok({ data: { children: [] } }); }
  });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('/first/'));
  assert.ok(calls[1].includes('/second/'));
  assert.deepEqual(result.providerFailures, []);
});

test('a query-local404 does not disable the whole source', async () => {
  let redditCalls = 0;
  const result = await crawl(async url => {
    if (!url.includes('reddit.com')) return ok({ results: [] });
    redditCalls += 1;
    return redditCalls === 1 ? denied(404) : reddit('after-miss');
  });
  assert.equal(redditCalls, 6);
  assert.deepEqual(result.providerFailures, []);
  assert.ok(result.updatedCollections.A.some(photo => photo.url.endsWith('after-miss.jpg')));
});

test('successful Unsplash results survive a later HTTP rejection in the same query', async () => {
  let calls = 0;
  const photos = await fetchUnsplashImages('fixture', 20, async () => ++calls === 1 ? unsplash('first-good') : denied(401));
  assert.equal(calls, 2);
  assert.equal(photos.length, 1);
  assert.ok(photos[0].url.includes('first-good'));
});


test('rejected-body cleanup cannot replace HTTP status or discard earlier photos', async () => {
  let calls = 0;
  const result = await crawl(async url => {
    if (url.includes('reddit.com')) return ok({ data: { children: [] } });
    calls++;
    if (calls === 1) return unsplash('keep-before-rejection');
    const body = new ReadableStream({ start(controller) { controller.error(Error('body failed')); } });
    return new Response(body, { status: 503 });
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.providerFailures, [{ provider: 'unsplash', kind: 'service', status: 503 }]);
  assert.ok(result.updatedCollections.A.some(photo => photo.url.includes('keep-before-rejection')));
  assert.equal(result.updatedCollections.A[0].comment, 'Keep me');
});

for (const [label, failure, kind] of [
  ['transport', async () => { throw Error('offline'); }, 'transport'],
  ['decoding', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad JSON'); } }), 'decoding']
]) {
  test(`${label} failure is bounded per source without losing saved data`, async () => {
    let calls = 0;
    const result = await crawl(async (...args) => { calls++; return failure(...args); });
    assert.equal(calls, 2);
    assert.deepEqual(result.providerFailures.map(({ kind }) => kind), [kind, kind]);
    assert.deepEqual(result.updatedCollections, cached());
  });
}

test('headers and a stalled JSON body both respect the per-request deadline', async () => {
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits++;
    if (hits === 1) res.writeHead(200, { 'content-type': 'application/json' }).write('{');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const local = `http://127.0.0.1:${server.address().port}/`;
    const result = await crawl((_url, options) => fetch(local, options), cached(), { requestTimeoutMs: 80 });
    assert.equal(hits, 2);
    assert.deepEqual(result.providerFailures.map(({ kind }) => kind), ['timeout', 'timeout']);
    assert.deepEqual(result.updatedCollections, cached());
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});


const wallhavenResponse = id => ok({ data: [{ id, path: `https://wallhaven.example.test/${id}.jpg`, uploader: { username: 'Fixture' } }] });
const wallhavenConfigs = () => Object.fromEntries(['A', 'B'].map(category => [category, {
  wallhaven: { enabled: true, keywords: ['forest', { keywords: ['mist', 'rain'], timeStart: '06:00', timeEnd: '10:00' }] }
}]));
const wallhavenCrawl = (fetchImpl, collections = cached(), options = {}) => crawlAllCollections(
  collections, wallhavenConfigs(), null, [], null, () => new Date('2026-11-24T00:00:00Z'),
  { fetchImpl, requestTimeoutMs: 1000, ...options }
);

// Source-local module fixture: no global fetch/cache/env patches or provider calls.
function isolatedCrawler(fetchImpl) {
  const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');
  const { compileFunction } = require('node:vm');
  const filename = path.join(__dirname, 'crawler.js'), localRequire = createRequire(filename), module = { exports: {} };
  compileFunction(fs.readFileSync(filename, 'utf8'), ['module', 'require', 'fetch', 'console'], { filename })(
    module, name => name === '../config/env.js' ? { readEnvVar: () => '' } : localRequire(name),
    fetchImpl, { log() {}, warn() {}, error() {} }
  );
  return module.exports;
}

for (const [status, kind] of [[401, 'authentication'], [403, 'policy'], [429, 'rate-limit'], [503, 'service']]) {
  test(`Wallhaven HTTP${status} is bounded once across pools/timed queries without losing cached metadata`, async () => {
    const input = cached(), before = structuredClone(input); let calls = 0;
    const result = await wallhavenCrawl(async () => { calls++; return denied(status); }, input);
    assert.equal(calls, 1);
    assert.deepEqual(result.providerFailures, [{ provider: 'wallhaven', kind, status }]);
    assert.equal(result.updatedAny, false); assert.deepEqual(result.updatedCollections, before); assert.deepEqual(input, before);
  });
}

test('Wallhaven retains accepted earlier queries and a fresh pass recovers with timed metadata/SFW parameters', async () => {
  let calls = 0;
  const partial = await wallhavenCrawl(async () => ++calls === 1 ? wallhavenResponse('first') : denied(429));
  assert.equal(calls, 2); assert.equal(partial.updatedCollections.A[0].comment, 'Keep me');
  assert.ok(partial.updatedCollections.A.some(photo => photo.url.endsWith('/first.jpg')));
  assert.deepEqual(partial.updatedCollections.B, cached().B);
  calls = 0;
  const recovered = await wallhavenCrawl(async (url, options) => {
    assert.ok(url.includes('purity=100') && url.includes('ratios=16x9,16x10'));
    assert.match(options.headers['User-Agent'], /^LuminaScreensaver\//);
    return wallhavenResponse(`recovered-${++calls}`);
  });
  assert.equal(calls, 6); assert.deepEqual(recovered.providerFailures, []);
  const mist = recovered.updatedCollections.A.find(photo => photo.queryKeyword === 'mist');
  assert.deepEqual(mist.timeRanges, [{ start: '06:00', end: '10:00' }]);
  assert.equal(mist.source, 'wallhaven'); assert.equal(mist.addedAt, '2026-11-24T00:00:00.000Z');
});

test('a Wallhaven query-local404 does not disable healthy later queries', async () => {
  let calls = 0;
  const result = await wallhavenCrawl(async () => ++calls === 1 ? denied(404) : wallhavenResponse(String(calls)));
  assert.equal(calls, 6); assert.deepEqual(result.providerFailures, []); assert.equal(result.updatedAny, true);
});

for (const [label, failure, kind] of [
  ['transport', async () => { throw new Error('offline'); }, 'transport'],
  ['decoding', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad JSON'); } }), 'decoding'],
  ['null transport', async () => { throw null; }, 'transport']
]) {
  test(`Wallhaven ${label} failure stays run-local and preserves saved data`, async () => {
    let calls = 0; const result = await wallhavenCrawl(async (...args) => { calls++; return failure(...args); });
    assert.equal(calls, 1); assert.equal(result.providerFailures[0].kind, kind);
    assert.deepEqual(result.updatedCollections, cached());
  });
}

for (const stage of ['headers', 'body']) {
  test(`Wallhaven stalled ${stage} respects the existing request deadline and stops later work`, async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => { hits++; if (stage === 'body') res.writeHead(200, { 'content-type': 'application/json' }).write('{'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const url = `http://127.0.0.1:${server.address().port}/`;
      const result = await wallhavenCrawl((_url, options) => fetch(url, options), cached(), { requestTimeoutMs: 80 });
      assert.equal(hits, 1); assert.equal(result.providerFailures[0].kind, 'timeout');
      assert.deepEqual(result.updatedCollections, cached());
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
}

for (const primary of [false, true]) {
  test(`keyless AI fallback shares the Wallhaven budget with primary enabled=${primary}`, async () => {
    const urls = [];
    const fetchImpl = async url => {
      urls.push(url);
      return url.includes('wallhaven.cc') ? denied(429)
        : ok({ images: [{ src: 'https://lexica.example.test/healthy.jpg', prompt: 'Fixture', width: 1200, height: 800 }] });
    };
    const service = isolatedCrawler(fetchImpl), input = { 'AI Creations': cached().A };
    const result = await service.crawlAllCollections(input, { 'AI Creations': {
      midjourney: { enabled: true }, wallhaven: { enabled: primary, keywords: ['first', 'second'] }
    } }, null, [], null, () => new Date('2026-11-24T00:00:00Z'), { fetchImpl });
    assert.equal(urls.filter(url => url.includes('wallhaven.cc')).length, 1);
    assert.equal(urls.filter(url => url.includes('lexica.art')).length, 1);
    assert.deepEqual(result.providerFailures, [{ provider: 'wallhaven', kind: 'rate-limit', status: 429 }]);
    assert.ok(result.updatedCollections['AI Creations'].some(photo => photo.source === 'lexica'));
    assert.equal(result.updatedCollections['AI Creations'][0].comment, 'Keep me');
  });
}

test('healthy keyless fallback keeps Lexica concurrent and preserves round-robin source identity/cardinality', async () => {
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  const calls = [];
  const service = isolatedCrawler(async url => {
    if (url.includes('lexica.art')) {
      calls.push('lexica');
      return ok({ images: [1, 2].map(n => ({ src: `https://lexica.example.test/${n}.jpg`, prompt: 'Fixture', width: 1200, height: 800 })) });
    }
    const number = calls.filter(value => value.startsWith('wall')).length + 1;
    calls.push(`wall${number}`);
    if (number === 1) { entered(); await blocked; }
    return ok({ data: [1, 2].map(n => ({ id: `${number}-${n}`, path: `https://wallhaven.example.test/${number}-${n}.jpg` })) });
  });
  const pending = service.fetchMidjourneyImages(2); await started;
  assert.deepEqual(calls, ['lexica', 'wall1']); release(); const result = await pending;
  assert.deepEqual(calls, ['lexica', 'wall1', 'wall2']);
  assert.deepEqual(result.map(photo => photo.url), [
    'https://lexica.example.test/1.jpg', 'https://wallhaven.example.test/1-1.jpg', 'https://wallhaven.example.test/2-1.jpg',
    'https://lexica.example.test/2.jpg', 'https://wallhaven.example.test/1-2.jpg', 'https://wallhaven.example.test/2-2.jpg'
  ]);
  assert.deepEqual(result.map(photo => photo.source), ['lexica', 'wallhaven', 'wallhaven', 'lexica', 'wallhaven', 'wallhaven']);
});


const aicResponse = id => ok({ data: [{ image_id: id, title: 'Fixture art', artist_title: 'Fixture Artist' }] });
const aicConfigs = () => Object.fromEntries(['A', 'B'].map(category => [category, {
  artic: { enabled: true, keywords: ['forest', { keywords: ['mist', 'rain'], timeStart: '06:00', timeEnd: '10:00' }] }
}]));
const aicCrawl = (fetchImpl, collections = cached(), options = {}) => crawlAllCollections(
  collections, aicConfigs(), null, [], null, () => new Date('2026-11-24T00:00:00Z'),
  { fetchImpl, requestTimeoutMs: 1000, ...options }
);

for (const [status, kind] of [[401, 'authentication'], [403, 'policy'], [429, 'rate-limit'], [503, 'service']]) {
  test('Art Institute HTTP' + status + ' stops once across pools/timed queries and preserves human metadata', async () => {
    const input = cached(), before = structuredClone(input); let calls = 0;
    const result = await aicCrawl(async () => { calls++; return denied(status); }, input);
    assert.equal(calls, 1);
    assert.deepEqual(result.providerFailures, [{ provider: 'artic', kind, status }]);
    assert.equal(result.updatedAny, false); assert.deepEqual(result.updatedCollections, before); assert.deepEqual(input, before);
  });
}

test('Art Institute keeps earlier accepted queries and recovers with timed IIIF metadata on the next run', async () => {
  let calls = 0;
  const partial = await aicCrawl(async () => ++calls === 1 ? aicResponse('first') : denied(403));
  assert.equal(calls, 2); assert.equal(partial.updatedCollections.A[0].comment, 'Keep me');
  assert.ok(partial.updatedCollections.A.some(photo => photo.url.includes('/first/full/843,/0/default.jpg')));
  assert.deepEqual(partial.updatedCollections.B, cached().B);
  calls = 0;
  const recovered = await aicCrawl(async (url, options) => {
    const target = new URL(url);
    assert.equal(target.hostname, 'api.artic.edu'); assert.equal(target.searchParams.get('limit'), '10');
    assert.equal(target.searchParams.get('fields'), 'id,title,image_id,artist_title');
    assert.match(options.headers['User-Agent'], /^LuminaScreensaver\//);
    return aicResponse('recovered-' + ++calls);
  });
  assert.equal(calls, 6); assert.deepEqual(recovered.providerFailures, []);
  const mist = recovered.updatedCollections.A.find(photo => photo.queryKeyword === 'mist');
  assert.deepEqual(mist.timeRanges, [{ start: '06:00', end: '10:00' }]);
  assert.equal(mist.source, 'artic'); assert.equal(mist.author, 'Fixture Artist');
  assert.equal(mist.addedAt, '2026-11-24T00:00:00.000Z');
  assert.ok(mist.url.startsWith('https://www.artic.edu/iiif/2/'));
});

test('an Art Institute query-local404 permits healthy later queries', async () => {
  let calls = 0;
  const result = await aicCrawl(async () => ++calls === 1 ? denied(404) : aicResponse(String(calls)));
  assert.equal(calls, 6); assert.deepEqual(result.providerFailures, []); assert.equal(result.updatedAny, true);
});

for (const [label, failure, kind] of [
  ['transport', async () => { throw Error('offline'); }, 'transport'],
  ['decoding', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad JSON'); } }), 'decoding'],
  ['null transport', async () => { throw null; }, 'transport']
]) {
  test('Art Institute ' + label + ' is bounded without losing the saved collection', async () => {
    let calls = 0; const result = await aicCrawl(async (...args) => { calls++; return failure(...args); });
    assert.equal(calls, 1); assert.equal(result.providerFailures[0].kind, kind);
    assert.deepEqual(result.updatedCollections, cached());
  });
}

for (const stage of ['headers', 'body']) {
  test('Art Institute stalled ' + stage + ' observes the existing deadline and stops later queries', async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => { hits++; if (stage === 'body') res.writeHead(200, { 'content-type': 'application/json' }).write('{'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const url = 'http://127.0.0.1:' + server.address().port + '/';
      const result = await aicCrawl((_url, options) => fetch(url, options), cached(), { requestTimeoutMs: 80 });
      assert.equal(hits, 1); assert.equal(result.providerFailures[0].kind, 'timeout');
      assert.deepEqual(result.updatedCollections, cached());
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
}

test('Art Institute concrete request preserves query/count, IIIF base, missing-image filtering and display defaults', async () => {
  const title = 'A'.repeat(60);
  const photos = await fetchAicImages('mist & rain', 3, async (url, options) => {
    const target = new URL(url);
    assert.equal(target.searchParams.get('q'), 'mist & rain'); assert.equal(target.searchParams.get('limit'), '3');
    assert.match(options.headers['User-Agent'], /^LuminaScreensaver\//);
    return ok({ config: { iiif_url: 'https://iiif.example.test/base' }, data: [
      { image_id: 'one', title, artist_title: 'Author' }, { title: 'No image' }, { image_id: 'two' }
    ] });
  });
  assert.deepEqual(photos, [
    { url: 'https://iiif.example.test/base/one/full/843,/0/default.jpg', title: 'A'.repeat(52) + '...', author: 'Author',
      source: 'artic', isNight: false, isRain: false, isSunny: true, isCloudy: false, isSnowy: false },
    { url: 'https://iiif.example.test/base/two/full/843,/0/default.jpg', title: 'mist & rain Artwork', author: 'Unknown Artist',
      source: 'artic', isNight: false, isRain: false, isSunny: true, isCloudy: false, isSnowy: false }
  ]);
});


const unsplashOnlyConfigs = () => Object.fromEntries(['A', 'B'].map(category => [category, {
  unsplash: { enabled: true, keywords: [{ keywords: ['mist', 'rain'], timeStart: '06:00', timeEnd: '10:00' }, 'forest'] }
}]));
const partialUnsplashCrawl = (fetchImpl, collections = cached(), options = {}) => crawlAllCollections(
  collections, unsplashOnlyConfigs(), null, [], null, () => new Date('2026-11-24T00:00:00Z'),
  { fetchImpl, requestTimeoutMs: 1000, ...options }
);

for (const [label, failure, kind] of [
  ['transport', async () => { throw Error('later offline'); }, 'transport'],
  ['decoding', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('later bad JSON'); } }), 'decoding'],
  ['null transport', async () => { throw null; }, 'transport']
]) {
  test('accepted Unsplash query photos survive later ' + label + ' with warnings/metadata and next-run recovery', async () => {
    const input = cached(), before = structuredClone(input); let calls = 0;
    const result = await partialUnsplashCrawl(async (...args) => ++calls === 1 ? unsplash('accepted-first') : failure(...args), input);
    assert.equal(calls, 2); assert.equal(result.updatedAny, true);
    assert.deepEqual(result.providerFailures, [{ provider: 'unsplash', kind }]);
    assert.deepEqual(input, before); assert.equal(result.updatedCollections.A[0].comment, 'Keep me');
    assert.deepEqual(result.updatedCollections.B, before.B);
    const accepted = result.updatedCollections.A.find(photo => photo.url.includes('accepted-first'));
    assert.equal(accepted.source, 'unsplash'); assert.equal(accepted.author, 'Unsplash Photographer');
    assert.equal(accepted.queryKeyword, 'mist'); assert.equal(accepted.addedAt, '2026-11-24T00:00:00.000Z');
    assert.deepEqual(accepted.timeRanges, [{ start: '06:00', end: '10:00' }]);
    let recoveryCalls = 0;
    const recovered = await partialUnsplashCrawl(async () => unsplash('recovered-' + ++recoveryCalls));
    assert.equal(recoveryCalls, 18); assert.deepEqual(recovered.providerFailures, []);
    assert.ok(recovered.updatedCollections.B.some(photo => photo.url.includes('recovered-')));
  });
}

for (const stage of ['headers', 'body']) {
  test('accepted Unsplash variant survives a later stalled ' + stage + ' deadline without repeating source work', async () => {
    let hits = 0, calls = 0;
    const server = http.createServer((_req, res) => { hits++; if (stage === 'body') res.writeHead(200, { 'content-type': 'application/json' }).write('{'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const local = 'http://127.0.0.1:' + server.address().port + '/';
      const result = await partialUnsplashCrawl((_url, options) => ++calls === 1
        ? Promise.resolve(unsplash('before-timeout')) : fetch(local, options), cached(), { requestTimeoutMs: 80 });
      assert.equal(calls, 2); assert.equal(hits, 1);
      assert.deepEqual(result.providerFailures, [{ provider: 'unsplash', kind: 'timeout' }]);
      assert.ok(result.updatedCollections.A.some(photo => photo.url.includes('before-timeout')));
      assert.equal(result.updatedCollections.A[0].comment, 'Keep me');
      assert.deepEqual(result.updatedCollections.B, cached().B);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
}

test('unfinished Unsplash results keep count/dedup/landscape/premium policy and normalized display metadata', async () => {
  let calls = 0;
  const item = (id, extras = {}) => ({
    width: 1200, height: 800, urls: { raw: 'https://images.unsplash.com/' + id },
    description: 'l'.repeat(70), user: { name: 'Fixture Author' }, ...extras
  });
  const photos = await fetchUnsplashImages('fixture', 2, async () => {
    calls++;
    if (calls > 1) throw new Error('later transport');
    return ok({ results: [
      item('first?ixid=one'), item('first?ixid=two'), item('portrait', { width: 800, height: 1200 }),
      item('premium', { premium: true }), item('plus', { plus: true }), item('second'), item('third')
    ] });
  });
  assert.equal(calls, 2); assert.equal(photos.length, 2);
  assert.deepEqual(photos.map(photo => photo.url), [
    'https://images.unsplash.com/first?q=80&w=2560&auto=format&fit=crop', 'https://images.unsplash.com/second'
  ]);
  assert.equal(photos[0].title, 'L' + 'l'.repeat(51) + '...');
  assert.deepEqual(photos.map(({ author, source, isNight, isRain, isSunny, isCloudy, isSnowy }) =>
    ({ author, source, isNight, isRain, isSunny, isCloudy, isSnowy })), Array.from({ length: 2 }, () => ({
      author: 'Fixture Author', source: 'unsplash', isNight: false, isRain: false, isSunny: true, isCloudy: false, isSnowy: false
    })));
});
