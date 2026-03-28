// @ts-check

// Matching Engine Harness
//
// Full pipeline implementation: Filter → Score → Combine & Rank
// Uses real scorers and real hard filters — no stubs.
//
// Stage 1 (Filter):  filterEligiblePhysicians — profession, specialty, isLooking, applicant check, duration, province
// Stage 2 (Score):   scoreLocation, scoreDuration, scoreEMR — each returns 0-1
// Stage 3 (Rank):    combineAndRank — applies weights, threshold, limit, sorts descending

import { filterEligiblePhysicians } from '../../../src/matchingLogic/filterEligiblePhysicians.js'
import { scoreEMR } from '../../../src/scoring/emr/scoreEMR.js'
import { scoreLocation } from '../../../src/scoring/location/scoreLocation.js'
import { createDurationScorer } from '../../../src/scoring/duration/scoreDuration.js'
import { combineAndRank } from '../../../src/scoring/combineAndRank.js'

const scoreDuration = createDurationScorer()

/**
 * @typedef {import('./types.js').Physician} Physician
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').SearchResult} SearchResult
 * @typedef {import('@locvm/types').ScoredPair} ScoredPair
 * @typedef {import('@locvm/types').SearchOptions} SearchOptions
 */

/** Reservation statuses that mean the job is still accepting applicants. Others (Completed, Cancelled, Expired) are excluded. */
const ELIGIBLE_RESERVATION_STATUSES = new Set(['Pending', 'In Progress', 'Ongoing'])

// ── Stage 2: Score one pair ──────────────────────────────────────────────

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
 * Scores a single physician-job pair across all 3 categories.
 * Returns a ScoredPair with raw 0-1 scores — no weighting or total yet.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {ScoredPair}
 */
function scoreMatch(physician, job) {
  return {
    physicianId: physician._id,
    jobId: job._id,
    breakdown: {
      location: scoreLocation(physician, job.location, job.fullAddress),
      duration: scoreDuration(physician, job.dateRange).score,
      emr: scoreEMR(physician, job),
    },
    flags: collectFlags(physician, job),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * True if we should run matching for this job.
 *
 * @param {Reservation | null | undefined} reservation
 * @returns {boolean}
 */
function isJobAcceptingApplicants(reservation) {
  if (!reservation) return true
  const status = (reservation.status ?? '').trim()
  return ELIGIBLE_RESERVATION_STATUSES.has(status)
}

// ── Top-level orchestrators ──────────────────────────────────────────────

/**
 * Job-centric: "A new job was posted, find matching physicians."
 *
 * Pipeline:
 *   1. Check reservation status (skip closed/expired jobs)
 *   2. Stage 1 — filterEligiblePhysicians (hard filters)
 *   3. Stage 2 — scoreMatch per eligible physician (raw 0-1 scores)
 *   4. Stage 3 — combineAndRank (apply weights, threshold, limit, sort)
 *
 * @type {import('@locvm/types').ScoreJobFn}
 */
export async function searchPhysicians(job, physicians, reservation, options) {
  if (!isJobAcceptingApplicants(reservation)) {
    return []
  }

  const eligible = filterEligiblePhysicians(
    /** @type {any} */ (physicians),
    /** @type {any} */ (job),
    /** @type {any} */ (reservation ?? undefined),
    /** @type {any} */ ({ job, reservation, options: { onlyLookingForLocums: true } })
  )

  /** @type {ScoredPair[]} */
  const scoredPairs = []
  for (const physician of eligible) {
    scoredPairs.push(scoreMatch(/** @type {any} */ (physician), job))
  }

  return combineAndRank(scoredPairs, options)
}

/**
 * Physician-centric: "A new physician signed up, find matching jobs."
 *
 * Same hard filters as searchPhysicians — both paths go through
 * filterEligiblePhysicians so any new filter is automatically applied here too.
 *
 * Pipeline:
 *   1. Per job: check reservation status → hard filter the single physician
 *   2. Stage 2 — scoreMatch for each passing pair
 *   3. Stage 3 — combineAndRank (apply weights, threshold, limit, sort)
 *
 * Pipeline: per-job filter → score each passing pair → sort → return.
 *
 * @type {import('@locvm/types').ScorePhysicianFn}
 */
export async function searchJobs(physician, jobs, reservations, options) {
  /** @type {ScoredPair[]} */
  const scoredPairs = []
  const pool = [physician]

  for (const job of jobs) {
    const reservation = reservations?.find((r) => r.locumJobId === job._id) ?? undefined

    if (!isJobAcceptingApplicants(reservation)) continue

    const eligible = filterEligiblePhysicians(
      /** @type {any} */ (pool),
      /** @type {any} */ (job),
      /** @type {any} */ (reservation),
      /** @type {any} */ ({ job, reservation, options: { onlyLookingForLocums: true } })
    )

    if (eligible.length === 0) continue

    scoredPairs.push(scoreMatch(physician, job))
  }

  return combineAndRank(scoredPairs, options)
}
