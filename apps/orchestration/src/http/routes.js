// @ts-check

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ejs from 'ejs'
import { matchRunRepository, matchRunResultRepository } from '@locvm/database'
import { getTopMatchesForPhysician, buildEmailPayload } from '@locvm/communication'
import { JOB_TYPES } from '../config/index.js'
import { readBody } from './middleware.js'

/**
 * Scale matching-engine 0-5 score to 0-100 integer.
 * @param {number} score
 */
function toHundred(score) {
  return Math.round(score * 20)
}

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

/** Max number of jobIds the caller may send in one batch request. */
const ACTIVE_MATCH_COUNTS_MAX_BATCH = 100

/**
 * Batch-counts active match results for a list of jobs.
 *
 * Returns `counts` keyed by jobId. Jobs with no active matches are included
 * with a count of 0 so the caller doesn't need a second lookup.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function activeMatchCountsRoute(req, res) {
  const body = /** @type {any} */ (await readBody(req))
  if (!Array.isArray(body.jobIds) || !body.jobIds.every((id) => typeof id === 'string')) {
    res.writeHead(400).end('jobIds must be a string[]')
    return
  }
  if (body.jobIds.length > ACTIVE_MATCH_COUNTS_MAX_BATCH) {
    res.writeHead(400).end(`jobIds exceeds max batch size of ${ACTIVE_MATCH_COUNTS_MAX_BATCH}`)
    return
  }

  const counts = await matchRunResultRepository.countActiveByJobIds(body.jobIds)
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ counts }))
}

/**
 * Returns the stored active match results for a job (same source as the count
 * badge on /active-match-counts), so the candidates list and the badge agree.
 *
 * Response body uses { error } JSON for 4xx so callers can branch on a single
 * shape regardless of which validation path fired.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function activeMatchesForJobRoute(req, res) {
  const body = /** @type {any} */ (await readBody(req))
  if (!body.jobId || typeof body.jobId !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'jobId required' }))
    return
  }

  const rows = await matchRunResultRepository.findActiveResultsByJobId(body.jobId)
  const matches = rows.map((r) => ({
    physicianId: r.physicianId,
    score: toHundred(r.score),
    matchDetails: r.breakdown,
  }))
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ matches }))
}
