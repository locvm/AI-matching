// @ts-check

import { describe, it, expect } from 'vitest'
import { createDurationScorer } from '../../src/scoring/score-duration.js'
import { DURATION_DEFAULTS } from '../../src/scoring/scoring.config.js'
import { makePhysician, dateRange } from '../helpers/factories.js'

const scoreDuration = createDurationScorer()

describe('full overlap', () => {
  it('availability fully covers the job', () => {
    const r = scoreDuration(
      makePhysician({ availabilityWindows: [{ from: new Date('2025-01-01'), to: new Date('2025-12-31') }] }),
      dateRange('2025-03-01', '2025-03-31')
    )
    expect(r.score).toBe(1)
    expect(r.breakdown.method).toBe('overlap')
    expect(r.breakdown.overlapPct).toBe(1)
    expect(r.breakdown.usedBucketFallback).toBe(false)
  })

  it('availability exactly matches the job', () => {
    const r = scoreDuration(
      makePhysician({ availabilityWindows: [{ from: new Date('2025-06-01'), to: new Date('2025-06-30') }] }),
      dateRange('2025-06-01', '2025-06-30')
    )
    expect(r.score).toBeCloseTo(1, 1)
    expect(r.breakdown.overlapPct).toBeCloseTo(1, 1)
  })
})

describe('partial overlap', () => {
  it('half the job covered', () => {
    const r = scoreDuration(
      makePhysician({ availabilityWindows: [{ from: new Date('2025-01-01'), to: new Date('2025-01-15') }] }),
      dateRange('2025-01-01', '2025-01-31')
    )
    expect(r.score).toBeGreaterThan(0.4)
    expect(r.score).toBeLessThan(0.6)
    expect(r.breakdown.method).toBe('overlap')
    expect(r.breakdown.overlapPct).toBeGreaterThan(0.4)
  })

  it('small but above-threshold overlap', () => {
    const r = scoreDuration(
      makePhysician({ availabilityWindows: [{ from: new Date('2025-03-28'), to: new Date('2025-04-03') }] }),
      dateRange('2025-03-01', '2025-03-31')
    )
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(0.5)
  })

  it('picks the best window when multiple exist', () => {
    const r = scoreDuration(
      makePhysician({
        availabilityWindows: [
          { from: new Date('2025-01-01'), to: new Date('2025-01-05') },
          { from: new Date('2025-01-10'), to: new Date('2025-02-28') },
        ],
      }),
      dateRange('2025-01-01', '2025-01-31')
    )
    expect(r.score).toBeGreaterThan(0.6)
  })
})

describe('no overlap', () => {
  it.each([
    {
      name: 'entirely outside job range',
      avail: [{ from: new Date('2025-06-01'), to: new Date('2025-06-30') }],
      job: dateRange('2025-01-01', '2025-01-31'),
    },
    {
      name: 'below minimum threshold',
      avail: [{ from: new Date('2025-01-30'), to: new Date('2025-01-31') }],
      job: dateRange('2025-01-01', '2025-04-11'),
    },
  ])('$name → 0', ({ avail, job }) => {
    const r = scoreDuration(makePhysician({ availabilityWindows: avail }), job)
    expect(r.score).toBe(0)
    expect(r.breakdown.method).toBe('overlap')
    expect(r.breakdown.usedBucketFallback).toBe(false)
  })
})

