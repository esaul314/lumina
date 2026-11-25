const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { photoCommentKey, normalizePhotoComment, readPhotoComments, withPhotoComment } = require('../domain/photoComments.js');
const { createPhotoCommentStore } = require('./photoComments.js');
const { saveCollectionsSnapshot, loadCollectionsSnapshot } = require('../config/collectionsCodec.js');
const { mergeSyncedMediaItems } = require('./googlePhotosCache.js');

const photo = { url: 'https://images.example.test/a.jpg', rating: 7, title: 'Caption' };
function fixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-comments-'));
  const jsonPath = path.join(dir, 'collections.json');
  const original = { feeds: { A: [photo], B: [{ ...photo }] }, lastFeedUpdated: 123, custom: { keep: true } };
  fs.writeFileSync(jsonPath, JSON.stringify(original));
  try { return run({ jsonPath, original, store: createPhotoCommentStore({ jsonPath }) }); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('comment identity is pool-independent and Google render-option independent', () => {
  assert.equal(photoCommentKey(photo), photoCommentKey({ ...photo, category: 'Other' }));
  assert.notEqual(photoCommentKey(photo), photoCommentKey({ url: photo.url + '?v=2' }));
  assert.equal(photoCommentKey({ url: '/api/google-photos/media/a%2Fb?w=20' }), 'google:a/b');
  assert.equal(photoCommentKey({ url: '/api/google-photos/media/a%2Fb?h=80&c=1' }), 'google:a/b');
  assert.equal(photoCommentKey({ url: '/api/google-photos/media/%xx' }), null);
  [null, {}, { url: 1 }, { url: '' }].forEach(row => assert.equal(photoCommentKey(row), null));
});

test('plain text normalization and immutable comment update/clear', () => {
  [undefined, null, 1, {}, [], 'x'.repeat(2001)].forEach(value => assert.equal(normalizePhotoComment(value), null));
  assert.equal(normalizePhotoComment('  <b>Human</b>\n note  '), '<b>Human</b>\n note');
  assert.equal(normalizePhotoComment(' '.repeat(2000)), '');
  const empty = Object.freeze({ version: 1, entries: Object.freeze({}) });
  const added = withPhotoComment('url:a', 'Note', empty);
  assert.deepEqual(withPhotoComment('url:a', '', added), empty);
  assert.deepEqual(withPhotoComment('url:a', 'Note', added), added);
  assert.deepEqual(empty.entries, {});
});

test('legacy private metadata defaults empty; malformed versions/text fail closed', () => {
  assert.deepEqual(readPhotoComments(undefined), { version: 1, entries: {} });
  [null, [], {}, { version: 2, entries: {} }, { version: 1, entries: [] },
    { version: 1, entries: { 'url:a': null } }, { version: 1, entries: { nope: 'text' } },
    { version: 1, entries: { 'url:a': ' untrimmed ' } }]
    .forEach(value => assert.throws(() => readPhotoComments(value), /Private photo comments/));
});

test('durable create/read/edit/clear survives reconstruction without changing photo metadata', () => fixture(({ jsonPath, store, original }) => {
  assert.equal(store.read(photo).comment, '');
  store.write(photo, '  My note  ');
  assert.equal(createPhotoCommentStore({ jsonPath }).read(photo).comment, 'My note');
  store.write({ ...photo, category: 'B' }, 'Edited');
  assert.equal(store.read(photo).comment, 'Edited');
  assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath)).feeds, original.feeds);
  assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath)).custom, original.custom);
  assert.equal(fs.statSync(jsonPath).mode & 0o777, 0o600);
  store.write(photo, '');
  assert.equal(store.read(photo).comment, '');
  assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath)).privatePhotoComments.entries, {});
  assert.ok(!fs.existsSync(jsonPath + '.tmp'));
}));

test('normal collection save/load, pruning and duplicate cleanup retain private dictionary', () => fixture(({ jsonPath, store }) => {
  store.write(photo, 'Retained');
  saveCollectionsSnapshot({ jsonPath, collections: { A: [photo], B: [photo] }, state: {}, lastFeedUpdated: 456 });
  const snapshot = loadCollectionsSnapshot({ jsonPath, defaultCollections: {}, defaultState: {}, buildFeedConfigsFromKeywords: () => ({}) });
  assert.ok(!JSON.stringify(snapshot).includes('Retained'));
  assert.equal(store.read(photo).comment, 'Retained');
  saveCollectionsSnapshot({ jsonPath, collections: { A: [] }, state: {} });
  assert.equal(createPhotoCommentStore({ jsonPath }).read(photo).comment, 'Retained');
  assert.equal(JSON.parse(fs.readFileSync(jsonPath)).lastFeedUpdated, 456);
}));

