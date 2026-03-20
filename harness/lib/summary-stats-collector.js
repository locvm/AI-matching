// @ts-check

/**
 * @typedef {import('../../../src/interfaces/index.js').SearchResult} SearchResult
 * @typedef {import('./types.js').JobSummaryStats} JobSummaryStats
 * @typedef {import('./types.js').PhysicianSummaryStats} PhysicianSummaryStats
 */

/**
 * Collects and computes summary statistics across harness results.
 */
export class SummaryStatsCollector {
  /**
   * @param {string} jobId
   * @param {SearchResult[]} results
   * @returns {JobSummaryStats}
   */
  computeForJob(jobId, results) {
    if (results.length === 0) {
      return {
        jobId,
        eligibleCandidates: 0,
        totalResults: 0,
        minScore: 0,
        medianScore: 0,
        maxScore: 0,
        missingDataFlags: [],
      }
    }

    const scores = results.map((r) => r.score).sort((a, b) => a - b)
    const flagCounts = this.#aggregateFlags(results)

    return {
      jobId,
      eligibleCandidates: results.length,
      totalResults: results.length,
      minScore: scores[0],
      medianScore: this.#median(scores),
      maxScore: scores[scores.length - 1],
      missingDataFlags: Object.entries(flagCounts).map(([flag, count]) => `${flag} (${count})`),
    }
  }

  /**
   * @param {string} physicianId
   * @param {SearchResult[]} results
   * @returns {PhysicianSummaryStats}
   */
  computeForPhysician(physicianId, results) {
    if (results.length === 0) {
      return {
        physicianId,
        eligibleJobs: 0,
        totalResults: 0,
        minScore: 0,
        medianScore: 0,
        maxScore: 0,
        missingDataFlags: [],
      }
    }

    const scores = results.map((r) => r.score).sort((a, b) => a - b)
    const flagCounts = this.#aggregateFlags(results)

    return {
      physicianId,
      eligibleJobs: results.length,
      totalResults: results.length,
      minScore: scores[0],
      medianScore: this.#median(scores),
      maxScore: scores[scores.length - 1],
      missingDataFlags: Object.entries(flagCounts).map(([flag, count]) => `${flag} (${count})`),
    }
  }

  /**
   * @param {number[]} sorted
   * @returns {number}
   */
  #median(sorted) {
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 0) {
      return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
    }
    return sorted[mid]
  }

  /**
   * @param {SearchResult[]} results
   * @returns {Record<string, number>}
   */
  #aggregateFlags(results) {
    /** @type {Record<string, number>} */
    const counts = {}
    for (const r of results) {
      if (!r.flags) continue
      for (const flag of r.flags) {
        if (!flag.startsWith('missing_')) continue
        counts[flag] = (counts[flag] ?? 0) + 1
      }
    }
    return counts
  }
}
