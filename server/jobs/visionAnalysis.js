// @ts-check

const { createAsyncJobService } = require('./jobService.js');

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
  createVisionAnalysisJobService
};
