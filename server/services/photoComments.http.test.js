// Real loopback REST + domain interpreter + task-owned durable collection file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { compileFunction } = require('node:vm');
const { createRequire } = require('node:module');
const { createDomainDispatcher } = require('../domain/dispatch.js');
const { decodePhotoCommentCommand } = require('../domain/commands.js');
const { createPhotoCommentStore } = require('./photoComments.js');
const { buildGooglePhotoProxyUrl } = require('./googlePhotosCache.js');

const a = { url: 'https://images.example.test/a.jpg', title: 'Caption', rating: 7 };
const g = { id: 'picker-id', url: buildGooglePhotoProxyUrl('picker-id'), googleBaseUrl: 'signed', rating: 6 };
const routesPath = path.join(__dirname, '../routes.js');
function loadRoutes() {
  const module = { exports: {} }, nativeRequire = createRequire(routesPath);
  compileFunction(fs.readFileSync(routesPath, 'utf8'), ['module', 'require'], { filename: routesPath })(
    module, name => name === './services/googlePhotos.js'
      ? { getCachedMediaItems: () => [structuredClone(g)] }
      : name === './services/weather.js' ? {} : nativeRequire(name)
  );
  return module.exports;
}
async function withHttp(run, { missingWriter = false, missingReader = false, failWrite = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-comments-http-'));
  const jsonPath = path.join(dir, 'collections.json');
  const collections = { A: [structuredClone(a)], B: [structuredClone(a)] };
  const state = { currentCategory: 'A', photosList: [structuredClone(a)], activePhoto: structuredClone(a), widgets: {},
    searchKeywords: {}, feedConfigs: {}, poolPolicies: {}, excludedKeywords: [], manualLocation: {} };
  fs.writeFileSync(jsonPath, JSON.stringify({ feeds: collections }));
  const store = createPhotoCommentStore({ jsonPath });
  const events = [], saved = [];
  const io = { emit: (...args) => events.push(args) };
  const dispatcher = createDomainDispatcher({
    state, collections, io, getRuntimeContext: () => ({ externalCollections: { 'Google Photos': [g] } }),
    persistCollections() { throw new Error('Must not persist normal collections for a comment'); },
    persistEnvVars() { throw new Error('Must not persist secrets'); },
    ...(!missingWriter ? { savePhotoComment: ({ url, comment }) => {
      if (failWrite) throw new Error('Injected persistence failure');
      saved.push({ url, comment });
      return store.write({ url }, comment);
    } } : {})
  });
  const app = require('express')(); app.use(require('express').json());
  loadRoutes()({ app, state, collections, io, port: 0, getWeatherData: () => null, setWeatherData() {},
    dispatchCommand: dispatcher.dispatchCommand,
    ...(!missingReader ? { readPhotoComment: photo => store.read(photo) } : {})
  });
  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, body = {}, url = '/api/admin/photo-comment') => {
      const response = await fetch(origin + (method === 'GET' ? url + '?url=' + encodeURIComponent(body.url ?? '') : url), {
        method, ...(method !== 'GET' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
      });
      return { status: response.status, body: await response.json() };
    };
    await run({ request, state, collections, store, jsonPath, events, saved, dispatcher, origin });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('strict comment command decoder allows clear, trims text, rejects malformed/oversized payloads', () => {
  assert.deepEqual(decodePhotoCommentCommand({ url: a.url, comment: '  Note  ' }), {
    type: 'set-photo-comment', payload: { url: a.url, comment: 'Note' }
  });
  assert.equal(decodePhotoCommentCommand({ url: a.url, comment: '' }).payload.comment, '');
  [null, [], {}, { url: '' }, { url: a.url }, { url: a.url, comment: null },
    { url: a.url, comment: 1 }, { url: a.url, comment: 'x'.repeat(2001) }]
    .forEach(input => assert.equal(decodePhotoCommentCommand(input), null));
});

test('REST create/read/edit/clear awaits durable effect, never changes ratings/captions or broadcasts comments', () => withHttp(async f => {
  assert.equal((await f.request('GET', { url: a.url })).body.comment, '');
  for (const comment of ['Private note', 'Edited note', '']) {
    const result = await f.request('PATCH', { url: a.url, comment, rating: 1 });
    assert.equal(result.status, 200);
    assert.equal(result.body.comment, comment);
    assert.equal((await f.request('GET', { url: a.url })).body.comment, comment);
    assert.equal(createPhotoCommentStore({ jsonPath: f.jsonPath }).read(a).comment, comment);
    assert.equal(f.collections.A[0].rating, 7);
    assert.equal(f.collections.B[0].title, 'Caption');
  }
  assert.equal(f.saved.length, 3);
  assert.deepEqual(f.events, []);
}));

test('Google and duplicate-pool photos share comments without injecting them into normal API/state/photo responses', () => withHttp(async f => {
  for (const url of [a.url, g.url]) {
    assert.equal((await f.request('PATCH', { url, comment: 'PRIVATE-SENTINEL' })).status, 200);
    assert.equal((await f.request('GET', { url })).body.comment, 'PRIVATE-SENTINEL');
  }
  const snapshot = f.dispatcher.refreshSnapshot();
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE-SENTINEL'));
  assert.ok(!JSON.stringify(f.state).includes('PRIVATE-SENTINEL'));
  for (const route of ['/api/state', '/api/pools/A/photos', '/api/pools/Google%20Photos/photos']) {
    const response = await fetch(f.origin + route);
    assert.ok(!(await response.text()).includes('PRIVATE-SENTINEL'));
  }
  assert.equal(f.store.read(f.collections.B[0]).comment, 'PRIVATE-SENTINEL');
}));

test('invalid or unknown photo requests refuse before any persistence', () => withHttp(async f => {
  for (const method of ['GET', 'PATCH']) {
    assert.equal((await f.request(method, { url: '', comment: 'Note' })).status, 400);
    assert.equal((await f.request(method, { url: 'https://missing.example.test', comment: 'Note' })).status, 404);
  }
  for (const comment of [null, {}, 'x'.repeat(2001)]) {
    assert.equal((await f.request('PATCH', { url: a.url, comment })).status, 400);
  }
  assert.deepEqual(f.saved, []);
}));

test('missing comment capabilities report unavailable instead of false save/read success', async () => {
  await withHttp(async f => assert.equal((await f.request('PATCH', { url: a.url, comment: 'Note' })).status, 503), { missingWriter: true });
  await withHttp(async f => assert.equal((await f.request('GET', { url: a.url })).status, 503), { missingReader: true });
});

test('persistence rejection returns failure and preserves private text and normal state', () => withHttp(async f => {
  const result = await f.request('PATCH', { url: a.url, comment: 'Rejected' });
  assert.equal(result.status, 500);
  assert.ok(!result.body.success);
  assert.equal(f.store.read(a).comment, '');
  assert.equal(f.state.activePhoto.rating, 7);
  assert.deepEqual(f.events, []);
}, { failWrite: true }));
