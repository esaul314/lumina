// @ts-check

const { normalizeCategorySelection } = require('../domain/selectors.js');
const { curry } = require('../utils/fn.js');

const JOB_STATUS_EVENT = 'job-status';
const LEGACY_RECRAWL_COMPLETE_EVENT = 'recrawl-complete';
const DEFAULT_CATEGORY = 'Scenic Nature';

const toErrorMessage = (error) => error instanceof Error ? error.message : String(error);
const toIsoString = (value) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const mapCategoryPhoto = curry((category, photo) => ({ ...photo, category }));
const tagCategoryPhotos = curry((category, photos = []) => photos.map(mapCategoryPhoto(category)));
const pickRecord = curry((keys, record = {}) => keys.reduce((picked, key) => {
  if (record[key] !== undefined) {
    picked[key] = record[key];
  }
  return picked;
}, {}));

function normalizeScopeCategories(requestedCategories, collections, fallbackCategories = []) {
  const availableCategories = Object.keys(collections);
  if (!Array.isArray(requestedCategories) || requestedCategories.length === 0) {
    return availableCategories.length > 0
      ? availableCategories
      : normalizeCategorySelection(
          fallbackCategories,
          availableCategories,
          fallbackCategories[0] || DEFAULT_CATEGORY
        );
  }

  return normalizeCategorySelection(
    requestedCategories,
    availableCategories,
    fallbackCategories[0] || availableCategories[0] || DEFAULT_CATEGORY
  );
}

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
    state.excludedKeywords
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
  now = () => new Date(),
  createJobId = () => `recrawl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}) {
  /** @type {Map<string, Record<string, any>>} */
  const jobs = new Map();
  /** @type {Promise<void> | null} */
  let activeRun = null;
  let latestJobId = null;

  const emitJob = (job) => {
    io.emit(JOB_STATUS_EVENT, job);

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
  };

  const storeJob = (job) => {
    jobs.set(job.id, job);
    latestJobId = job.id;
    emitJob(job);
    return job;
  };

  const updateJob = (jobId, patch) => {
    const currentJob = jobs.get(jobId);
    if (!currentJob) {
      return null;
    }

    const nextJob = {
      ...currentJob,
      ...patch,
      progress: patch.progress
        ? {
            ...(currentJob.progress || {}),
            ...patch.progress
          }
        : currentJob.progress
    };

    return storeJob(nextJob);
  };

  const buildTerminalJob = (jobId, status, patch) => updateJob(jobId, {
    status,
    completedAt: toIsoString(now()),
    ...patch
  });

  const runJob = async (job) => {
    updateJob(job.id, {
      status: 'running',
      startedAt: toIsoString(now()),
      progress: {
        phase: 'starting',
        message: 'Starting feed recrawl job...'
      }
    });

    try {
      const result = await executeRecrawlPass({
        state,
        collections,
        crawlCollections,
        persistCollections,
        buildActiveFeed,
        getActiveCategories,
        broadcastStateSync,
        triggerImageAnalysisBackground,
        categories: job.scope.categories,
        emitProgress: (progress) => {
          updateJob(job.id, { progress });
        }
      });

      buildTerminalJob(job.id, 'succeeded', {
        progress: {
          phase: 'complete',
          message: 'Feed recrawl completed successfully.'
        },
        result
      });
    } catch (error) {
      buildTerminalJob(job.id, 'failed', {
        progress: {
          phase: 'error',
          message: 'Feed recrawl failed.'
        },
        error: toErrorMessage(error)
      });
    }
  };

  async function submit({ categories = [], requestedBy = 'rest' } = {}) {
    const activeJob = latestJobId ? jobs.get(latestJobId) : null;
    if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'running')) {
      return {
        job: activeJob,
        reused: true
      };
    }

    const scopedCategories = normalizeScopeCategories(categories, collections, getActiveCategories());
    const requestedAt = toIsoString(now());
    const job = storeJob({
      id: createJobId(),
      type: 'recrawl',
      status: 'queued',
      requestedBy,
      requestedAt,
      startedAt: null,
      completedAt: null,
      scope: {
        categories: scopedCategories
      },
      progress: {
        phase: 'queued',
        message: 'Feed recrawl queued.'
      },
      result: null,
      error: null
    });

    activeRun = runJob(job).finally(() => {
      activeRun = null;
    });

    return {
      job,
      reused: false
    };
  }

  function getLatestJob() {
    return latestJobId ? jobs.get(latestJobId) || null : null;
  }

  function waitForIdle() {
    return activeRun || Promise.resolve();
  }

  return {
    getLatestJob,
    submit,
    waitForIdle
  };
}

module.exports = {
  JOB_STATUS_EVENT,
  LEGACY_RECRAWL_COMPLETE_EVENT,
  createRecrawlJobService,
  executeRecrawlPass
};
