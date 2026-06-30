const { exec } = require('child_process');
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

/**
 * ⚡ setCpuGovernor
 * Toggles the CPU scaling governor profiles (e.g. performance vs schedutil).
 */
function setCpuGovernor(profile) {
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
  const waylandFlags = buildChromiumFlags({ platform: 'wayland' });
  const x11Flags = buildChromiumFlags({ platform: 'x11' });
  const accelerationProfile = getChromiumAccelerationProfile();
  console.log(`System Service: Launching Chromium kiosk with ${accelerationProfile} acceleration profile on Wayland-first path.`);

  const waylandCmd = `WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/${uid} chromium-browser ${waylandFlags} http://localhost:${port}/?mode=${mode}`;
  const x11Cmd = `XAUTH=$(find /run/user/${uid} -name ".mutter-Xwaylandauth.*" | head -n 1); [ -z "$XAUTH" ] && XAUTH="${homedir}/.Xauthority"; DISPLAY=:0 XAUTHORITY=$XAUTH XDG_RUNTIME_DIR=/run/user/${uid} chromium-browser ${x11Flags} http://localhost:${port}/?mode=${mode}`;
  const waylandFallbackCmd = `WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/${uid} chromium ${waylandFlags} http://localhost:${port}/?mode=${mode}`;

  let currentProcess = null;

  function runCommandWithFallback(cmds, index) {
    if (index >= cmds.length) {
      console.error('System Service: All Chromium kiosk launch attempts failed.');
      if (onUnexpectedExit) onUnexpectedExit();
      return;
    }

    const { cmd, name } = cmds[index];
    const startTime = Date.now();
    let exited = false;

    const p = exec(cmd, (err) => {
      if (exited) return;
      exited = true;

      const duration = Date.now() - startTime;
      if (err) {
        if (err.signal === 'SIGTERM' || err.signal === 'SIGKILL') {
          return; // Expected exit
        }

        // If the process was running for more than 5 seconds, treat it as a successful launch
        // that crashed later, rather than a startup failure. Do not run fallbacks.
        if (duration > 5000) {
          console.warn(`System Service: Kiosk browser (${name}) exited unexpectedly after running for ${Math.round(duration / 1000)}s:`, err.message);
          if (onUnexpectedExit) onUnexpectedExit();
          return;
        }

        console.warn(`System Service: Kiosk browser (${name}) failed at startup:`, err.message);
        runCommandWithFallback(cmds, index + 1);
      } else {
        // Normal exit (exit code 0) without explicit signal
        console.log(`System Service: Kiosk browser (${name}) exited normally.`);
        if (onUnexpectedExit) onUnexpectedExit();
      }
    });

    currentProcess = p;
  }

  const launchSequence = [
    { cmd: waylandCmd, name: 'Wayland (chromium-browser)' },
    { cmd: x11Cmd, name: 'X11 fallback (chromium-browser)' },
    { cmd: waylandFallbackCmd, name: 'Wayland fallback (chromium)' }
  ];

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

/**
 * 💀 killChromiumKiosk
 * Hard kills all active Chromium/kiosk processes.
 */
function killChromiumKiosk() {
  return new Promise((resolve) => {
    exec('killall chromium-browser || killall chromium', () => {
      resolve(true);
    });
  });
}

module.exports = {
  setCpuGovernor,
  getGnomeIdleTime,
  isAudioPlaying,
  isSessionInhibited,
  buildChromiumFlags,
  getChromiumAccelerationProfile,
  launchChromiumKiosk,
  killChromiumKiosk
};
