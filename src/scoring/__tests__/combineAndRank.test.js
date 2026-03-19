import { describe, it, expect } from 'vitest'
import { combineAndRank, computeWeightedScore } from '../combineAndRank.js'
import { WEIGHTS } from '../../config/scoringConfig.js'

// Helper to build a minimal ScoredPair
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
  it('computes correct weighted sum with all 5 categories', () => {
    const breakdown = {
      location: 0.8,
      duration: 0.6,
      emr: 0.4,
      province: 1.0,
      speciality: 0.2,
    }
    // All weights present → no re-normalization needed
    // speciality: 0.2*0.30 = 0.06
    // emr:        0.4*0.25 = 0.10
    // province:   1.0*0.20 = 0.20
    // location:   0.8*0.15 = 0.12
    // duration:   0.6*0.10 = 0.06
    // total = 0.54
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBeCloseTo(0.54, 2)
  })

  it('returns 1.0 when all scores are 1.0', () => {
    const breakdown = { location: 1, duration: 1, emr: 1, province: 1, speciality: 1 }
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBe(1)
  })

  it('returns 0 when all scores are 0', () => {
    const breakdown = { location: 0, duration: 0, emr: 0, province: 0, speciality: 0 }
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBe(0)
  })

  it('returns 0.5 when all scores are 0.5', () => {
    const breakdown = { location: 0.5, duration: 0.5, emr: 0.5, province: 0.5, speciality: 0.5 }
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBe(0.5)
  })
})

// ─── Re-normalization for missing components ───────────────────────────────

describe('re-normalization for missing components', () => {
  it('redistributes weight when one category is missing', () => {
    // Missing emr (weight 0.25). Available: speciality 0.30, province 0.20, location 0.15, duration 0.10 = 0.75
    const breakdown = { location: 0.8, duration: 0.6, province: 1.0, speciality: 0.2 }
    const w = WEIGHTS
    const weighted = 0.8 * w.location + 0.6 * w.duration + 1.0 * w.province + 0.2 * w.speciality
    const weightSum = w.location + w.duration + w.province + w.speciality
    const expected = weighted / weightSum
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBeCloseTo(expected, 2)
  })

  it('works with only 2 categories scored', () => {
    const breakdown = { location: 0.9, duration: 0.7 }
    const w = WEIGHTS
    const expected = (0.9 * w.location + 0.7 * w.duration) / (w.location + w.duration)
    const { totalScore } = computeWeightedScore(breakdown)
    expect(totalScore).toBeCloseTo(expected, 2)
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
    expect(breakdown.province).toBeUndefined()
    expect(breakdown.speciality).toBeUndefined()
  })
})

// ─── Score bounds ──────────────────────────────────────────────────────────

describe('score bounds', () => {
  it('totalScore is always in [0, 1]', () => {
    const cases = [
      { location: 0, duration: 0, emr: 0, province: 0, speciality: 0 },
      { location: 1, duration: 1, emr: 1, province: 1, speciality: 1 },
      { location: 0.5 },
      { location: 1, duration: 0 },
      {},
    ]
    for (const breakdown of cases) {
      const { totalScore } = computeWeightedScore(breakdown)
      expect(totalScore).toBeGreaterThanOrEqual(0)
      expect(totalScore).toBeLessThanOrEqual(1)
    }
  })

  it('breakdown values are always in [0, 1]', () => {
    const { breakdown } = computeWeightedScore({
      location: 0.99,
      duration: 0.01,
      emr: 0.5,
      province: 0,
      speciality: 1,
    })
    for (const key of Object.keys(breakdown)) {
      expect(breakdown[key]).toBeGreaterThanOrEqual(0)
      expect(breakdown[key]).toBeLessThanOrEqual(1)
    }
  })
})

// ─── Breakdown keys ────────────────────────────────────────────────────────

describe('breakdown keys', () => {
  it('all 5 keys present when all scored', () => {
    const { breakdown } = computeWeightedScore({
      location: 0.5,
      duration: 0.5,
      emr: 0.5,
      province: 0.5,
      speciality: 0.5,
    })
    expect(Object.keys(breakdown).sort()).toEqual(['duration', 'emr', 'location', 'province', 'speciality'])
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
      makePair({ location: 0, duration: 0, emr: 0, province: 0, speciality: 0 }, { physicianId: 'c' }),
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
    const results = combineAndRank(pairs, { threshold: 0.5 })
    expect(results.length).toBe(2)
    expect(results.every((r) => r.score >= 0.5)).toBe(true)
  })

  it('no threshold returns all', () => {
    const results = combineAndRank(pairs)
    expect(results.length).toBe(3)
  })

  it('threshold higher than all scores returns empty', () => {
    const results = combineAndRank(pairs, { threshold: 0.99 })
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
