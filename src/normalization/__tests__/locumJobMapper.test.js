import { describe, it, expect } from 'vitest'
import { toDomain, toPersistence } from '../locumJobMapper.js'

/** Realistic raw LocumJob document from MongoDB */
const RAW_JOB = {
  _id: { $oid: '60d5ec49f1a2c8b1f8e4e1a1' },
  jobId: 'EuXagtm',
  postTitle: ' Emergency Room Coverage ',
  facilityName: ' General Hospital ',
  medProfession: 'Physician',
  medSpeciality: ' Emergency Medicine ',
  location: {
    type: 'Point',
    coordinates: [-79.3832, 43.6532],
  },
  fullAddress: {
    streetNumber: '200',
    streetName: 'Elizabeth St',
    city: 'Toronto',
    province: 'Ontario',
    country: 'Canada',
    postalCode: 'M5G 2C4',
  },
  dateRange: {
    from: '2024-07-01T00:00:00Z',
    to: '2024-07-31T00:00:00Z',
  },
  locumPay: '8000',
  schedule: 'Nights',
  experience: '2+ years',
  facilityInfo: { emr: 'OSCAR Pro' },
  locumCreator: { $oid: '507f1f77bcf86cd799439011' },
  reservationId: { $oid: '60d5ec49f1a2c8b1f8e4e1a2' },
  practiceType: ['ED only'],
  patientType: ['All Ages'],
}

describe('locumJobMapper.toDomain', () => {
  it('transforms a realistic raw LocumJob document', () => {
    const job = toDomain(RAW_JOB)

    expect(job._id).toBe('60d5ec49f1a2c8b1f8e4e1a1')
    expect(job.jobId).toBe('EuXagtm')
    expect(job.postTitle).toBe('Emergency Room Coverage')
    expect(job.facilityName).toBe('General Hospital')
    expect(job.medProfession).toBe('Physician')
    expect(job.medSpeciality).toBe('Emergency Medicine')
  })

  it('converts GeoJSON coordinates to {lng, lat}', () => {
    const job = toDomain(RAW_JOB)
    expect(job.location).toEqual({ lng: -79.3832, lat: 43.6532 })
  })

  it('returns null location for missing GeoJSON', () => {
    const raw = { _id: 'abc', fullAddress: { province: 'ON' }, dateRange: {} }
    expect(toDomain(raw).location).toBe(null)
  })

  it('returns null location for empty coordinates', () => {
    const raw = {
      _id: 'abc',
      location: { type: 'Point', coordinates: [] },
      fullAddress: { province: 'ON' },
      dateRange: {},
    }
    expect(toDomain(raw).location).toBe(null)
  })

  it('normalizes province in fullAddress', () => {
    const job = toDomain(RAW_JOB)
    expect(job.fullAddress.province).toBe('ON')
  })

  it('defaults fullAddress province to ON when missing', () => {
    const raw = { _id: 'abc', dateRange: {} }
    expect(toDomain(raw).fullAddress.province).toBe('ON')
  })

  it('coerces dateRange strings to Date objects', () => {
    const job = toDomain(RAW_JOB)
    expect(job.dateRange.from).toBeInstanceOf(Date)
    expect(job.dateRange.to).toBeInstanceOf(Date)
    expect(job.dateRange.from.toISOString()).toBe('2024-07-01T00:00:00.000Z')
    expect(job.dateRange.to.toISOString()).toBe('2024-07-31T00:00:00.000Z')
  })

  it('renames locumCreator to locumCreatorId', () => {
    const job = toDomain(RAW_JOB)
    expect(job.locumCreatorId).toBe('507f1f77bcf86cd799439011')
    expect(/** @type {any} */ (job).locumCreator).toBe(undefined)
  })

  it('coerces reservationId', () => {
    const job = toDomain(RAW_JOB)
    expect(job.reservationId).toBe('60d5ec49f1a2c8b1f8e4e1a2')
  })

  it('normalizes facilityInfo.emr', () => {
    const job = toDomain(RAW_JOB)
    expect(job.facilityInfo).toEqual({ emr: 'OSCAR Pro' })
  })

  it('trims whitespace from facilityInfo.emr', () => {
    const raw = { _id: 'abc', dateRange: {}, facilityInfo: { emr: '  Accuro EMR  ' } }
    expect(toDomain(raw).facilityInfo).toEqual({ emr: 'Accuro EMR' })
  })

  it('returns undefined facilityInfo when missing', () => {
    const raw = { _id: 'abc', dateRange: {} }
    expect(toDomain(raw).facilityInfo).toBe(undefined)
  })

  it('handles practiceType and patientType arrays', () => {
    const job = toDomain(RAW_JOB)
    expect(job.practiceType).toEqual(['ED only'])
    expect(job.patientType).toEqual(['All Ages'])
  })

  it('omits optional fields when missing', () => {
    const raw = { _id: 'abc', dateRange: {} }
    const job = toDomain(raw)
    expect(job.jobId).toBe(undefined)
    expect(job.postTitle).toBe(undefined)
    expect(job.locumCreatorId).toBe(undefined)
    expect(job.practiceType).toBe(undefined)
    expect(job.patientType).toBe(undefined)
  })

  it('throws for null/undefined input', () => {
    expect(() => toDomain(/** @type {any} */ (null))).toThrow('raw document is required')
    expect(() => toDomain(/** @type {any} */ (undefined))).toThrow('raw document is required')
  })
})

describe('locumJobMapper.toPersistence', () => {
  it('throws not implemented', () => {
    expect(() => toPersistence(/** @type {any} */ ({}))).toThrow('not implemented')
  })
})
