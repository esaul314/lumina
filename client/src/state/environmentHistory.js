export const formatEnvironmentMetric = (value, suffix = '') => {
  if (value === null || value === undefined || value === '') return '—';
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(1)}${suffix}` : '—';
};

export const formatEnvironmentTimestamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No reading yet' : date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

export const getEnvironmentStatus = (environment) => {
  if (!environment?.enabled) return { label: 'Not configured', color: '#94a3b8' };
  if (environment.stale) return { label: 'Stale fallback', color: '#f59e0b' };
  if (environment.indoor) return { label: 'Online', color: '#10b981' };
  return { label: 'Waiting for device', color: '#f59e0b' };
};
