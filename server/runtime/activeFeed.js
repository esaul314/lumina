// @ts-check

const { buildBalancedFeed, normalizeCategorySelection } = require('../domain/selectors.js');

const DEFAULT_ACTIVE_FEED_CATEGORY = 'Scenic Nature';

const splitCategorySelection = (value) => String(value ?? '')
  .split(',')
  .map((category) => category.trim())
  .filter(Boolean);

const uniqueStrings = (values) => [...new Set(values)];

const getAvailableCategories = (collections = {}, externalCollections = {}) => uniqueStrings([
  ...Object.keys(collections),
  ...Object.keys(externalCollections)
]);

function normalizeActiveCategories({
  currentCategory,
  collections,
  externalCollections = {},
  fallbackCategory = DEFAULT_ACTIVE_FEED_CATEGORY
}) {
  return normalizeCategorySelection(
    splitCategorySelection(currentCategory),
    getAvailableCategories(collections, externalCollections),
    fallbackCategory
  );
}

function buildFeedSelection({
  selectedCategories,
  collections,
  externalCollections = {},
  excludedKeywords = []
}) {
  return buildBalancedFeed({
    selectedCategories,
    collections,
    externalCollections,
    excludedKeywords
  });
}

function createActiveFeedRuntime({
  state,
  collections,
  getExternalCollections = () => ({}),
  fallbackCategory = DEFAULT_ACTIVE_FEED_CATEGORY
}) {
  const readExternalCollections = () => getExternalCollections() ?? {};

  const getActiveCategories = () => normalizeActiveCategories({
    currentCategory: state.currentCategory,
    collections,
    externalCollections: readExternalCollections(),
    fallbackCategory
  });

  const buildActiveFeed = (selectedCategories = getActiveCategories()) => buildFeedSelection({
    selectedCategories,
    collections,
    externalCollections: readExternalCollections(),
    excludedKeywords: state.excludedKeywords
  });

  const buildFallbackFeed = () => buildFeedSelection({
    selectedCategories: [fallbackCategory],
    collections,
    externalCollections: readExternalCollections(),
    excludedKeywords: state.excludedKeywords
  });

  const setPhotosList = (photos) => {
    state.photosList = photos;
    return photos;
  };

  const refreshActiveFeed = (selectedCategories = getActiveCategories()) => {
    const nextPhotos = buildActiveFeed(selectedCategories);
    return setPhotosList(nextPhotos.length > 0 ? nextPhotos : buildFallbackFeed());
  };

  const activeFeedIncludesAny = (categories = []) => getActiveCategories()
    .some((category) => categories.includes(category));

  const refreshActiveFeedIfIncluded = (categories = []) => (
    activeFeedIncludesAny(categories)
      ? refreshActiveFeed()
      : state.photosList
  );

  return {
    activeFeedIncludesAny,
    buildActiveFeed,
    buildFallbackFeed,
    getActiveCategories,
    refreshActiveFeed,
    refreshActiveFeedIfIncluded
  };
}

module.exports = {
  DEFAULT_ACTIVE_FEED_CATEGORY,
  buildFeedSelection,
  createActiveFeedRuntime,
  getAvailableCategories,
  normalizeActiveCategories,
  splitCategorySelection
};
