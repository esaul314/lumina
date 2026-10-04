// @ts-check

const { normalizeCategorySelection } = require('../domain/selectors.js');
const { appendUniqueCategory, resolveScheduledPool } = require('../domain/poolSchedule.js');

const sameCategories = (left = [], right = []) => (
  left.length === right.length && left.every((category, index) => category === right[index])
);

/**
 * @typedef {object} PoolScheduleStatus
 * @property {string | null} activeIdentity Identity of the currently active schedule.
 * @property {string[]} scheduledCategories Categories introduced by scheduling.
 * @property {string[] | null} activationCategories Full category selection applied at activation.
 * @property {string[] | null} baselineCategories Category selection to restore at the boundary.
 * @property {boolean} manualOverride Whether a manual selection changed the active schedule.
 */

/**
 * Project an isolated status snapshot without exposing runtime-owned arrays.
 *
 * @param {PoolScheduleStatus} status
 * @returns {PoolScheduleStatus}
 */
function projectPoolScheduleStatus({
  activeIdentity,
  scheduledCategories,
  activationCategories,
  baselineCategories,
  manualOverride
}) {
  return {
    activeIdentity,
    scheduledCategories: [...scheduledCategories],
    activationCategories: activationCategories ? [...activationCategories] : null,
    baselineCategories: baselineCategories ? [...baselineCategories] : null,
    manualOverride
  };
}

/**
 * Keeps scheduled activation in the imperative runtime while using the normal
 * category command for the actual state transition. Manual category changes
 * during a window are left alone until the next schedule boundary.
 */
function createPoolScheduleRuntime({
  state,
  collections = {},
  dispatchCommand,
  getNow = () => new Date(),
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
  intervalMs = 30 * 1000,
  log = console
}) {
  let intervalId = null;
  let transitionInProgress = false;
  let activeIdentity = null;
  let scheduledCategories = [];
  let activationCategories = null;
  let baselineCategories = null;
  let manualOverride = false;

  const getAvailableCategories = () => Object.keys(collections);
  const getCurrentCategories = () => normalizeCategorySelection(
    state.currentCategory,
    getAvailableCategories(),
    getAvailableCategories()[0] || 'Scenic Nature'
  );

  const dispatchSelection = async (categories) => {
    if (sameCategories(getCurrentCategories(), categories)) return true;
    if (typeof dispatchCommand !== 'function') return false;

    await dispatchCommand({
      type: 'select-categories',
      payload: { categories }
    });
    return true;
  };

  const tick = async () => {
    if (transitionInProgress) return null;
    transitionInProgress = true;

    try {
      const scheduledPool = resolveScheduledPool({
        poolPolicies: state.poolPolicies,
        availableCategories: getAvailableCategories(),
        now: getNow()
      });
      const currentCategories = getCurrentCategories();

      if (!scheduledPool) {
        if (activeIdentity) {
          const restoreCategories = baselineCategories || currentCategories;
          activeIdentity = null;
          scheduledCategories = [];
          activationCategories = null;
          baselineCategories = null;
          manualOverride = false;
          await dispatchSelection(restoreCategories);
          return restoreCategories;
        }
        return currentCategories;
      }

      if (scheduledPool.identity !== activeIdentity) {
        baselineCategories = activeIdentity
          ? (baselineCategories || currentCategories)
          : currentCategories;
        activeIdentity = scheduledPool.identity;
        scheduledCategories = [scheduledPool.category];
        activationCategories = appendUniqueCategory(
          baselineCategories || currentCategories,
          scheduledPool.category
        );
        manualOverride = false;
        await dispatchSelection(activationCategories);
        return activationCategories;
      }

      if (!manualOverride && !sameCategories(currentCategories, activationCategories || currentCategories)) {
        manualOverride = true;
      }

      return currentCategories;
    } catch (error) {
      log.warn('Pool schedule evaluation failed:', error.message);
      return null;
    } finally {
      transitionInProgress = false;
    }
  };

  const start = () => {
    if (intervalId !== null) return;
    void tick();
    intervalId = setIntervalImpl(() => { void tick(); }, intervalMs);
  };

  const stop = () => {
    if (intervalId === null) return;
    clearIntervalImpl(intervalId);
    intervalId = null;
  };

  return {
    start,
    stop,
    tick,
    getStatus: () => projectPoolScheduleStatus({
      activeIdentity,
      scheduledCategories,
      activationCategories,
      baselineCategories,
      manualOverride
    })
  };
}

module.exports = { createPoolScheduleRuntime, projectPoolScheduleStatus };
