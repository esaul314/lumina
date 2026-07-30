const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const { readEnvVar } = require('../config/env.js');

// Discover system information dynamically for robust daemon paths
const userInfo = os.userInfo();
const uid = userInfo.uid || 1000;
const homedir = userInfo.homedir || os.homedir();

const BASE_CHROMIUM_FLAGS = Object.freeze([
  '--js-flags="--max-old-space-size=256"',
  '--disable-dev-shm-usage',
  '--disk-cache-size=52428800',
  '--media-cache-size=20971520',
  '--disable-gpu-shader-disk-cache',
  '--kiosk',
  '--no-first-run',
  '--new-window',
  '--enable-offline-auto-reload'
]);

const WAYLAND_PLATFORM_FLAGS = Object.freeze([
  '--ozone-platform=wayland',
  '--enable-features=UseOzonePlatform'
]);

const AGGRESSIVE_GPU_FLAGS = Object.freeze([
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
  '--enable-zero-copy',
  '--enable-native-gpu-memory-buffers'
]);
const DISPLAY_CONFIG_CMD = `DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${uid}/bus" gdbus call --session --dest org.gnome.Mutter.DisplayConfig --object-path /org/gnome/Mutter/DisplayConfig --method org.gnome.Mutter.DisplayConfig.GetCurrentState`;

function parseCurrentDisplayInfo(stdout) {
  if (!stdout) {
    return null;
  }

  const connectorMatch = stdout.match(/\(\('([^']+)', '([^']*)', '([^']*)', '([^']*)'\),/);
  const displayNameMatch = stdout.match(/'display-name': <'([^']+)'>/);
  const currentModeMatch = stdout.match(/\('([^']+)', (\d+), (\d+), ([0-9.]+), [\s\S]*?\{'is-current': <true>[\s\S]*?\}\)/);

  if (!connectorMatch) {
    return null;
  }

  const [, connector, vendor, product, serial] = connectorMatch;
  const [, modeName, width, height, refreshRate] = currentModeMatch || [];
  const displayName = displayNameMatch?.[1] || '';
  const makeModel = [vendor, product].filter(Boolean).join(' ').trim() || displayName || connector;

  return {
    connector,
    vendor,
    product,
    serial,
    displayName,
    makeModel,
    modeName: modeName || null,
    width: width ? Number(width) : null,
    height: height ? Number(height) : null,
    refreshRate: refreshRate ? Number(refreshRate) : null,
    source: 'mutter-displayconfig'
  };
}

function getChromiumAccelerationProfile() {
  const rawProfile = readEnvVar('LUMINA_CHROMIUM_ACCELERATION_PROFILE', 'safe').toLowerCase();
  return rawProfile === 'aggressive' ? 'aggressive' : 'safe';
}

function buildChromiumFlags({ platform = 'wayland' } = {}) {
  const flags = [
    ...BASE_CHROMIUM_FLAGS,
    ...(platform === 'wayland' ? WAYLAND_PLATFORM_FLAGS : [])
  ];

  if (getChromiumAccelerationProfile() === 'aggressive') {
    flags.push(...AGGRESSIVE_GPU_FLAGS);
  }

  return flags.join(' ');
}

function getHostDisplayInfo() {
  return new Promise((resolve) => {
    exec(DISPLAY_CONFIG_CMD, (err, stdout) => {
      if (err) {
        console.warn('System Service: Could not read host display info:', err.message);
        resolve(null);
        return;
      }

      resolve(parseCurrentDisplayInfo(stdout));
    });
  });
}

/**
 * ⚡ setCpuGovernor
 * Toggles the CPU scaling governor profiles (e.g. performance vs schedutil).
 */
function setCpuGovernor(profile) {
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    exec(`echo "${profile}" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor`, (err) => {
      if (err) {
        console.warn(`System Service: Could not set CPU governor to ${profile}:`, err.message);
        resolve(false);
      } else {
        console.log(`System Service: CPU governor scaled to ${profile}`);
        resolve(true);
      }
    });
  });
}

/**
 * 🖥️ getGnomeIdleTime
 * Queries the Mutter idle monitor via DBus to get the user inactivity time in milliseconds.
 */
function getGnomeIdleTime() {
  return new Promise((resolve, reject) => {
    const dbusCmd = `DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${uid}/bus" busctl --user call org.gnome.Mutter.IdleMonitor /org/gnome/Mutter/IdleMonitor/Core org.gnome.Mutter.IdleMonitor GetIdletime`;
    exec(dbusCmd, (err, stdout) => {
      if (err) {
        return reject(err);
      }
      const match = stdout.trim().match(/t\s+(\d+)/);
      if (match) {
        resolve(parseInt(match[1], 10));
      } else {
        reject(new Error('Mutter Idle Monitor returned an invalid format'));
      }
    });
  });
}

/**
 * 🔊 isAudioPlaying
 * Queries PulseAudio to detect if there is any active, non-corked sound output.
 */
