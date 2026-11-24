// @ts-check

const { createAsyncJobService } = require('./jobService.js');
const { reduceAsyncSequentially } = require('../utils/asyncReduce.js');

const ANALYSIS_PROGRESS_INTERVAL = 25;
const isEligiblePhoto = (photo) => photo.rating !== 1 && !photo.isBroken;
const selectScopeCategories = (categories, collections) => Array.isArray(categories) && categories.length > 0
  ? categories.filter((category) => Array.isArray(collections[category]))
  : Object.keys(collections);
const photosInCategory = (category, collections) => Array.isArray(collections[category]) ? collections[category] : [];
const projectVisionTags = ({ isNight, isRain, isSunny, isCloudy, isSnowy }) => ({
  isNight, isRain, isSunny, isCloudy, isSnowy
});

/**
 * One sequential pass, shared by startup, daily refresh, recrawl and manual jobs.
 * Direct scopes deliberately retain duplicates (job submissions normalize theirs).
 * Inject effects here; tag projection stays pure, while in-place application keeps
 * feed references and unrelated human metadata intact. Tests opt in with doubles;
 * the default test guard prevents the application from invoking real analysis.
 */
function createImageAnalysisRunner({
  collections,
  analyzeImageContent,
  persistCollections,
  refreshActiveFeedIfIncluded,
  broadcastStateSync,
  getVisionConfig,
  isTestMode = () => process.env.NODE_ENV === 'test',
  log = console
}) {
  return async ({ categories = [], emitProgress = () => {}, requireConfigured = false } = {}) => {
    if (isTestMode()) return;
    log.log('[Vision Service] Starting background content analysis for curated collections...');
    const scopedCategories = selectScopeCategories(categories, collections);
    if (!getVisionConfig()?.apiUrl) {
      const message = 'Vision API is not configured.';
      if (requireConfigured) throw new Error(message);
      log.warn(`[Vision Service] ${message} Skipping background content analysis.`);
      return { categories: scopedCategories, processedCount: 0, taggedCount: 0, changedCount: 0, categoryCounts: [] };
    }

    const categoryCounts = scopedCategories.map((name) => ({ name, photoCount: photosInCategory(name, collections).length }));
    const totalCandidates = scopedCategories.flatMap((category) => photosInCategory(category, collections))
      .filter(isEligiblePhoto).length;
    emitProgress({
      phase: 'scanning',
      message: totalCandidates > 0
        ? `Scanning ${totalCandidates} photo${totalCandidates === 1 ? '' : 's'} for vision analysis...`
        : 'No eligible photos found for vision analysis.',
      processedCount: 0,
      totalCount: totalCandidates
    });

    const analyzePhoto = async (counts, photo) => {
      const analysis = await analyzeImageContent(photo.url, photo.title);
      const patch = analysis ? projectVisionTags(analysis) : null;
      const changed = patch && Object.entries(patch).some(([key, value]) => photo[key] !== value);
      if (patch) Object.assign(photo, patch);
      const next = {
        processedCount: counts.processedCount + 1,
        taggedCount: counts.taggedCount + (analysis ? 1 : 0),
        changedCount: counts.changedCount + (changed ? 1 : 0),
        consecutiveFailures: analysis ? 0 : counts.consecutiveFailures + 1
      };
      if (next.consecutiveFailures >= 3) {
        const message = 'Aborting background analysis after 3 consecutive API failures. The Vision API server is likely offline or misconfigured.';
        log.warn(`[Vision Service] ${message}`);
        throw new Error(message);
      }
      if (next.processedCount === totalCandidates || next.processedCount === 1 || next.processedCount % ANALYSIS_PROGRESS_INTERVAL === 0) {
        emitProgress({
          phase: 'analyzing',
          message: `Processed ${next.processedCount} of ${totalCandidates} photo${totalCandidates === 1 ? '' : 's'}...`,
          processedCount: next.processedCount,
          totalCount: totalCandidates,
          taggedCount: next.taggedCount,
          changedCount: next.changedCount
        });
      }
      return next;
    };

    // The category reducer reads later pools at visit time. Keep the native
    // photo iterator in the effect shell: a queued Array.reduce would snapshot
    // entries/length before awaits, losing in-flight edits, appends and holes.
    const analyzeCategory = async (counts, category) => {
      let next = counts;
      for (const photo of photosInCategory(category, collections)) {
        // Recheck flags at visit time; skipped rows introduce no extra await.
        if (isEligiblePhoto(photo)) next = await analyzePhoto(next, photo);
      }
      return next;
    };
    const { processedCount, taggedCount, changedCount } = await reduceAsyncSequentially(
      analyzeCategory,
      { processedCount: 0, taggedCount: 0, changedCount: 0, consecutiveFailures: 0 }
    )(scopedCategories);

    if (taggedCount > 0) {
      log.log(`[Vision Service] Finished background image analysis. Tagged ${taggedCount} images across ${scopedCategories.length} categories.`);
      persistCollections(collections);
      refreshActiveFeedIfIncluded(scopedCategories);
      emitProgress({ phase: 'persisting', message: 'Persisting refreshed vision metadata...' });
      broadcastStateSync();
    } else {
      log.log('[Vision Service] All active images are already precisely analyzed.');
    }
    return { categories: scopedCategories, processedCount, taggedCount, changedCount, categoryCounts };
  };
}

function createVisionAnalysisJobService({
  collections,
  io,
  getActiveCategories,
  triggerImageAnalysisBackground,
  now,
  createJobId
}) {
  return createAsyncJobService({
    type: 'vision-analysis',
    collections,
    io,
    getActiveCategories,
    now,
    createJobId,
    queuedMessage: 'Vision analysis queued.',
    startingMessage: 'Starting vision-analysis job...',
    completeMessage: 'Vision analysis completed successfully.',
    failureMessage: 'Vision analysis failed.',
    execute: (job, emitProgress) => triggerImageAnalysisBackground({
      categories: job.scope.categories,
      requireConfigured: true,
      emitProgress
    })
  });
}

module.exports = {
  createImageAnalysisRunner,
  createVisionAnalysisJobService
};