describe('bucket fallback', () => {
  it.each([
    {
      name: 'fits preferred bucket',
      dur: [{ minDays: 1, maxDays: 7 }],
      job: dateRange('2025-01-01', '2025-01-04'),
      expected: DURATION_DEFAULTS.bucketMatchScore,
    },
    {
      name: 'fits 1–3 months bucket',
      dur: [{ minDays: 30, maxDays: 90 }],
      job: dateRange('2025-01-01', '2025-02-15'),
      expected: DURATION_DEFAULTS.bucketMatchScore,
    },
    {
      name: 'near-miss boundary → partial',
      dur: [{ minDays: 30, maxDays: 90 }],
      job: dateRange('2025-01-01', '2025-01-26'),
      expected: DURATION_DEFAULTS.bucketPartialScore,
    },
    {
      name: 'outside all preferred buckets',
      dur: [{ minDays: 1, maxDays: 7 }],
      job: dateRange('2025-01-01', '2025-04-01'),
      expected: 0,
    },
  ])('$name', ({ dur, job, expected }) => {
    const r = scoreDuration(makePhysician({ locumDurations: dur }), job)
    expect(r.score).toBe(expected)
    expect(r.breakdown.method).toBe('bucket')
    expect(r.breakdown.usedBucketFallback).toBe(true)
    expect(r.breakdown.overlapPct).toBeNull()
  })

  it('overlap takes priority over bucket', () => {
    const r = scoreDuration(
      makePhysician({
        availabilityWindows: [{ from: new Date('2025-01-01'), to: new Date('2025-12-31') }],
        locumDurations: [{ minDays: 1, maxDays: 7 }],
      }),
      dateRange('2025-03-01', '2025-03-31')
    )
    expect(r.score).toBe(1)
    expect(r.breakdown.method).toBe('overlap')
    expect(r.breakdown.usedBucketFallback).toBe(false)
  })
})

describe('missing data', () => {
  it.each([
    { name: 'no availability, no durations', overrides: {}, job: dateRange('2025-03-01', '2025-03-31') },
    {
      name: 'zero-length job',
      overrides: { availabilityWindows: [{ from: new Date('2025-03-01'), to: new Date('2025-03-31') }] },
      job: dateRange('2025-03-15', '2025-03-15'),
    },
    {
      name: 'negative-duration job',
      overrides: { availabilityWindows: [{ from: new Date('2025-03-01'), to: new Date('2025-03-31') }] },
      job: dateRange('2025-03-15', '2025-03-10'),
    },
  ])('$name → neutral', ({ overrides, job }) => {
    const r = scoreDuration(makePhysician(overrides), job)
    expect(r.score).toBe(DURATION_DEFAULTS.neutralScore)
    expect(r.breakdown.method).toBe('neutral')
    expect(r.breakdown.overlapPct).toBeNull()
  })
})

describe('output always in [0, 1]', () => {
  it.each([
    {
      name: 'full overlap',
      avail: [{ from: new Date('2025-01-01'), to: new Date('2025-12-31') }],
      dur: [],
      job: dateRange('2025-06-01', '2025-06-30'),
    },
    {
      name: 'no overlap',
      avail: [{ from: new Date('2024-01-01'), to: new Date('2024-06-30') }],
      dur: [],
      job: dateRange('2025-06-01', '2025-06-30'),
    },
    { name: 'bucket match', avail: [], dur: [{ minDays: 1, maxDays: 30 }], job: dateRange('2025-01-01', '2025-01-15') },
    { name: 'no data', avail: [], dur: [], job: dateRange('2025-01-01', '2025-01-15') },
    { name: 'zero job', avail: [], dur: [{ minDays: 1, maxDays: 7 }], job: dateRange('2025-01-01', '2025-01-01') },
  ])('$name', ({ avail, dur, job }) => {
    const r = scoreDuration(makePhysician({ availabilityWindows: avail, locumDurations: dur }), job)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(1)
    expect(r.breakdown).toBeDefined()
    expect(r.breakdown.method).toMatch(/^(overlap|bucket|neutral)$/)
  })
})

describe('custom config', () => {
  it.each([
    {
      name: 'neutral score',
      config: { neutralScore: 0.3 },
      overrides: {},
      job: dateRange('2025-01-01', '2025-01-31'),
      expected: 0.3,
    },
    {
      name: 'overlap threshold',
      config: { minOverlapThreshold: 0.5 },
      overrides: { availabilityWindows: [{ from: new Date('2025-01-01'), to: new Date('2025-01-10') }] },
      job: dateRange('2025-01-01', '2025-01-31'),
      expected: 0,
    },
    {
      name: 'bucket match score',
      config: { bucketMatchScore: 0.9 },
      overrides: { locumDurations: [{ minDays: 1, maxDays: 7 }] },
      job: dateRange('2025-01-01', '2025-01-04'),
      expected: 0.9,
    },
  ])('$name', ({ config, overrides, job, expected }) => {
    const scorer = createDurationScorer(config)
    expect(scorer(makePhysician(overrides), job).score).toBe(expected)
  })
})
