// @ts-check

import { dataRepository, scannerStateRepository } from '@locvm/database'
import { QUEUE, JOB_TYPES } from '../config/index.js'

/**
 * Scans the shared cluster for physicians and locum jobs that were created or
 * modified since the last scan, and enqueues a scoring job for each.
 *
 * On the very first run (no persisted state), defaults to a single SCAN_INTERVAL_MS
 * window so we don't backfill the whole database.
 *
 * @param {import('./index.js').MatchingQueue} queue
 */
export async function runScanner(queue) {
  const lastScanAt = await scannerStateRepository.getLastScanAt()
  const since = lastScanAt ?? new Date(Date.now() - QUEUE.SCAN_INTERVAL_MS)
  const scanStart = new Date()

  const [physicianIds, jobIds] = await Promise.all([
    dataRepository.findChangedPhysicianIds(since),
    dataRepository.findChangedJobIds(since),
  ])

  if (physicianIds.length === 0 && jobIds.length === 0) {
    await scannerStateRepository.setLastScanAt(scanStart)
    return
  }

  console.log(
    `[scanner] found ${physicianIds.length} physician(s) and ${jobIds.length} job(s) changed since ${since.toISOString()}`
  )

  for (const physicianId of physicianIds) {
    queue.enqueue(JOB_TYPES.PHYSICIAN_UPDATED, { physicianId })
  }
  for (const jobId of jobIds) {
    queue.enqueue(JOB_TYPES.JOB_POSTED, { jobId })
  }

  await scannerStateRepository.setLastScanAt(scanStart)
}

/**
 * Starts the periodic scanner loop. Returns the interval handle so the caller
 * can clear it on shutdown.
 *
 * @param {import('./index.js').MatchingQueue} queue
 * @returns {ReturnType<typeof setInterval>}
 */
export function startScanner(queue) {
  runScanner(queue).catch((err) => console.error('[scanner] startup scan failed:', err))

  return setInterval(() => {
    runScanner(queue).catch((err) => console.error('[scanner] scan failed:', err))
  }, QUEUE.SCAN_INTERVAL_MS)
}
