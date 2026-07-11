// @ts-check

const TIME_RANGE_PATTERN = /^([0-1]?\d|2[0-3]):[0-5]\d$/;

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const trimString = (value) => typeof value === 'string' ? value.trim() : '';

const normalizeKeywordTerms = (keywords, { splitString = false } = {}) => {
  const rawKeywords = Array.isArray(keywords)
    ? keywords
    : (typeof keywords === 'string'
      ? (splitString ? keywords.split(/[;,]/) : [keywords])
      : []);

  return rawKeywords.map(trimString).filter(Boolean);
};

const cloneKeywordEntry = (entry) => (
  typeof entry === 'string'
    ? entry
    : {
        timeStart: entry.timeStart,
        timeEnd: entry.timeEnd,
        keywords: [...entry.keywords]
      }
);

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

function normalizeKeywordEntries(entries, { splitTopLevelString = false } = {}) {
  const rawEntries = Array.isArray(entries)
    ? entries
    : (typeof entries === 'string'
      ? (splitTopLevelString ? entries.split(/[;,]/) : [entries])
      : (isPlainObject(entries) ? [entries] : []));

  return rawEntries
    .map(normalizeKeywordEntry)
    .filter(Boolean)
    .map(cloneKeywordEntry);
}

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

function collectKeywordTerms(entries) {
  const rawEntries = Array.isArray(entries)
    ? entries
    : (typeof entries === 'string'
      ? entries.split(/[;,]/)
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
