// @ts-check
// In-process job queue. Drains up to CONCURRENCY jobs at a time.
// Jobs are held in memory — completed runs are tracked in MongoDB for recovery.

import { JobPostedHandler } from '../handlers/job-posted.js'
import { PhysicianUpdatedHandler } from '../handlers/physician-updated.js'
import { QUEUE, JOB_TYPES } from '../config/index.js'

/** @typedef {{ type: string, payload: unknown }} QueueJob */

export class MatchingQueue {
  constructor() {
    /** @type {QueueJob[]} */
    this.pending = []
    this.activeWorkers = 0

    /** @type {Map<string, { process(payload: any, log?: (msg: string) => void): Promise<void> }>} */
    this.handlers = new Map()
    this.handlers.set(JOB_TYPES.JOB_POSTED, new JobPostedHandler())
    this.handlers.set(JOB_TYPES.PHYSICIAN_UPDATED, new PhysicianUpdatedHandler())
  }

  /** @param {string} type @param {unknown} payload */
  enqueue(type, payload) {
    this.pending.push({ type, payload })
    this.drain()
  }

  drain() {
    while (this.pending.length > 0 && this.activeWorkers < QUEUE.CONCURRENCY) {
      const job = /** @type {QueueJob} */ (this.pending.shift())
      this.activeWorkers++
      this.process(job)
        .catch((err) => console.error(`[${job.type}] failed:`, err))
        .finally(() => {
          this.activeWorkers--
          this.drain()
        })
    }
  }

  /**
   * Resolves when all active workers have finished.
   * @returns {Promise<void>}
   */
  waitForDrain() {
    if (this.activeWorkers === 0) return Promise.resolve()
    return new Promise((resolve) => {
      const check = () => {
        if (this.activeWorkers === 0) resolve()
        else setTimeout(check, 100)
      }
      check()
    })
  }

  /** @param {QueueJob} job */
  async process({ type, payload }) {
    const handler = this.handlers.get(type)
    if (!handler) throw new Error(`Unknown job type: ${type}`)
    await handler.process(/** @type {any} */ (payload), (msg) => console.log(`[${type}] ${msg}`))
  }
}
