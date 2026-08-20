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

const isActiveJob = (status) => status === 'queued' || status === 'running';
const hasJobStatusSpec = (type) => Object.prototype.hasOwnProperty.call(JOB_STATUS_SPECS, type);

/**
 * Project a server job event into the small UI state algebra shared by all
 * supported job types. The Socket.IO shell remains responsible for applying
 * the projection to React state and scheduling its transient reset.
 */
export function projectJobStatus(job) {
  const spec = hasJobStatusSpec(job?.type) ? JOB_STATUS_SPECS[job.type] : null;
  if (!spec) {
    return null;
  }

  if (isActiveJob(job.status)) {
    return {
      status: 'loading',
      message: job.progress?.message || spec.loadingMessage
    };
  }

  if (job.status === 'succeeded') {
    return {
      status: 'success',
      count: job.result?.[spec.countKey] || 0,
      message: job.progress?.message || spec.successMessage,
      reset: true
    };
  }

  if (job.status === 'failed') {
    return {
      status: 'error',
      message: job.error || spec.failureMessage,
      reset: true
    };
  }

  return null;
}
