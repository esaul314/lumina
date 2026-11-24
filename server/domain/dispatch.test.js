// Concrete persistence boundaries: real dispatcher/core, isolated writers only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDomainDispatcher } = require('./dispatch.js');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const policyCommand = () => ({ type: 'set-pool-policy', payload: { name: 'A', policy: { maxPhotos: 500 } } });
const secretCommand = () => ({ type: 'save-env-secret', payload: { envKey: 'USEAPI_TOKEN', runtimeFlag: 'hasUseApiToken', value: 'fixture' } });
function harness(overrides = {}) {
  const photo = { url: 'fixture', title: 'Fixture', category: 'A', rating: 8 };
  const state = { currentCategory: 'A', photosList: [photo], activePhoto: photo, widgets: {}, poolPolicies: {},
    searchKeywords: { A: ['forest'] }, feedConfigs: {}, excludedKeywords: [], hasUseApiToken: false };
  const collections = { A: [photo] }, events = [];
  const dispatcher = createDomainDispatcher({ state, collections, io: { emit: (event, payload) => events.push([event, payload]) },
    persistCollections() {}, persistEnvVars() {}, ...overrides });
  return { state, collections, events, dispatcher };
}

test('persistence is awaited after state application and before later effects/events; aliases/results stay exact', async () => {
  const blocked = deferred(), entered = deferred(), order = [], received = [];
  const refreshed = Object.freeze({ refreshed: true });
  const h = harness({
    persistCollections: (collections, state) => {
      received.push([collections, state]); order.push('persist'); entered.resolve(); return blocked.promise;
    },
    refreshActiveFeed: payload => { order.push('refresh'); received.push(payload); return refreshed; }
  });
  const pending = h.dispatcher.dispatchCommand(policyCommand()); await entered.promise;
  assert.equal(h.state.poolPolicies.A.maxPhotos, 500);
  assert.equal(received[0][0], h.collections); assert.equal(received[0][1], h.state);
  assert.deepEqual(order, ['persist']); assert.deepEqual(h.events, []);
  blocked.resolve({ ignored: true }); const result = await pending;
  assert.deepEqual(order, ['persist', 'refresh']);
  assert.equal(result.effectResults[0].value, undefined, 'opaque collection-writer result remains ignored');
  assert.equal(result.effectResults[1].value, refreshed);
  assert.equal(result.effectResults[1].effect.payload, received[1]);
  assert.deepEqual(h.events.map(([event]) => event), ['state-sync']);
});

for (const mode of ['throw', 'reject']) {
  test(`collection writer ${mode} propagates without rollback, later effects or events`, async () => {
    const failure = new Error('write failed'), later = [];
    const h = harness({ persistCollections: () => { if (mode === 'throw') throw failure; return Promise.reject(failure); },
      refreshActiveFeed: () => later.push('refresh') });
    await assert.rejects(h.dispatcher.dispatchCommand(policyCommand()), error => error === failure);
    assert.equal(h.state.poolPolicies.A.maxPhotos, 500);
    assert.deepEqual(later, []); assert.deepEqual(h.events, []);
  });
}

test('environment persistence finishes before flags/events and retains input aliases with detached results', async () => {
  const entered = deferred(), blocked = deferred(); let received;
  const h = harness({ persistEnvVars: entries => { received = entries; entered.resolve(); return { then: resolve => blocked.promise.then(resolve) }; } });
  const pending = h.dispatcher.dispatchCommand(secretCommand()); await entered.promise;
  assert.equal(h.state.hasUseApiToken, false); assert.deepEqual(h.events, []);
  blocked.resolve('ignored'); const result = await pending;
  const effect = result.reducerResult.effects.find(({ type }) => type === 'persist-env-vars');
  const completed = result.effectResults.find(({ effect }) => effect.type === 'persist-env-vars');
  assert.equal(received, effect.payload.entries); assert.equal(received.USEAPI_TOKEN, 'fixture');
  assert.equal(h.state.hasUseApiToken, true);
  assert.notEqual(completed.value.entries, received); assert.deepEqual(completed.value.entries, received);
  assert.notEqual(completed.value.runtimeFlags, effect.payload.runtimeFlags);
  assert.deepEqual(h.events.map(([event]) => event), ['state-sync']);
});

for (const failure of [new Error('env failed'), null]) {
  test(`environment rejection ${failure === null ? 'null' : 'Error'} preserves old flags and suppresses events`, async () => {
    const h = harness({ persistEnvVars: () => Promise.reject(failure) });
    await assert.rejects(h.dispatcher.dispatchCommand(secretCommand()), error => error === failure);
    assert.equal(h.state.hasUseApiToken, false); assert.deepEqual(h.events, []);
  });
}

for (const [writer, command] of [['persistCollections', policyCommand], ['persistEnvVars', secretCommand]]) {
  test(`missing ${writer} fails at the effect, never substitutes hidden I/O or a silent no-op`, async () => {
    const h = harness({ [writer]: undefined });
    await assert.rejects(h.dispatcher.dispatchCommand(command()), TypeError);
    assert.deepEqual(h.events, []);
  });
}

test('importing the dispatcher loads no configuration, persistence, service or entrypoint modules', () => {
  const server = path.resolve(__dirname, '..') + path.sep;
  const applicationModules = Object.keys(require.cache).filter(filename => filename.startsWith(server) && !filename.endsWith('.test.js'));
  assert.ok(applicationModules.length > 0);
  assert.ok(applicationModules.every(filename => filename.startsWith(path.join(server, 'domain') + path.sep)
    || filename.startsWith(path.join(server, 'utils') + path.sep)), applicationModules.join('\n'));
});

test('core and client-state runtime imports keep the established pure dependency boundary (not a purity proof)', () => {
  const ts = require('typescript'), root = path.resolve(__dirname, '../..');
  const targets = [
    ...['types.js', 'commands.js', 'reducer.js', 'selectors.js'].map(name => path.join(__dirname, name)),
    ...fs.readdirSync(path.join(root, 'client/src/state')).filter(name => name.endsWith('.js')).map(name => path.join(root, 'client/src/state', name))
  ];
  targets.forEach(filename => {
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = node => {
      const specifier = ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly ? node.moduleSpecifier
        : ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' ? node.arguments[0] : null;
      if (specifier) {
        assert.equal(ts.isStringLiteralLike(specifier), true, filename);
        const value = specifier.text; assert.ok(value.startsWith('.'), `${filename}: ${value}`);
        const resolved = path.resolve(path.dirname(filename), value);
        const allowed = filename.includes('/client/src/state/')
          ? [path.join(root, 'client/src/state') + path.sep]
          : [path.join(root, 'server/domain') + path.sep, path.join(root, 'server/utils') + path.sep];
        assert.ok(allowed.some(prefix => resolved.startsWith(prefix)), `${filename}: ${value}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  });
});
