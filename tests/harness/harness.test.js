// @ts-check

import { describe, it, expect, beforeAll } from 'vitest'

import { loadFixtures } from './lib/fixture-loader.js'
import { MatchingTestHarness, PhysicianTestHarness } from './lib/matching-harness-runner.js'
import { PATHS, OUTPUT, SCORING, TEST } from './harness.config.js'

/** @type {import('./lib/fixture-loader.js').FixtureData} */
let fixtures

beforeAll(async () => {
  fixtures = await loadFixtures()
})

/**
 * @param {object} [overrides]
 * @returns {MatchingTestHarness}
 */
function createJobHarness(overrides = {}) {
  return new MatchingTestHarness({
    jobs: fixtures.jobs,
    physicians: fixtures.physicians,
    reservations: fixtures.reservations,
    ...overrides,
  })
}

/**
 * @param {object} [overrides]
 * @returns {PhysicianTestHarness}
 */
function createPhysicianHarness(overrides = {}) {
  return new PhysicianTestHarness(fixtures, {
    topK: OUTPUT.TOP_K,
    outputDir: PATHS.OUTPUT_DIR,
    sampling: {
      maxJobs: TEST.MAX_JOBS,
      maxUsers: TEST.MAX_USERS,
      seed: TEST.SEED,
      ...overrides,
    },
  })
}

describe('MatchingTestHarness – end-to-end', () => {
  /** @type {import('./lib/types.js').HarnessRunResult} */
  let result

  beforeAll(async () => {
    result = await createJobHarness().run()
  })

  it('should process the expected number of sampled jobs', () => {
    expect(result.jobsProcessed).toBeLessThanOrEqual(TEST.MAX_JOBS)
    expect(result.jobsProcessed).toBeGreaterThan(0)
  })

  it('should produce an output file path', () => {
    expect(result.outputPath).toContain(OUTPUT.CSV_PREFIX)
    expect(result.outputPath).toContain('.csv')
  })

  it('should return the seed used', () => {
    expect(result.seed).toBe(TEST.SEED)
  })

  it('should return results for each processed job', () => {
    expect(result.results.length).toBe(result.jobsProcessed)
  })

  it('should include job context in each result', () => {
    for (const r of result.results) {
      expect(r.job).toBeDefined()
      expect(r.job._id).toBeTruthy()
      expect(r.stats).toBeDefined()
    }
  })

  it('should limit topResults to topK', () => {
    for (const r of result.results) {
      expect(r.topResults.length).toBeLessThanOrEqual(OUTPUT.TOP_K)
    }
  })

  it('should satisfy basic scoring invariants', () => {
    for (const r of result.results) {
      for (const match of r.topResults) {
        expect(match.score).toBeGreaterThanOrEqual(0)
        expect(match.score).toBeLessThanOrEqual(SCORING.MAX_SCORE)
        expect(match.breakdown.location).toBeGreaterThanOrEqual(0)
        expect(match.breakdown.location).toBeLessThanOrEqual(SCORING.MAX_SCORE)
        expect(match.breakdown.duration).toBeGreaterThanOrEqual(0)
        expect(match.breakdown.duration).toBeLessThanOrEqual(SCORING.MAX_SCORE)
        expect(match.breakdown.emr).toBeGreaterThanOrEqual(0)
        expect(match.breakdown.emr).toBeLessThanOrEqual(SCORING.MAX_SCORE)
      }
    }
  })

  it('should include jobId in every match result', () => {
    for (const r of result.results) {
      for (const match of r.topResults) {
        expect(match.jobId).toBeTruthy()
        expect(match.jobId).toBe(r.job._id)
      }
    }
  })

  it('should have sane summary stats', () => {
    for (const r of result.results) {
      expect(r.stats.eligibleCandidates).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(r.stats.eligibleCandidates)).toBe(true)

      if (r.stats.eligibleCandidates === 0) continue
      expect(r.stats.minScore).toBeLessThanOrEqual(r.stats.medianScore)
      expect(r.stats.medianScore).toBeLessThanOrEqual(r.stats.maxScore)
    }
  })
})

describe('MatchingTestHarness – determinism', () => {
  it('should produce identical results with the same seed', async () => {
    const result1 = await createJobHarness({ seed: 999 }).run()
    const result2 = await createJobHarness({ seed: 999 }).run()

    expect(result1.jobsProcessed).toBe(result2.jobsProcessed)
    expect(result1.totalMatches).toBe(result2.totalMatches)

    for (let i = 0; i < result1.results.length; i++) {
      expect(result1.results[i].job._id).toBe(result2.results[i].job._id)
      for (let j = 0; j < result1.results[i].topResults.length; j++) {
        expect(result1.results[i].topResults[j].physicianId).toBe(result2.results[i].topResults[j].physicianId)
        expect(result1.results[i].topResults[j].score).toBe(result2.results[i].topResults[j].score)
      }
    }
  })

  it('should produce different results with different seeds', async () => {
    const result1 = await createJobHarness({ seed: 111 }).run()
    const result2 = await createJobHarness({ seed: 222 }).run()

    const jobs1 = result1.results.map((r) => r.job._id).sort()
    const jobs2 = result2.results.map((r) => r.job._id).sort()
    expect(jobs1.some((id, i) => id !== jobs2[i])).toBe(true)
  })
})

