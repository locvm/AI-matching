// @ts-check

import { createSeededRandom, seededShuffle } from './random-seeder.js'
import { SAMPLING, JOB_FILTERS } from '../harness.config.js'

/**
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Physician} Physician
 * @typedef {import('./types.js').SamplerConfig} SamplerConfig
 */

const MS_PER_DAY = 86_400_000

export class Sampler {
  /** @param {SamplerConfig} [config] */
  constructor(config = {}) {
    /** @type {Required<Omit<SamplerConfig, 'jobFilter'>> & { jobFilter?: string }} */
    this._config = {
      maxJobs: config.maxJobs ?? SAMPLING.MAX_JOBS,
      maxUsers: config.maxUsers ?? SAMPLING.MAX_USERS,
      seed: config.seed ?? SAMPLING.DEFAULT_SEED ?? Date.now(),
      jobFilter: config.jobFilter,
    }
    /** @type {() => number} */
    this._rng = createSeededRandom(this._config.seed)
  }

  /**
   * @param {LocumJob[]} jobs
   * @returns {LocumJob[]}
   */
  sampleJobs(jobs) {
    let filtered = jobs

    if (this._config.jobFilter) {
      filtered = this._applyJobFilter(filtered, this._config.jobFilter)
    }

    if (filtered.length <= this._config.maxJobs) return filtered

    const shuffled = seededShuffle(filtered, this._rng)
    return shuffled.slice(0, this._config.maxJobs)
  }

  /**
   * @param {Physician[]} physicians
   * @returns {Physician[]}
   */
  sampleUsers(physicians) {
    if (physicians.length <= this._config.maxUsers) return physicians

    const shuffled = seededShuffle(physicians, this._rng)
    return shuffled.slice(0, this._config.maxUsers)
  }

  get seed() {
    return this._config.seed
  }

  /**
   * @param {LocumJob[]} jobs
   * @param {string} filter
   * @returns {LocumJob[]}
   */
  _applyJobFilter(jobs, filter) {
    const key = filter.toLowerCase()
    if (key === 'short-term') {
      return jobs.filter((job) => {
        if (!job.dateRange?.from || !job.dateRange?.to) return false
        const days = (new Date(job.dateRange.to).getTime() - new Date(job.dateRange.from).getTime()) / MS_PER_DAY
        return days <= JOB_FILTERS.SHORT_TERM_MAX_DAYS
      })
    }

    if (key === 'long-term') {
      return jobs.filter((job) => {
        if (!job.dateRange?.from || !job.dateRange?.to) return false
        const days = (new Date(job.dateRange.to).getTime() - new Date(job.dateRange.from).getTime()) / MS_PER_DAY
        return days > JOB_FILTERS.SHORT_TERM_MAX_DAYS
      })
    }
    return jobs
  }
}
