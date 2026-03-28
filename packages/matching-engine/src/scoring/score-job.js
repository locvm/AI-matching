// @ts-check

import { filterEligiblePhysicians } from '../matchingLogic/filterEligiblePhysicians.js'
import { scoreMatch } from './score-match.js'
import { combineAndRank } from './combineAndRank.js'

/** @typedef {import('@locvm/types').LocumJob} LocumJob */
/** @typedef {import('@locvm/types').Physician} Physician */
/** @typedef {import('@locvm/types').Reservation} Reservation */
/** @typedef {import('@locvm/types').SearchOptions} SearchOptions */
/** @typedef {import('@locvm/types').SearchResult} SearchResult */

/**
 * Full pipeline for a job: filter → score each pair → combine + rank.
 *
 * @param {LocumJob} job
 * @param {Physician[]} physicians
 * @param {Reservation | null} [reservation]
 * @param {SearchOptions} [options]
 * @returns {Promise<SearchResult[]>}
 */
export async function scoreJob(job, physicians, reservation, options = {}) {
  const eligible = filterEligiblePhysicians(physicians, job, reservation ?? null)
  const scoredPairs = eligible.map((p) => scoreMatch(/** @type {Physician} */ (p), job))
  return combineAndRank(scoredPairs, options)
}
