// Offline source-boundary regressions; no global fetch, private cache or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { crawlAllCollections, fetchUnsplashImages } = require('./crawler.js');

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
