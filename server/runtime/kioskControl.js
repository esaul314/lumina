// @ts-check

/**
 * @typedef {object} KioskRuntimeState
 * @property {boolean} browserRunning Whether the kiosk process is running.
 * @property {boolean} manualOverride Whether activation was explicitly requested.
 * @property {boolean} launchBlocked Whether crash-loop policy blocks new launches.
 *
 * @typedef {KioskRuntimeState} KioskRuntimeContext
 */

/**
 * Project the observable kiosk flags without exposing the mutable runtime record.
 *
 * @param {KioskRuntimeState} runtimeState
 * @returns {KioskRuntimeContext}
 */
function projectKioskRuntimeContext({ browserRunning, manualOverride, launchBlocked }) {
  return { browserRunning, manualOverride, launchBlocked };
}

function createKioskControlRuntime({
  state,
  emitStateSync = () => {},
  getPort,
  isServerListening = () => false,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  retryDelayMs = 1000,
  notifyActivity = () => {},
  setCpuGovernor,
  launchChromiumKiosk,
  log = console
}) {
  const runtimeState = {
    browserRunning: false,
    manualOverride: false,
    launchBlocked: false
  };
  let pendingLaunchRetry = null;
  let kioskProcess = null;
  let expectedExit = false;
  let launchGeneration = 0;

  /** @param {unknown} error */
  const warnCpuRestore = error => log.warn('CPU policy restore failed:', error instanceof Error ? error.message : String(error));

  const readPort = () => typeof getPort === 'function' ? getPort() : getPort;
  const getRuntimeContext = () => projectKioskRuntimeContext(runtimeState);
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
    if (expectedExit) {
      expectedExit = false;
      kioskProcess = null;
      return false;
    }

    kioskProcess = null;
    setBrowserRunning(false);
    resetManualOverrideOnUnexpectedExit();
    consecutiveFailures += 1;
    if (consecutiveFailures >= MAX_RAPID_FAILURES) {
      cooldownUntil = Date.now() + FAILURE_COOLDOWN_MS;
      runtimeState.launchBlocked = true;
      log.error(`System Service: Kiosk browser crashed ${consecutiveFailures} times consecutively. Cooling down launch retries for ${FAILURE_COOLDOWN_MS / 1000}s to prevent CPU thrashing.`);
    }
    return true;
  };
  const scheduleDeferredLaunch = (forceManual = false) => {
    if (pendingLaunchRetry !== null) {
      return pendingLaunchRetry;
    }

    log.warn(`System Service: Deferring kiosk browser launch because server is not listening on port ${readPort()} yet.`);
    const generation = launchGeneration;
    pendingLaunchRetry = setTimeoutImpl(() => {
      if (generation !== launchGeneration) return;
      pendingLaunchRetry = null;
      launchKioskBrowser(forceManual);
    }, retryDelayMs);
    return pendingLaunchRetry;
  };
  const relaunchChromiumKiosk = () => {
    const generation = launchGeneration;
    return Promise.resolve(setCpuGovernor?.('performance')).then(() => {
      if (generation !== launchGeneration || !runtimeState.browserRunning) return null;
      const onExit = () => { if (generation === launchGeneration) handleUnexpectedExit(); };
      kioskProcess = launchChromiumKiosk?.(readPort(), 'tv', onExit) ?? null;
      return kioskProcess;
    });
  };

  function launchKioskBrowser(forceManual = false) {
    if (forceManual) {
      setManualOverride(true);
      runtimeState.launchBlocked = false;
      consecutiveFailures = 0;
      cooldownUntil = 0;
    }

    if (runtimeState.browserRunning || kioskProcess) {
      return false;
    }

    if (runtimeState.launchBlocked || Date.now() < cooldownUntil) {
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
    expectedExit = false;
    void relaunchChromiumKiosk();
    return true;
  }

  function killKioskBrowser(forceManual = false) {
    notifyActivity();
    if (forceManual) {
      setManualOverride(false);
    }

    clearLaunchRetry();
    launchGeneration += 1;
    runtimeState.launchBlocked = false;
    consecutiveFailures = 0;
    cooldownUntil = 0;
    if (!runtimeState.browserRunning && !kioskProcess) {
      return false;
    }

    log.log('Lumina System Active: Dismissing Kiosk Browser...');
    expectedExit = true;
    setBrowserRunning(false);
    // ponytail: CPU policy failure must never forbid stopping the owned child.
    try {
      void Promise.resolve(setCpuGovernor?.('schedutil')).catch(warnCpuRestore);
    } catch (error) {
      warnCpuRestore(error);
    }
    kioskProcess?.kill?.('SIGTERM');
    kioskProcess = null;
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
  createKioskControlRuntime,
  projectKioskRuntimeContext
};
