const { curry } = require('./fn.js');

/**
 * 🔍 validateRange
 * Curried validator builder that returns parsed value if within min/max, or null.
 */
const validateRange = curry((min, max, parser, value) => {
  if (value === undefined || value === null) return null;
  const parsed = parser(value);
  return (!isNaN(parsed) && parsed >= min && parsed <= max) ? parsed : null;
});

/**
 * 🎯 validateRating
 * Validates rating values (1-10 integer).
 */
const validateRating = validateRange(1, 10, (v) => parseInt(v, 10));

/**
 * 📏 validatePercent
 * Validates percentages (0-100 integer).
 */
const validatePercent = validateRange(0, 100, (v) => parseInt(v, 10));

module.exports = {
  validateRange,
  validateRating,
  validatePercent
};
