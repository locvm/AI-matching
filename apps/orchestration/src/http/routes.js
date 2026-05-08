// @ts-check

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ejs from 'ejs'
import { matchRunRepository, matchRunResultRepository, dataRepository } from '@locvm/database'
import { scoreJob, scorePhysician } from '@locvm/matching-engine'
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

/**
 * Preview-only: score a job against all eligible physicians and return ranked
 * results with IDs + 0-100 scores + per-category breakdown. No persistence.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function previewJobRoute(req, res) {
  const body = /** @type {any} */ (await readBody(req))
  if (!body.jobId || typeof body.jobId !== 'string') {
    res.writeHead(400).end('jobId required')
    return
  }

  const [job, physicians, reservation] = await Promise.all([
    dataRepository.findJobById(body.jobId),
    dataRepository.findEligiblePhysicians(),
    dataRepository.findReservationByJobId(body.jobId),
  ])

  if (!job) {
    res.writeHead(404).end(`Job ${body.jobId} not found`)
    return
  }

  const results = await scoreJob(job, physicians, reservation)
  const matches = results.map((r) => ({
    physicianId: r.physicianId,
    score: toHundred(r.score),
    matchDetails: r.breakdown,
  }))

  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ matches }))
}

/**
 * Preview-only: score a physician against all open jobs and return ranked
 * results with IDs + 0-100 scores + per-category breakdown. No persistence.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function previewPhysicianRoute(req, res) {
  const body = /** @type {any} */ (await readBody(req))
  if (!body.physicianId || typeof body.physicianId !== 'string') {
    res.writeHead(400).end('physicianId required')
    return
  }

  const [physician, openReservations] = await Promise.all([
    dataRepository.findPhysicianById(body.physicianId),
    dataRepository.findOpenReservations(),
  ])

  if (!physician) {
    res.writeHead(404).end(`Physician ${body.physicianId} not found`)
    return
  }

  const openJobIds = [...new Set(openReservations.map((r) => r.locumJobId))]
  const openJobs = await dataRepository.findJobsByIds(openJobIds)

  // limit:null overrides scorePhysician's default-10 cap so all scored jobs are returned.
  const results = await scorePhysician(physician, openJobs, openReservations, { limit: null })
  const matches = results.map((r) => ({
    jobId: r.jobId,
    score: toHundred(r.score),
    matchDetails: r.breakdown,
  }))

  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ matches }))
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
