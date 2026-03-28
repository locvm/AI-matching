import { describe, it, expect } from 'vitest'
import { normalizeAvailabilityYears } from '../normalizeAvailabilityYears.js'

describe('normalizeAvailabilityYears', () => {
  it("extracts years from 'Available in YYYY' strings", () => {
    const result = normalizeAvailabilityYears(['Available in 2025', 'Available in 2026'])
    expect(result).toEqual([2025, 2026])
  })

  it('handles plain year strings', () => {
    const result = normalizeAvailabilityYears(['2025', '2026'])
    expect(result).toEqual([2025, 2026])
  })

  it('sorts years in ascending order', () => {
    const result = normalizeAvailabilityYears(['Available in 2026', 'Available in 2025'])
    expect(result).toEqual([2025, 2026])
  })

  it('deduplicates years', () => {
    const result = normalizeAvailabilityYears(['Available in 2025', '2025', 'Available in 2025'])
    expect(result).toEqual([2025])
  })

  it('filters out strings with no year', () => {
    const result = normalizeAvailabilityYears(['Available in 2025', 'no year here', 'Available in 2026'])
    expect(result).toEqual([2025, 2026])
  })

  it('filters out years outside 2000-2100 range', () => {
    const result = normalizeAvailabilityYears(['Available in 1999', 'Available in 2025', 'Available in 2101'])
    expect(result).toEqual([2025])
  })

  it('filters out non-string values', () => {
    const result = normalizeAvailabilityYears([null, undefined, 123, 'Available in 2025'])
    expect(result).toEqual([2025])
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
    const result = normalizeAvailabilityYears(['Available in 2025'])
    expect(result).toEqual([2025])
  })
})
