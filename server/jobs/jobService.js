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

/**
 * Create the shared async-job state machine. Job-specific execution remains a
 * callback so the lifecycle algebra does not know about crawling or analysis.
 *
 * @param {{
 *   type: string,
 *   collections: Record<string, any>,
 *   io: { emit: (event: string, payload: any) => void },
 *   getActiveCategories: () => string[],
 *   execute: (job: Record<string, any>, emitProgress: (progress: Record<string, any>) => void) => Promise<any>,
 *   emitTerminal?: (job: Record<string, any>) => void,
 *   now?: () => Date,
 *   createJobId?: () => string,
 *   queuedMessage: string,
 *   startingMessage: string,
 *   completeMessage: string,
 *   failureMessage: string
 * }} options
 */
function createAsyncJobService({
  type,
  collections,
  io,
  getActiveCategories,
  execute,
  emitTerminal = () => {},
  now = () => new Date(),
  createJobId = () => `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  queuedMessage,
  startingMessage,
  completeMessage,
  failureMessage
}) {
  /** @type {Map<string, Record<string, any>>} */
  const jobs = new Map();
  /** @type {Promise<void> | null} */
  let activeRun = null;
  let latestJobId = null;

  const emitJob = (job) => {
    io.emit(JOB_STATUS_EVENT, job);
    emitTerminal(job);
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
        message: startingMessage
      }
    });

    try {
      const result = await execute(job, (progress) => {
        updateJob(job.id, { progress });
      });

      buildTerminalJob(job.id, 'succeeded', {
        progress: {
          phase: 'complete',
          message: completeMessage
        },
        result
      });
    } catch (error) {
      buildTerminalJob(job.id, 'failed', {
        progress: {
          phase: 'error',
          message: failureMessage
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
      type,
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
        message: queuedMessage
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

  return {
    getLatestJob: () => latestJobId ? jobs.get(latestJobId) || null : null,
    submit,
    waitForIdle: () => activeRun || Promise.resolve()
  };
}

module.exports = {
  JOB_STATUS_EVENT,
  createAsyncJobService,
  normalizeScopeCategories,
  toErrorMessage,
  toIsoString
};
