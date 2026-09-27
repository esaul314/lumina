// @ts-check

const { curry } = require('./fn.js');

/**
 * @typedef {(value: unknown) => number} NumberParser
 * @typedef {(value: unknown) => number | null} NumericValidator
 */

/**
 * 🔍 validateRange
 * Curried validator builder that returns parsed value if within min/max, or null.
 *
 * @param {number} min
 * @param {number} max
 * @param {NumberParser} parser
 * @param {unknown} value
 * @returns {number | null}
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
/** @type {NumericValidator} */
const validateRating = validateRange(1, 10, (v) => parseInt(v, 10));

/**
 * 📏 validatePercent
 * Validates percentages (0-100 integer).
 */
/** @type {NumericValidator} */
const validatePercent = validateRange(0, 100, (v) => parseInt(v, 10));

/**
 * 🔎 validatePhotoCropPercent
 * Validates per-photo zoom percentages (0-200 integer).
 */
/** @type {NumericValidator} */
const validatePhotoCropPercent = validateRange(0, 200, (v) => parseInt(v, 10));

module.exports = {
  validateRange,
  validateRating,
  validatePercent,
  validatePhotoCropPercent
};
