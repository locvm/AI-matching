// @ts-check

import { filterEligiblePhysicians } from '../../../src/matchingLogic/filterEligiblePhysicians.js'
// Stub implementations of ScoreJobFn and ScorePhysicianFn.
//
// Uses modular stub scorers so each category can be swapped independently.
// When a real scorer is built, change one import in stub-scorers.js and nothing here changes.
// The harness doesnt care whats inside. It just calls the function and gets results.

import { scoreEMR } from '../../../src/scoring/scoreEMR.js'
import { scoreLocation } from '../../../src/scoring/location/scoreLocation.js'
import { createDurationScorer } from '../../../src/scoring/duration/scoreDuration.js'
import { computeWeightedScore } from '../../../src/scoring/combineAndRank.js'

const scoreDuration = createDurationScorer()

/**
 * @typedef {import('./types.js').Physician} Physician
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').SearchResult} SearchResult
 */

/** Reservation statuses that mean the job is still accepting applicants. Others (Completed, Cancelled, Expired) are excluded. */
const ELIGIBLE_RESERVATION_STATUSES = new Set(['Pending', 'In Progress', 'Ongoing'])

/**
 * Collects data quality flags for a physician-job pair.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {string[]}
 */
function collectFlags(physician, job) {
  /** @type {string[]} */
  const flags = []

  if (!(physician.workAddress?.city && physician.workAddress?.province)) {
    flags.push('missing_physician_location')
  }

  if (!(job.fullAddress?.city && job.fullAddress?.province)) {
    flags.push('missing_job_location')
  }

  if (
    !job.facilityInfo?.emr &&
    !(Array.isArray(physician.emrSystems) && physician.emrSystems.length > 0) &&
    !physician.facilityEMR
  ) {
    flags.push('missing_emr_data')
  }

  return flags
}

/**
 * Scores a single physician-job pair across all 3 categories and combines.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {SearchResult}
 */
function scoreAndBuild(physician, job) {
  const scores = {
    location: scoreLocation(physician, job.location, job.fullAddress),
    duration: scoreDuration(physician, job.dateRange).score,
    emr: scoreEMR(physician, job),
  }

  const { totalScore: score, breakdown } = computeWeightedScore(scores)
  const flags = collectFlags(physician, job)

  return {
    physicianId: physician._id,
    jobId: job._id,
    score,
    breakdown,
    flags,
  }
}

/**
 * Stub ScoreJobFn. Job-centric: 1 job → find matching physicians.
 *
 * Pipeline: filter → score each pair → combine → sort → return.
 *
 * @type {import('../../../src/interfaces/matching/matching.js').ScoreJobFn}
 */
export async function searchPhysicians(job, physicians, reservation, options) {
  if (!isJobAcceptingApplicants(job, reservation)) {
    return []
  }

  const eligible = filterEligiblePhysicians(
    /** @type {any} */ (physicians),
    /** @type {any} */ (job),
    /** @type {any} */ (reservation ?? undefined),
    /** @type {any} */ ({ job, reservation, options: { onlyLookingForLocums: true } })
  )

  /** @type {SearchResult[]} */
  const results = []

  for (const physician of eligible) {
    results.push(scoreAndBuild(/** @type {any} */ (physician), job))
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

/**
 * True if we should run matching for this job.
 * @param {LocumJob} job
 * @param {Reservation | null | undefined} reservation
 * @returns {boolean}
 */
function isJobAcceptingApplicants(job, reservation) {
  if (!reservation) return true
  const status = (reservation.status ?? '').trim()
  return ELIGIBLE_RESERVATION_STATUSES.has(status)
}

/**
 * Stub ScorePhysicianFn. Physician-centric: 1 physician → find matching jobs.
 *
 * Same hard filters as searchPhysicians — both paths go through
 * filterEligiblePhysicians (IsEligiblePhysicianFn) so any new filter
 * (duration, province, future gates) is automatically applied here too.
 *
 * We wrap the single physician in an array and call filterEligiblePhysicians
 * per job. If the physician survives the filter, we score; otherwise skip.
 *
 * Pipeline: per-job filter → score each passing pair → sort → return.
 *
 * @type {import('../../../src/interfaces/index.js').ScorePhysicianFn}
 */
export async function searchJobs(physician, jobs, reservations, options) {
  /** @type {SearchResult[]} */
  const results = []
  const pool = [physician]

  for (const job of jobs) {
    const reservation = reservations?.find((r) => r.locumJobId === job._id) ?? undefined

    if (!isJobAcceptingApplicants(job, reservation ?? null)) continue

    const eligible = filterEligiblePhysicians(
      /** @type {any} */ (pool),
      /** @type {any} */ (job),
      /** @type {any} */ (reservation),
      /** @type {any} */ ({ job, reservation, options: { onlyLookingForLocums: true } })
    )

    if (eligible.length === 0) continue

    results.push(scoreAndBuild(physician, job))
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
