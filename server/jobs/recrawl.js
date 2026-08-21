// @ts-check

const { curry } = require('../utils/fn.js');
const {
  JOB_STATUS_EVENT,
  createAsyncJobService,
  normalizeScopeCategories
} = require('./jobService.js');

const LEGACY_RECRAWL_COMPLETE_EVENT = 'recrawl-complete';
const mapCategoryPhoto = curry((category, photo) => ({ ...photo, category }));
const tagCategoryPhotos = curry((category, photos = []) => photos.map(mapCategoryPhoto(category)));
const pickRecord = curry((keys, record = {}) => keys.reduce((picked, key) => {
  if (record[key] !== undefined) {
    picked[key] = record[key];
  }
  return picked;
}, {}));

function mergeUpdatedCollections(collections, updatedCollections) {
  Object.entries(updatedCollections).forEach(([category, photos]) => {
    collections[category] = tagCategoryPhotos(category, photos);
  });
}

function buildCategoryCounts(categories, collections) {
  return categories.map((category) => ({
    name: category,
    photoCount: Array.isArray(collections[category]) ? collections[category].length : 0
  }));
}

async function executeRecrawlPass({
  state,
  collections,
  crawlCollections,
  persistCollections,
  buildActiveFeed,
  getActiveCategories,
  broadcastStateSync,
  triggerImageAnalysisBackground,
  categories,
  emitProgress = () => {},
  broadcast = true
}) {
  const activeCategories = getActiveCategories();
  const scopedCategories = normalizeScopeCategories(categories, collections, activeCategories);
  const scopedCollections = pickRecord(scopedCategories, collections);
  const scopedFeedConfigs = pickRecord(scopedCategories, state.feedConfigs || {});
  const scopedKeywords = pickRecord(scopedCategories, state.searchKeywords || {});

  emitProgress({
    phase: 'crawling',
    message: `Recrawling ${scopedCategories.length} feed pool${scopedCategories.length === 1 ? '' : 's'}...`
  });

  const { updatedCollections, updatedAny } = await crawlCollections(
    scopedCollections,
    scopedFeedConfigs,
    scopedKeywords,
    state.excludedKeywords,
    state.poolPolicies
  );

  emitProgress({
    phase: 'persisting',
    message: updatedAny
      ? 'Persisting refreshed collection data...'
      : 'No new photos found. Refreshing the live snapshot...'
  });

  if (updatedAny) {
    mergeUpdatedCollections(collections, updatedCollections);
    persistCollections(collections, state);
  }

  const affectsActiveFeed = activeCategories.some((category) => scopedCategories.includes(category));
  if (affectsActiveFeed) {
    emitProgress({
      phase: 'syncing',
      message: 'Refreshing the active balanced feed...'
    });
    state.photosList = buildActiveFeed(activeCategories, collections);
  }

  if (broadcast) {
    emitProgress({
      phase: 'broadcasting',
      message: 'Broadcasting refreshed state to connected displays...'
    });
    broadcastStateSync();
  }

  emitProgress({
    phase: 'analyzing',
    message: 'Scheduling background image analysis for new photos...'
  });
  triggerImageAnalysisBackground({ categories: scopedCategories }).catch((error) => {
    console.error('Error in background image analysis:', error);
  });

  return {
    categories: scopedCategories,
    updatedAny,
    visibleCount: Array.isArray(state.photosList) ? state.photosList.length : 0,
    categoryCounts: buildCategoryCounts(scopedCategories, collections)
  };
}

function createRecrawlJobService({
  state,
  collections,
  io,
  crawlCollections,
  persistCollections,
  buildActiveFeed,
  getActiveCategories,
  broadcastStateSync,
  triggerImageAnalysisBackground,
  now,
  createJobId
}) {
  return createAsyncJobService({
    type: 'recrawl',
    collections,
    io,
    getActiveCategories,
    now,
    createJobId,
    queuedMessage: 'Feed recrawl queued.',
    startingMessage: 'Starting feed recrawl job...',
    completeMessage: 'Feed recrawl completed successfully.',
    failureMessage: 'Feed recrawl failed.',
    emitTerminal: (job) => {
      if (job.status === 'succeeded') {
        io.emit(LEGACY_RECRAWL_COMPLETE_EVENT, {
          success: true,
          count: job.result?.visibleCount || 0
        });
      }

      if (job.status === 'failed') {
        io.emit(LEGACY_RECRAWL_COMPLETE_EVENT, {
          success: false,
          error: job.error || 'Recrawl failed.'
        });
      }
    },
    execute: (job, emitProgress) => executeRecrawlPass({
      state,
      collections,
      crawlCollections,
      persistCollections,
      buildActiveFeed,
      getActiveCategories,
      broadcastStateSync,
      triggerImageAnalysisBackground,
      categories: job.scope.categories,
      emitProgress
    })
  });
}

module.exports = {
  JOB_STATUS_EVENT,
  LEGACY_RECRAWL_COMPLETE_EVENT,
  createRecrawlJobService,
  executeRecrawlPass,
  normalizeScopeCategories
};
