// @ts-check

import { randomUUID } from 'node:crypto'
import { scoreJob } from '@locvm/matching-engine'
import { loadFixtures, JsonStore, STORE_PATHS } from '@locvm/database'

const runs = new JsonStore(STORE_PATHS.matchRuns)
const results = new JsonStore(STORE_PATHS.matchRunResults)

export class PhysicianUpdatedHandler {
  /**
   * @param {{ physicianId: string }} payload
   * @param {(msg: string) => void} log
   */
  async process({ physicianId }, log = () => {}) {
    const { jobs, physicians, reservations } = await loadFixtures()
    log(`Fixtures loaded — ${physicians.length} physicians, ${jobs.length} jobs`)

    const physician = physicians.find((p) => p._id === physicianId)
    if (!physician) throw new Error(`Physician ${physicianId} not found`)
    if (!physician.isOnboardingCompleted) {
      log(`Physician ${physicianId} has not completed onboarding — skipping`)
      return
    }

    const openReservations = reservations.filter((r) => r.status === 'Pending' || r.status === 'Awaiting Payment')
    const openJobIds = new Set(openReservations.map((r) => r.locumJobId))
    const openJobs = jobs.filter((j) => openJobIds.has(j._id))
    log(`Found ${openJobs.length} open jobs to score against`)

    const runId = randomUUID()
    await runs.append({
      id: runId,
      type: 'PHYSICIAN_UPDATED',
      status: 'RUNNING',
      physicianId,
      startedAt: new Date(),
      createdAt: new Date(),
    })

    try {
      await results.updateWhere((r) => r.physicianId === physicianId && r.isActive, {
        isActive: false,
        deprecatedAt: new Date(),
      })
      log(`Previous active results deprecated`)

      const resultDocs = []
      for (const job of openJobs) {
        const reservation = openReservations.find((r) => r.locumJobId === job._id) ?? null
        const scored = await scoreJob(job, [physician], reservation)
        log(`Job ${job._id} — score: ${scored[0]?.score?.toFixed(3) ?? 'filtered'}`)
        for (let i = 0; i < scored.length; i++) {
          const r = scored[i]
          resultDocs.push({
            runId,
            physicianId: r.physicianId,
            jobId: r.jobId,
            rank: i + 1,
            score: r.score,
            breakdown: r.breakdown,
            flags: r.flags ?? [],
            isActive: true,
            computedAt: new Date(),
          })
        }
      }

      for (const doc of resultDocs) await results.append(doc)

      await runs.updateWhere((r) => r.id === runId, {
        status: 'COMPLETED',
        completedAt: new Date(),
        resultCount: resultDocs.length,
      })
      log(`Run ${runId} completed with ${resultDocs.length} results`)
    } catch (err) {
      await runs.updateWhere((r) => r.id === runId, {
        status: 'FAILED',
        completedAt: new Date(),
        error: /** @type {Error} */ (err).message,
      })
      throw err
    }
  }
}
