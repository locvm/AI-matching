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
 * Returns all active (current) match results for a physician, highest score first.
 *
 * @param {string} physicianId
 * @returns {Promise<Array<{ runId: string, physicianId: string, jobId: string, rank: number, score: number, breakdown: Record<string, number>, flags: string[], isActive: boolean, computedAt: Date }>>}
 */
export async function findActiveResultsByPhysicianId(physicianId) {
  const db = await getDb()
  const docs = await db
    .collection(COLLECTIONS.MATCH_RUN_RESULTS)
    .find({ physicianId, isActive: true })
    .sort({ score: -1 })
    .toArray()
  return /** @type {any} */ (docs)
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

/**
 * Counts active match results grouped by job, for a list of job IDs.
 *
 * Returns a record keyed by jobId. Jobs with zero active matches are included
 * with a count of 0, so callers can render UI without a follow-up lookup.
 *
 * @param {string[]} jobIds
 * @returns {Promise<Record<string, number>>}
 */
export async function countActiveByJobIds(jobIds) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const id of jobIds) counts[id] = 0
  if (jobIds.length === 0) return counts

  const db = await getDb()
  const rows = await db
    .collection(COLLECTIONS.MATCH_RUN_RESULTS)
    .aggregate([
      { $match: { isActive: true, jobId: { $in: jobIds } } },
      { $group: { _id: '$jobId', count: { $sum: 1 } } },
    ])
    .toArray()

  for (const row of rows) counts[row._id] = row.count
  return counts
}
