// @ts-check

// Harness-backed integration test for combineAndRank.
//
// Loads real fixture data, runs stub scorers for Stage 2,
// then feeds the ScoredPairs into the real combineAndRank for Stage 3.
// Validates end-to-end scoring invariants.

import { describe, it, expect, beforeAll } from 'vitest'
import { loadFixtures } from '../../harness/lib/fixture-loader.js'
import { stubScoreEMR } from '../../harness/lib/stub-scorers.js'
import { scoreLocation } from '../location/scoreLocation.js'
import { createDurationScorer } from '../duration/scoreDuration.js'
import { combineAndRank } from '../combineAndRank.js'

const scoreDuration = createDurationScorer()

/** @typedef {import('../../interfaces/matching/matching.js').ScoredPair} ScoredPair */

/** @type {import('../../harness/lib/types.js').FixtureData} */
let fixtures

beforeAll(async () => {
  fixtures = await loadFixtures({ enrichGps: 'local' })
})

/**
 * Build ScoredPairs for a single job against all physicians that pass hard filters.
 *
 * @param {import('../../interfaces/core/models.js').LocumJob} job
 * @param {import('../../interfaces/core/models.js').Physician[]} physicians
 * @returns {ScoredPair[]}
 */
function buildScoredPairs(job, physicians) {
  /** @type {ScoredPair[]} */
  const pairs = []

  for (const physician of physicians) {
    // Basic hard filters (same as harness stub)
    if (physician.medProfession !== job.medProfession) continue
    const pSpec = (physician.medSpeciality ?? '').trim().toLowerCase()
    const jSpec = (job.medSpeciality ?? '').trim().toLowerCase()
    if (pSpec !== jSpec) continue
    if (!physician.isLookingForLocums) continue

    /** @type {string[]} */
    const flags = []
    if (!(physician.workAddress?.city && physician.workAddress?.province)) {
      flags.push('missing_physician_location')
    }

    pairs.push({
      physicianId: physician._id,
      jobId: job._id,
      breakdown: {
        location: scoreLocation(physician, job.location, job.fullAddress),
        duration: scoreDuration(physician, job.dateRange).score,
        emr: stubScoreEMR(physician, job),
      },
      flags,
    })
  }

  return pairs
}

describe('Harness: combineAndRank end-to-end', () => {
  /** @type {import('../../interfaces/matching/matching.js').SearchResult[]} */
  let allResults

  beforeAll(() => {
    // Run combineAndRank across multiple jobs
    allResults = []
    const jobSample = fixtures.jobs.slice(0, 10)

    for (const job of jobSample) {
      const pairs = buildScoredPairs(job, fixtures.physicians)
      const results = combineAndRank(pairs)
      allResults.push(...results)
    }
  })

  it('produces results', () => {
    expect(allResults.length).toBeGreaterThan(0)
  })

  it('all scores are in [0, 5]', () => {
    for (const r of allResults) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(5)
    }
  })

  it('all breakdown values are in [0, 1]', () => {
    for (const r of allResults) {
      for (const key of Object.keys(r.breakdown)) {
        const val = r.breakdown[key]
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  })

  it('no NaN values in scores or breakdown', () => {
    for (const r of allResults) {
      expect(Number.isNaN(r.score)).toBe(false)
      for (const key of Object.keys(r.breakdown)) {
        expect(Number.isNaN(r.breakdown[key])).toBe(false)
      }
    }
  })

  it('breakdown contains all 3 categories (all stubs always return a value)', () => {
    for (const r of allResults) {
      expect(r.breakdown.location).toBeDefined()
      expect(r.breakdown.duration).toBeDefined()
      expect(r.breakdown.emr).toBeDefined()
    }
  })

  it('every result has physicianId and jobId', () => {
    for (const r of allResults) {
      expect(r.physicianId).toBeTruthy()
      expect(r.jobId).toBeTruthy()
    }
  })
})

describe('Harness: combineAndRank sorting and filtering', () => {
  it('results are sorted descending by score', () => {
    const pairs = buildScoredPairs(fixtures.jobs[0], fixtures.physicians)
    const results = combineAndRank(pairs)

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('threshold filters correctly on real data', () => {
    const pairs = buildScoredPairs(fixtures.jobs[0], fixtures.physicians)
    const all = combineAndRank(pairs)
    const filtered = combineAndRank(pairs, { threshold: 2.5 })

    expect(filtered.length).toBeLessThanOrEqual(all.length)
    for (const r of filtered) {
      expect(r.score).toBeGreaterThanOrEqual(2.5)
    }
  })

  it('limit caps correctly on real data', () => {
    const pairs = buildScoredPairs(fixtures.jobs[0], fixtures.physicians)
    const results = combineAndRank(pairs, { limit: 5 })

    expect(results.length).toBeLessThanOrEqual(5)
  })
})

describe('Harness: score distribution stats', () => {
  it('logs distribution stats for debugging (not an assertion)', () => {
    const pairs = buildScoredPairs(fixtures.jobs[0], fixtures.physicians)
    const results = combineAndRank(pairs)

    if (results.length === 0) return

    const scores = results.map((r) => r.score)
    const min = Math.min(...scores)
    const max = Math.max(...scores)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const sorted = [...scores].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    console.log('\n  Score Distribution (combineAndRank):')
    console.log(`    Count:  ${scores.length}`)
    console.log(`    Min:    ${min.toFixed(3)}`)
    console.log(`    Max:    ${max.toFixed(3)}`)
    console.log(`    Avg:    ${avg.toFixed(3)}`)
    console.log(`    Median: ${median.toFixed(3)}`)

    // Sanity: avg should be between min and max
    expect(avg).toBeGreaterThanOrEqual(min)
    expect(avg).toBeLessThanOrEqual(max)
  })
})