describe('PhysicianTestHarness – end-to-end', () => {
  /** @type {import('./lib/types.js').PhysicianHarnessRunResult} */
  let result

  beforeAll(async () => {
    result = await createPhysicianHarness().run()
  })

  it('should process the expected number of sampled physicians', () => {
    expect(result.physiciansProcessed).toBeLessThanOrEqual(TEST.MAX_USERS)
    expect(result.physiciansProcessed).toBeGreaterThan(0)
  })

  it('should produce an output file path', () => {
    expect(result.outputPath).toContain(OUTPUT.PHYSICIAN_CSV_PREFIX)
    expect(result.outputPath).toContain('.csv')
  })

  it('should return the seed used', () => {
    expect(result.seed).toBe(TEST.SEED)
  })

  it('should return results for each processed physician', () => {
    expect(result.results.length).toBe(result.physiciansProcessed)
  })

  it('should include physician context in each result', () => {
    for (const r of result.results) {
      expect(r.physician).toBeDefined()
      expect(r.physician._id).toBeTruthy()
      expect(r.stats).toBeDefined()
    }
  })

  it('should limit topResults to topK', () => {
    for (const r of result.results) {
      expect(r.topResults.length).toBeLessThanOrEqual(OUTPUT.TOP_K)
    }
  })

  it('should satisfy basic scoring invariants', () => {
    for (const r of result.results) {
      for (const match of r.topResults) {
        expect(match.score).toBeGreaterThanOrEqual(0)
        expect(match.score).toBeLessThanOrEqual(SCORING.MAX_SCORE)
        expect(match.breakdown.location).toBeGreaterThanOrEqual(0)
        expect(match.breakdown.location).toBeLessThanOrEqual(SCORING.MAX_SCORE)
        expect(match.breakdown.duration).toBeGreaterThanOrEqual(0)
        expect(match.breakdown.duration).toBeLessThanOrEqual(SCORING.MAX_SCORE)
        expect(match.breakdown.emr).toBeGreaterThanOrEqual(0)
        expect(match.breakdown.emr).toBeLessThanOrEqual(SCORING.MAX_SCORE)
      }
    }
  })

  it('should include physicianId and jobId in every match result', () => {
    for (const r of result.results) {
      for (const match of r.topResults) {
        expect(match.physicianId).toBe(r.physician._id)
        expect(match.jobId).toBeTruthy()
      }
    }
  })

  it('should have sane summary stats', () => {
    for (const r of result.results) {
      expect(r.stats.eligibleJobs).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(r.stats.eligibleJobs)).toBe(true)

      if (r.stats.eligibleJobs === 0) continue
      expect(r.stats.minScore).toBeLessThanOrEqual(r.stats.medianScore)
      expect(r.stats.medianScore).toBeLessThanOrEqual(r.stats.maxScore)
    }
  })
})

describe('PhysicianTestHarness – determinism', () => {
  it('should produce identical results with the same seed', async () => {
    const result1 = await createPhysicianHarness({ seed: 999 }).run()
    const result2 = await createPhysicianHarness({ seed: 999 }).run()

    expect(result1.physiciansProcessed).toBe(result2.physiciansProcessed)
    expect(result1.totalMatches).toBe(result2.totalMatches)

    for (let i = 0; i < result1.results.length; i++) {
      expect(result1.results[i].physician._id).toBe(result2.results[i].physician._id)
      for (let j = 0; j < result1.results[i].topResults.length; j++) {
        expect(result1.results[i].topResults[j].jobId).toBe(result2.results[i].topResults[j].jobId)
        expect(result1.results[i].topResults[j].score).toBe(result2.results[i].topResults[j].score)
      }
    }
  })

  it('should produce different results with different seeds', async () => {
    const result1 = await createPhysicianHarness({ seed: 111 }).run()
    const result2 = await createPhysicianHarness({ seed: 222 }).run()

    const physicians1 = result1.results.map((r) => r.physician._id).sort()
    const physicians2 = result2.results.map((r) => r.physician._id).sort()
    expect(physicians1.some((id, i) => id !== physicians2[i])).toBe(true)
  })
})
