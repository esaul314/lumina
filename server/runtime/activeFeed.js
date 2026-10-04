// @ts-check

const { buildBalancedFeed, normalizeCategorySelection } = require('../domain/selectors.js');

/**
 * The runtime consumes domain photos but keeps feed configuration local to this boundary.
 * @typedef {import('../domain/types').Photo} ActiveFeedPhoto
 * @typedef {Record<string, ActiveFeedPhoto[]>} PhotoCollections
 */

/** @typedef {string[]} CategorySelection */

/**
 * @typedef {object} ActiveFeedState
 * @property {string} currentCategory
 * @property {string[]=} excludedKeywords
 * @property {ActiveFeedPhoto[]} photosList
 */

/**
 * @typedef {object} ActiveCategoryOptions
 * @property {unknown} currentCategory
 * @property {PhotoCollections} collections
 * @property {PhotoCollections=} externalCollections
 * @property {string=} fallbackCategory
 */

/**
 * @typedef {object} FeedSelectionOptions
 * @property {CategorySelection} selectedCategories
 * @property {PhotoCollections} collections
 * @property {PhotoCollections=} externalCollections
 * @property {string[]=} excludedKeywords
 */

/**
 * @typedef {object} ActiveFeedRuntimeOptions
 * @property {ActiveFeedState} state
 * @property {PhotoCollections} collections
 * @property {() => (PhotoCollections | null | undefined)=} getExternalCollections
 * @property {string=} fallbackCategory
 */

/**
 * @typedef {object} ActiveFeedRuntime
 * @property {() => CategorySelection} getActiveCategories
 * @property {(selectedCategories?: CategorySelection) => ActiveFeedPhoto[]} buildActiveFeed
 * @property {() => ActiveFeedPhoto[]} buildFallbackFeed
 * @property {(selectedCategories?: CategorySelection) => ActiveFeedPhoto[]} refreshActiveFeed
 * @property {(categories?: CategorySelection) => ActiveFeedPhoto[]} refreshActiveFeedIfIncluded
 */

const DEFAULT_ACTIVE_FEED_CATEGORY = 'Scenic Nature';

/**
 * Decode the legacy comma-separated selection into trimmed category names.
 *
 * @param {unknown} value
 * @returns {CategorySelection}
 */
const splitCategorySelection = (value) => String(value ?? '')
  .split(',')
  .map((category) => category.trim())
  .filter(Boolean);

/** @param {string[]} values @returns {string[]} */
const uniqueStrings = (values) => [...new Set(values)];

/**
 * @param {PhotoCollections} [collections]
 * @param {PhotoCollections} [externalCollections]
 * @returns {CategorySelection}
 */
const getAvailableCategories = (collections = {}, externalCollections = {}) => uniqueStrings([
  ...Object.keys(collections),
  ...Object.keys(externalCollections)
]);

/**
 * Normalize legacy category input against both persisted and external pools.
 *
 * @param {ActiveCategoryOptions} options
 * @returns {CategorySelection}
 */
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

/**
 * Project the visible, balanced feed for a category selection without mutating its sources.
 *
 * @param {FeedSelectionOptions} options
 * @returns {ActiveFeedPhoto[]}
 */
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

/**
 * Interpret feed projections and assign the resulting list at the legacy runtime boundary.
 *
 * @param {ActiveFeedRuntimeOptions} options
 * @returns {ActiveFeedRuntime}
 */
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
