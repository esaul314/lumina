// @ts-check

function getNextScreensaverState(currentState, inputs) {
  const { idleCounter, isBrowserRunning } = currentState;
  const { isIdle, isMoviePlaying, manualOverride, launchBlocked = false } = inputs;

  const isActuallyIdle = isIdle && !isMoviePlaying;
  const nextIdleCounter = isActuallyIdle ? idleCounter + 1 : 0;
  const shouldBeActive = !launchBlocked && (nextIdleCounter >= 3 || manualOverride);

  let action = null;
  if (shouldBeActive && !isBrowserRunning) {
    action = 'launch';
  } else if (!shouldBeActive && isBrowserRunning) {
    action = 'kill';
  }

  return {
    nextState: {
      idleCounter: nextIdleCounter,
      isBrowserRunning: shouldBeActive,
      screensaverActive: shouldBeActive
    },
    action
  };
}

function buildDaemonInputs({
  idleMs,
  inactivityTimeout,
  audioPlaying,
  sessionInhibited,
  manualOverride,
  launchBlocked = false
}) {
  return {
    isIdle: idleMs >= inactivityTimeout,
    isMoviePlaying: Boolean(audioPlaying || sessionInhibited),
    manualOverride: Boolean(manualOverride),
    launchBlocked: Boolean(launchBlocked)
  };
}

function createIdleDaemonRuntime({
  state,
  getRuntimeContext = () => ({}),
  getIdleTime,
  isAudioPlaying,
  isSessionInhibited,
  launchKioskBrowser,
  killKioskBrowser,
  broadcastStateSync = () => {},
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
  pollIntervalMs = 2000,
  log = console
}) {
  const actionHandlers = {
    launch: () => launchKioskBrowser?.(),
    kill: () => killKioskBrowser?.()
  };
  let idleCounter = 0;
  let activitySuppressed = false;
  let intervalId = null;

  const notifyActivity = () => {
    idleCounter = 0;
    activitySuppressed = true;
    return true;
  };

  const syncScreensaverActivity = (screensaverActive) => {
    if (state.screensaverActive === screensaverActive) {
      return false;
    }

    state.screensaverActive = screensaverActive;
    broadcastStateSync();
    return true;
  };

  const tick = async () => {
    try {
      const { browserRunning = false, manualOverride = false, launchBlocked = false } = getRuntimeContext() ?? {};
      const idleMs = await getIdleTime();
      if (manualOverride || idleMs < state.inactivityTimeout) {
        activitySuppressed = false;
      }
      const audioPlaying = await isAudioPlaying();
      const sessionInhibited = browserRunning ? false : await isSessionInhibited();
      const inputs = buildDaemonInputs({
        idleMs,
        inactivityTimeout: state.inactivityTimeout,
        audioPlaying,
        sessionInhibited,
        manualOverride,
        launchBlocked: launchBlocked || activitySuppressed
      });
      const { nextState, action } = getNextScreensaverState(
        { idleCounter, isBrowserRunning: browserRunning },
        inputs
      );

      idleCounter = nextState.idleCounter;
      actionHandlers[action]?.();
      syncScreensaverActivity(nextState.screensaverActive);

      return {
        action,
        inputs,
        nextState,
        activitySuppressed
      };
    } catch (error) {
      log.warn('System Service: Idle daemon tick failed:', error.message);
      return null;
    }
  };

  const start = () => {
    if (intervalId !== null) {
      return intervalId;
    }

    intervalId = setIntervalImpl(() => {
      void tick();
    }, pollIntervalMs);
    return intervalId;
  };

  const stop = () => {
    if (intervalId === null) {
      return false;
    }

    clearIntervalImpl(intervalId);
    intervalId = null;
    return true;
  };

  return {
    getIdleCounter: () => idleCounter,
    notifyActivity,
    start,
    stop,
    tick
  };
}

module.exports = {
  buildDaemonInputs,
  createIdleDaemonRuntime,
  getNextScreensaverState
};
