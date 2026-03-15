// @ts-check

// Stub implementations of ScoreJobFn and ScorePhysicianFn.
//
// Uses modular stub scorers so each category can be swapped independently.
// When a real scorer is built, change one import in stub-scorers.js and nothing here changes.
// The harness doesnt care whats inside. It just calls the function and gets results.

import {
  stubScoreLocation,
  stubScoreDuration,
  stubScoreEMR,
  stubScoreProvince,
  stubScoreSpeciality,
  stubCombineScores,
} from './stub-scorers.js'

/**
 * @typedef {import('./types.js').Physician} Physician
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').SearchResult} SearchResult
 */

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
 * Scores a single physician-job pair across all 5 categories and combines.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {SearchResult}
 */
function scoreAndBuild(physician, job) {
  const scores = {
    location: stubScoreLocation(physician, job),
    duration: stubScoreDuration(physician, job),
    emr: stubScoreEMR(physician, job),
    province: stubScoreProvince(physician, job),
    speciality: stubScoreSpeciality(physician, job),
  }

  const { score, breakdown } = stubCombineScores(scores)
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
  const onlyLooking = true

  // Build applicant set from reservation (for scheduling conflict filter)
  const applicantIds = new Set()
  if (reservation?.applicants) {
    for (const a of reservation.applicants) {
      if (a.userId) applicantIds.add(a.userId)
    }
  }

  /** @type {SearchResult[]} */
  const results = []

  for (const physician of physicians) {
    // FILTER (hard filters, pass or fail)
    if (physician.medProfession !== job.medProfession) continue

    const pSpec = (physician.medSpeciality ?? '').trim().toLowerCase()
    const jSpec = (job.medSpeciality ?? '').trim().toLowerCase()
    if (pSpec !== jSpec) continue

    if (onlyLooking && !physician.isLookingForLocums) continue
    if (applicantIds.has(physician._id)) continue

    // SCORE + BUILD result
    results.push(scoreAndBuild(physician, job))
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

/**
 * Stub ScorePhysicianFn. Physician-centric: 1 physician → find matching jobs.
 *
 * Pipeline: filter → score each pair → combine → sort → return.
 *
 * @type {import('../../../src/interfaces/matching/matching.js').ScorePhysicianFn}
 */
export async function searchJobs(physician, jobs, reservations, options) {
  const onlyLooking = true

  // Early exit: if physician isnt looking, no matches
  if (onlyLooking && !physician.isLookingForLocums) return []

  /** @type {SearchResult[]} */
  const results = []

  for (const job of jobs) {
    // FILTER (hard filters, pass or fail)
    if (job.medProfession !== physician.medProfession) continue

    const jSpec = (job.medSpeciality ?? '').trim().toLowerCase()
    const pSpec = (physician.medSpeciality ?? '').trim().toLowerCase()
    if (jSpec !== pSpec) continue

    // Check if physician already applied to this job's reservation
    if (reservations) {
      const reservation = reservations.find((r) => r.locumJobId === job._id)
      if (reservation?.applicants) {
        const alreadyApplied = reservation.applicants.some((a) => a.userId === physician._id)
        if (alreadyApplied) continue
      }
    }

    // SCORE + BUILD result
    results.push(scoreAndBuild(physician, job))
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
