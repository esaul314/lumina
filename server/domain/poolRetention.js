// @ts-check

const DEFAULT_POOL_RETENTION_DAYS = 30;
const MIN_POOL_RETENTION_DAYS = 1;
const MAX_POOL_RETENTION_DAYS = 3650;

const normalizePoolRetentionDays = (value) => {
  const days = Number(value);
  if (!Number.isFinite(days)) return null;
  return Math.min(MAX_POOL_RETENTION_DAYS, Math.max(MIN_POOL_RETENTION_DAYS, Math.round(days)));
};

const normalizePoolPolicy = (policy = {}) => ({
  retentionDays: normalizePoolRetentionDays(policy.retentionDays) ?? DEFAULT_POOL_RETENTION_DAYS,
  maxPhotos: Number.isFinite(Number(policy.maxPhotos))
    ? Math.max(12, Math.min(10000, Math.round(Number(policy.maxPhotos))))
    : 2000
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
  DEFAULT_POOL_RETENTION_DAYS,
  normalizePoolRetentionDays,
  normalizePoolPolicy,
  pruneExpiredPhotos
};
