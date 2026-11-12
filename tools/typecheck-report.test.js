'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { categoryFor, summarize, statusFor } = require('./typecheck-report.js');

const root = path.resolve(__dirname, '..');
const diagnostic = (fileName, code) => ({ file: fileName && { fileName: path.join(root, fileName) }, code });

test('diagnostic grouping partitions roots, fixtures, transitives, and missing locations', () => {
  const inputs = [diagnostic('server/domain/commands.js', 1), diagnostic('type-fixtures/domain.ts', 2),
    diagnostic('server/domain/snapshot.js', 3), diagnostic(null, 4)];
  const groups = summarize(root)(inputs);
  assert.deepEqual(Object.values(groups).map((items) => items.length), [1, 1, 1, 1]);
  assert.deepEqual(Object.values(groups).flat().map(({ code }) => code).sort(), [1, 2, 3, 4]);
  assert.equal(categoryFor(root)(diagnostic('server/domain/commands.js.extra', 5)), 'transitive modules');
  assert.deepEqual(Object.values(summarize(root)([])).map((items) => items.length), [0, 0, 0, 0]);
});

test('the diagnostic command fails on any reported diagnostic and can become green', () => {
  assert.equal(statusFor([]), 0);
  assert.equal(statusFor([diagnostic('type-fixtures/domain.ts', 2578)]), 1);
  assert.equal(statusFor([diagnostic(null, 1)]), 1);
});

test('compile-time fixtures check positive cases and detect a weakened negative assertion', () => {
  const configPath = path.join(root, 'tsconfig.domain.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.options.noEmit, true);
  const fixturePath = path.join(root, 'type-fixtures/domain.ts');
  const original = fs.readFileSync(fixturePath, 'utf8');
  const mutated = original.replace("type: 'not-a-command'", "type: 'set-scale-mode'");
  assert.notEqual(mutated, original);
  const reducerPath = path.join(root, 'server/domain/reducer.js');
  const reducerSource = fs.readFileSync(reducerPath, 'utf8');
  // Check the private factory in its own lexical scope without adding exports.
  const readerFixture = `
    /** @type {DomainState} */ const fixtureState = /** @type {DomainState} */ ({});
    const fixtureReader = readPatchField('x', (value, state, patch) => {
      /** @type {unknown} */ const raw = value;
      /** @type {DomainState} */ const sameState = state;
      /** @type {unknown} */ const samePatch = patch;
      return 7;
    });
    /** @type {number | typeof PATCH_SKIP} */ const fixtureResult = fixtureReader({}, fixtureState);
    const fixtureIdentity = readPatchField('x');
    /** @type {unknown} */ const fixtureRaw = fixtureIdentity({}, fixtureState);
    /** @type {number} */
    // @ts-expect-error an omitted normalizer does not guarantee a number
    const fixtureUnsafeIdentity = fixtureIdentity({}, fixtureState);
    /** @type {number} */
    // @ts-expect-error missing fields may return the skip sentinel
    const fixtureUnsafeResult = fixtureReader({}, fixtureState);
    // @ts-expect-error a normalizer must accept an unknown raw value
    readPatchField('x', (/** @type {string} */ value) => value);
    /** @type {unknown} */ const fixtureCandidate = {};
    // @ts-expect-error unchecked candidates cannot be indexed
    fixtureCandidate.field;
    if (isPlainObject(fixtureCandidate)) {
      /** @type {unknown} */ const fixtureField = fixtureCandidate.field;
      // @ts-expect-error property values remain unknown
      /** @type {string} */ const fixtureString = fixtureCandidate.field;
    }
    const fixtureSpec = createConfigPatchSpec('theme', {
      readValue: () => 42,
      hasChanged: (state, value) => value > 0,
      applyValue: (state, value) => ({ ...state, config: { ...state.config, theme: value } }),
      flags: { refreshWeather: 'truthy' }
    });
    /** @type {number | typeof PATCH_SKIP} */ const fixtureSpecRead = fixtureSpec.readValue({}, fixtureState);
    // @ts-expect-error custom readers do not accept string values in their callbacks
    fixtureSpec.hasChanged(fixtureState, 'wrong');
    const fixtureDefaultSpec = createConfigPatchSpec('theme');
    // @ts-expect-error the default reader retains unknown values
    /** @type {number} */ const fixtureDefaultRead = fixtureDefaultSpec.readValue({}, fixtureState);
    // @ts-expect-error a custom comparator without a reader must accept unknown values
    createConfigPatchSpec('theme', { hasChanged: (state, /** @type {number} */ value) => value > 0 });
    /** @type {PatchContext} */ const fixtureContext = {
      patch: {}, nextState: fixtureState, changed: false, recomputePhotos: false, refreshWeather: false
    };
    const fixtureSharedSpec = createPatchSpec({
      readValue: () => 'value',
      hasChanged: (state, value) => value.length > 0,
      applyValue: (state, value) => ({ ...state, config: { ...state.config, theme: value } })
    });
    /** @type {PatchContext} */ const fixtureApplied = applyPatchSpec(fixtureContext, fixtureSharedSpec);
    // @ts-expect-error callbacks retain their shared string result type
    fixtureSharedSpec.applyValue(fixtureState, 2);
    // @ts-expect-error a spec requires a writer
    createPatchSpec({ readValue: () => 1, hasChanged: () => true });
    const fixtureWidgets = readWidgetPatch({}, fixtureState);
    if (fixtureWidgets !== PATCH_SKIP) {
      /** @type {boolean | undefined} */ const maybeWidget = fixtureWidgets.missing;
      // @ts-expect-error arbitrary widget keys can be absent
      /** @type {boolean} */ const presentWidget = fixtureWidgets.missing;
      // @ts-expect-error normalized values cannot be strings
      fixtureWidgets.clock = 'visible';
    }
  `;
  const host = ts.createCompilerHost(parsed.options);
  const readFile = host.readFile.bind(host);
  host.readFile = (fileName) => {
    const resolved = path.resolve(fileName);
    if (resolved === fixturePath) return mutated;
    if (resolved === reducerPath) return reducerSource + readerFixture;
    return readFile(fileName);
  };
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const commandsPath = path.join(root, 'server/domain/commands.js');
  const commands = program.getSourceFile(commandsPath);
  const decoder = commands.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'decodeStatePatchCommand');
  assert.ok(decoder);
  assert.deepEqual(diagnostics.filter((item) => item.file === commands && item.code === 18046 &&
    item.start >= decoder.getStart(commands) && item.start < decoder.end), []);
  const readerDiagnostics = diagnostics.filter((item) => item.file &&
    path.resolve(item.file.fileName) === reducerPath && item.start >= reducerSource.length);
  assert.deepEqual(readerDiagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
  const fixtureDiagnostics = diagnostics
    .filter((item) => item.file && path.resolve(item.file.fileName) === fixturePath);
  // Only the intentionally weakened check may fail.
  const lines = mutated.split('\n');
  const located = fixtureDiagnostics.map((item) => ({
    code: item.code,
    line: lines[item.file.getLineAndCharacterOfPosition(item.start).line]
  }));
  assert.equal(located.filter(({ code }) => code === 2578).length, 1);
  assert.ok(located.every(({ code, line }) => (
    code === 2578 && line.includes('@ts-expect-error unrecognized commands')
  )));
});
