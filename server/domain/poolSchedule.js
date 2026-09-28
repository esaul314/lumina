// @ts-check

const { isTimeInSchedule } = require('./selectors.js');
const { normalizePoolSchedule } = require('./poolRetention.js');

/**
 * @typedef {{
 *   enabled?: unknown,
 *   start?: unknown,
 *   end?: unknown,
 *   priority?: unknown
 * }} PoolScheduleInput
 */

/**
 * @typedef {object} PoolSchedule
 * @property {boolean} enabled
 * @property {string} start
 * @property {string} end
 * @property {number} priority
 */

/**
 * @typedef {{schedule?: PoolScheduleInput} | null | undefined} PoolPolicyRecord
 */

/** @typedef {Record<string, PoolPolicyRecord>} PoolPolicies */

/**
 * @typedef {object} ScheduledPool
 * @property {string} category
 * @property {PoolSchedule} schedule
 * @property {string} identity
 */

/**
 * @typedef {object} ScheduledPoolOptions
 * @property {PoolPolicies} [poolPolicies={}]
 * @property {string[]} [availableCategories=[]]
 * @property {Date} [now]
 */

/**
 * Format a local clock value for the schedule selector.
 *
 * @param {Date} date
 * @returns {string}
 */
const formatLocalTime = (date) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);

/**
 * Build a stable identity for one resolved schedule.
 *
 * @param {string} category
 * @param {PoolSchedule} schedule
 * @returns {string}
 */
const scheduleIdentity = (category, schedule) => [
  category,
  schedule.start,
  schedule.end,
  schedule.priority
].join('|');

/**
 * Add a scheduled category without replacing the user's active selection.
 *
 * @param {string[]} categories
 * @param {string} category
 * @returns {string[]}
 */
const appendUniqueCategory = (categories = [], category) => (
  categories.includes(category) ? [...categories] : [...categories, category]
);

/**
 * Determine whether a schedule is active at a local clock instant.
 *
 * @param {PoolScheduleInput} schedule
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
const isPoolScheduleActive = (schedule, now = new Date()) => {
  const normalized = normalizePoolSchedule(schedule);
  return normalized.enabled && isTimeInSchedule(
    formatLocalTime(now),
    normalized.start,
    normalized.end
  );
};

/**
 * Select the highest-priority active schedule, breaking ties by category.
 *
 * @param {ScheduledPoolOptions} [options={}]
 * @returns {ScheduledPool | null}
 */
function resolveScheduledPool({
  poolPolicies = {},
  availableCategories = [],
  now = new Date()
} = {}) {
  return Object.entries(poolPolicies)
    .filter(([category]) => availableCategories.length === 0 || availableCategories.includes(category))
    .map(([category, policy]) => ({
      category,
      schedule: normalizePoolSchedule(policy?.schedule)
    }))
    .filter(({ schedule }) => isPoolScheduleActive(schedule, now))
    .sort((left, right) => (
      right.schedule.priority - left.schedule.priority
      || left.category.localeCompare(right.category)
    ))
    .map((entry) => ({
      ...entry,
      identity: scheduleIdentity(entry.category, entry.schedule)
    }))[0] || null;
}

module.exports = {
  formatLocalTime,
  isPoolScheduleActive,
  resolveScheduledPool,
  scheduleIdentity,
  appendUniqueCategory
};
