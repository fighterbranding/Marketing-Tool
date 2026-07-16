export const DEFAULT_QUEUE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 86400 },
  removeOnFail: { age: 604800 },
};
