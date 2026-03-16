// @ts-check

/**
 * Unit tests for the hard filter (filterEligiblePhysicians).
 * Only isLookingForLocums: missing is treated as true (pass). medProfession and medSpeciality: missing = excluded.
 * onlyLooking = criteria.options.onlyLookingForLocums; when false, the isLookingForLocums check is skipped.
 */

import { describe, it, expect } from 'vitest'
import { filterEligiblePhysicians } from '../src/matchingLogic/filterEligiblePhysicians.js'

const baseJob = {
  medProfession: 'Physician',
  medSpeciality: 'Family Medicine',
}

const basePhysician = {
  _id: 'p1',
  medProfession: 'Physician',
  medSpeciality: 'Family Medicine',
  preferences: { isLookingForLocums: true },
}

describe('filterEligiblePhysicians', () => {
  it('missing preferences object: physician still passes (isLookingForLocums missing → treated as true)', () => {
    const physicians = [
      { ...basePhysician, _id: 'a', preferences: undefined },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('a')
  })

  it('missing isLookingForLocums: physician still passes (only lenient field)', () => {
    const physicians = [
      { ...basePhysician, _id: 'a', preferences: {} },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('case insensitive specialty: different casing still matches', () => {
    const physicians = [
      { ...basePhysician, _id: 'a', medSpeciality: 'family medicine' },
      { ...basePhysician, _id: 'b', medSpeciality: 'FAMILY MEDICINE' },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(2)
  })

  it('case sensitive specialty mismatch: different specialty excludes', () => {
    const physicians = [
      { ...basePhysician, _id: 'a', medSpeciality: 'Radiologist' },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('physician profession mismatch: excluded', () => {
    const physicians = [
      { ...basePhysician, medProfession: 'Recruiter' },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('reservation excludes physician via applicants (physician id in reservation.applicants)', () => {
    const physicians = [
      { ...basePhysician, _id: 'already-applied' },
      { ...basePhysician, _id: 'not-applied' },
    ]
    const reservation = {
      applicants: [{ userId: 'already-applied' }],
    }
    const result = filterEligiblePhysicians(physicians, baseJob, reservation, {})
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('not-applied')
  })

  it('reservation excludes physician via applicant stages (multiple applicants)', () => {
    const physicians = [
      { ...basePhysician, _id: 'user1' },
      { ...basePhysician, _id: 'user2' },
      { ...basePhysician, _id: 'user3' },
    ]
    const reservation = {
      applicants: [
        { userId: 'user1' },
        { userId: 'user3' },
      ],
    }
    const result = filterEligiblePhysicians(physicians, baseJob, reservation, {})
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('user2')
  })

  it('reservation missing: filter still works, no applicant exclusion', () => {
    const physicians = [
      { ...basePhysician, _id: 'a' },
      { ...basePhysician, _id: 'b' },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(2)
  })

  it('reservation null: filter still works, no applicant exclusion', () => {
    const physicians = [
      { ...basePhysician, _id: 'a' },
      { ...basePhysician, _id: 'b' },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, null, {})
    expect(result).toHaveLength(2)
  })

  it('excludes when isLookingForLocums is explicitly false (onlyLooking default true)', () => {
    const physicians = [
      { ...basePhysician, preferences: { isLookingForLocums: false } },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('when onlyLooking is false, physician with isLookingForLocums false still passes', () => {
    const physicians = [
      { ...basePhysician, preferences: { isLookingForLocums: false } },
    ]
    const criteria = { options: { onlyLookingForLocums: false } }
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, criteria)
    expect(result).toHaveLength(1)
  })

  it('returned list size never exceeds input list size', () => {
    const physicians = [
      { ...basePhysician, _id: 'a' },
      { ...basePhysician, _id: 'b', medSpeciality: 'Radiologist' },
    ]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result.length).toBeLessThanOrEqual(physicians.length)
  })

  it('medProfession missing on physician → excluded', () => {
    const physicians = [{ ...basePhysician, medProfession: undefined }]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('medSpeciality missing on physician → excluded', () => {
    const physicians = [{ ...basePhysician, medSpeciality: undefined }]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(0)
  })
})

const shortJob = {
  ...baseJob,
  dateRange: { from: '2025-01-01', to: '2025-01-15' },
}

const midJob = {
  ...baseJob,
  dateRange: { from: '2025-01-01', to: '2025-03-15' },
}

const longJob = {
  ...baseJob,
  dateRange: { from: '2025-01-01', to: '2025-07-01' },
}

describe('filterEligiblePhysicians – duration filter', () => {
  it('short job: physician with "A few days" passes', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['A few days'] }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('short job: physician with "Less than a month" passes', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['Less than a month'] }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('short job: physician with "1–3 months" passes (gray area, allowed)', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['1–3 months'] }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('short job: physician with only "3–6 months" excluded', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['3–6 months'] }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('short job: physician with only "6+ months" excluded', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['6+ months'] }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('long job: physician with "3–6 months" passes', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['3–6 months'] }]
    const result = filterEligiblePhysicians(physicians, longJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('long job: physician with "6+ months" passes', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['6+ months'] }]
    const result = filterEligiblePhysicians(physicians, longJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('long job: physician with only "A few days" excluded', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['A few days'] }]
    const result = filterEligiblePhysicians(physicians, longJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('long job: physician with only "1–3 months" excluded', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['1–3 months'] }]
    const result = filterEligiblePhysicians(physicians, longJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('mid job: physician with "1–3 months" passes', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['1–3 months'] }]
    const result = filterEligiblePhysicians(physicians, midJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('mid job: physician with "3–6 months" passes', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['3–6 months'] }]
    const result = filterEligiblePhysicians(physicians, midJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('mid job: physician with only "A few days" excluded', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['A few days'] }]
    const result = filterEligiblePhysicians(physicians, midJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('mid job: physician with only "6+ months" excluded', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['6+ months'] }]
    const result = filterEligiblePhysicians(physicians, midJob, undefined, {})
    expect(result).toHaveLength(0)
  })

  it('multiple durations: physician with both short and long passes for short job', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['A few days', '6+ months'] }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('multiple durations: physician with both short and long passes for long job', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['A few days', '6+ months'] }]
    const result = filterEligiblePhysicians(physicians, longJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('missing locumDurations: physician passes (lenient)', () => {
    const physicians = [{ ...basePhysician }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('empty locumDurations array: physician passes (lenient)', () => {
    const physicians = [{ ...basePhysician, locumDurations: [] }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('locumDurations in preferences: physician passes when overlapping', () => {
    const physicians = [{ ...basePhysician, preferences: { isLookingForLocums: true, locumDurations: ['A few days'] } }]
    const result = filterEligiblePhysicians(physicians, shortJob, undefined, {})
    expect(result).toHaveLength(1)
  })

  it('job without dateRange: duration filter skipped, physician passes', () => {
    const physicians = [{ ...basePhysician, locumDurations: ['6+ months'] }]
    const result = filterEligiblePhysicians(physicians, baseJob, undefined, {})
    expect(result).toHaveLength(1)
  })
})
