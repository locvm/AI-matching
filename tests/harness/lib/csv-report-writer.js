// @ts-check

import { join } from 'node:path'
import { stringify } from 'csv-stringify/sync'
import { mkdir, writeFile } from 'node:fs/promises'

import { OUTPUT, PATHS } from '../harness.config.js'

/**
 * @typedef {import('./types.js').HarnessJobResult} HarnessJobResult
 * @typedef {import('./types.js').HarnessPhysicianResult} HarnessPhysicianResult
 * @typedef {import('./types.js').JobSummaryStats} JobSummaryStats
 */

export class CsvReportWriter {
  /** @type {string} */
  #outputDir

  /** @param {string} [outputDir] */
  constructor(outputDir) {
    this.#outputDir = outputDir ?? PATHS.JOB_OUTPUT_DIR
  }

  /**
   * @param {HarnessJobResult[]} results
   * @param {object} [meta]
   * @param {number} [meta.seed]
   * @param {number} [meta.maxJobs]
   * @param {number} [meta.maxUsers]
   * @returns {Promise<string>}
   */
  async write(results, meta) {
    await mkdir(this.#outputDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${OUTPUT.CSV_PREFIX}_${timestamp}.csv`
    const filePath = join(this.#outputDir, filename)

    const rows = this.#buildRows(results, meta)
    const csv = stringify(rows, { header: true })

    await writeFile(filePath, csv, 'utf-8')
    return filePath
  }

  /**
   * @param {HarnessJobResult[]} results
   * @param {object} [meta]
   * @param {number} [meta.seed]
   * @param {number} [meta.maxJobs]
   * @param {number} [meta.maxUsers]
   * @returns {Record<string, string | number>[]}
   */
  #buildRows(results, meta) {
    /** @type {Record<string, string | number>[]} */
    const rows = []

    for (const { job, topResults, stats } of results) {
      const jobContext = {
        job_id: job._id,
        job_title: job.postTitle ?? '',
        specialty: job.medSpeciality ?? '',
        province: job.fullAddress?.province ?? '',
        city: job.fullAddress?.city ?? '',
        date_from: job.dateRange?.from ? new Date(job.dateRange.from).toISOString().slice(0, 10) : '',
        date_to: job.dateRange?.to ? new Date(job.dateRange.to).toISOString().slice(0, 10) : '',
        emr: job.facilityInfo?.emr ?? '',
      }

      if (topResults.length === 0) {
        rows.push({
          ...jobContext,
          rank: 0,
          physician_id: 'NO_MATCHES',
          score: 0,
          score_location: 0,
          score_duration: 0,
          score_emr: 0,
          flags: '',
          eligible_candidates: stats.eligibleCandidates,
          score_min: stats.minScore,
          score_median: stats.medianScore,
          score_max: stats.maxScore,
          missing_data_flags: stats.missingDataFlags.join('; '),
          seed: meta?.seed ?? '',
        })
        continue
      }

      for (let i = 0; i < topResults.length; i++) {
        const r = topResults[i]
        rows.push({
          ...jobContext,
          rank: i + 1,
          physician_id: r.physicianId,
          score: r.score,
          score_location: r.breakdown.location ?? 0,
          score_duration: r.breakdown.duration ?? 0,
          score_emr: r.breakdown.emr ?? 0,
          flags: (r.flags ?? []).join('; '),
          eligible_candidates: stats.eligibleCandidates,
          score_min: stats.minScore,
          score_median: stats.medianScore,
          score_max: stats.maxScore,
          missing_data_flags: stats.missingDataFlags.join('; '),
          seed: meta?.seed ?? '',
        })
      }
    }

    return rows
  }
}

export class PhysicianCsvReportWriter {
  /** @type {string} */
  #outputDir

  /** @param {string} [outputDir] */
  constructor(outputDir) {
    this.#outputDir = outputDir ?? PATHS.PHYSICIAN_OUTPUT_DIR
  }

  /**
   * @param {HarnessPhysicianResult[]} results
   * @param {object} [meta]
   * @param {number} [meta.seed]
   * @param {number} [meta.maxJobs]
   * @param {number} [meta.maxUsers]
   * @returns {Promise<string>}
   */
  async write(results, meta) {
    await mkdir(this.#outputDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${OUTPUT.PHYSICIAN_CSV_PREFIX}_${timestamp}.csv`
    const filePath = join(this.#outputDir, filename)

    const rows = this.#buildRows(results, meta)
    const csv = stringify(rows, { header: true })

    await writeFile(filePath, csv, 'utf-8')
    return filePath
  }

  /**
   * @param {HarnessPhysicianResult[]} results
   * @param {object} [meta]
   * @param {number} [meta.seed]
   * @param {number} [meta.maxJobs]
   * @param {number} [meta.maxUsers]
   * @returns {Record<string, string | number>[]}
   */
  #buildRows(results, meta) {
    /** @type {Record<string, string | number>[]} */
    const rows = []

    for (const { physician, topResults, stats } of results) {
      const physicianContext = {
        physician_id: physician._id,
        physician_name: [physician.firstName, physician.lastName].filter(Boolean).join(' ') || '',
        specialty: physician.medSpeciality ?? '',
        province: physician.workAddress?.province ?? '',
      }

      if (topResults.length === 0) {
        rows.push({
          ...physicianContext,
          rank: 0,
          job_id: 'NO_MATCHES',
          job_title: '',
          score: 0,
          score_location: 0,
          score_duration: 0,
          score_emr: 0,
          flags: '',
          eligible_jobs: stats.eligibleJobs,
          score_min: stats.minScore,
          score_median: stats.medianScore,
          score_max: stats.maxScore,
          missing_data_flags: stats.missingDataFlags.join('; '),
          seed: meta?.seed ?? '',
        })
        continue
      }

      for (let i = 0; i < topResults.length; i++) {
        const r = topResults[i]
        rows.push({
          ...physicianContext,
          rank: i + 1,
          job_id: r.jobId ?? '',
          job_title: '',
          score: r.score,
          score_location: r.breakdown.location ?? 0,
          score_duration: r.breakdown.duration ?? 0,
          score_emr: r.breakdown.emr ?? 0,
          flags: (r.flags ?? []).join('; '),
          eligible_jobs: stats.eligibleJobs,
          score_min: stats.minScore,
          score_median: stats.medianScore,
          score_max: stats.maxScore,
          missing_data_flags: stats.missingDataFlags.join('; '),
          seed: meta?.seed ?? '',
        })
      }
    }

    return rows
  }
}
