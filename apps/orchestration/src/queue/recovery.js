// @ts-check

import { matchRunRepository } from '@locvm/database'
import { QUEUE, JOB_TYPES } from '../config/index.js'

/**
 * Scans for FAILED or stale RUNNING match runs and re-enqueues them.
 * Marks each recovered run as RETRIED so it won't be picked up again.
 *
 * @param {import('./index.js').MatchingQueue} queue
 */
export async function runRecovery(queue) {
  const incomplete = await matchRunRepository.findIncompleteRuns()
  if (incomplete.length === 0) return

  console.log(`[recovery] found ${incomplete.length} incomplete run(s) — re-enqueueing`)

  for (const run of incomplete) {
    await matchRunRepository.updateRunStatus(run.id, 'RETRIED')

    if (run.jobId) {
      queue.enqueue(JOB_TYPES.JOB_POSTED, { jobId: run.jobId })
    } else if (run.physicianId) {
      queue.enqueue(JOB_TYPES.PHYSICIAN_UPDATED, { physicianId: run.physicianId })
    }
  }
}

/**
 * Starts the periodic recovery loop.
 * Returns the interval handle so the caller can clear it on shutdown.
 *
 * @param {import('./index.js').MatchingQueue} queue
 * @returns {ReturnType<typeof setInterval>}
 */
export function startRecovery(queue) {
  runRecovery(queue).catch((err) => console.error('[recovery] startup scan failed:', err))

  return setInterval(() => {
    runRecovery(queue).catch((err) => console.error('[recovery] scan failed:', err))
  }, QUEUE.RECOVERY_INTERVAL_MS)
}
