'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const tool = path.join(__dirname, 'candidate-evidence.js');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000
  });
  const write = (name, value) => fs.writeFileSync(path.join(root, name), value);
  git('init', '--quiet');
  write('.gitignore', 'private.json\n.evidence/\n');
  write('app.js', 'original\n');
  write('package-lock.json', 'locked\n');
  git('add', '--all');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
    'commit', '--quiet', '-m', 'fixture baseline');
  fs.mkdirSync(path.join(root, '.evidence'));
  write('private.json', 'never include ignored data\n');
  const run = (...args) => spawnSync(process.execPath, [tool, ...args], {
    cwd: root, encoding: 'utf8', timeout: 5000
  });
  const capture = (...args) => {
    const result = run('capture', ...args);
    assert.equal(result.status, 0, result.stderr);
    write('.evidence/candidate.json', result.stdout);
    return JSON.parse(result.stdout);
  };
  const verify = () => run('verify', '.evidence/candidate.json');
  return { root, git, write, run, capture, verify };
}

test('capture and verify bind tracked, new, ignored and explicit artifact inputs', t => {
  const f = fixture(t);
  f.write('new-module.js', 'new code\n');
  f.write('.evidence/index.html', 'built bytes\n');
  const before = f.capture('--artifact', '.evidence/index.html');
  assert.equal(before.files['private.json'], undefined);
  assert.ok(before.files['new-module.js']);
  assert.ok(before.artifacts['.evidence/index.html']);
  assert.equal(f.verify().status, 0);
  f.write('private.json', 'unrelated live churn\n');
  assert.equal(f.verify().status, 0);
  f.write('.evidence/index.html', 'changed build\n');
  const result = f.verify();
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).artifacts, ['.evidence/index.html']);
});

test('changed, added, removed and deleted working inputs invalidate evidence', t => {
  const f = fixture(t);
  f.write('new-module.js', 'first\n');
  f.capture();
  f.write('app.js', 'changed\n');
  f.write('later.js', 'new after freeze\n');
  fs.unlinkSync(path.join(f.root, 'new-module.js'));
  fs.unlinkSync(path.join(f.root, 'package-lock.json'));
  const result = f.verify();
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).files, [
    'app.js', 'later.js', 'new-module.js', 'package-lock.json'
  ]);
});

test('head and runtime drift cannot silently reuse acceptance', t => {
  const f = fixture(t);
  const before = f.capture();
  f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
    'commit', '--allow-empty', '--quiet', '-m', 'new head');
  let result = f.verify();
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).headChanged, true);
  const current = f.capture();
  f.write('.evidence/candidate.json', JSON.stringify({ ...current, node: 'v0.0.0' }));
  result = f.verify();
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).nodeChanged, true);
  assert.notEqual(before.head, current.head);
});

test('malformed manifests, traversal and symlink artifacts fail closed', t => {
  const f = fixture(t);
  f.capture();
  f.write('.evidence/candidate.json', '{"schema":1}');
  assert.equal(f.verify().status, 2);
  f.write('.evidence/candidate.json', '{');
  assert.equal(f.verify().status, 2);
  for (const name of ['../outside', '/etc/passwd', 'bad/../app.js']) {
    assert.equal(f.run('capture', '--artifact', name).status, 2);
  }
  fs.symlinkSync(path.join(f.root, 'private.json'), path.join(f.root, '.evidence/link'));
  assert.equal(f.run('capture', '--artifact', '.evidence/link').status, 2);
  assert.equal(f.run('capture', '--artifact', '.evidence/missing').status, 2);
  const before = f.capture();
  before.artifacts = { '../outside': 'a'.repeat(64) };
  f.write('.evidence/candidate.json', JSON.stringify(before));
  assert.equal(f.verify().status, 2);
  assert.equal(f.run('unknown').status, 2);
  assert.equal(f.run('--help').status, 0);
});


test('Git filenames decode losslessly or explicitly reject unsupported bytes', t => {
  const f = fixture(t);
  for (const name of ['odd-\ufffd.js', '\ufefffirst.js', 'with\nnewline.js']) {
    f.write(name, 'valid Unicode bytes');
  }
  const before = f.capture();
  assert.ok(before.files['odd-\ufffd.js']);
  assert.ok(before.files['\ufefffirst.js']);
  assert.equal(f.verify().status, 0);
  f.write('odd-\ufffd.js', 'changed valid bytes');
  assert.equal(f.verify().status, 1);
  f.git('rm', '--', '.gitignore', 'app.js', 'package-lock.json');
  fs.writeFileSync(path.join(f.root, '.git/info/exclude'), '.evidence/\nprivate.json\n');
  fs.unlinkSync(path.join(f.root, 'odd-\ufffd.js'));
  fs.unlinkSync(path.join(f.root, 'with\nnewline.js'));
  assert.deepEqual(Object.keys(f.capture().files), ['\ufefffirst.js']);
  const rawName = Buffer.concat([Buffer.from(f.root + path.sep + 'odd-'), Buffer.from([255])]);
  fs.writeFileSync(rawName, 'unsupported filename bytes');
  assert.equal(f.run('capture').status, 2);
  assert.equal(f.verify().status, 2);
  f.git('add', '--all');
  assert.equal(f.run('capture').status, 2);
});
