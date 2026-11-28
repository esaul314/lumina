const test = require('node:test');
const assert = require('node:assert/strict');
const { galleryPageRequest, projectPermanentGallery } = require('./permanentGallery.js');
const fs = require('node:fs'), path = require('node:path');
const { compileFunction } = require('node:vm'), { createRequire } = require('node:module');

test('permanent projection ignores feed selection, retains exclusions, exact dedupe and bounded pages without mutation', () => {
  const collections = { A: [null, 'bad', { url: 'temporary' }, { url: 'legacy', loved: 'true' },
    { url: 'same', loved: false }, { url: 'same', loved: true, rating: 1, isBroken: true, title: 'Hidden' }],
  B: [{ url: 'same', loved: true }, ...Array.from({ length: 125 }, (_, index) => ({ url: `u${index}`, loved: true }))], Bad: null };
  const googlePhotos = [{ url: 'google', loved: true }, { url: 'same', loved: true }];
  const before = JSON.stringify({ collections, googlePhotos });
  const input = { collections, googlePhotos, excludedKeywords: ['hidden'], page: 1, pageSize: 24 };
  const first = projectPermanentGallery(input);
  assert.equal(first.total, 127); assert.equal(first.photos.length, 24);
  assert.deepEqual(first.photos[0], { url: 'same', title: 'Hidden', pool: 'A', author: null, exclusions: ['Banned rating', 'Marked broken', 'Excluded keyword'] });
  const last = projectPermanentGallery({ ...input, page: 999 });
  assert.equal(last.page, 6); assert.equal(last.photos.length, 7); assert.equal(last.photos.at(-1).url, 'google');
  assert.equal(JSON.stringify({ collections, googlePhotos }), before);
  assert.equal(projectPermanentGallery({ collections: {}, page: 3, pageSize: 24 }).page, 1);
});

test('page decode rejects arrays, coercions, fractions, zero, unsafe values and oversized responses', () => {
  assert.deepEqual(galleryPageRequest({}), { page: 1, pageSize: 24 });
  for (const value of ['', '0', '-1', '1.2', '1e2', 'Infinity', '9007199254740992', ['1'], {}, 1, null]) {
    assert.equal(galleryPageRequest({ page: value }), null);
  }
  assert.equal(galleryPageRequest({ pageSize: '61' }), null);
});

test('actual gallery HTTP route reads Google explicitly read-only and never dispatches/emits or exposes private fields', async () => {
  const filename = path.join(__dirname, '../routes.js'), module = { exports: {} }, nativeRequire = createRequire(filename);
  const googleCalls = [];
  compileFunction(fs.readFileSync(filename, 'utf8'), ['module', 'require'], { filename })(module,
    name => name === './services/googlePhotos.js' ? { getCachedMediaItems: options => {
      googleCalls.push(options); return [{ url: 'g', loved: true, googleBaseUrl: 'secret' }];
    } } : name === './services/weather.js' ? {} : nativeRequire(name));
  const app = require('express')(), state = { currentCategory: 'Other', photosList: [], excludedKeywords: [] };
  const collections = { A: [{ url: 'a', loved: true, comment: 'private' }] };
  module.exports({ app, state, collections, getWeatherData: () => null, setWeatherData: () => assert.fail(),
    io: { emit: () => assert.fail('emit') }, port: 0, dispatchCommand: () => assert.fail('dispatch') });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const before = JSON.stringify({ state, collections });
    const response = await fetch(origin + '/api/admin/permanent-gallery?page=1&pageSize=24&category=Other');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json(); assert.equal(body.total, 2);
    assert.ok(!JSON.stringify(body).includes('secret')); assert.ok(!JSON.stringify(body).includes('private'));
    assert.deepEqual(googleCalls, [{ readOnly: true, includeUnavailable: true }]);
    const invalid = await fetch(origin + '/api/admin/permanent-gallery?pageSize=2000'); assert.equal(invalid.status, 400);
    assert.equal(googleCalls.length, 1); assert.equal(JSON.stringify({ state, collections }), before);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('client read plan is GET-only and validates bounded response shape', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../../client/src/state/permanentGallery.js'), 'utf8');
  const { permanentGalleryRequest, readPermanentGallery } = await import('data:text/javascript,' + encodeURIComponent(source));
  assert.deepEqual(permanentGalleryRequest(2), { path: '/api/admin/permanent-gallery?page=2&pageSize=24', options: { method: 'GET', cache: 'no-store' } });
  const empty = { page: 1, pageSize: 24, pages: 1, total: 0, photos: [] };
  assert.deepEqual(readPermanentGallery(empty), empty);
  for (const patch of [{ page: 0 }, { total: -1 }, { pages: 2 }, { pageSize: 100 }, { total: 1 }, { photos: [null] }]) {
    assert.throws(() => readPermanentGallery({ ...empty, ...patch }), /Invalid permanent/);
  }
});


test('saved attribution is optional read-only text, never private comments or fabricated provenance', async () => {
  const collections={A:[{url:'artist',loved:true,author:'  Artist name  ',comment:'private'},
    {url:'unknown',loved:true,author:7},{url:'blank',loved:true,author:'  '}]};
  const before=JSON.stringify(collections);
  const result=projectPermanentGallery({collections,page:1,pageSize:24});
  assert.deepEqual(result.photos.map(p=>p.author),['Artist name',null,null]);
  assert(!JSON.stringify(result).includes('private'));assert.equal(JSON.stringify(collections),before);
  const source=fs.readFileSync(path.join(__dirname,'../../client/src/state/permanentGallery.js'),'utf8');
  const {readPermanentGallery}=await import('data:text/javascript,'+encodeURIComponent(source));
  assert.equal(readPermanentGallery(result),result);
  assert.throws(()=>readPermanentGallery({...result,photos:result.photos.map((p,i)=>i? p:{...p,author:9})}),/Invalid permanent/);
  assert.equal(readPermanentGallery({...result,photos:result.photos.map(({author,...p})=>p)}).photos.length,3);
});
