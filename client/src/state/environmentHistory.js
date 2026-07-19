export const formatEnvironmentMetric = (value, suffix = '') => {
  if (value === null || value === undefined || value === '') return '—';
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(1)}${suffix}` : '—';
};

export const convertTemperature = (value, unit = 'C') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return unit === 'F' ? (numericValue * 9) / 5 + 32 : numericValue;
};

export const convertPressure = (value, unit = 'hPa') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return unit === 'inHg' ? numericValue / 33.8638866667 : numericValue;
};

export const parseEnvironmentSettingsJson = (value) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { valid: true, value: parsed }
      : { valid: false, error: 'Configuration JSON must contain an object.' };
  } catch (error) {
    return { valid: false, error: `Invalid configuration JSON: ${error.message}` };
  }
};

export const formatEnvironmentTimestamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No reading yet' : date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

export const getEnvironmentStatus = (environment) => {
  if (!environment) return { label: 'Backend unavailable', color: '#ef4444' };
  if (!environment.enabled) return { label: 'Not configured', color: '#94a3b8' };
  if (environment.stale) return { label: 'Stale fallback', color: '#f59e0b' };
  if (environment.indoor) return { label: 'Online', color: '#10b981' };
  return { label: 'Waiting for device', color: '#f59e0b' };
};
