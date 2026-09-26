// @ts-check

/** @typedef {{enabled?: boolean, start?: string, end?: string}} PoolScheduleInput */
/** @typedef {{retentionDays?: number|string, maxPhotos?: number|string, schedule?: PoolScheduleInput|null}} PoolLifecyclePolicyInput */
/** @typedef {{retention: string, maximum: string, schedule: string}} PoolLifecycleSummary */
/** @typedef {{category: string, policy: PoolLifecyclePolicyInput, summary: PoolLifecycleSummary}} PoolLifecycleRow */
/** @typedef {(category: string) => PoolLifecyclePolicyInput} PoolPolicyReader */

const DEFAULT_START = '22:00';
const DEFAULT_END = '06:00';

/**
 * @param {PoolScheduleInput|null|undefined} schedule
 * @returns {string}
 */
export const formatPoolSchedule = (schedule = {}) => schedule?.enabled
  ? `${schedule.start || DEFAULT_START}–${schedule.end || DEFAULT_END}`
  : 'Manual activation';

/**
 * @param {PoolLifecyclePolicyInput} [policy]
 * @returns {PoolLifecycleSummary}
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
 * @param {PoolPolicyReader} policyFor
 * @returns {PoolLifecycleRow[]}
 */
export const getPoolLifecycleRows = (categories = [], policyFor) => categories
  .map(category => {
    const policy = policyFor(category);
    return {
      category,
      policy,
      summary: formatPoolLifecycleSummary(policy)
    };
  });
