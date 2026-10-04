// @ts-check

const TIME_RANGE_PATTERN = /^([0-1]?\d|2[0-3]):[0-5]\d$/;

/**
 * @typedef {{timeStart: string, timeEnd: string, keywords: string[]}} TimedKeywordSpec
 */

/** @typedef {string | TimedKeywordSpec} KeywordSpec */

/** @typedef {{splitString?: boolean}} KeywordTermOptions */

/** @typedef {{splitTopLevelString?: boolean}} KeywordEntryOptions */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * @param {unknown} value
 * @returns {string}
 */
const trimString = (value) => typeof value === 'string' ? value.trim() : '';

/**
 * Normalize unknown keyword input while preserving phrase order.
 *
 * @param {unknown} keywords
 * @param {KeywordTermOptions} [options]
 * @returns {string[]}
 */
const normalizeKeywordTerms = (keywords, { splitString = false } = {}) => {
  const rawKeywords = Array.isArray(keywords)
    ? keywords
    : (typeof keywords === 'string'
      ? (splitString ? keywords.split(/[;,\r\n]+/) : [keywords])
      : []);

  return rawKeywords.map(trimString).filter(Boolean);
};

/**
 * Clone a normalized keyword spec so callers do not share its nested array.
 *
 * @param {KeywordSpec} entry
 * @returns {KeywordSpec}
 */
const cloneKeywordEntry = (entry) => (
  typeof entry === 'string'
    ? entry
    : {
        timeStart: entry.timeStart,
        timeEnd: entry.timeEnd,
        keywords: [...entry.keywords]
      }
);

/**
 * Decode one unknown value into a normalized keyword spec.
 *
 * @param {unknown} entry
 * @returns {KeywordSpec | null}
 */
function normalizeKeywordEntry(entry) {
  if (typeof entry === 'string') {
    return trimString(entry) || null;
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  const timeStart = trimString(entry.timeStart);
  const timeEnd = trimString(entry.timeEnd);
  const keywords = normalizeKeywordTerms(entry.keywords);

  if (!TIME_RANGE_PATTERN.test(timeStart) || !TIME_RANGE_PATTERN.test(timeEnd) || keywords.length === 0) {
    return null;
  }

  return { timeStart, timeEnd, keywords };
}

/**
 * Normalize a list or supported shorthand into ordered, detached keyword specs.
 *
 * @param {unknown} entries
 * @param {KeywordEntryOptions} [options]
 * @returns {KeywordSpec[]}
 */
function normalizeKeywordEntries(entries, { splitTopLevelString = false } = {}) {
  const rawEntries = Array.isArray(entries)
    ? entries
    : (typeof entries === 'string'
      ? (splitTopLevelString ? entries.split(/[;,\r\n]+/) : [entries])
      : (isPlainObject(entries) ? [entries] : []));

  return rawEntries
    .map(normalizeKeywordEntry)
    .filter(Boolean)
    .map(cloneKeywordEntry);
}

/**
 * Compare keyword specs after normalization; spec order remains significant.
 *
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
function keywordEntriesEqual(left, right) {
  const normalizedLeft = normalizeKeywordEntries(left);
  const normalizedRight = normalizeKeywordEntries(right);

  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((entry, index) => {
      const other = normalizedRight[index];
      return typeof entry === 'string' || typeof other === 'string'
        ? entry === other
        : entry.timeStart === other.timeStart
          && entry.timeEnd === other.timeEnd
          && entry.keywords.length === other.keywords.length
          && entry.keywords.every((keyword, keywordIndex) => keyword === other.keywords[keywordIndex]);
    });
}

/**
 * Collect normalized terms from plain and time-scoped specs in source order.
 *
 * @param {unknown} entries
 * @returns {string[]}
 */
function collectKeywordTerms(entries) {
  const rawEntries = Array.isArray(entries)
    ? entries
    : (typeof entries === 'string'
      ? entries.split(/[;,\r\n]+/)
      : (isPlainObject(entries) ? [entries] : []));

  return rawEntries.flatMap((entry) => {
    if (typeof entry === 'string') {
      return normalizeKeywordTerms(entry);
    }

    if (isPlainObject(entry)) {
      return normalizeKeywordTerms(entry.keywords);
    }

    return [];
  });
}

module.exports = {
  collectKeywordTerms,
  keywordEntriesEqual,
  normalizeKeywordEntries,
  normalizeKeywordEntry,
  normalizeKeywordTerms
};
