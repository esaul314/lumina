// @ts-check

/**
 * @typedef {Object} PoolLifecycleRow
 * @property {string} category
 * @property {Object} policy
 * @property {string} scheduleLabel
 */

const DEFAULT_START = '22:00';
const DEFAULT_END = '06:00';

/**
 * @param {Object|undefined|null} schedule
 * @returns {string}
 */
export const formatPoolSchedule = (schedule = {}) => schedule?.enabled
  ? `${schedule.start || DEFAULT_START}–${schedule.end || DEFAULT_END}`
  : 'Manual activation';

/**
 * Build the presentation rows for the lifecycle editor without coupling the
 * view to the persisted policy container or to React state.
 *
 * @param {string[]} categories
 * @param {(category: string) => Object} policyFor
 * @returns {PoolLifecycleRow[]}
 */
export const getPoolLifecycleRows = (categories = [], policyFor) => categories
  .filter(category => category !== 'Google Photos')
  .map(category => {
    const policy = policyFor(category);
    return {
      category,
      policy,
      scheduleLabel: formatPoolSchedule(policy.schedule)
    };
  });