test('Google sync and changed signed URLs keep stable private annotation without cache injection', () => fixture(({ store }) => {
  const a = { id: 'id', url: '/api/google-photos/media/id?w=20', googleBaseUrl: 'old', rating: 9 };
  store.write(a, 'Private');
  const [refreshed] = mergeSyncedMediaItems([{ ...a, url: '/api/google-photos/media/id?w=200', googleBaseUrl: 'fresh' }], [a]);
  assert.equal(store.read(refreshed).comment, 'Private');
  assert.equal(refreshed.rating, 9);
  assert.ok(!JSON.stringify(refreshed).includes('Private'));
}));

test('corrupt collection/private data and read failures never overwrite the original', () => fixture(({ jsonPath, store }) => {
  for (const content of ['{', '[]', '{"privatePhotoComments":{"version":2,"entries":{}}}']) {
    fs.writeFileSync(jsonPath, content);
    assert.throws(() => store.write(photo, 'Must not save'));
    assert.equal(fs.readFileSync(jsonPath, 'utf8'), content);
  }
  fs.unlinkSync(jsonPath);
  assert.throws(() => store.write(photo, 'Must not recreate'));
  assert.ok(!fs.existsSync(jsonPath));
}));

test('failed write or rename preserves original and cleans only the task temporary file', () => fixture(({ jsonPath }) => {
  const before = fs.readFileSync(jsonPath);
  for (const operation of ['writeFileSync', 'renameSync']) {
    const fsImpl = { ...fs, [operation]() { throw new Error('Injected ' + operation); } };
    assert.throws(() => createPhotoCommentStore({ jsonPath, fsImpl }).write(photo, 'Private'), /Injected/);
    assert.deepEqual(fs.readFileSync(jsonPath), before);
    assert.ok(!fs.existsSync(jsonPath + '.tmp'));
  }
}));

test('equal write/empty clear needs no filesystem mutation', () => fixture(({ jsonPath, store }) => {
  store.write(photo, 'Note');
  const fsImpl = { ...fs, writeFileSync() { throw new Error('Unexpected write'); } };
  const unchanged = createPhotoCommentStore({ jsonPath, fsImpl });
  assert.equal(unchanged.write(photo, 'Note').comment, 'Note');
  assert.equal(unchanged.write({ url: 'https://images.example.test/missing' }, '').comment, '');
}));


test('generated identity keys round-trip for encoded line breaks and reserved names', () => fixture(({ store }) => {
  ['\n', '\r', '\u2028', '__proto__', 'constructor', 'a/b', '#?%'].forEach(id => {
    const row = { url: `/api/google-photos/media/${encodeURIComponent(id)}?w=20` };
    store.write(row, 'Retained');
    assert.equal(store.read(row).comment, 'Retained');
  });
}));

test('normal-save and startup-dedup partial-write/rename failures preserve original', () => fixture(({ jsonPath, store }) => {
  store.write(photo, 'Private');
  const before = fs.readFileSync(jsonPath);
  // Isolate the codec filesystem dependency; never patch global fs.
  const { compileFunction } = require('node:vm');
  const { createRequire } = require('node:module');
  const filename = require.resolve('../config/collectionsCodec.js');
  const localRequire = createRequire(filename);
  ['writeFileSync', 'renameSync'].forEach(operation => {
    const injected = { ...fs, [operation](target) {
      if (operation === 'writeFileSync') fs.writeFileSync(target, before.subarray(0, 48));
      throw new Error('Injected ' + operation);
    } };
    const module = { exports: {} };
    compileFunction(fs.readFileSync(filename, 'utf8'), ['require', 'module', 'exports'], { filename })(
      name => name === 'fs' ? injected : localRequire(name), module, module.exports
    );
    assert.throws(() => module.exports.saveCollectionsSnapshot({ jsonPath, collections: {}, state: {} }), /Injected/);
    assert.deepEqual(fs.readFileSync(jsonPath), before);
    module.exports.loadCollectionsSnapshot({ jsonPath, defaultCollections: {}, defaultState: {}, buildFeedConfigsFromKeywords: () => ({}) });
    assert.deepEqual(fs.readFileSync(jsonPath), before);
    assert.ok(!fs.existsSync(jsonPath + '.tmp'));
  });
}));
