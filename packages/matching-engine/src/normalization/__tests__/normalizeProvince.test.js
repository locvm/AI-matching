import { describe, it, expect } from 'vitest'
import { normalizeProvince } from '../normalizeProvince.js'

describe('normalizeProvince', () => {
  it('normalizes full name to 2-letter code', () => {
    expect(normalizeProvince('Ontario')).toBe('ON')
    expect(normalizeProvince('British Columbia')).toBe('BC')
    expect(normalizeProvince('Alberta')).toBe('AB')
    expect(normalizeProvince('Quebec')).toBe('QC')
    expect(normalizeProvince('Saskatchewan')).toBe('SK')
    expect(normalizeProvince('Manitoba')).toBe('MB')
    expect(normalizeProvince('Nova Scotia')).toBe('NS')
    expect(normalizeProvince('New Brunswick')).toBe('NB')
    expect(normalizeProvince('Newfoundland and Labrador')).toBe('NL')
    expect(normalizeProvince('Prince Edward Island')).toBe('PE')
    expect(normalizeProvince('Northwest Territories')).toBe('NT')
    expect(normalizeProvince('Nunavut')).toBe('NU')
    expect(normalizeProvince('Yukon')).toBe('YT')
  })

  it('handles case insensitivity', () => {
    expect(normalizeProvince('ontario')).toBe('ON')
    expect(normalizeProvince('ONTARIO')).toBe('ON')
    expect(normalizeProvince('Ontario')).toBe('ON')
  })

  it('handles trailing/leading whitespace', () => {
    expect(normalizeProvince('Ontario ')).toBe('ON')
    expect(normalizeProvince(' Ontario')).toBe('ON')
    expect(normalizeProvince('Québec ')).toBe('QC')
  })

  it('passes through already-clean 2-letter codes', () => {
    expect(normalizeProvince('ON')).toBe('ON')
    expect(normalizeProvince('BC')).toBe('BC')
    expect(normalizeProvince('AB')).toBe('AB')
    expect(normalizeProvince('QC')).toBe('QC')
  })

  it('handles Québec with accent', () => {
    expect(normalizeProvince('Québec')).toBe('QC')
    expect(normalizeProvince('québec')).toBe('QC')
  })

  it('handles short forms', () => {
    expect(normalizeProvince('PEI')).toBe('PE')
    expect(normalizeProvince('Newfoundland')).toBe('NL')
  })

  it('returns null for empty string', () => {
    expect(normalizeProvince('')).toBe(null)
    expect(normalizeProvince('  ')).toBe(null)
  })

  it('returns null for unrecognized values', () => {
    expect(normalizeProvince('Blorbistan')).toBe(null)
    expect(normalizeProvince('USA')).toBe(null)
  })

  it('returns null for null/undefined', () => {
    expect(normalizeProvince(null)).toBe(null)
    expect(normalizeProvince(undefined)).toBe(null)
  })
})
