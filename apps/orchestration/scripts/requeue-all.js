// @ts-check
//
// Bulk requeue: re-triggers matching for every physician, every job, or both,
// by firing the same HTTP endpoints the orchestration service exposes to
// upstream producers. Useful after scorer changes or to stress-test the drain queue.
//
// Usage:
//   node --env-file=../../.env scripts/requeue-all.js --physicians
//   node --env-file=../../.env scripts/requeue-all.js --jobs
//   node --env-file=../../.env scripts/requeue-all.js --all

import { connect, disconnect, getDb, COLLECTIONS } from '@locvm/database'

const SERVICE_URL = process.env.MATCHING_SERVICE_URL ?? 'http://localhost:3001'
const SERVICE_SECRET = process.env.MATCHING_SERVICE_SECRET ?? ''

/**
 * @typedef {Object} RequeueTarget
 * @property {string} label - human label used in console output
 * @property {string} endpoint - orchestration HTTP path to POST to
 * @property {string} collection - Mongo collection to enumerate
 * @property {Record<string, unknown>} query - filter applied when enumerating
 * @property {'jobId' | 'physicianId'} bodyKey - JSON key the endpoint expects
 */

/** @type {RequeueTarget} */
const PHYSICIANS = {
  label: 'physicians',
  endpoint: '/physician-updated',
  collection: COLLECTIONS.USERS,
  query: { medProfession: 'Physician', isOnboardingCompleted: true },
  bodyKey: 'physicianId',
}

/** @type {RequeueTarget} */
const JOBS = {
  label: 'jobs',
  endpoint: '/job-posted',
  collection: COLLECTIONS.LOCUM_JOBS,
  query: {},
  bodyKey: 'jobId',
}

const args = new Set(process.argv.slice(2))
const wantAll = args.has('--all')
const targets = [
  ...(wantAll || args.has('--physicians') ? [PHYSICIANS] : []),
  ...(wantAll || args.has('--jobs') ? [JOBS] : []),
]

if (targets.length === 0) {
  console.error('Usage: requeue-all.js --physicians | --jobs | --all')
  process.exit(1)
}

/**
 * Fires a single requeue request. Errors are returned, not thrown, so one
 * failure doesn't abort the rest of the batch.
 *
 * @param {RequeueTarget} target
 * @param {string} id
 * @returns {Promise<{ id: string, ok: boolean, error?: string }>}
 */
async function trigger(target, id) {
  try {
    const res = await fetch(`${SERVICE_URL}${target.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SERVICE_SECRET ? { Authorization: `Bearer ${SERVICE_SECRET}` } : {}),
      },
      body: JSON.stringify({ [target.bodyKey]: id }),
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return { id, ok: true }
  } catch (err) {
    return { id, ok: false, error: /** @type {Error} */ (err).message }
  }
}

/**
 * @param {string} label
 * @param {Array<{ id: string, ok: boolean, error?: string }>} results
 * @param {number} elapsedMs
 */
function report(label, results, elapsedMs) {
  const ok = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`[${label}] ${ok} queued, ${failed.length} failed — ${(elapsedMs / 1000).toFixed(2)}s`)
  for (const r of failed) console.log(`  ${r.id} — ${r.error}`)
}

/**
 * Enumerate `target.collection` and fan out concurrent requeue requests.
 *
 * @param {RequeueTarget} target
 */
async function requeueTarget(target) {
  const db = await getDb()
  const docs = await db
    .collection(target.collection)
    .find(target.query, { projection: { _id: 1 } })
    .toArray()

  console.log(`Triggering ${docs.length} ${target.label}...`)
  const start = Date.now()
  const results = await Promise.all(docs.map((d) => trigger(target, d._id.toString())))
  report(target.label, results, Date.now() - start)
}

async function run() {
  await connect()
  try {
    for (const target of targets) {
      await requeueTarget(target)
    }
  } finally {
    await disconnect()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
