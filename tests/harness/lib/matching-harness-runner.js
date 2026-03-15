// @ts-check

import { searchPhysicians as searchPhysiciansStub, searchJobs as searchJobsStub } from './matching-engine-stub.js'
import { Sampler } from './sampler.js'
import { SummaryStatsCollector } from './summary-stats-collector.js'
import { CsvReportWriter, PhysicianCsvReportWriter } from './csv-report-writer.js'
import { OUTPUT, PATHS } from '../harness.config.js'

/**
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Physician} Physician
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').SearchResult} SearchResult
 * @typedef {import('./types.js').HarnessJobResult} HarnessJobResult
 * @typedef {import('./types.js').HarnessPhysicianResult} HarnessPhysicianResult
 * @typedef {import('./types.js').SamplerConfig} SamplerConfig
 * @typedef {import('./types.js').HarnessConfig} HarnessConfig
 * @typedef {import('./types.js').HarnessRunResult} HarnessRunResult
 * @typedef {import('./types.js').PhysicianHarnessRunResult} PhysicianHarnessRunResult
 * @typedef {import('./types.js').ScoreJobFn} ScoreJobFn
 * @typedef {import('./types.js').ScorePhysicianFn} ScorePhysicianFn
 */

// ── Job-centric harness (1 job → all physicians) ───────────────────────────

export class MatchingTestHarness {
  /** @type {LocumJob[]} */
  #jobs

  /** @type {Physician[]} */
  #physicians

  /** @type {Reservation[]} */
  #reservations

  /** @type {ScoreJobFn} */
  #searchPhysicians

  /** @type {HarnessConfig} */
  #config

  /**
   * @param {object} data
   * @param {LocumJob[]} data.jobs
   * @param {Physician[]} data.physicians
   * @param {Reservation[]} data.reservations
   * @param {ScoreJobFn} [data.searchPhysicians] - The matching function. Defaults to stub.
   * @param {HarnessConfig} [config]
   */
  constructor(data, config = {}) {
    this.#jobs = data.jobs
    this.#physicians = data.physicians
    this.#reservations = data.reservations
    this.#searchPhysicians = data.searchPhysicians ?? searchPhysiciansStub
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

    console.log(`[Harness:Job] Seed: ${sampler.seed}`)
    console.log(`[Harness:Job] Jobs: ${jobs.length} sampled from ${this.#jobs.length}`)
    console.log(`[Harness:Job] Physicians: ${physicians.length} sampled from ${this.#physicians.length}`)

    const statsCollector = new SummaryStatsCollector()
    /** @type {HarnessJobResult[]} */
    const harnessResults = []
    let totalMatches = 0

    for (const job of jobs) {
      const reservation = this.#reservations.find((r) => r.locumJobId === job._id) ?? undefined

      const results = await this.#searchPhysicians(job, physicians, reservation)

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

    console.log(`[Harness:Job] Processed ${jobs.length} jobs, ${totalMatches} total matches`)
    console.log(`[Harness:Job] Output: ${outputPath}`)

    return {
      outputPath,
      jobsProcessed: jobs.length,
      totalMatches,
      seed: sampler.seed,
      results: harnessResults,
    }
  }
}

// ── Physician-centric harness (1 physician → all jobs) ──────────────────────

export class PhysicianTestHarness {
  /** @type {LocumJob[]} */
  #jobs

  /** @type {Physician[]} */
  #physicians

  /** @type {Reservation[]} */
  #reservations

  /** @type {ScorePhysicianFn} */
  #searchJobs

  /** @type {HarnessConfig} */
  #config

  /**
   * @param {object} data
   * @param {LocumJob[]} data.jobs
   * @param {Physician[]} data.physicians
   * @param {Reservation[]} data.reservations
   * @param {ScorePhysicianFn} [data.searchJobs] - The matching function. Defaults to stub.
   * @param {HarnessConfig} [config]
   */
  constructor(data, config = {}) {
    this.#jobs = data.jobs
    this.#physicians = data.physicians
    this.#reservations = data.reservations
    this.#searchJobs = data.searchJobs ?? searchJobsStub
    this.#config = {
      topK: config.topK ?? OUTPUT.TOP_K,
      outputDir: config.outputDir ?? PATHS.OUTPUT_DIR,
      sampling: config.sampling,
    }
  }

  /** @returns {Promise<PhysicianHarnessRunResult>} */
  async run() {
    const sampler = new Sampler(this.#config.sampling)

    const jobs = sampler.sampleJobs(this.#jobs)
    const physicians = sampler.sampleUsers(this.#physicians)

    console.log(`[Harness:Physician] Seed: ${sampler.seed}`)
    console.log(`[Harness:Physician] Physicians: ${physicians.length} sampled from ${this.#physicians.length}`)
    console.log(`[Harness:Physician] Jobs: ${jobs.length} sampled from ${this.#jobs.length}`)

    const statsCollector = new SummaryStatsCollector()
    /** @type {HarnessPhysicianResult[]} */
    const harnessResults = []
    let totalMatches = 0

    for (const physician of physicians) {
      const results = await this.#searchJobs(physician, jobs, this.#reservations)

      const topResults = results.slice(0, this.#config.topK)
      const stats = statsCollector.computeForPhysician(physician._id, results)

      harnessResults.push({ physician, topResults, stats })
      totalMatches += results.length
    }

    const writer = new PhysicianCsvReportWriter(this.#config.outputDir)
    const outputPath = await writer.write(harnessResults, {
      seed: sampler.seed,
      maxJobs: this.#config.sampling?.maxJobs,
      maxUsers: this.#config.sampling?.maxUsers,
    })

    console.log(`[Harness:Physician] Processed ${physicians.length} physicians, ${totalMatches} total matches`)
    console.log(`[Harness:Physician] Output: ${outputPath}`)

    return {
      outputPath,
      physiciansProcessed: physicians.length,
      totalMatches,
      seed: sampler.seed,
      results: harnessResults,
    }
  }
}
