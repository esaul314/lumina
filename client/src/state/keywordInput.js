// @ts-check

/**
 * @typedef {{timeStart: string, timeEnd: string, keywords: string[]}} FeedParameter
 * @typedef {FeedParameter|string} ParsedFeedParameter
 */

/** @type {RegExp} */
const KEYWORD_SEPARATOR_PATTERN = /[;,\r\n]+/;

/**
 * Split pasted keyword text without changing the phrase text itself.
 * Commas, semicolons, and line breaks are all accepted as separators.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function splitKeywordInput(value) {
  return typeof value === 'string'
    ? value.split(KEYWORD_SEPARATOR_PATTERN).map((item) => item.trim()).filter(Boolean)
    : [];
}

/**
 * Parse feed-editor lines into timed keyword records or untimed phrases.
 *
 * The parser deliberately leaves validation and persistence to their owning
 * boundaries: malformed/non-string input becomes an empty list, while the
 * supplied regular expression defines the accepted time-range syntax.
 *
 * @param {unknown} value
 * @param {RegExp} timeRangePattern
 * @returns {ParsedFeedParameter[]}
 */
export function parseFeedParameterInput(value, timeRangePattern) {
  const inputLines = typeof value === 'string' ? value.split(/\r?\n/) : [];

  return inputLines.flatMap((line) => {
    const inputLine = line.trim();
    if (!inputLine) {
      return [];
    }

    const match = inputLine.match(timeRangePattern);
    if (match) {
      const [, start, end, keywords] = match;
      return [{
        timeStart: start,
        timeEnd: end,
        keywords: splitKeywordInput(keywords)
      }];
    }

    return splitKeywordInput(inputLine);
  });
}
