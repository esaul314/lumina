// @ts-check

const { isTimeInSchedule } = require('./selectors.js');
const { normalizePoolSchedule } = require('./poolRetention.js');

const formatLocalTime = (date) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);

const scheduleIdentity = (category, schedule) => [
  category,
  schedule.start,
  schedule.end,
  schedule.priority
].join('|');

const isPoolScheduleActive = (schedule, now = new Date()) => {
  const normalized = normalizePoolSchedule(schedule);
  return normalized.enabled && isTimeInSchedule(
    formatLocalTime(now),
    normalized.start,
    normalized.end
  );
};

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
  scheduleIdentity
};
