// @ts-check

import express from 'express'
import Redis from 'ioredis'
import { Queue } from 'bullmq'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { QUEUE_NAME, JOB_TYPES } from '@locvm/orchestration/src/matching/config.js'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const matchingQueue = new Queue(QUEUE_NAME, { connection: redis })

const boardAdapter = new ExpressAdapter()
boardAdapter.setBasePath('/admin')

createBullBoard({
  queues: [new BullMQAdapter(matchingQueue)],
  serverAdapter: boardAdapter,
})

const app = express()
app.use(express.json())
app.use('/admin', boardAdapter.getRouter())

app.post('/trigger/job-posted', async (req, res) => {
  const { jobId } = req.body
  if (!jobId) return res.status(400).json({ error: 'jobId required' })
  const job = await matchingQueue.add(JOB_TYPES.JOB_POSTED, { jobId })
  res.json({ jobId: job.id })
})

app.post('/trigger/physician-updated', async (req, res) => {
  const { physicianId } = req.body
  if (!physicianId) return res.status(400).json({ error: 'physicianId required' })
  const job = await matchingQueue.add(JOB_TYPES.PHYSICIAN_UPDATED, { physicianId })
  res.json({ jobId: job.id })
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => console.log(`sandbox running on http://localhost:${PORT}`))
