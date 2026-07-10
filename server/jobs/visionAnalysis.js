// @ts-check

const { normalizeCategorySelection } = require('../domain/selectors.js');

const JOB_STATUS_EVENT = 'job-status';
const DEFAULT_CATEGORY = 'Scenic Nature';

const toErrorMessage = (error) => error instanceof Error ? error.message : String(error);
const toIsoString = (value) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();

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

function createVisionAnalysisJobService({
  state: _state,
  collections,
  io,
  getActiveCategories,
  triggerImageAnalysisBackground,
  now = () => new Date(),
  createJobId = () => `vision-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}) {
  /** @type {Map<string, Record<string, any>>} */
  const jobs = new Map();
  /** @type {Promise<void> | null} */
  let activeRun = null;
  let latestJobId = null;

  const emitJob = (job) => {
    io.emit(JOB_STATUS_EVENT, job);
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
        message: 'Starting vision-analysis job...'
      }
    });

    try {
      const result = await triggerImageAnalysisBackground({
        categories: job.scope.categories,
        requireConfigured: true,
        emitProgress: (progress) => {
          updateJob(job.id, { progress });
        }
      });

      buildTerminalJob(job.id, 'succeeded', {
        progress: {
          phase: 'complete',
          message: 'Vision analysis completed successfully.'
        },
        result
      });
    } catch (error) {
      buildTerminalJob(job.id, 'failed', {
        progress: {
          phase: 'error',
          message: 'Vision analysis failed.'
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
      type: 'vision-analysis',
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
        message: 'Vision analysis queued.'
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
  createVisionAnalysisJobService
};
