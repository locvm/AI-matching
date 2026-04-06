// @ts-check

import { randomUUID } from 'node:crypto'
import { matchRunRepository } from '@locvm/database'

/** @typedef {import('@locvm/types').MatchRun} MatchRun */

/**
 * Wraps a scoring function with run lifecycle management.
 * Creates a run record, calls fn, then marks it COMPLETED or FAILED.
 *
 * @param {MatchRun['type']} type
 * @param {{ jobId?: string, physicianId?: string }} params
 * @param {(runId: string) => Promise<number>} fn - must return resultCount
 * @returns {Promise<void>}
 */
export async function withRun(type, params, fn) {
  if (await matchRunRepository.hasActiveRun(params)) {
    console.log(`[${type}] active run already exists for`, params, '— skipping')
    return
  }

  const runId = randomUUID()
  await matchRunRepository.createRun({ id: runId, type, ...params })
  try {
    const resultCount = await fn(runId)
    await matchRunRepository.updateRunStatus(runId, 'COMPLETED', { resultCount })
  } catch (err) {
    await matchRunRepository.updateRunStatus(runId, 'FAILED', {
      error: /** @type {Error} */ (err).message,
    })
    throw err
  }
}
