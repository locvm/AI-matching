// @ts-check

import { Worker } from 'bullmq'
import { BaseWorker } from '../shared/base-worker.js'
import { JobPostedHandler, PhysicianUpdatedHandler } from './handlers/index.js'
import { QUEUE_NAME, JOB_TYPES, WORKER_CONFIG } from './config.js'
import { IdempotencyService } from '../shared/idempotency.js'

export class MatchingWorker extends BaseWorker {
  /** @param {import('ioredis').Redis} redis */
  constructor(redis) {
    super(redis, 'MatchingWorker')

    /** @type {Map<string, { process(payload: any, log?: (msg: string) => void): Promise<void> }>} */
    this.handlers = new Map()
    this.handlers.set(JOB_TYPES.JOB_POSTED, new JobPostedHandler())
    this.handlers.set(JOB_TYPES.PHYSICIAN_UPDATED, new PhysicianUpdatedHandler())

    this.worker = new Worker(QUEUE_NAME, (job) => this.processJob(job.name, job.data, (msg) => job.log(msg)), {
      connection: redis,
      concurrency: WORKER_CONFIG.concurrency,
    })
  }

  /**
   * @param {string} jobType
   * @param {unknown} payload
   * @param {(msg: string) => void} log
   */
  async processJob(jobType, payload, log = () => {}) {
    const key = IdempotencyService.jobKey(
      jobType,
      /** @type {any} */ (payload).jobId ?? /** @type {any} */ (payload).physicianId
    )
    if (await this.idempotency.check(key, WORKER_CONFIG.idempotency.ttl)) {
      log('Skipped — duplicate job (idempotency hit)')
      return
    }

    const handler = this.handlers.get(jobType)
    if (!handler) throw new Error(`Unknown job type: ${jobType}`)

    await handler.process(/** @type {any} */ (payload), log)
  }
}
