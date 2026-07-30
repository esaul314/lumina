// @ts-check

function createKioskControlRuntime({
  state,
  emitStateSync = () => {},
  getPort,
  isServerListening = () => false,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  retryDelayMs = 1000,
  setCpuGovernor,
  launchChromiumKiosk,
  killChromiumKiosk,
  log = console
}) {
  const runtimeState = {
    browserRunning: false,
    manualOverride: false
  };
  let pendingLaunchRetry = null;

  const readPort = () => typeof getPort === 'function' ? getPort() : getPort;
  const getRuntimeContext = () => ({
    browserRunning: runtimeState.browserRunning,
    manualOverride: runtimeState.manualOverride
  });
  const setManualOverride = (value) => {
    runtimeState.manualOverride = Boolean(value);
    return runtimeState.manualOverride;
  };
  const setBrowserRunning = (value) => {
    runtimeState.browserRunning = Boolean(value);
    return runtimeState.browserRunning;
  };
  const clearLaunchRetry = () => {
    if (pendingLaunchRetry === null) {
      return false;
    }

    clearTimeoutImpl(pendingLaunchRetry);
    pendingLaunchRetry = null;
    return true;
  };
  const resetManualOverrideOnUnexpectedExit = () => {
    if (!runtimeState.manualOverride) {
      return false;
    }

    runtimeState.manualOverride = false;
    state.screensaverActive = false;
    emitStateSync();
    return true;
  };
  const MAX_RAPID_FAILURES = 3;
  const FAILURE_COOLDOWN_MS = 60000; // 1 minute pause on crash loop
  let consecutiveFailures = 0;
  let cooldownUntil = 0;

  const handleUnexpectedExit = () => {
    setBrowserRunning(false);
    resetManualOverrideOnUnexpectedExit();
    
    consecutiveFailures += 1;
    if (consecutiveFailures >= MAX_RAPID_FAILURES) {
      cooldownUntil = Date.now() + FAILURE_COOLDOWN_MS;
      log.error(`System Service: Kiosk browser crashed ${consecutiveFailures} times consecutively. Cooling down launch retries for ${FAILURE_COOLDOWN_MS / 1000}s to prevent CPU thrashing.`);
    }
  };
  const scheduleDeferredLaunch = (forceManual = false) => {
    if (pendingLaunchRetry !== null) {
      return pendingLaunchRetry;
    }

    log.warn(`System Service: Deferring kiosk browser launch because server is not listening on port ${readPort()} yet.`);
    pendingLaunchRetry = setTimeoutImpl(() => {
      pendingLaunchRetry = null;
      launchKioskBrowser(forceManual);
    }, retryDelayMs);
    return pendingLaunchRetry;
  };
  const relaunchChromiumKiosk = () => Promise.resolve(setCpuGovernor?.('performance'))
    .then(() => killChromiumKiosk?.())
    .then(() => launchChromiumKiosk?.(readPort(), 'tv', handleUnexpectedExit));

  function launchKioskBrowser(forceManual = false) {
    if (forceManual) {
      setManualOverride(true);
    }

    if (runtimeState.browserRunning) {
      return false;
    }

    if (Date.now() < cooldownUntil) {
      log.warn(`System Service: Kiosk browser launch suppressed due to crash-loop cooldown (active until ${new Date(cooldownUntil).toISOString()}).`);
      return false;
    }

    if (!isServerListening()) {
      scheduleDeferredLaunch(forceManual);
      return false;
    }

    clearLaunchRetry();
    log.log('Lumina System Idle: Spawning Fullscreen Kiosk Screensaver...');
    setBrowserRunning(true);
    // ponytail: successful manual launch resets failure count
    if (forceManual) {
      consecutiveFailures = 0;
      cooldownUntil = 0;
    }
    void relaunchChromiumKiosk();
    return true;
  }

  function killKioskBrowser(forceManual = false) {
    if (forceManual) {
      setManualOverride(false);
    }

    clearLaunchRetry();
    if (!runtimeState.browserRunning) {
      return false;
    }

    log.log('Lumina System Active: Dismissing Kiosk Browser...');
    setBrowserRunning(false);
    void Promise.resolve(setCpuGovernor?.('schedutil'))
      .then(() => killChromiumKiosk?.());
    return true;
  }

  return {
    clearLaunchRetry,
    getRuntimeContext,
    handleUnexpectedExit,
    isBrowserRunning: () => runtimeState.browserRunning,
    isManualOverride: () => runtimeState.manualOverride,
    killKioskBrowser,
    launchKioskBrowser,
    setManualOverride
  };
}

module.exports = {
  createKioskControlRuntime
};
