// @ts-check

import { Redis } from 'ioredis'
import { MatchingWorker } from './matching/matching-worker.js'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const matchingWorker = new MatchingWorker(redis)

process.on('SIGTERM', async () => {
  await matchingWorker.worker.close()
  redis.disconnect()
})
