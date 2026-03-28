// @ts-check

import { IdempotencyService } from './idempotency.js'

export class BaseWorker {
  /**
   * @param {import('ioredis').Redis} redis
   * @param {string} workerName
   */
  constructor(redis, workerName) {
    this.redis = redis
    this.workerName = workerName
    this.idempotency = new IdempotencyService(redis, {
      keyPrefix: `idempotency:${workerName}`,
    })
  }

  /**
   * @param {string} jobType
   * @param {unknown} payload
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async processJob(jobType, payload) {
    throw new Error(`${this.workerName}.processJob() not implemented`)
  }
}
