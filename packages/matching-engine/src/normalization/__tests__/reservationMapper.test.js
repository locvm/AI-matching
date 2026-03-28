import { describe, it, expect } from 'vitest'
import { toDomain, toPersistence } from '../reservationMapper.js'

/** Realistic raw Reservation document from MongoDB */
const RAW_RESERVATION = {
  _id: { $oid: '60d5ec49f1a2c8b1f8e4e1a2' },
  locumJobId: { $oid: '60d5ec49f1a2c8b1f8e4e1a1' },
  status: 'Confirmed',
  reservationDate: {
    from: '2024-07-01T00:00:00Z',
    to: '2024-07-31T00:00:00Z',
  },
  createdBy: { $oid: '507f1f77bcf86cd799439011' },
  reservedBy: { $oid: '507f1f77bcf86cd799439022' },
  createdAt: { $date: '2024-06-15T10:00:00Z' },
  dateModified: { $date: '2024-06-20T14:30:00Z' },
  applicants: [
    {
      _id: { $oid: 'aaa111' },
      userId: { $oid: '507f1f77bcf86cd799439033' },
      currentApplicationStage: 'Selected',
      applicationLog: [
        { event: 'Applied', at: '2024-06-16T08:00:00Z', note: 'Initial application' },
        { event: 'Selected', at: '2024-06-18T12:00:00Z' },
      ],
    },
  ],
}

describe('reservationMapper.toDomain', () => {
  it('transforms a realistic raw Reservation document', () => {
    const res = toDomain(RAW_RESERVATION)

    expect(res._id).toBe('60d5ec49f1a2c8b1f8e4e1a2')
    expect(res.locumJobId).toBe('60d5ec49f1a2c8b1f8e4e1a1')
    expect(res.status).toBe('Confirmed')
    expect(res.createdBy).toBe('507f1f77bcf86cd799439011')
    expect(res.reservedBy).toBe('507f1f77bcf86cd799439022')
  })

  it('validates status against enum, defaults to Pending', () => {
    const raw = { _id: 'abc', locumJobId: 'def', status: 'InvalidStatus' }
    expect(toDomain(raw).status).toBe('Pending')
  })

  it('accepts all valid statuses', () => {
    const statuses = [
      'Pending',
      'Requested',
      'Awaiting Payment',
      'Confirmed',
      'In Progress',
      'Completed',
      'Cancelled',
      'Expired',
    ]
    for (const status of statuses) {
      const raw = { _id: 'abc', locumJobId: 'def', status }
      expect(toDomain(raw).status).toBe(status)
    }
  })

  it('coerces reservationDate to Dates', () => {
    const res = toDomain(RAW_RESERVATION)
    expect(res.reservationDate?.from).toBeInstanceOf(Date)
    expect(res.reservationDate?.to).toBeInstanceOf(Date)
    expect(res.reservationDate?.from.toISOString()).toBe('2024-07-01T00:00:00.000Z')
  })

  it('coerces createdAt and dateModified from Extended JSON', () => {
    const res = toDomain(RAW_RESERVATION)
    expect(res.createdAt).toBeInstanceOf(Date)
    expect(res.createdAt?.toISOString()).toBe('2024-06-15T10:00:00.000Z')
    expect(res.dateModified).toBeInstanceOf(Date)
    expect(res.dateModified?.toISOString()).toBe('2024-06-20T14:30:00.000Z')
  })

  it('normalizes applicants', () => {
    const res = toDomain(RAW_RESERVATION)
    expect(res.applicants).toHaveLength(1)

    const applicant = res.applicants?.[0]
    expect(applicant?._id).toBe('aaa111')
    expect(applicant?.userId).toBe('507f1f77bcf86cd799439033')
    expect(applicant?.currentApplicationStage).toBe('Selected')
  })

  it('normalizes applicationLog entries', () => {
    const res = toDomain(RAW_RESERVATION)
    const log = res.applicants?.[0]?.applicationLog

    expect(log).toHaveLength(2)
    expect(log?.[0].event).toBe('Applied')
    expect(log?.[0].at).toBeInstanceOf(Date)
    expect(log?.[0].note).toBe('Initial application')
    expect(log?.[1].event).toBe('Selected')
    expect(log?.[1].note).toBe(undefined)
  })

  it('validates currentApplicationStage against enum', () => {
    const raw = {
      _id: 'abc',
      locumJobId: 'def',
      applicants: [{ _id: 'a1', userId: 'u1', currentApplicationStage: 'InvalidStage' }],
    }
    const res = toDomain(raw)
    expect(res.applicants?.[0]?.currentApplicationStage).toBe(undefined)
  })

  it('defaults applicants to empty array when missing', () => {
    const raw = { _id: 'abc', locumJobId: 'def' }
    expect(toDomain(raw).applicants).toEqual([])
  })

  it('handles missing optional fields', () => {
    const raw = { _id: 'abc', locumJobId: 'def' }
    const res = toDomain(raw)
    expect(res.createdBy).toBe(undefined)
    expect(res.reservedBy).toBe(undefined)
    expect(res.createdAt).toBe(undefined)
    expect(res.dateModified).toBe(undefined)
  })

  it('throws for null/undefined input', () => {
    // @ts-expect-error - intentional boundary test: null input
    expect(() => toDomain(null)).toThrow('raw document is required')
    // @ts-expect-error - intentional boundary test: undefined input
    expect(() => toDomain(undefined)).toThrow('raw document is required')
  })
})

describe('reservationMapper.toPersistence', () => {
  it('throws not implemented', () => {
    expect(() => toPersistence(/** @type {any} */ ({}))).toThrow('not implemented')
  })
})
