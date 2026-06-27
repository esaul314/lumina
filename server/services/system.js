const { exec } = require('child_process');
const os = require('os');

// Discover system information dynamically for robust daemon paths
const userInfo = os.userInfo();
const uid = userInfo.uid || 1000;
const homedir = userInfo.homedir || os.homedir();

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
  const optimizedFlags = '--ozone-platform=wayland --enable-features=UseOzonePlatform --js-flags="--max-old-space-size=256" --disable-dev-shm-usage --disk-cache-size=52428800 --media-cache-size=20971520 --disable-gpu-shader-disk-cache --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-native-gpu-memory-buffers --kiosk --no-first-run --new-window';
  const x11Flags = '--js-flags="--max-old-space-size=256" --disable-dev-shm-usage --disk-cache-size=52428800 --media-cache-size=20971520 --disable-gpu-shader-disk-cache --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-native-gpu-memory-buffers --kiosk --no-first-run --new-window';

  const waylandCmd = `WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/${uid} chromium-browser ${optimizedFlags} http://localhost:${port}/?mode=${mode}`;
  
  const processRef = exec(waylandCmd, (err) => {
    if (err) {
      if (err.signal === 'SIGTERM' || err.signal === 'SIGKILL') {
        return; // Expected exit
      }
      
      console.warn('Chromium Wayland launch failed, falling back to X11/Xwayland...', err.message);
      
      const x11Cmd = `XAUTH=$(find /run/user/${uid} -name ".mutter-Xwaylandauth.*" | head -n 1); [ -z "$XAUTH" ] && XAUTH="${homedir}/.Xauthority"; DISPLAY=:0 XAUTHORITY=$XAUTH XDG_RUNTIME_DIR=/run/user/${uid} chromium-browser ${x11Flags} http://localhost:${port}/?mode=${mode}`;
      
      exec(x11Cmd, (x11Err) => {
        if (x11Err) {
          if (x11Err.signal === 'SIGTERM' || x11Err.signal === 'SIGKILL') {
            return; // Expected exit
          }
          
          console.warn('Chromium X11 launch failed, trying standard chromium (Wayland)...', x11Err.message);
          
          const waylandFallback = `WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/${uid} chromium ${optimizedFlags} http://localhost:${port}/?mode=${mode}`;
          exec(waylandFallback, (wfErr) => {
            if (wfErr) {
              if (wfErr.signal === 'SIGTERM' || wfErr.signal === 'SIGKILL') {
                return; // Expected exit
              }
              console.error('System Service: All Chromium kiosk launch attempts failed:', wfErr.message);
              if (onUnexpectedExit) onUnexpectedExit();
            }
          });
        }
      });
    }
  });

  return processRef;
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
  launchChromiumKiosk,
  killChromiumKiosk
};
