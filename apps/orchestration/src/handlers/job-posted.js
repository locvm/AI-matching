// @ts-check

import { scoreJob } from '@locvm/matching-engine'
import { dataRepository, matchRunResultRepository } from '@locvm/database'
import { withRun } from './run.js'

export class JobPostedHandler {
  /**
   * @param {{ jobId: string }} payload
   * @param {(msg: string) => void} log
   */
  async process({ jobId }, log = () => {}) {
    const [job, physicians, reservation] = await Promise.all([
      dataRepository.findJobById(jobId),
      dataRepository.findEligiblePhysicians(),
      dataRepository.findReservationByJobId(jobId),
    ])

    if (!job) throw new Error(`Job ${jobId} not found`)
    log(`Loaded job + ${physicians.length} eligible physicians`)

    await withRun('JOB_POSTED', { jobId }, async (runId) => {
      log(`Scoring ${physicians.length} physicians against job ${jobId}...`)
      const results = await scoreJob(job, physicians, reservation)
      log(`${results.length} results above threshold — persisting...`)

      await matchRunResultRepository.saveMany(runId, results)
      log(`Run completed with ${results.length} results`)
      return results.length
    })
  }
}
