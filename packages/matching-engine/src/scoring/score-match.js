// @ts-check

import { scoreLocation } from './location/scoreLocation.js'
import { scoreEMR } from './emr/scoreEMR.js'
import { createDurationScorer } from './duration/scoreDuration.js'

/** @typedef {import('@locvm/types').Physician} Physician */
/** @typedef {import('@locvm/types').LocumJob} LocumJob */
/** @typedef {import('@locvm/types').ScoredPair} ScoredPair */

const scoreDuration = createDurationScorer()

/**
 * Scores one physician-job pair across all categories. Returns raw 0-1 scores per category.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {ScoredPair}
 */
export function scoreMatch(physician, job) {
  /** @type {import('@locvm/types').ScoreBreakdown} */
  const breakdown = {}
  /** @type {string[]} */
  const flags = []

  breakdown.location = scoreLocation(physician, job.location, job.fullAddress)
  if (!physician.workAddress && !physician.location) flags.push('missing_physician_location')

  breakdown.emr = scoreEMR(physician, job)

  if (job.dateRange) {
    breakdown.duration = scoreDuration(physician, job.dateRange).score
  } else {
    flags.push('missing_job_date_range')
  }

  return {
    physicianId: physician._id,
    jobId: job._id,
    breakdown,
    flags,
  }
}
