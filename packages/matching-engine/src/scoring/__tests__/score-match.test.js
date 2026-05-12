// @ts-check

import { describe, it, expect } from 'vitest'
import { scoreMatch } from '../score-match.js'
import { makePhysician, dateRange } from '../../../tests/helpers/factories.js'

/** @typedef {import('@locvm/types').LocumJob} LocumJob */

/** @param {Partial<LocumJob>} [overrides] */
function makeJob(overrides = {}) {
  return /** @type {LocumJob} */ ({
    _id: 'test-job',
    medProfession: 'Physician',
    medSpeciality: 'Family Medicine',
    location: null,
    fullAddress: { city: 'Toronto', province: 'ON' },
    dateRange: dateRange('2025-01-01', '2025-03-01'),
    ...overrides,
  })
}

// ─── Identity passthrough ──────────────────────────────────────────────────

describe('scoreMatch – identity', () => {
  it('echoes physicianId and jobId', () => {
    const physician = makePhysician({ _id: 'phys-7' })
    const job = makeJob({ _id: 'job-42' })

    const result = scoreMatch(physician, job)

    expect(result.physicianId).toBe('phys-7')
    expect(result.jobId).toBe('job-42')
  })
})

// ─── Breakdown shape ───────────────────────────────────────────────────────

describe('scoreMatch – breakdown shape', () => {
  it('produces a score and a detail blob for every category', () => {
    const { breakdown } = scoreMatch(makePhysician(), makeJob())

    expect(typeof breakdown.location).toBe('number')
    expect(typeof breakdown.emr).toBe('number')
    expect(typeof breakdown.duration).toBe('number')

    expect(breakdown.locationDetail).toMatchObject({
      method: expect.any(String),
      distanceBucket: expect.any(String),
      provinceMatch: expect.any(Boolean),
    })
    expect(breakdown.emrDetail).toMatchObject({
      method: expect.any(String),
      physicianEMRs: expect.any(Array),
      matched: expect.any(Boolean),
    })
    expect(breakdown.durationDetail).toMatchObject({
      method: expect.any(String),
      usedBucketFallback: expect.any(Boolean),
    })
  })

  it('omits durationDetail when the job has no dateRange', () => {
    const job = makeJob({ dateRange: /** @type {any} */ (undefined) })
    const { breakdown, flags } = scoreMatch(makePhysician(), job)

    expect(breakdown.duration).toBeUndefined()
    expect(breakdown.durationDetail).toBeUndefined()
    expect(flags).toContain('no_job_date_range')
  })
})

// ─── Location flags ────────────────────────────────────────────────────────

describe('scoreMatch – location flags', () => {
  it('flags "no_location_data" when neither side has any location signal', () => {
    const physician = makePhysician({
      location: null,
      workAddress: null,
      preferredProvinces: [],
      specificRegions: [],
      medicalProvince: undefined,
    })
    const job = makeJob({ location: null, fullAddress: /** @type {any} */ ({}) })

    const { flags, breakdown } = scoreMatch(physician, job)

    expect(flags).toContain('no_location_data')
    expect(breakdown.locationDetail?.method).toBe('no_data')
  })

  it('flags "location_province_only" when the score is province-derived (no GPS)', () => {
    const physician = makePhysician({
      location: null,
      preferredProvinces: ['ON'],
    })
    const job = makeJob({ location: null })

    const { flags, breakdown } = scoreMatch(physician, job)

    expect(flags).toContain('location_province_only')
    expect(breakdown.locationDetail?.method).toBe('preferred_province')
  })

  it('does NOT flag "location_province_only" when GPS distance was used', () => {
    const physician = makePhysician({ location: { lat: 43.65, lng: -79.38 } })
    const job = makeJob({ location: { lat: 43.7, lng: -79.4 } })

    const { flags, breakdown } = scoreMatch(physician, job)

    expect(flags).not.toContain('location_province_only')
    expect(breakdown.locationDetail?.method).toBe('gps_distance')
  })
})

// ─── EMR flags ─────────────────────────────────────────────────────────────

describe('scoreMatch – EMR flags', () => {
  it('flags "no_physician_emr" when physician has no EMR data', () => {
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })

    const { flags, breakdown } = scoreMatch(makePhysician({ emrSystems: [] }), job)

    expect(flags).toContain('no_physician_emr')
    expect(breakdown.emrDetail?.method).toBe('no_physician_emr')
  })

  it('flags "no_job_emr" when the job has no EMR field', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({ facilityInfo: undefined })

    const { flags, breakdown } = scoreMatch(physician, job)

    expect(flags).toContain('no_job_emr')
    expect(breakdown.emrDetail?.method).toBe('no_job_emr')
  })

  it('flags "emr_mismatch" when both sides have EMRs but none match', () => {
    const physician = makePhysician({ emrSystems: ['Accuro'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })

    const { flags, breakdown } = scoreMatch(physician, job)

    expect(flags).toContain('emr_mismatch')
    expect(breakdown.emrDetail?.method).toBe('no_match')
  })

  it('emits no EMR flag on a successful match', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })

    const { flags } = scoreMatch(physician, job)

    expect(flags).not.toContain('emr_mismatch')
    expect(flags).not.toContain('no_physician_emr')
    expect(flags).not.toContain('no_job_emr')
  })
})

// ─── Duration flags ────────────────────────────────────────────────────────

describe('scoreMatch – duration flags', () => {
  it('flags "no_duration_data" when physician has no availability or bucket data', () => {
    const physician = makePhysician({ availabilityWindows: [], locumDurations: [] })
    const job = makeJob({ dateRange: dateRange('2025-01-01', '2025-01-31') })

    const { flags, breakdown } = scoreMatch(physician, job)

    expect(flags).toContain('no_duration_data')
    expect(breakdown.durationDetail?.method).toBe('neutral')
  })

  it('flags "low_date_overlap" when overlap with availability is below 50%', () => {
    const physician = makePhysician({
      availabilityWindows: [{ from: new Date('2025-01-01'), to: new Date('2025-01-10') }],
    })
    const job = makeJob({ dateRange: dateRange('2025-01-01', '2025-01-31') })

    const { flags, breakdown } = scoreMatch(physician, job)

    expect(flags).toContain('low_date_overlap')
    expect(breakdown.durationDetail?.method).toBe('overlap')
    expect(breakdown.durationDetail?.overlapPct).toBeLessThan(0.5)
  })

  it('does NOT flag "low_date_overlap" when overlap exceeds 50%', () => {
    const physician = makePhysician({
      availabilityWindows: [{ from: new Date('2025-01-01'), to: new Date('2025-01-31') }],
    })
    const job = makeJob({ dateRange: dateRange('2025-01-01', '2025-01-31') })

    const { flags } = scoreMatch(physician, job)

    expect(flags).not.toContain('low_date_overlap')
  })
})
