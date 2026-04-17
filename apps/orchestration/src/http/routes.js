// @ts-check

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ejs from 'ejs'
import { matchRunRepository } from '@locvm/database'
import { getTopMatchesForPhysician, buildEmailPayload } from '@locvm/communication'
import { JOB_TYPES } from '../config/index.js'
import { readBody } from './middleware.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dashboardTemplate = fs.readFileSync(path.join(__dirname, 'views/dashboard.ejs'), 'utf-8')

/**
 * @param {import('node:http').ServerResponse} res
 * @param {import('../queue/index.js').MatchingQueue} queue
 */
export async function dashboardRoute(res, queue) {
  const runs = await matchRunRepository.getRecentRuns(50)
  const html = ejs.render(dashboardTemplate, {
    queue: { active: queue.activeWorkers, pending: queue.pending.length },
    runs,
  })
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html)
}

/**
 * Returns a route handler that reads one string field from the body and enqueues a job.
 *
 * @param {string} field
 * @param {string} jobType
 */
function makeEnqueueRoute(field, jobType) {
  return async (
    /** @type {import('node:http').IncomingMessage} */ req,
    /** @type {import('node:http').ServerResponse} */ res,
    /** @type {import('../queue/index.js').MatchingQueue} */ queue
  ) => {
    const payload = /** @type {any} */ (await readBody(req))
    if (!payload[field] || typeof payload[field] !== 'string') {
      res.writeHead(400).end(`${field} required`)
      return
    }
    queue.enqueue(jobType, { [field]: payload[field] })
    res.writeHead(202).end()
  }
}

export const jobPostedRoute = makeEnqueueRoute('jobId', JOB_TYPES.JOB_POSTED)
export const physicianUpdatedRoute = makeEnqueueRoute('physicianId', JOB_TYPES.PHYSICIAN_UPDATED)

/**
 * Returns a ready-to-send email payload for one physician. Synchronous: reads
 * from `matchrunresults`, filters to open jobs, and shapes the top matches plus
 * physician into JSON. Returns `{ physician, jobs: [], totalOpenMatches: 0 }`
 * when the physician has no active matches — caller decides whether to skip.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function emailPayloadRoute(req, res) {
  const body = /** @type {any} */ (await readBody(req))
  if (!body.physicianId || typeof body.physicianId !== 'string') {
    res.writeHead(400).end('physicianId required')
    return
  }
  const { topMatches, totalOpenMatches } = await getTopMatchesForPhysician(body.physicianId)
  const payload = await buildEmailPayload(body.physicianId, topMatches, totalOpenMatches)
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload))
}
