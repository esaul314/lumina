'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { parseArgs, TextDecoder } = require('node:util');

const git = (...args) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(execFileSync('git', args, {
  stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000
}));
const names = (value) => value.split('\0').filter(Boolean).sort();
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function relativeFile(name) {
  if (typeof name !== 'string' || name.includes('\\') || name.includes('\0')
    || name.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Expected a repository-relative file path');
  }
  return name;
}

function hashFile(name) {
  const target = path.join(process.cwd(), relativeFile(name));
  try {
    if (!fs.lstatSync(target).isFile() || fs.realpathSync(target) !== target) {
      throw new Error('Evidence inputs must be regular files without symlinks: ' + name);
    }
    return digest(fs.readFileSync(target));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const hashes = (files) => Object.fromEntries([...new Set(files)].sort().map((name) => [name, hashFile(name)]));
const inventory = () => names(git('ls-files', '--cached', '--others', '--exclude-standard', '-z'));

function capture(artifacts = []) {
  if (git('rev-parse', '--show-toplevel').trim() !== fs.realpathSync(process.cwd())) {
    throw new Error('Run from the repository root');
  }
  const built = hashes(artifacts);
  if (Object.values(built).some((hash) => hash === null)) throw new Error('Explicit artifacts must exist');
  return {
    schema: 1, head: git('rev-parse', 'HEAD').trim(), node: process.version,
    files: hashes(inventory()), artifacts: built
  };
}

function validate(value) {
  const validHashes = (items) => record(items) && Object.entries(items).every(([name, hash]) => (
    relativeFile(name) && (hash === null || (typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)))
  ));
  if (!record(value) || value.schema !== 1 || ! /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.head)
    || !/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value.node) || !validHashes(value.files)
    || !validHashes(value.artifacts)) throw new Error('Malformed candidate evidence');
  return value;
}

/** Pure comparison: matching bytes are evidence, never test/review acceptance. */
function compare(expected, actual) {
  const changes = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort().filter((name) => before[name] !== after[name]);
  const files = changes(expected.files, actual.files);
  const artifacts = changes(expected.artifacts, actual.artifacts);
  const headChanged = expected.head !== actual.head;
  const nodeChanged = expected.node !== actual.node;
  return { ok: !headChanged && !nodeChanged && !files.length && !artifacts.length,
    headChanged, nodeChanged, files, artifacts };
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { artifact: { type: 'string', multiple: true }, help: { type: 'boolean' } }
  });
  if (values.help) {
    console.log('From repo root: node tools/candidate-evidence.js capture [--artifact RELATIVE_FILE] > IGNORED_EVIDENCE.json\n'
      + 'node tools/candidate-evidence.js verify IGNORED_EVIDENCE.json\nExit 0: match; 1: differences; 2: invalid input/I/O. No tests, review, deployment or authorization.');
    return;
  }
  const [command, filename] = positionals;
  if (command === 'capture' && positionals.length === 1) {
    // ponytail: no runner/controller; callers retain test logs and review judgment.
    console.log(JSON.stringify(capture(values.artifact), null, 2));
    return;
  }
  if (command !== 'verify' || positionals.length !== 2 || values.artifact) {
    throw new Error('Use --help for capture/verify usage');
  }
  const expected = validate(JSON.parse(fs.readFileSync(filename, 'utf8')));
  const result = compare(expected, capture(Object.keys(expected.artifacts)));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
}

module.exports = { compare };
