// @ts-check

import { scoreLocationWithDetail } from './location/scoreLocation.js'
import { scoreEMRWithDetail } from './emr/scoreEMR.js'
import { createDurationScorer } from './duration/scoreDuration.js'

/** @typedef {import('@locvm/types').Physician} Physician */
/** @typedef {import('@locvm/types').LocumJob} LocumJob */
/** @typedef {import('@locvm/types').ScoredPair} ScoredPair */
/** @typedef {import('@locvm/types').ScoreBreakdown} ScoreBreakdown */

const scoreDuration = createDurationScorer()

// Location scoring tiers that did not use GPS — useful for the UI to caveat
// "matched by province only" results.
const PROVINCE_ONLY_LOCATION_METHODS = new Set(['preferred_province', 'work_province', 'medical_province'])

// Below this overlap ratio between the physician's availability and the job's
// date range, we surface a "low_date_overlap" flag so reviewers can spot
// borderline matches at a glance.
const LOW_DATE_OVERLAP_THRESHOLD = 0.5

/**
 * Scores one physician-job pair across all categories.
 *
 * For each category we store both the raw 0-1 score AND a `<category>Detail`
 * object describing the signals that produced it (distance, EMR names, overlap %).
 * The detail blobs let the UI and analytics explain *why* a match scored what
 * it did without re-running the scorers.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {ScoredPair}
 */
export function scoreMatch(physician, job) {
  /** @type {ScoreBreakdown} */
  const breakdown = {}
  /** @type {string[]} */
  const flags = []

  applyLocationCategory(physician, job, breakdown, flags)
  applyEMRCategory(physician, job, breakdown, flags)
  applyDurationCategory(physician, job, breakdown, flags)

  return {
    physicianId: physician._id,
    jobId: job._id,
    breakdown,
    flags,
  }
}

/**
 * @param {Physician} physician
 * @param {LocumJob} job
 * @param {ScoreBreakdown} breakdown
 * @param {string[]} flags
 */
function applyLocationCategory(physician, job, breakdown, flags) {
  const result = scoreLocationWithDetail(physician, job.location, job.fullAddress)

  breakdown.location = result.score
  breakdown.locationDetail = {
    method: result.method,
    distanceKm: result.distanceKm,
    distanceBucket: result.distanceBucket,
    matchedRegion: result.matchedRegion,
    physicianProvince: result.resolvedPhysicianProvince,
    jobProvince: result.resolvedJobProvince,
    provinceMatch: result.provinceMatch,
  }

  if (result.method === 'no_data') {
    flags.push('no_location_data')
  } else if (PROVINCE_ONLY_LOCATION_METHODS.has(result.method)) {
    flags.push('location_province_only')
  }
}

/**
 * @param {Physician} physician
 * @param {LocumJob} job
 * @param {ScoreBreakdown} breakdown
 * @param {string[]} flags
 */
function applyEMRCategory(physician, job, breakdown, flags) {
  const result = scoreEMRWithDetail(physician, job)

  breakdown.emr = result.score
  breakdown.emrDetail = {
    method: result.method,
    jobEMR: result.jobEMR,
    physicianEMRs: result.physicianEMRs,
    matched: result.matched,
  }

  switch (result.method) {
    case 'no_physician_emr':
      flags.push('no_physician_emr')
      break
    case 'no_job_emr':
      flags.push('no_job_emr')
      break
    case 'no_match':
      flags.push('emr_mismatch')
      break
  }
}

/**
 * @param {Physician} physician
 * @param {LocumJob} job
 * @param {ScoreBreakdown} breakdown
 * @param {string[]} flags
 */
function applyDurationCategory(physician, job, breakdown, flags) {
  if (!job.dateRange) {
    flags.push('no_job_date_range')
    return
  }

  const result = scoreDuration(physician, job.dateRange)

  breakdown.duration = result.score
  breakdown.durationDetail = {
    method: result.breakdown.method,
    overlapPct: result.breakdown.overlapPct,
    usedBucketFallback: result.breakdown.usedBucketFallback,
  }

  if (result.breakdown.method === 'neutral') {
    flags.push('no_duration_data')
  } else if (result.breakdown.overlapPct !== null && result.breakdown.overlapPct < LOW_DATE_OVERLAP_THRESHOLD) {
    flags.push('low_date_overlap')
  }
}
