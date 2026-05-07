// @ts-check

import { filterEligiblePhysicians } from '../matchingLogic/filterEligiblePhysicians.js'
import { scoreMatch } from './score-match.js'
import { combineAndRank } from './combineAndRank.js'

/** @typedef {import('@locvm/types').LocumJob} LocumJob */
/** @typedef {import('@locvm/types').Physician} Physician */
/** @typedef {import('@locvm/types').Reservation} Reservation */
/** @typedef {import('@locvm/types').SearchOptions} SearchOptions */
/** @typedef {import('@locvm/types').SearchResult} SearchResult */

/** Default number of top results to return. */
const DEFAULT_LIMIT = 10

/**
 * Full pipeline for a physician: filter → score each pair → combine + rank.
 *
 * For each job, runs the physician through hard filters (profession, specialty,
 * not-already-applied, duration, province). Passing pairs are scored and ranked.
 *
 * @type {import('@locvm/types').ScorePhysicianFn}
 */
export async function scorePhysician(physician, jobs, reservations, options = {}) {
  const pool = [physician]
  /** @type {import('@locvm/types').ScoredPair[]} */
  const scoredPairs = []

  for (const job of jobs) {
    const reservation = reservations?.find((r) => r.locumJobId === job._id) ?? null

    const eligible = filterEligiblePhysicians(pool, job, reservation)
    if (eligible.length === 0) continue

    scoredPairs.push(scoreMatch(physician, job))
  }

  return combineAndRank(scoredPairs, { limit: DEFAULT_LIMIT, ...options })
}
