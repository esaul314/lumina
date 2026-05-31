/**
 * 📰 News Sentiment Analysis Service
 * Uses pure functional mappings and declarative parsing to analyze real-time news headlines.
 * Fuses global sentiment scores directly to screensaver moods.
 */

// Heuristic positive and negative lexicon arrays
const positiveWords = [
  'hope', 'breakthrough', 'success', 'win', 'wins', 'won', 'celebrate', 'celebrates', 'celebration', 
  'good', 'great', 'growth', 'rising', 'rise', 'agreement', 'peace', 'sunny', 'love', 'bright', 
  'positive', 'joy', 'happy', 'heals', 'healing', 'cure', 'cured', 'recovery', 'recovers', 
  'innovation', 'advancement', 'progress', 'benefit', 'beautiful', 'friendly', 'smile', 'smiles', 
  'gains', 'gain', 'optimism', 'optimistic', 'green'
];

const negativeWords = [
  'crash', 'tragedy', 'crisis', 'tension', 'tensions', 'storm', 'storms', 'war', 'conflict', 'clash', 
  'clashes', 'dispute', 'protest', 'protests', 'strike', 'strikes', 'attack', 'attacks', 'killed', 
  'death', 'dead', 'fear', 'panic', 'drop', 'drops', 'dropped', 'decline', 'declines', 'inflation', 
  'threat', 'threatens', 'threatened', 'danger', 'dangerous', 'dread', 'disaster', 'damage', 
  'damages', 'damaged', 'concern', 'concerns', 'worries', 'worry', 'loss', 'losses', 'lost', 
  'fired', 'firing', 'collapse', 'collapses', 'collapsed', 'arrest', 'arrests', 'arrested', 
  'accused', 'charge', 'charges', 'investigation', 'probe'
];

const { curry, reduce } = require('../utils/fn.js');

/**
 * 🔍 countWordMatches
 * Curried match counter that supports partial execution.
 */
const countWordMatches = curry((wordList, text) => 
  reduce((acc, word) => {
    const regex = new RegExp('\\b' + word + '\\b', 'g');
    const matches = text.match(regex);
    return acc + (matches ? matches.length : 0);
  }, 0, wordList)
);

// Partially execute the counter to create dedicated positive/negative taggers
const countPositives = countWordMatches(positiveWords);
const countNegatives = countWordMatches(negativeWords);

/**
 * 📰 getHeadlines
 * Pure declarative extractor of headline titles from XML.
 */
const getHeadlines = (xmlText) => {
  const titleRegex = /<title>([^<]+)<\/title>/g;
  const matches = [];
  let match;
  while ((match = titleRegex.exec(xmlText)) !== null) {
    matches.push(match[1].toLowerCase());
  }
  // Skip the main RSS feed title if it includes "google news"
  if (matches.length > 0 && matches[0].includes('google news')) {
    return matches.slice(1);
  }
  return matches;
};

/**
 * 🧠 analyzeSentiment
 * Functional sentiment scoring engine. Takes raw Google News RSS XML,
 * parses headlines, and scores net positivity/negativity.
 */
function analyzeSentiment(rssXmlText) {
  const headlines = getHeadlines(rssXmlText);
  if (headlines.length === 0) {
    return { score: 0, label: 'Overcast / Calm', weatherMatch: 'Cloudy', headlinesCount: 0 };
  }

  // Pure declarative reduction using partially executed counters
  const { posCount, negCount } = headlines.reduce(
    (acc, headline) => ({
      posCount: acc.posCount + countPositives(headline),
      negCount: acc.negCount + countNegatives(headline)
    }), 
    { posCount: 0, negCount: 0 }
  );

  const totalMatches = posCount + negCount;
  const score = totalMatches > 0 ? (posCount - negCount) / (totalMatches + 1) : 0;

  let label = 'Overcast / Calm';
  let weatherMatch = 'Cloudy';

  if (score <= -0.1) {
    label = 'Stormy / Tense';
    weatherMatch = 'Rainy';
  } else if (score >= 0.1) {
    label = 'Sunny / Hopeful';
    weatherMatch = 'Sunny';
  }

  return {
    score: parseFloat(score.toFixed(3)),
    label,
    weatherMatch,
    headlinesCount: headlines.length
  };
}

module.exports = {
  positiveWords,
  negativeWords,
  analyzeSentiment
};
