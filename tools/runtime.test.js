'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const pin = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
assert.match(pin, /^\d+\.\d+\.\d+$/);

const fixture = (t, version = 'v' + pin) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-runtime-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  fs.mkdirSync(bin);
  const writeExecutable = (name, body) => {
    const target = path.join(bin, name);
    fs.writeFileSync(target, '#!/bin/sh\n' + body + '\n', { mode: 0o755 });
    return target;
  };
  const node = writeExecutable('node', 'if [ "$1" = "--version" ]; then printf "%s\\n" "$LUMINA_TEST_NODE_VERSION"; exit 0; fi\nexit 90');
  writeExecutable('systemctl', 'printf "%s\\n" "$*" >> "$LUMINA_TEST_CTL_LOG"');
  writeExecutable('ss', 'printf "LISTEN 0 0 127.0.0.1:5000 0.0.0.0:*\\n"');
  const controlLog = path.join(directory, 'systemctl.log');
  const config = path.join(directory, 'config');
  const unit = path.join(config, 'systemd/user/lumina.service');
  const env = {
    ...process.env, HOME: directory, XDG_CONFIG_HOME: config,
    PATH: bin + ':/usr/bin:/bin', NODE_BIN: node,
    LUMINA_TEST_NODE_VERSION: version, LUMINA_TEST_CTL_LOG: controlLog
  };
  const run = script => spawnSync('bash', [path.join(root, script)], {
    cwd: root, env, encoding: 'utf8', timeout: 5000
  });
  return { directory, bin, node, unit, controlLog, run };
};

test('runtime mismatch cannot overwrite an existing unit or call systemctl', t => {
  const f = fixture(t, 'v0.0.0');
  fs.mkdirSync(path.dirname(f.unit), { recursive: true });
  fs.writeFileSync(f.unit, 'incumbent unit\n');
  const result = f.run('scripts/install-systemd-user-service.sh');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Node runtime mismatch/);
  assert.equal(fs.readFileSync(f.unit, 'utf8'), 'incumbent unit\n');
  assert.equal(fs.existsSync(f.controlLog), false);
});

test('qualified runtime drives both ExecStart and service PATH', t => {
  const f = fixture(t);
  const result = f.run('scripts/install-systemd-user-service.sh');
  assert.equal(result.status, 0, result.stderr);
  const unit = fs.readFileSync(f.unit, 'utf8');
  assert.ok(unit.includes('ExecStart=' + f.node + ' ' + root + '/server.js'));
  assert.ok(unit.includes('Environment=PATH=' + f.bin + ':' + f.directory + '/.local/bin:'));
  assert.doesNotMatch(unit, /__[A-Z_]+__/);
  assert.equal(fs.readFileSync(f.controlLog, 'utf8'), '--user daemon-reload\n--user enable --now lumina.service\n');
});

test('manual launch refuses a mismatched runtime before touching the daemon', t => {
  const f = fixture(t, 'v0.0.0');
  const result = f.run('launch.sh');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Node runtime mismatch/);
  assert.equal(fs.existsSync(f.controlLog), false);
});

test('manual launch retains its occupied-port duplicate guard', t => {
  const f = fixture(t);
  const result = f.run('launch.sh');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /already listening on port 5000/);
  assert.equal(fs.existsSync(f.controlLog), false);
});
