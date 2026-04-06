// @ts-check

import { scoreJob } from '@locvm/matching-engine'
import { dataRepository, matchRunResultRepository } from '@locvm/database'
import { withRun } from './run.js'

export class PhysicianUpdatedHandler {
  /**
   * @param {{ physicianId: string }} payload
   * @param {(msg: string) => void} log
   */
  async process({ physicianId }, log = () => {}) {
    const [physician, openReservations] = await Promise.all([
      dataRepository.findPhysicianById(physicianId),
      dataRepository.findOpenReservations(),
    ])

    if (!physician) throw new Error(`Physician ${physicianId} not found`)

    if (!physician.isOnboardingCompleted) {
      log(`Physician ${physicianId} has not completed onboarding — skipping`)
      return
    }

    const openJobIds = [...new Set(openReservations.map((r) => r.locumJobId))]
    const openJobs = await dataRepository.findJobsByIds(openJobIds)
    log(`Found ${openJobs.length} open jobs to score against`)

    await withRun('PHYSICIAN_UPDATED', { physicianId }, async (runId) => {
      await matchRunResultRepository.deprecateForPhysician(physicianId)
      log(`Previous active results deprecated`)

      /** @type {import('@locvm/types').SearchResult[]} */
      const allResults = []

      for (const job of openJobs) {
        const reservation = openReservations.find((r) => r.locumJobId === job._id) ?? null
        const scored = await scoreJob(job, [physician], reservation)
        log(`Job ${job._id} — ${scored.length > 0 ? `score: ${scored[0].score.toFixed(2)}` : 'filtered out'}`)
        allResults.push(...scored)
      }

      await matchRunResultRepository.saveMany(runId, allResults)

      log(`Run completed with ${allResults.length} results`)
      return allResults.length
    })
  }
}
