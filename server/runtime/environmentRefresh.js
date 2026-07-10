// @ts-check

const fs = require('fs');
const { curry } = require('../utils/fn.js');

const NEWS_RSS_URL = 'https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const withCategory = curry((category, photo) => ({ ...photo, category }));

function createNewsRssFetcher({
  fetchImpl = fetch,
  log = console,
  url = NEWS_RSS_URL
} = {}) {
  return async () => {
    log.log('News Sentiment: Fetching headlines from Google News RSS...');
    const response = await fetchImpl(url);
    if (!response.ok) {
      log.warn('News Sentiment: Failed to fetch Google News RSS');
      return null;
    }

    return response.text();
  };
}

function readLastUpdatedTimestamp({
  fsImpl = fs,
  jsonPath,
  log = console
}) {
  if (!fsImpl.existsSync(jsonPath)) {
    return 0;
  }

  try {
    const fileData = JSON.parse(fsImpl.readFileSync(jsonPath, 'utf8'));
    return fileData.lastUpdated ?? 0;
  } catch (error) {
    log.warn('Could not parse persisted curated collections for last update check:', error.message);
    return 0;
  }
}

function shouldSkipDailyFeedUpdate({
  now,
  lastUpdated,
  refreshIntervalMs = ONE_DAY_MS
}) {
  return lastUpdated > 0 && (now - lastUpdated) < refreshIntervalMs;
}

function buildWeatherDataSnapshot(location, data) {
  return {
    location,
    current: data.current,
    daily: data.daily
  };
}

function buildPhysicalWeatherSnapshot(currentWeather, classifyWeatherCode) {
  if (!currentWeather) {
    return null;
  }

  const { physicalMatch, physicalCond } = classifyWeatherCode(currentWeather.weather_code);
  return {
    temp: Math.round(currentWeather.temperature_2m),
    condition: physicalCond,
    weatherMatch: physicalMatch
  };
}

function mergeUpdatedCollections(collections, updatedCollections = {}) {
  Object.entries(updatedCollections).forEach(([category, photos = []]) => {
    collections[category] = photos.map(withCategory(category));
  });
}

function createEnvironmentRefreshRuntime({
  state,
  collections,
  activeFeedRuntime,
  jsonPath,
  setWeatherData,
  resolveActiveLocation,
  fetchWeatherForecast,
  classifyWeatherCode,
  analyzeSentiment,
  crawlCollections,
  persistCollections,
  broadcastStateSync,
  triggerImageAnalysisBackground,
  readNewsRss = createNewsRssFetcher(),
  fsImpl = fs,
  now = () => Date.now(),
  refreshIntervalMs = ONE_DAY_MS,
  log = console
}) {
  const updateNewsSentiment = async () => {
    try {
      const rssText = await readNewsRss();
      if (!rssText) {
        return null;
      }

      const nextSentiment = analyzeSentiment(rssText);
      state.newsSentiment = nextSentiment;
      log.log(`News Sentiment: Success! Score=${nextSentiment.score.toFixed(3)} (${nextSentiment.label}) -> Correlated weather mood: ${nextSentiment.weatherMatch}`);
      broadcastStateSync();
      return nextSentiment;
    } catch (error) {
      log.error('Failed to update news sentiment:', error.message);
      return null;
    }
  };

  const updateServerWeather = async () => {
    try {
      const location = await resolveActiveLocation(state);
      const weatherData = await fetchWeatherForecast(location.lat, location.lon);
      if (!weatherData || weatherData.error) {
        return null;
      }

      const nextWeatherData = buildWeatherDataSnapshot(location, weatherData);
      setWeatherData(nextWeatherData);

      const nextPhysicalWeather = buildPhysicalWeatherSnapshot(weatherData.current, classifyWeatherCode);
      if (nextPhysicalWeather) {
        state.physicalWeather = nextPhysicalWeather;
      }

      log.log('Server weather cache updated successfully.');
      broadcastStateSync();
      return nextWeatherData;
    } catch (error) {
      log.error('Failed to update server weather cache:', error.message);
      return null;
    }
  };

  const updateFeedsDaily = async () => {
    log.log('Checking for daily dynamic feed updates...');

    const lastUpdated = readLastUpdatedTimestamp({
      fsImpl,
      jsonPath,
      log
    });
    const currentTime = now();
    if (shouldSkipDailyFeedUpdate({ now: currentTime, lastUpdated, refreshIntervalMs })) {
      log.log('Feeds were updated less than 24 hours ago. Skipping daily update.');
      return {
        skipped: true,
        updatedAny: false,
        lastUpdated
      };
    }

    const { updatedCollections, updatedAny } = await crawlCollections(
      collections,
      state.feedConfigs,
      state.searchKeywords,
      state.excludedKeywords
    );

    if (!updatedAny) {
      return {
        skipped: false,
        updatedAny: false,
        lastUpdated
      };
    }

    mergeUpdatedCollections(collections, updatedCollections);
    persistCollections(collections, state);
    activeFeedRuntime.refreshActiveFeed();
    broadcastStateSync();
    triggerImageAnalysisBackground().catch((error) => {
      log.error('Error in background image analysis:', error);
    });

    return {
      skipped: false,
      updatedAny: true,
      lastUpdated
    };
  };

  return {
    updateFeedsDaily,
    updateNewsSentiment,
    updateServerWeather
  };
}

module.exports = {
  NEWS_RSS_URL,
  ONE_DAY_MS,
  buildPhysicalWeatherSnapshot,
  buildWeatherDataSnapshot,
  createEnvironmentRefreshRuntime,
  createNewsRssFetcher,
  mergeUpdatedCollections,
  readLastUpdatedTimestamp,
  shouldSkipDailyFeedUpdate
};
