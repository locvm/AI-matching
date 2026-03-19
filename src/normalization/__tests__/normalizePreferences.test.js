import { describe, it, expect } from 'vitest'
import {
  normalizeLocumDuration,
  normalizeAvailability,
  normalizeAvailabilityDateRange,
  normalizeAvailabilityDateRanges,
  normalizeAvailabilityYears,
} from '../normalizePreferences.js'

// ── normalizeLocumDuration ─────────────────────────────────────────────────

describe('normalizeLocumDuration', () => {
  it('normalizes all 5 known duration strings', () => {
    expect(normalizeLocumDuration('A few days')).toEqual({ minDays: 1, maxDays: 7 })
    expect(normalizeLocumDuration('Less than a month')).toEqual({ minDays: 1, maxDays: 30 })
    expect(normalizeLocumDuration('1–3 months')).toEqual({ minDays: 30, maxDays: 90 })
    expect(normalizeLocumDuration('3–6 months')).toEqual({ minDays: 90, maxDays: 180 })
    expect(normalizeLocumDuration('6+ months')).toEqual({ minDays: 180, maxDays: 365 })
  })

  it('handles case insensitivity', () => {
    expect(normalizeLocumDuration('a few days')).toEqual({ minDays: 1, maxDays: 7 })
    expect(normalizeLocumDuration('LESS THAN A MONTH')).toEqual({ minDays: 1, maxDays: 30 })
    expect(normalizeLocumDuration('A FEW DAYS')).toEqual({ minDays: 1, maxDays: 7 })
  })

  it('handles en-dash and em-dash variants', () => {
    expect(normalizeLocumDuration('1–3 months')).toEqual({ minDays: 30, maxDays: 90 })
    expect(normalizeLocumDuration('3–6 months')).toEqual({ minDays: 90, maxDays: 180 })
    expect(normalizeLocumDuration('1-3 months')).toEqual({ minDays: 30, maxDays: 90 })
    expect(normalizeLocumDuration('3-6 months')).toEqual({ minDays: 90, maxDays: 180 })
    expect(normalizeLocumDuration('1—3 months')).toEqual({ minDays: 30, maxDays: 90 })
  })

  it('handles leading/trailing whitespace', () => {
    expect(normalizeLocumDuration('  A few days  ')).toEqual({ minDays: 1, maxDays: 7 })
    expect(normalizeLocumDuration(' 6+ months ')).toEqual({ minDays: 180, maxDays: 365 })
  })

  it('returns null for unrecognized strings', () => {
    expect(normalizeLocumDuration('forever')).toBeNull()
    expect(normalizeLocumDuration('2 weeks')).toBeNull()
    expect(normalizeLocumDuration('')).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(normalizeLocumDuration(null)).toBeNull()
    expect(normalizeLocumDuration(undefined)).toBeNull()
    expect(normalizeLocumDuration(42)).toBeNull()
    expect(normalizeLocumDuration({})).toBeNull()
  })
})

// ── normalizeAvailability ──────────────────────────────────────────────────

