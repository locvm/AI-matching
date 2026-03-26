import { describe, it, expect } from 'vitest'
import { normalizeAvailabilityDateRange, normalizeAvailabilityDateRanges } from '../normalizeAvailabilityDateRange.js'

describe('normalizeAvailabilityDateRange', () => {
  it('converts month/year strings to Date objects', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'january',
      fromYear: '2025',
      toMonth: 'march',
      toYear: '2025',
    })

    expect(result).not.toBeNull()
    expect(result?.from).toEqual(new Date(2025, 0, 1)) // Jan 1 2025
    expect(result?.to).toEqual(new Date(2025, 2, 31)) // Mar 31 2025
  })

  it('handles a single month range (same from and to)', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'june',
      fromYear: '2025',
      toMonth: 'june',
      toYear: '2025',
    })

    expect(result?.from).toEqual(new Date(2025, 5, 1)) // Jun 1
    expect(result?.to).toEqual(new Date(2025, 5, 30)) // Jun 30
  })

  it('handles ranges that cross years', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'november',
      fromYear: '2025',
      toMonth: 'june',
      toYear: '2026',
    })

    expect(result?.from).toEqual(new Date(2025, 10, 1)) // Nov 1 2025
    expect(result?.to).toEqual(new Date(2026, 5, 30)) // Jun 30 2026
  })

  it('handles february end date correctly (non leap year)', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'january',
      fromYear: '2025',
      toMonth: 'february',
      toYear: '2025',
    })

    expect(result?.to).toEqual(new Date(2025, 1, 28)) // Feb 28 2025
  })

  it('handles february end date correctly (leap year)', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'january',
      fromYear: '2024',
      toMonth: 'february',
      toYear: '2024',
    })

    expect(result?.to).toEqual(new Date(2024, 1, 29)) // Feb 29 2024
  })

  it('is case insensitive for month names', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'JANUARY',
      fromYear: '2025',
      toMonth: 'March',
      toYear: '2025',
    })

    expect(result).not.toBeNull()
    expect(result?.from).toEqual(new Date(2025, 0, 1))
  })

  it('trims whitespace from month names', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: ' january ',
      fromYear: '2025',
      toMonth: 'march',
      toYear: '2025',
    })

    expect(result).not.toBeNull()
  })

  it('returns null when from is after to', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'june',
      fromYear: '2026',
      toMonth: 'january',
      toYear: '2025',
    })

    expect(result).toBeNull()
  })

  it('returns null when fromMonth is missing', () => {
    expect(
      normalizeAvailabilityDateRange({
        fromYear: '2025',
        toMonth: 'march',
        toYear: '2025',
      })
    ).toBeNull()
  })

  it('returns null when toYear is missing', () => {
    expect(
      normalizeAvailabilityDateRange({
        fromMonth: 'january',
        fromYear: '2025',
        toMonth: 'march',
      })
    ).toBeNull()
  })

  it('returns null for unrecognized month names', () => {
    expect(
      normalizeAvailabilityDateRange({
        fromMonth: 'smarch',
        fromYear: '2025',
        toMonth: 'march',
        toYear: '2025',
      })
    ).toBeNull()
  })

  it('returns null for bad year values', () => {
    expect(
      normalizeAvailabilityDateRange({
        fromMonth: 'january',
        fromYear: 'abc',
        toMonth: 'march',
        toYear: '2025',
      })
    ).toBeNull()
  })

  it('returns null for null input', () => {
    expect(normalizeAvailabilityDateRange(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(normalizeAvailabilityDateRange('hello')).toBeNull()
  })

  it('accepts numeric year values', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'january',
      fromYear: 2025,
      toMonth: 'march',
      toYear: 2025,
    })

    expect(result).not.toBeNull()
    expect(result?.from).toEqual(new Date(2025, 0, 1))
  })
})

describe('normalizeAvailabilityDateRanges', () => {
  it('normalizes an array of ranges', () => {
    const result = normalizeAvailabilityDateRanges([
      { fromMonth: 'january', fromYear: '2025', toMonth: 'march', toYear: '2025' },
      { fromMonth: 'september', fromYear: '2025', toMonth: 'december', toYear: '2025' },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].from).toEqual(new Date(2025, 0, 1))
    expect(result[1].from).toEqual(new Date(2025, 8, 1))
  })

  it('filters out bad entries', () => {
    const result = normalizeAvailabilityDateRanges([
      { fromMonth: 'january', fromYear: '2025', toMonth: 'march', toYear: '2025' },
      null,
      { fromMonth: 'smarch', fromYear: '2025', toMonth: 'march', toYear: '2025' },
      { fromMonth: 'september', fromYear: '2025', toMonth: 'december', toYear: '2025' },
    ])

    expect(result).toHaveLength(2)
  })

  it('returns empty array for non-array input', () => {
    expect(normalizeAvailabilityDateRanges(null)).toEqual([])
    expect(normalizeAvailabilityDateRanges(undefined)).toEqual([])
    expect(normalizeAvailabilityDateRanges('hello')).toEqual([])
  })

  it('returns empty array for empty array input', () => {
    expect(normalizeAvailabilityDateRanges([])).toEqual([])
  })
})
