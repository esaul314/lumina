// Owned runtime teardown: injected effects only, no real desktop or source calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEcowittRuntime } = require('../services/ecowitt.js');
const { createIdleDaemonRuntime } = require('./idleDaemon.js');
const { createPoolScheduleRuntime } = require('./poolSchedule.js');
const { createKioskControlRuntime } = require('./kioskControl.js');

const quiet = { log() {}, warn() {}, error() {} };
const flush = () => new Promise(setImmediate);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const clock = () => {
  const callbacks = [], cleared = new Set();
  return { callbacks, cleared, set: fn => callbacks.push(fn) - 1, clear: id => cleared.add(id) };
};
const settings = { enabled: true, baseUrl: 'http://sensor.example.test', timeoutMs: 5000, pollIntervalMs: 10000 };

test('sensor stop aborts in-flight timeout/fetch, suppresses stale readings and handles timer id zero', async () => {
  const timers = clock(), signals = [], readings = [];
  const runtime = createEcowittRuntime({
    settings, log: quiet, onReading: value => readings.push(value),
    setIntervalImpl: timers.set, clearIntervalImpl: timers.clear,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signals.push(signal); signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })
  });
  runtime.start(); runtime.start();
  assert.equal(timers.callbacks.length, 1);
  const pending = runtime.readEnvironment();
  runtime.stop();
  await pending;
  assert.equal(signals[0].aborted, true);
  assert.equal(timers.cleared.has(0), true);
  assert.deepEqual(readings, []);
  timers.callbacks[0]();
  assert.equal(signals.length, 1, 'queued stopped poll must not start another fetch');
  runtime.stop();
});

test('a source ignoring abort cannot publish a late successful reading after stop', async () => {
  const pending = deferred(), readings = [];
  const runtime = createEcowittRuntime({ settings, log: quiet, onReading: value => readings.push(value),
    fetchImpl: () => pending.promise });
  const read = runtime.readEnvironment();
  runtime.stop();
  pending.resolve({ ok: true, json: async () => ({}) });
  await read;
  assert.deepEqual(readings, []);
});

test('same-source setting updates retain in-flight reads while public stop aborts them', async () => {
  const timers = clock(), pending = deferred(), readings = [];
  let signal;
  const runtime = createEcowittRuntime({ settings, log: quiet,
    setIntervalImpl: timers.set, clearIntervalImpl: timers.clear,
    onReading: value => readings.push(value),
    fetchImpl: (_url, options) => { signal = options.signal; return pending.promise; } });
  runtime.start();
  const read = runtime.readEnvironment();
  assert.equal(runtime.updateSettings({ ...settings, units: { temperature: 'F' } }).valid, true);
  assert.equal(signal.aborted, false);
  pending.resolve({ ok: true, json: async () => ({}) });
  await read;
  assert.equal(readings.length, 1);
  runtime.stop();
});

test('sensor teardown still aborts requests if interval cleanup throws and can retry', async () => {
  const timers = clock(), pending = deferred(); let clears = 0, signal;
  const runtime = createEcowittRuntime({ settings, log: quiet, setIntervalImpl: timers.set,
    clearIntervalImpl: id => { if (++clears === 1) throw new Error('clear failed'); timers.clear(id); },
    fetchImpl: (_url, options) => { signal = options.signal; return pending.promise; } });
  runtime.start(); const read = runtime.readEnvironment();
  assert.throws(() => runtime.stop(), /clear failed/);
  assert.equal(signal.aborted, true);
  runtime.stop();
  pending.resolve({ ok: true, json: async () => ({}) }); await read;
  assert.equal(timers.cleared.has(0), true);
});

test('stopping an idle tick prevents later adapter calls, kiosk launch and state emission', async () => {
  const timers = clock(), blocked = deferred(), calls = [];
  const runtime = createIdleDaemonRuntime({
    state: { inactivityTimeout: 0, screensaverActive: false },
    getRuntimeContext: () => ({ manualOverride: true }), log: quiet,
    setIntervalImpl: timers.set, clearIntervalImpl: timers.clear,
    getIdleTime: () => { calls.push('idle'); return blocked.promise; },
    isAudioPlaying: async () => { calls.push('audio'); return false; },
    isSessionInhibited: async () => { calls.push('inhibited'); return false; },
    launchKioskBrowser: () => calls.push('launch'), broadcastStateSync: () => calls.push('emit')
  });
  runtime.start(); timers.callbacks[0](); runtime.stop();
  blocked.resolve(10000); await flush(); timers.callbacks[0](); await flush();
  assert.deepEqual(calls, ['idle']);
  assert.equal(timers.cleared.has(0), true);
});

