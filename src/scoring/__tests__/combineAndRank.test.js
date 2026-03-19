import { describe, it, expect } from 'vitest'
import { combineAndRank, computeWeightedScore } from '../combineAndRank.js'
import { WEIGHTS } from '../../config/scoringConfig.js'

// Helper to build a minimal ScoredPair
/**
 * @param {import('../../interfaces/matching/matching.js').ScoreBreakdown} breakdown
 * @param {object} [overrides]
 * @param {string} [overrides.physicianId]
 * @param {string} [overrides.jobId]
 * @param {string[]} [overrides.flags]
 * @returns {import('../../interfaces/matching/matching.js').ScoredPair}
 */
function makePair(breakdown, overrides = {}) {
  return {
    physicianId: overrides.physicianId ?? 'phys-1',
    jobId: overrides.jobId ?? 'job-1',
    breakdown,
    flags: overrides.flags ?? [],
  }
}

// ─── computeWeightedScore ──────────────────────────────────────────────────

describe('computeWeightedScore', () => {
  it('computes correct weighted sum with all 3 categories', () => {
    const breakdown = {
      location: 0.8,
      duration: 0.6,
      emr: 0.4,
    }
    // All weights present → no re-normalization needed
    // emr:      0.4*0.40 = 0.16
    // location: 0.8*0.35 = 0.28
    // duration: 0.6*0.25 = 0.15
    // weighted avg = 0.59, scaled to 0-5 = 2.95
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBeCloseTo(0.59 * 5, 1)
  })

  it('returns 5.0 when all scores are 1.0', () => {
    const breakdown = { location: 1, duration: 1, emr: 1 }
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBe(5)
  })

  it('returns 0 when all scores are 0', () => {
    const breakdown = { location: 0, duration: 0, emr: 0 }
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBe(0)
  })

  it('returns 2.5 when all scores are 0.5', () => {
    const breakdown = { location: 0.5, duration: 0.5, emr: 0.5 }
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBe(2.5)
  })
})

// ─── Re-normalization for missing components ───────────────────────────────

describe('re-normalization for missing components', () => {
  it('redistributes weight when one category is missing', () => {
    // Missing emr (weight 0.40). Available: location 0.35, duration 0.25 = 0.60
    const breakdown = { location: 0.8, duration: 0.6 }
    const w = WEIGHTS
    const weighted = 0.8 * w.location + 0.6 * w.duration
    const weightSum = w.location + w.duration
    const expected = (weighted / weightSum) * 5
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBeCloseTo(expected, 1)
  })

  it('works with only 1 category scored', () => {
    const breakdown = { location: 0.9 }
    // Re-normalizes to just location → 0.9 * 5 = 4.5
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBeCloseTo(0.9 * 5, 1)
  })

  it('returns 0 when all categories are missing', () => {
    const { totalScore, breakdown } = computeWeightedScore({})
    expect(totalScore).toBe(0)
    expect(breakdown).toEqual({})
  })

  it('missing categories stay undefined in output breakdown', () => {
    const { breakdown } = computeWeightedScore({ location: 0.8, emr: 0.5 })
    expect(breakdown.location).toBeDefined()
    expect(breakdown.emr).toBeDefined()
    expect(breakdown.duration).toBeUndefined()
  })
})

// ─── Score bounds ──────────────────────────────────────────────────────────

describe('score bounds', () => {
  it('totalScore is always in [0, 5]', () => {
    const cases = [
      { location: 0, duration: 0, emr: 0 },
      { location: 1, duration: 1, emr: 1 },
      { location: 0.5 },
      { location: 1, duration: 0 },
      {},
    ]
    for (const breakdown of cases) {
      const { totalScore } = computeWeightedScore(breakdown)
      expect(totalScore).toBeGreaterThanOrEqual(0)
      expect(totalScore).toBeLessThanOrEqual(5)
    }
  })

  it('breakdown values are always in [0, 1]', () => {
    const { breakdown } = computeWeightedScore({
      location: 0.99,
      duration: 0.01,
      emr: 0.5,
    })
    for (const key of Object.keys(breakdown)) {
      expect(
        breakdown[/** @type {keyof import('../../interfaces/matching/matching.js').ScoreBreakdown} */ (key)]
      ).toBeGreaterThanOrEqual(0)
      expect(
        breakdown[/** @type {keyof import('../../interfaces/matching/matching.js').ScoreBreakdown} */ (key)]
      ).toBeLessThanOrEqual(1)
    }
  })
})

