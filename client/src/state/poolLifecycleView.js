// @ts-check

/**
 * @typedef {Object} PoolLifecycleRow
 * @property {string} category
 * @property {Object} policy
 * @property {{retention: string, maximum: string, schedule: string}} summary
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
 * @param {Object} policy
 * @returns {{retention: string, maximum: string, schedule: string}}
 */
export const formatPoolLifecycleSummary = ({ retentionDays, maxPhotos, schedule } = {}) => ({
  retention: `${retentionDays} days`,
  maximum: `${maxPhotos} photos`,
  schedule: formatPoolSchedule(schedule)
});

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
      summary: formatPoolLifecycleSummary(policy)
    };
  });