function isAudioPlaying() {
  return new Promise((resolve) => {
    exec('pactl list sink-inputs', (pactlErr, pactlStdout) => {
      if (pactlErr || !pactlStdout) {
        return resolve(false);
      }
      
      const inputs = pactlStdout.split(/Sink Input #/i).slice(1);
      
      const isUncorked = (input) =>
        input.toLowerCase().includes('corked: no') || 
        input.toLowerCase().includes('pulse.corked = "false"');
        
      const isSystemSpeech = (input) =>
        input.toLowerCase().includes('speech-dispatcher') || 
        input.toLowerCase().includes('sd_dummy');

      const isPlaying = inputs.some(input => isUncorked(input) && !isSystemSpeech(input));
      resolve(isPlaying);
    });
  });
}

/**
 * 📺 isSessionInhibited
 * Queries GNOME Session Manager via DBus to check if idle screensaver is currently inhibited (e.g. by video playback).
 */
function isSessionInhibited() {
  return new Promise((resolve) => {
    const dbusCmd = `DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${uid}/bus" busctl --user call org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager IsInhibited u 8`;
    exec(dbusCmd, (err, stdout) => {
      if (err) {
        return resolve(false);
      }
      // Output is usually: "b true" or "b false"
      const isInhibited = stdout.toLowerCase().includes('true');
      resolve(isInhibited);
    });
  });
}

/**
 * 📺 launchChromiumKiosk
 * Spawns Chromium in fullscreen kiosk mode with strict memory and GPU overrides.
 */
function launchChromiumKiosk(port, mode = 'tv', onUnexpectedExit) {
  if (process.env.NODE_ENV === 'test') {
    console.log('System Service: [Test Mode] Bypassing real Chromium kiosk spawn.');
    return {
      kill: () => {}
    };
  }
  const waylandFlags = buildChromiumFlags({ platform: 'wayland' });
  const x11Flags = buildChromiumFlags({ platform: 'x11' });
  const accelerationProfile = getChromiumAccelerationProfile();
  console.log(`System Service: Launching Chromium kiosk with ${accelerationProfile} acceleration profile on Wayland-first path.`);

  const runtimeDir = `/run/user/${uid}`;
  const displayAuth = (() => {
    try {
      const entry = fs.readdirSync(runtimeDir).find(name => name.startsWith('.mutter-Xwaylandauth.'));
      return entry ? `${runtimeDir}/${entry}` : `${homedir}/.Xauthority`;
    } catch {
      return `${homedir}/.Xauthority`;
    }
  })();
  const targetUrl = `http://localhost:${port}/?mode=${mode}`;
  const launchSequence = [
    { executable: 'chromium-browser', args: waylandFlags.split(' ').concat(targetUrl), name: 'Wayland (chromium-browser)', env: { WAYLAND_DISPLAY: 'wayland-0', XDG_RUNTIME_DIR: runtimeDir } },
    { executable: 'chromium-browser', args: x11Flags.split(' ').concat(targetUrl), name: 'X11 fallback (chromium-browser)', env: { DISPLAY: ':0', XAUTHORITY: displayAuth, XDG_RUNTIME_DIR: runtimeDir } },
    { executable: 'chromium', args: waylandFlags.split(' ').concat(targetUrl), name: 'Wayland fallback (chromium)', env: { WAYLAND_DISPLAY: 'wayland-0', XDG_RUNTIME_DIR: runtimeDir } }
  ];

  let currentProcess = null;

  function runCommandWithFallback(cmds, index) {
    if (index >= cmds.length) {
      console.error('System Service: All Chromium kiosk launch attempts failed.');
      if (onUnexpectedExit) onUnexpectedExit();
      return;
    }

    const { executable, args, name, env } = cmds[index];
    const startTime = Date.now();
    let exited = false;

    const p = spawn(executable, args, {
      env: { ...process.env, ...env },
      stdio: 'ignore'
    });
    const handleExit = (err, code, signal) => {
      if (exited) return;
      exited = true;

      const duration = Date.now() - startTime;
      if (err || code !== 0) {
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          console.log(`System Service: Kiosk browser (${name}) terminated via ${signal}.`);
          if (onUnexpectedExit) onUnexpectedExit();
          return; // Expected exit
        }

        // A process that survives startup is a failed kiosk session, not a
        // reason to try a second display backend while the first is exiting.
        if (duration > 5000) {
          console.warn(`System Service: Kiosk browser (${name}) exited unexpectedly after running for ${Math.round(duration / 1000)}s.`);
          if (onUnexpectedExit) onUnexpectedExit();
          return;
        }

        console.warn(`System Service: Kiosk browser (${name}) failed at startup.`);
        runCommandWithFallback(cmds, index + 1);
      } else {
        // Normal exit (exit code 0) without explicit signal
        console.log(`System Service: Kiosk browser (${name}) exited normally.`);
        if (onUnexpectedExit) onUnexpectedExit();
      }
    };
    p.once('error', error => handleExit(error, null, null));
    p.once('close', (code, signal) => handleExit(null, code, signal));

    currentProcess = p;
  }

  runCommandWithFallback(launchSequence, 0);

  // Return a proxy object that implements the kill method of child_process
  return {
    kill: (signal) => {
      if (currentProcess) {
        currentProcess.kill(signal);
      }
    }
  };
}

module.exports = {
  setCpuGovernor,
  getGnomeIdleTime,
  isAudioPlaying,
  isSessionInhibited,
  getHostDisplayInfo,
  buildChromiumFlags,
  getChromiumAccelerationProfile,
  launchChromiumKiosk
};
