// @ts-check

import { randomUUID } from 'node:crypto'
import { scoreJob } from '@locvm/matching-engine'
import { loadFixtures, JsonStore, STORE_PATHS } from '@locvm/database'

const runs = new JsonStore(STORE_PATHS.matchRuns)
const results = new JsonStore(STORE_PATHS.matchRunResults)

export class JobPostedHandler {
  /**
   * @param {{ jobId: string }} payload
   * @param {(msg: string) => void} log
   */
  async process({ jobId }, log = () => {}) {
    const { jobs, physicians, reservations } = await loadFixtures()
    log(`Fixtures loaded — ${physicians.length} physicians, ${jobs.length} jobs`)

    const job = jobs.find((j) => j._id === jobId)
    if (!job) throw new Error(`Job ${jobId} not found`)

    const reservation = reservations.find((r) => r.locumJobId === jobId) ?? null
    log(`Job found${reservation ? ' (has reservation)' : ' (no reservation)'}`)

    const runId = randomUUID()
    await runs.append({
      id: runId,
      type: 'JOB_POSTED',
      status: 'RUNNING',
      jobId,
      startedAt: new Date(),
      createdAt: new Date(),
    })

    try {
      log(`Scoring job ${jobId} against ${physicians.length} physicians...`)
      const scored = await scoreJob(job, physicians, reservation)
      log(`Scored ${scored.length} results — persisting...`)

      for (let i = 0; i < scored.length; i++) {
        const r = scored[i]
        await results.append({
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

      await runs.updateWhere((r) => r.id === runId, {
        status: 'COMPLETED',
        completedAt: new Date(),
        resultCount: scored.length,
      })
      log(`Run ${runId} completed with ${scored.length} results`)
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
