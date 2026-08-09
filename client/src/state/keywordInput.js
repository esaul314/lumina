const KEYWORD_SEPARATOR_PATTERN = /[;,\r\n]+/;

/**
 * Split pasted keyword text without changing the phrase text itself.
 * Commas, semicolons, and line breaks are all accepted as separators.
 */
export function splitKeywordInput(value) {
  return typeof value === 'string'
    ? value.split(KEYWORD_SEPARATOR_PATTERN).map((item) => item.trim()).filter(Boolean)
    : [];
}

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
