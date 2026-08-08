/**
 * Format the clock's numeric time and day-period independently so locale
 * whitespace and punctuation cannot become part of the period layout.
 *
 * @param {Date} date
 * @param {string|string[]} [locales=[]]
 * @param {Intl.DateTimeFormatOptions} [options={}]
 * @returns {{time: string, period: string}}
 */
export const formatClockParts = (date, locales = [], options = {}) => {
  const parts = new Intl.DateTimeFormat(locales, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  }).formatToParts(date);

  return {
    time: parts
      .filter(({ type }) => type !== 'dayPeriod')
      .map(({ value }) => value)
      .join('')
      .trim(),
    period: parts.find(({ type }) => type === 'dayPeriod')?.value || ''
  };
};