describe('normalizeAvailability', () => {
  it('splits Weekdays into Mon-Fri', () => {
    const result = normalizeAvailability(['Weekdays'])
    expect(result.availableDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    expect(result.commitmentTypes).toEqual([])
  })

  it('splits Weekends into Sat-Sun', () => {
    const result = normalizeAvailability(['Weekends'])
    expect(result.availableDays).toEqual(['Sat', 'Sun'])
    expect(result.commitmentTypes).toEqual([])
  })

  it('combines Weekdays + Weekends into all 7 days', () => {
    const result = normalizeAvailability(['Weekdays', 'Weekends'])
    expect(result.availableDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('deduplicates days when Weekdays appears twice', () => {
    const result = normalizeAvailability(['Weekdays', 'Weekdays'])
    expect(result.availableDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  })

  it('normalizes Full-time to commitment type', () => {
    const result = normalizeAvailability(['Full-time'])
    expect(result.availableDays).toEqual([])
    expect(result.commitmentTypes).toEqual(['full-time'])
  })

  it('normalizes Part-time to commitment type', () => {
    const result = normalizeAvailability(['Part-time'])
    expect(result.commitmentTypes).toEqual(['part-time'])
  })

  it('normalizes On-call or short notice to commitment type', () => {
    const result = normalizeAvailability(['On-call or short notice'])
    expect(result.commitmentTypes).toEqual(['on-call'])
  })

  it('handles mixed days and commitment types', () => {
    const result = normalizeAvailability(['Weekdays', 'Full-time', 'On-call or short notice'])
    expect(result.availableDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    expect(result.commitmentTypes).toEqual(['full-time', 'on-call'])
  })

  it('handles case insensitivity', () => {
    const result = normalizeAvailability(['weekdays', 'FULL-TIME'])
    expect(result.availableDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    expect(result.commitmentTypes).toEqual(['full-time'])
  })

  it('handles whitespace', () => {
    const result = normalizeAvailability(['  Weekends  ', ' Part-time '])
    expect(result.availableDays).toEqual(['Sat', 'Sun'])
    expect(result.commitmentTypes).toEqual(['part-time'])
  })

  it('ignores unrecognized values', () => {
    const result = normalizeAvailability(['Weekdays', 'Evenings', 'Midnight shift'])
    expect(result.availableDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    expect(result.commitmentTypes).toEqual([])
  })

  it('returns empty arrays for empty input', () => {
    const result = normalizeAvailability([])
    expect(result.availableDays).toEqual([])
    expect(result.commitmentTypes).toEqual([])
  })

  it('returns empty arrays for non-array input', () => {
    const result = normalizeAvailability(/** @type {any} */ (null))
    expect(result.availableDays).toEqual([])
    expect(result.commitmentTypes).toEqual([])
  })
})

// ── normalizeAvailabilityDateRange ─────────────────────────────────────────

describe('normalizeAvailabilityDateRange', () => {
  it('converts month/year strings to Date objects', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'january',
      fromYear: '2025',
      toMonth: 'march',
      toYear: '2025',
    })
    expect(result).not.toBeNull()
    expect(result.from).toEqual(new Date(2025, 0, 1))
    expect(result.to).toEqual(new Date(2025, 2, 31))
  })

  it('handles a single month range (same from and to)', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'june',
      fromYear: '2025',
      toMonth: 'june',
      toYear: '2025',
    })
    expect(result.from).toEqual(new Date(2025, 5, 1))
    expect(result.to).toEqual(new Date(2025, 5, 30))
  })

  it('handles ranges that cross years', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'november',
      fromYear: '2025',
      toMonth: 'june',
      toYear: '2026',
    })
    expect(result.from).toEqual(new Date(2025, 10, 1))
    expect(result.to).toEqual(new Date(2026, 5, 30))
  })

  it('handles february end date correctly (non leap year)', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'january',
      fromYear: '2025',
      toMonth: 'february',
      toYear: '2025',
    })
    expect(result.to).toEqual(new Date(2025, 1, 28))
  })

  it('handles february end date correctly (leap year)', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'january',
      fromYear: '2024',
      toMonth: 'february',
      toYear: '2024',
    })
    expect(result.to).toEqual(new Date(2024, 1, 29))
  })

  it('is case insensitive for month names', () => {
    const result = normalizeAvailabilityDateRange({
      fromMonth: 'JANUARY',
      fromYear: '2025',
      toMonth: 'March',
      toYear: '2025',
    })
    expect(result).not.toBeNull()
    expect(result.from).toEqual(new Date(2025, 0, 1))
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
    expect(
      normalizeAvailabilityDateRange({
        fromMonth: 'june',
        fromYear: '2026',
        toMonth: 'january',
        toYear: '2025',
      })
    ).toBeNull()
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
    expect(result.from).toEqual(new Date(2025, 0, 1))
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

// ── normalizeAvailabilityYears ─────────────────────────────────────────────

describe('normalizeAvailabilityYears', () => {
  it("extracts years from 'Available in YYYY' strings", () => {
    expect(normalizeAvailabilityYears(['Available in 2025', 'Available in 2026'])).toEqual([2025, 2026])
  })

  it('handles plain year strings', () => {
    expect(normalizeAvailabilityYears(['2025', '2026'])).toEqual([2025, 2026])
  })

  it('sorts years in ascending order', () => {
    expect(normalizeAvailabilityYears(['Available in 2026', 'Available in 2025'])).toEqual([2025, 2026])
  })

  it('deduplicates years', () => {
    expect(normalizeAvailabilityYears(['Available in 2025', '2025', 'Available in 2025'])).toEqual([2025])
  })

  it('filters out strings with no year', () => {
    expect(normalizeAvailabilityYears(['Available in 2025', 'no year here', 'Available in 2026'])).toEqual([2025, 2026])
  })

  it('filters out years outside 2000-2100 range', () => {
    expect(normalizeAvailabilityYears(['Available in 1999', 'Available in 2025', 'Available in 2101'])).toEqual([2025])
  })

  it('filters out non-string values', () => {
    expect(normalizeAvailabilityYears([null, undefined, 123, 'Available in 2025'])).toEqual([2025])
  })

  it('returns empty array for empty input', () => {
    expect(normalizeAvailabilityYears([])).toEqual([])
  })

  it('returns empty array for non-array input', () => {
    expect(normalizeAvailabilityYears(null)).toEqual([])
    expect(normalizeAvailabilityYears(undefined)).toEqual([])
    expect(normalizeAvailabilityYears('hello')).toEqual([])
  })

  it('handles a single year', () => {
    expect(normalizeAvailabilityYears(['Available in 2025'])).toEqual([2025])
  })
})
