// @ts-check

import { MatchingEngineStub } from './matching-engine-stub.js'
import { Sampler } from './Sampler.js'
import { SummaryStatsCollector } from './summary-stats-collector.js'
import { CsvReportWriter } from './csv-report-writer.js'
import { OUTPUT, PATHS } from '../harness.config.js'
  
/**
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Physician} Physician
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').SearchCriteria} SearchCriteria
 * @typedef {import('./types.js').SearchResult} SearchResult
 * @typedef {import('./types.js').HarnessJobResult} HarnessJobResult
 * @typedef {import('./types.js').SamplerConfig} SamplerConfig
 * @typedef {import('./types.js').HarnessConfig} HarnessConfig
 * @typedef {import('./types.js').HarnessRunResult} HarnessRunResult
 * @typedef {import('./types.js').MatchingEngine} MatchingEngine
 */

export class MatchingTestHarness {
  /** @type {LocumJob[]} */
  #jobs

  /** @type {Physician[]} */
  #physicians

  /** @type {Reservation[]} */
  #reservations

  /** @type {MatchingEngine} */
  #engine

  /** @type {HarnessConfig} */
  #config

  /**
   * @param {object} data
   * @param {LocumJob[]} data.jobs
   * @param {Physician[]} data.physicians
   * @param {Reservation[]} data.reservations
   * @param {MatchingEngine} [data.engine]
   * @param {HarnessConfig} [config]
   */
  constructor(data, config = {}) {
    this.#jobs = data.jobs
    this.#physicians = data.physicians
    this.#reservations = data.reservations
    this.#engine = data.engine ?? new MatchingEngineStub()
    this.#config = {
      topK: config.topK ?? OUTPUT.TOP_K,
      outputDir: config.outputDir ?? PATHS.OUTPUT_DIR,
      sampling: config.sampling,
    }
  }

  /** @returns {Promise<HarnessRunResult>} */
  async run() {
    const sampler = new Sampler(this.#config.sampling)

    const jobs = sampler.sampleJobs(this.#jobs)
    const physicians = sampler.sampleUsers(this.#physicians)

    console.log(`[Harness] Seed: ${sampler.seed}`)
    console.log(`[Harness] Jobs: ${jobs.length} sampled from ${this.#jobs.length}`)
    console.log(`[Harness] Physicians: ${physicians.length} sampled from ${this.#physicians.length}`)

    const statsCollector = new SummaryStatsCollector()
    /** @type {HarnessJobResult[]} */
    const harnessResults = []
    let totalMatches = 0

    for (const job of jobs) {
      const reservation = this.#reservations.find((r) => r.locumJobId === job._id) ?? null

      const results = await this.#engine.searchPhysicians({ job, reservation: reservation ?? undefined }, physicians)

      const topResults = results.slice(0, this.#config.topK)
      const stats = statsCollector.computeForJob(job._id, results)

      harnessResults.push({ job, topResults, stats })
      totalMatches += results.length
    }

    const writer = new CsvReportWriter(this.#config.outputDir)
    const outputPath = await writer.write(harnessResults, {
      seed: sampler.seed,
      maxJobs: this.#config.sampling?.maxJobs,
      maxUsers: this.#config.sampling?.maxUsers,
    })

    console.log(`[Harness] Processed ${jobs.length} jobs, ${totalMatches} total matches`)
    console.log(`[Harness] Output: ${outputPath}`)

    return {
      outputPath,
      jobsProcessed: jobs.length,
      totalMatches,
      seed: sampler.seed,
      results: harnessResults,
    }
  }
}
