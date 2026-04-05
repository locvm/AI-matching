// @ts-check

import { filterEligiblePhysicians } from '../matchingLogic/filterEligiblePhysicians.js'
import { scoreMatch } from './score-match.js'
import { combineAndRank } from './combineAndRank.js'

/** @typedef {import('@locvm/types').LocumJob} LocumJob */
/** @typedef {import('@locvm/types').Physician} Physician */
/** @typedef {import('@locvm/types').Reservation} Reservation */
/** @typedef {import('@locvm/types').SearchOptions} SearchOptions */
/** @typedef {import('@locvm/types').SearchResult} SearchResult */
/** @typedef {import('@locvm/types').ScoredPair} ScoredPair */

const CHUNK_SIZE = 50

/** @returns {Promise<void>} */
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve))

/**
 * Full pipeline for a job: filter → score each pair in chunks → combine + rank.
 *
 * Scoring is chunked to avoid blocking the event loop on large physician lists.
 *
 * @param {LocumJob} job
 * @param {Physician[]} physicians
 * @param {Reservation | null} [reservation]
 * @param {SearchOptions} [options]
 * @returns {Promise<SearchResult[]>}
 */
export async function scoreJob(job, physicians, reservation, options = {}) {
  const eligible = filterEligiblePhysicians(physicians, job, reservation ?? null)

  /** @type {ScoredPair[]} */
  const scoredPairs = []

  for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
    const chunk = eligible.slice(i, i + CHUNK_SIZE)
    scoredPairs.push(...chunk.map((p) => scoreMatch(/** @type {Physician} */ (p), job)))
    await yieldToEventLoop()
  }

  return combineAndRank(scoredPairs, options)
}
