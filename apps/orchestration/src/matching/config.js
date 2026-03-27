// @ts-check

export const QUEUE_NAME = 'matching'

export const JOB_TYPES = /** @type {const} */ ({
  JOB_POSTED: 'job.posted',
  PHYSICIAN_UPDATED: 'physician.updated',
  WEEKLY_DIGEST: 'weekly.digest',
})

export const WORKER_CONFIG = /** @type {const} */ ({
  concurrency: 5,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2_000 },
    removeOnComplete: { count: 100, age: 86_400 },
    removeOnFail: { count: 50, age: 604_800 },
  },
  idempotency: {
    ttl: 3_600_000,
  },
})
