// @ts-check

const DEFAULT_POOL_RETENTION_DAYS = 30;
const MIN_POOL_RETENTION_DAYS = 1;
const MAX_POOL_RETENTION_DAYS = 3650;
const DEFAULT_POOL_SCHEDULE = Object.freeze({
  enabled: false,
  start: '22:00',
  end: '06:00',
  priority: 0
});
const MIN_POOL_SCHEDULE_PRIORITY = -10000;
const MAX_POOL_SCHEDULE_PRIORITY = 10000;

const normalizePoolRetentionDays = (value) => {
  const days = Number(value);
  if (!Number.isFinite(days)) return null;
  return Math.min(MAX_POOL_RETENTION_DAYS, Math.max(MIN_POOL_RETENTION_DAYS, Math.round(days)));
};

const isValidPoolScheduleTime = (value) => (
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
);

const normalizePoolSchedule = (schedule = {}) => {
  const input = schedule && typeof schedule === 'object' && !Array.isArray(schedule)
    ? schedule
    : {};
  const priority = Number(input.priority);

  return {
    enabled: Boolean(input.enabled),
    start: isValidPoolScheduleTime(input.start) ? input.start : DEFAULT_POOL_SCHEDULE.start,
    end: isValidPoolScheduleTime(input.end) ? input.end : DEFAULT_POOL_SCHEDULE.end,
    priority: Number.isFinite(priority)
      ? Math.min(MAX_POOL_SCHEDULE_PRIORITY, Math.max(MIN_POOL_SCHEDULE_PRIORITY, Math.round(priority)))
      : DEFAULT_POOL_SCHEDULE.priority
  };
};

const normalizePoolPolicy = (policy = {}) => ({
  retentionDays: normalizePoolRetentionDays(policy.retentionDays) ?? DEFAULT_POOL_RETENTION_DAYS,
  maxPhotos: Number.isFinite(Number(policy.maxPhotos))
    ? Math.max(12, Math.min(10000, Math.round(Number(policy.maxPhotos))))
    : 2000,
  schedule: normalizePoolSchedule(policy.schedule)
});

const pruneExpiredPhotos = (now, policy) => (photos = []) => {
  const { retentionDays } = normalizePoolPolicy(policy);
  const cutoff = new Date(now).getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return photos.filter((photo) => {
    if (!photo?.addedAt || photo.loved === true) return true;
    const addedAt = new Date(photo.addedAt).getTime();
    return !Number.isFinite(addedAt) || addedAt >= cutoff;
  });
};

module.exports = {
  DEFAULT_POOL_SCHEDULE,
  DEFAULT_POOL_RETENTION_DAYS,
  isValidPoolScheduleTime,
  normalizePoolSchedule,
  normalizePoolRetentionDays,
  normalizePoolPolicy,
  pruneExpiredPhotos
};
