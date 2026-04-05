// @ts-check

// Match run result repository — stores per-physician-job scored pairs.
// isActive tracks which results are current; old ones are deprecated on physician update.

import { getDb } from '../connection.js'
import { COLLECTIONS } from '../collections.js'

/** @typedef {import('@locvm/types').SearchResult} SearchResult */

/**
 * Persists a batch of scored results from a single run.
 *
 * @param {string} runId
 * @param {SearchResult[]} results - ranked, filtered results from scoreJob
 * @returns {Promise<void>}
 */
export async function saveMany(runId, results) {
  if (!results.length) return
  const db = await getDb()
  const docs = results.map((r, i) => ({
    runId,
    physicianId: r.physicianId,
    jobId: r.jobId,
    rank: i + 1,
    score: r.score,
    breakdown: r.breakdown,
    flags: r.flags ?? [],
    isActive: true,
    computedAt: new Date(),
  }))
  await db.collection(COLLECTIONS.MATCH_RUN_RESULTS).insertMany(docs)
}

/**
 * Marks all active results for a physician as inactive (deprecated).
 * Call this before writing a fresh set of results for the same physician.
 *
 * @param {string} physicianId
 * @returns {Promise<void>}
 */
export async function deprecateForPhysician(physicianId) {
  const db = await getDb()
  await db
    .collection(COLLECTIONS.MATCH_RUN_RESULTS)
    .updateMany({ physicianId, isActive: true }, { $set: { isActive: false, deprecatedAt: new Date() } })
}
