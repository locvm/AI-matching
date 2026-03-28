import { describe, it, expect } from 'vitest'
import { coerceObjectId, ensureDate, trimString, ensureStringArray, normalizeAddress } from '../primitives.js'

describe('coerceObjectId', () => {
  it('returns plain string as-is', () => {
    expect(coerceObjectId('507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011')
  })

  it('extracts $oid from Extended JSON', () => {
    expect(coerceObjectId({ $oid: '507f1f77bcf86cd799439011' })).toBe('507f1f77bcf86cd799439011')
  })

  it('calls toString() on Mongoose ObjectId-like objects', () => {
    const fakeObjectId = { toString: () => '507f1f77bcf86cd799439011' }
    expect(coerceObjectId(fakeObjectId)).toBe('507f1f77bcf86cd799439011')
  })

  it('returns empty string for null/undefined', () => {
    expect(coerceObjectId(null)).toBe('')
    expect(coerceObjectId(undefined)).toBe('')
  })
})

describe('ensureDate', () => {
  it('passes through valid Date', () => {
    const d = new Date('2024-06-15T00:00:00Z')
    expect(ensureDate(d)).toBe(d)
  })

  it('parses ISO string', () => {
    const result = ensureDate('2024-06-15T00:00:00Z')
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString()).toBe('2024-06-15T00:00:00.000Z')
  })

  it('extracts $date from Extended JSON', () => {
    const result = ensureDate({ $date: '2024-06-15T00:00:00Z' })
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString()).toBe('2024-06-15T00:00:00.000Z')
  })

  it('handles numeric timestamp', () => {
    const ts = new Date('2024-06-15T00:00:00Z').getTime()
    const result = ensureDate(ts)
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString()).toBe('2024-06-15T00:00:00.000Z')
  })

  it('returns null for invalid date string', () => {
    expect(ensureDate('not-a-date')).toBe(null)
  })

  it('returns null for invalid Date object', () => {
    expect(ensureDate(new Date('invalid'))).toBe(null)
  })

  it('returns null for null/undefined', () => {
    expect(ensureDate(null)).toBe(null)
    expect(ensureDate(undefined)).toBe(null)
  })
})

describe('trimString', () => {
  it('trims whitespace', () => {
    expect(trimString('  hello  ')).toBe('hello')
  })

  it('returns fallback for whitespace-only', () => {
    expect(trimString('   ', 'default')).toBe('default')
  })

  it('returns fallback for non-string', () => {
    expect(trimString(42, 'default')).toBe('default')
    expect(trimString(null, 'default')).toBe('default')
    expect(trimString(undefined, 'default')).toBe('default')
  })

  it('returns empty string fallback by default', () => {
    expect(trimString(null)).toBe('')
    expect(trimString('  ')).toBe('')
  })
})

describe('ensureStringArray', () => {
  it('trims strings and filters empties', () => {
    expect(ensureStringArray(['  hello  ', '', '  ', 'world'])).toEqual(['hello', 'world'])
  })

  it('filters non-string values', () => {
    expect(ensureStringArray(['a', 42, null, 'b', undefined])).toEqual(['a', 'b'])
  })

  it('returns empty array for non-array', () => {
    expect(ensureStringArray(null)).toEqual([])
    expect(ensureStringArray(undefined)).toEqual([])
    expect(ensureStringArray('string')).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(ensureStringArray([])).toEqual([])
  })
})

describe('normalizeAddress', () => {
  it('normalizes full address with province', () => {
    const raw = {
      streetNumber: '123',
      streetName: ' Main St ',
      city: ' Toronto ',
      province: 'Ontario',
      postalCode: ' M5V 2T6 ',
      country: ' Canada ',
    }
    const result = normalizeAddress(raw)
    expect(result).toEqual({
      streetNumber: '123',
      streetName: 'Main St',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 2T6',
      country: 'Canada',
    })
  })

  it('returns null for null/undefined', () => {
    expect(normalizeAddress(null)).toBe(null)
    expect(normalizeAddress(undefined)).toBe(null)
  })

  it('handles missing fields gracefully', () => {
    const raw = { city: 'Toronto', province: 'ON' }
    const result = normalizeAddress(raw)
    expect(result).toEqual({
      city: 'Toronto',
      province: 'ON',
    })
  })

  it('omits province when unrecognized', () => {
    const raw = { city: 'NYC', province: 'NY' }
    const result = normalizeAddress(raw)
    expect(result).toEqual({ city: 'NYC' })
  })
})
