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
