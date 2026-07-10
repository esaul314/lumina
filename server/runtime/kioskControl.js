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
  const handleUnexpectedExit = () => {
    setBrowserRunning(false);
    resetManualOverrideOnUnexpectedExit();
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

    if (!isServerListening()) {
      scheduleDeferredLaunch(forceManual);
      return false;
    }

    clearLaunchRetry();
    log.log('Lumina System Idle: Spawning Fullscreen Kiosk Screensaver...');
    setBrowserRunning(true);
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
