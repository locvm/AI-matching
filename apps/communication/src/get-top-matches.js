// @ts-check

/**
 * Communication Layer: Get Top Matches for a Physician
 */

import { JsonStore } from '@locvm/database'

/** @typedef {import('@locvm/types').Reservation} Reservation */

/**
 * @typedef {Object} StoredMatchResult
 * @property {string} runId
 * @property {string} physicianId
 * @property {string} jobId
 * @property {number} rank
 * @property {number} score
 * @property {Record<string, number>} breakdown
 * @property {string[]} flags
 * @property {boolean} isActive
 * @property {string} computedAt
 */

/** Reservation statuses that mean the job is still open and accepting matches */
const OPEN_STATUSES = new Set(['Pending', 'Awaiting Payment'])

const TOP_K = 10

/**
 * Returns the top-K best job matches for a given physician.
 *
 * Reads from the stored match-run results (populated by the orchestration layer),
 * keeps only active results whose jobs are still open, then ranks and truncates.
 *
 * @param {string} physicianId
 * @param {{ resultsStore: JsonStore, reservations: Reservation[] }} deps
 * @returns {Promise<StoredMatchResult[]>}
 */
export async function getTopMatchesForPhysician(physicianId, { resultsStore, reservations }) {
  // Build a set of jobIds that are still open
  const openJobIds = new Set(reservations.filter((r) => OPEN_STATUSES.has(r.status)).map((r) => r.locumJobId))

  // Pull all active results for this physician
  const allResults = /** @type {StoredMatchResult[]} */ (
    await resultsStore.findMany((r) => r.physicianId === physicianId && r.isActive === true)
  )

  const filtered = allResults.filter((r) => openJobIds.has(r.jobId))
  filtered.sort((a, b) => b.score - a.score || a.jobId.localeCompare(b.jobId))
  return filtered.slice(0, TOP_K)
}