// ─── Breakdown keys ────────────────────────────────────────────────────────

describe('breakdown keys', () => {
  it('all 3 keys present when all scored', () => {
    const { breakdown } = computeWeightedScore({
      location: 0.5,
      duration: 0.5,
      emr: 0.5,
    })
    expect(Object.keys(breakdown).sort()).toEqual(['duration', 'emr', 'location'])
  })

  it('only scored keys present in output', () => {
    const { breakdown } = computeWeightedScore({ location: 0.8, emr: 0.3 })
    expect(Object.keys(breakdown).sort()).toEqual(['emr', 'location'])
  })
})

// ─── combineAndRank ────────────────────────────────────────────────────────

describe('combineAndRank', () => {
  it('returns empty array for empty input', () => {
    expect(combineAndRank([])).toEqual([])
  })

  it('passes through physicianId, jobId, and flags', () => {
    const pairs = [
      makePair(
        { location: 0.5 },
        {
          physicianId: 'p-42',
          jobId: 'j-99',
          flags: ['missing_emr_data'],
        }
      ),
    ]
    const [result] = combineAndRank(pairs)
    expect(result.physicianId).toBe('p-42')
    expect(result.jobId).toBe('j-99')
    expect(result.flags).toEqual(['missing_emr_data'])
  })

  it('produces no NaN values', () => {
    const pairs = [
      makePair({}, { physicianId: 'a' }),
      makePair({ location: 0.5 }, { physicianId: 'b' }),
      makePair({ location: 0, duration: 0, emr: 0 }, { physicianId: 'c' }),
    ]
    const results = combineAndRank(pairs)
    for (const r of results) {
      expect(Number.isNaN(r.score)).toBe(false)
    }
  })
})

// ─── Sorting ───────────────────────────────────────────────────────────────

describe('sorting', () => {
  it('results are sorted descending by score', () => {
    const pairs = [
      makePair({ location: 0.2 }, { physicianId: 'low' }),
      makePair({ location: 0.9 }, { physicianId: 'high' }),
      makePair({ location: 0.5 }, { physicianId: 'mid' }),
    ]
    const results = combineAndRank(pairs)
    expect(results[0].physicianId).toBe('high')
    expect(results[1].physicianId).toBe('mid')
    expect(results[2].physicianId).toBe('low')
  })

  it('stable sort preserves input order for ties', () => {
    const pairs = [
      makePair({ location: 0.5 }, { physicianId: 'first' }),
      makePair({ location: 0.5 }, { physicianId: 'second' }),
      makePair({ location: 0.5 }, { physicianId: 'third' }),
    ]
    const results = combineAndRank(pairs)
    expect(results.map((r) => r.physicianId)).toEqual(['first', 'second', 'third'])
  })
})

// ─── Threshold filtering ───────────────────────────────────────────────────

describe('threshold filtering', () => {
  const pairs = [
    makePair({ location: 0.9 }, { physicianId: 'high' }),
    makePair({ location: 0.5 }, { physicianId: 'mid' }),
    makePair({ location: 0.1 }, { physicianId: 'low' }),
  ]

  it('filters out scores below threshold', () => {
    // location-only scores: 0.9*5=4.5, 0.5*5=2.5, 0.1*5=0.5
    const results = combineAndRank(pairs, { threshold: 2.5 })
    expect(results.length).toBe(2)
    expect(results.every((r) => r.score >= 2.5)).toBe(true)
  })

  it('no threshold returns all', () => {
    const results = combineAndRank(pairs)
    expect(results.length).toBe(3)
  })

  it('threshold higher than all scores returns empty', () => {
    const results = combineAndRank(pairs, { threshold: 4.99 })
    expect(results.length).toBe(0)
  })
})

// ─── Limit capping ─────────────────────────────────────────────────────────

describe('limit capping', () => {
  const pairs = Array.from({ length: 10 }, (_, i) => makePair({ location: (10 - i) / 10 }, { physicianId: `p-${i}` }))

  it('caps results at limit', () => {
    const results = combineAndRank(pairs, { limit: 3 })
    expect(results.length).toBe(3)
  })

  it('limit larger than results returns all', () => {
    const results = combineAndRank(pairs, { limit: 100 })
    expect(results.length).toBe(10)
  })

  it('no limit returns all', () => {
    const results = combineAndRank(pairs)
    expect(results.length).toBe(10)
  })
})