test('stopped pool schedule callbacks cannot start another evaluation', async () => {
  const timers = clock(); let evaluations = 0;
  const runtime = createPoolScheduleRuntime({ state: { currentCategory: 'A', poolPolicies: {} },
    collections: { A: [] }, setIntervalImpl: timers.set, clearIntervalImpl: timers.clear,
    getNow: () => { evaluations++; return new Date('2026-01-01T12:00:00Z'); }, log: quiet });
  runtime.start(); await flush(); runtime.stop(); timers.callbacks[0](); await flush();
  assert.equal(evaluations, 1);
  assert.equal(timers.cleared.has(0), true);
});

test('stopped deferred kiosk callbacks and blocked governor work cannot launch later', async () => {
  const timers = clock(), governor = deferred(); let listening = false, launches = 0;
  const runtime = createKioskControlRuntime({ state: {}, log: quiet, getPort: () => 0,
    isServerListening: () => listening, setTimeoutImpl: timers.set, clearTimeoutImpl: timers.clear,
    setCpuGovernor: profile => profile === 'performance' ? governor.promise : Promise.resolve(),
    launchChromiumKiosk: () => { launches++; return { kill() {} }; } });
  assert.equal(runtime.launchKioskBrowser(true), false);
  runtime.killKioskBrowser(true); listening = true; timers.callbacks[0]();
  assert.equal(launches, 0);
  runtime.launchKioskBrowser(true); runtime.killKioskBrowser(true);
  governor.resolve(); await flush();
  assert.equal(launches, 0);
  assert.equal(runtime.isBrowserRunning(), false);
});

for (const failure of ['throw', 'reject']) {
  test(`CPU restore ${failure} cannot block owned kiosk teardown`, async () => {
    let kills = 0; const warnings = [];
    const runtime = createKioskControlRuntime({ state: {}, getPort: () => 0,
      isServerListening: () => true, log: { ...quiet, warn: (...args) => warnings.push(args) },
      setCpuGovernor: profile => {
        if (profile === 'performance') return Promise.resolve();
        if (failure === 'throw') throw new Error('policy unavailable');
        return Promise.reject(new Error('policy unavailable'));
      }, launchChromiumKiosk: () => ({ kill: signal => { assert.equal(signal, 'SIGTERM'); kills++; } }) });
    runtime.launchKioskBrowser(); await flush();
    assert.equal(runtime.killKioskBrowser(true), true); await flush();
    assert.equal(kills, 1); assert.equal(warnings.length, 1);
    assert.equal(runtime.killKioskBrowser(), false);
  });
}

test('failed kiosk kill retains its handle for retry, and old exits cannot clear a new child', async () => {
  let kills = 0; const exits = [];
  const runtime = createKioskControlRuntime({ state: {}, getPort: () => 0, isServerListening: () => true, log: quiet,
    setCpuGovernor: async () => {}, launchChromiumKiosk: (_port, _mode, onExit) => {
      exits.push(onExit); return { kill() { if (++kills === 1) throw new Error('kill failed'); } };
    } });
  runtime.launchKioskBrowser(); await flush();
  assert.throws(() => runtime.killKioskBrowser(), /kill failed/);
  assert.equal(runtime.launchKioskBrowser(), false, 'do not overwrite a still-owned handle');
  assert.equal(runtime.killKioskBrowser(), true);
  runtime.launchKioskBrowser(); await flush();
  exits[0](); assert.equal(runtime.isBrowserRunning(), true);
  runtime.killKioskBrowser(); assert.equal(runtime.isBrowserRunning(), false);
});

test('a non-Error CPU rejection is contained without losing owned teardown', async () => {
  let kills = 0; const warnings = [];
  const runtime = createKioskControlRuntime({ state: {}, getPort: () => 0, isServerListening: () => true,
    log: { ...quiet, warn: (...args) => warnings.push(args) },
    setCpuGovernor: profile => profile === 'performance' ? Promise.resolve() : Promise.reject(null),
    launchChromiumKiosk: () => ({ kill() { kills++; } }) });
  runtime.launchKioskBrowser(); await flush(); runtime.killKioskBrowser(); await flush();
  assert.equal(kills, 1); assert.equal(warnings[0][1], 'null');
});
