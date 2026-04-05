// @ts-check

// Match run repository — audit log for every scoring run.
// One record per handler invocation, tracks status + result count.

import { getDb } from '../connection.js'
import { COLLECTIONS } from '../collections.js'

/** @typedef {import('@locvm/types').MatchRun} MatchRun */

// Stale threshold: runs stuck in RUNNING beyond this are assumed crashed.
const STALE_RUNNING_MS = 10 * 60 * 1000

/**
 * Creates a new MatchRun record with RUNNING status.
 *
 * @param {{ id: string, type: MatchRun['type'], jobId?: string, physicianId?: string }} params
 * @returns {Promise<void>}
 */
export async function createRun({ id, type, jobId, physicianId }) {
  const db = await getDb()
  await db.collection(COLLECTIONS.MATCH_RUNS).insertOne({
    id,
    type,
    status: 'RUNNING',
    ...(jobId ? { jobId } : {}),
    ...(physicianId ? { physicianId } : {}),
    startedAt: new Date(),
    createdAt: new Date(),
  })
}

/**
 * Returns true if a PENDING or RUNNING run already exists for the given filter.
 * Used to prevent duplicate runs when the same trigger fires multiple times.
 *
 * @param {{ jobId?: string, physicianId?: string }} filter
 * @returns {Promise<boolean>}
 */
export async function hasActiveRun(filter) {
  const db = await getDb()
  const doc = await db
    .collection(COLLECTIONS.MATCH_RUNS)
    .findOne({ ...filter, status: { $in: ['RUNNING', 'PENDING'] } })
  return doc !== null
}

/**
 * Returns runs that need to be retried:
 *   - FAILED runs (handler threw)
 *   - RUNNING runs older than STALE_RUNNING_MS (process crashed mid-run)
 *
 * Excludes runs already marked RETRIED so we don't loop forever.
 *
 * @returns {Promise<MatchRun[]>}
 */
export async function findIncompleteRuns() {
  const db = await getDb()
  const staleCutoff = new Date(Date.now() - STALE_RUNNING_MS)
  return db
    .collection(COLLECTIONS.MATCH_RUNS)
    .find({
      $or: [{ status: 'PENDING' }, { status: 'FAILED' }, { status: 'RUNNING', startedAt: { $lt: staleCutoff } }],
    })
    .toArray()
    .then((docs) => /** @type {MatchRun[]} */ (/** @type {unknown} */ (docs)))
}

/**
 * Returns the most recent runs ordered by createdAt descending.
 *
 * @param {number} [limit]
 * @returns {Promise<MatchRun[]>}
 */
export async function getRecentRuns(limit = 50) {
  const db = await getDb()
  return db
    .collection(COLLECTIONS.MATCH_RUNS)
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
    .then((docs) => /** @type {MatchRun[]} */ (/** @type {unknown} */ (docs)))
}

/**
 * Updates a run's status and optional metadata (resultCount, error, completedAt).
 *
 * @param {string} runId
 * @param {MatchRun['status']} status
 * @param {{ resultCount?: number, error?: string }} [meta]
 * @returns {Promise<void>}
 */
export async function updateRunStatus(runId, status, meta = {}) {
  const db = await getDb()
  await db.collection(COLLECTIONS.MATCH_RUNS).updateOne(
    { id: runId },
    {
      $set: {
        status,
        completedAt: new Date(),
        ...(meta.resultCount !== undefined ? { resultCount: meta.resultCount } : {}),
        ...(meta.error !== undefined ? { error: meta.error } : {}),
      },
    }
  )
}
