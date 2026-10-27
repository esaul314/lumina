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
  const host = ts.createCompilerHost(parsed.options);
  const readFile = host.readFile.bind(host);
  host.readFile = (fileName) => path.resolve(fileName) === fixturePath ? mutated : readFile(fileName);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  const fixtureDiagnostics = ts.getPreEmitDiagnostics(program)
    .filter((item) => item.file && path.resolve(item.file.fileName) === fixturePath);
  // Only the intentionally weakened check and the two known inference
  // assertions may fail. The latter can disappear as contracts improve.
  const lines = mutated.split('\n');
  const located = fixtureDiagnostics.map((item) => ({
    code: item.code,
    line: lines[item.file.getLineAndCharacterOfPosition(item.start).line]
  }));
  assert.equal(located.filter(({ code }) => code === 2578).length, 1);
  assert.ok(located.every(({ code, line }) => (
    (code === 2578 && line.includes('@ts-expect-error unrecognized commands')) ||
    (code === 2344 && /^type (CurriedPatchIsNotAny|HandlerResultIsNotAny) =/.test(line))
  )));
});
