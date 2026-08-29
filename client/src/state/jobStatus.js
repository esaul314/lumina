// @ts-check

/** @typedef {'recrawl'|'vision-analysis'} JobType */
/** @typedef {{loadingMessage: string, successMessage: string, failureMessage: string, countKey: 'visibleCount'|'taggedCount'}} JobStatusSpec */
/** @typedef {{message?: string}} JobProgress */
/** @typedef {Record<string, number|undefined>} JobResult */

/**
 * The server job envelope is deliberately local to the client boundary. The
 * transport may still deliver a legacy or partially populated payload, while
 * the projection below gives both supported job types one stable vocabulary.
 *
 * @typedef {object} JobStatusEvent
 * @property {JobType=} type
 * @property {string=} status
 * @property {JobProgress=} progress
 * @property {JobResult=} result
 * @property {string=} error
 */

/** @typedef {{success?: boolean, count?: number, error?: string}} LegacyRecrawlCompletion */
/** @typedef {{status: 'loading'|'success'|'error', message: string, count?: number, reset?: boolean}} JobStatusUpdate */
/** @typedef {{type: JobType|undefined, update: JobStatusUpdate|null}} JobEventProjection */

/** @type {Readonly<Record<JobType, JobStatusSpec>>} */
const JOB_STATUS_SPECS = Object.freeze({
  recrawl: Object.freeze({
    loadingMessage: 'Crawling web feeds & self-healing links...',
    successMessage: 'Feed recrawl completed successfully.',
    failureMessage: 'Recrawl failed.',
    countKey: 'visibleCount'
  }),
  'vision-analysis': Object.freeze({
    loadingMessage: 'Analyzing photo metadata...',
    successMessage: 'Vision analysis completed successfully.',
    failureMessage: 'Vision analysis failed.',
    countKey: 'taggedCount'
  })
});

/** @param {string} status @returns {boolean} */
const isActiveJob = (status) => status === 'queued' || status === 'running';

/** @param {unknown} type @returns {type is JobType} */
const hasJobStatusSpec = (type) => Object.prototype.hasOwnProperty.call(JOB_STATUS_SPECS, type);

/**
 * Project a server job event into the small UI state algebra shared by all
 * supported job types. The Socket.IO shell remains responsible for applying
 * the projection to React state and scheduling its transient reset.
 *
 * @param {unknown} job
 * @returns {JobStatusUpdate|null}
 */
export function projectJobStatus(job) {
  const event = /** @type {JobStatusEvent|null|undefined} */ (job);
  const spec = hasJobStatusSpec(event?.type) ? JOB_STATUS_SPECS[event.type] : null;
  if (!spec) {
    return null;
  }

  if (isActiveJob(event.status || '')) {
    return {
      status: 'loading',
      message: event.progress?.message || spec.loadingMessage
    };
  }

  if (event.status === 'succeeded') {
    return {
      status: 'success',
      count: event.result?.[spec.countKey] || 0,
      message: event.progress?.message || spec.successMessage,
      reset: true
    };
  }

  if (event.status === 'failed') {
    return {
      status: 'error',
      message: event.error || spec.failureMessage,
      reset: true
    };
  }

  return null;
}

/**
 * Normalize the modern and mixed-version job event envelopes into one pure
 * projection. The caller still owns applying the update to its view target.
 *
 * @param {string} event
 * @param {unknown} payload
 * @returns {JobEventProjection|null}
 */
export function projectJobEvent(event, payload) {
  if (event === 'job-status') {
    const job = /** @type {JobStatusEvent|null|undefined} */ (payload);
    return {
      type: job?.type,
      update: projectJobStatus(job)
    };
  }

  if (event === 'recrawl-complete') {
    const completion = /** @type {LegacyRecrawlCompletion|null|undefined} */ (payload);
    return {
      type: 'recrawl',
      update: projectJobStatus({
        type: 'recrawl',
        status: completion?.success ? 'succeeded' : 'failed',
        result: { visibleCount: completion?.count },
        error: completion?.error
      })
    };
  }

  return null;
}
