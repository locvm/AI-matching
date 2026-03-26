import { describe, it, expect } from 'vitest'
import { lookupCity, lookupAddress } from '../scoreLocation.js'

describe('lookupCity', () => {
  it('finds Toronto with province code ON', () => {
    const coords = lookupCity('Toronto', 'ON')
    expect(coords).not.toBeNull()
    // @ts-expect-error - coords asserted non-null above
    expect(coords.lat).toBeCloseTo(43.65, 1)
    // @ts-expect-error - coords asserted non-null above
    expect(coords.lng).toBeCloseTo(-79.38, 1)
  })

  it('is case insensitive', () => {
    const upper = lookupCity('TORONTO', 'ON')
    const lower = lookupCity('toronto', 'on')
    const mixed = lookupCity('Toronto', 'On')
    expect(upper).toEqual(lower)
    expect(lower).toEqual(mixed)
    expect(upper).not.toBeNull()
  })

  it('trims whitespace', () => {
    const coords = lookupCity('  Toronto  ', ' ON ')
    expect(coords).not.toBeNull()
    // @ts-expect-error - coords asserted non-null above
    expect(coords.lat).toBeCloseTo(43.65, 1)
  })

  it('returns null for unknown cities', () => {
    expect(lookupCity('Atlantis', 'ON')).toBeNull()
    expect(lookupCity('Springfield', 'XX')).toBeNull()
  })

  it('returns null for empty inputs', () => {
    expect(lookupCity('', 'ON')).toBeNull()
    // @ts-expect-error - intentional boundary test: null city
    expect(lookupCity(null, 'ON')).toBeNull()
  })

  it('finds cities without province', () => {
    const coords = lookupCity('Toronto')
    expect(coords).not.toBeNull()
    // @ts-expect-error - coords asserted non-null above
    expect(coords.lat).toBeCloseTo(43.65, 1)
  })

  it('resolves Toronto subdivisions to Toronto coords', () => {
    const toronto = lookupCity('Toronto', 'ON')
    const northYork = lookupCity('North York', 'ON')
    const scarborough = lookupCity('Scarborough', 'ON')
    const etobicoke = lookupCity('Etobicoke', 'ON')

    // All should resolve (subdivisions have their own coords, or fall back to Toronto)
    expect(northYork).not.toBeNull()
    expect(scarborough).not.toBeNull()
    expect(etobicoke).not.toBeNull()
  })

  it('finds cities across different provinces', () => {
    expect(lookupCity('Edmonton', 'AB')).not.toBeNull()
    expect(lookupCity('Vancouver', 'BC')).not.toBeNull()
    expect(lookupCity('Montreal', 'QC')).not.toBeNull()
    expect(lookupCity('Surrey', 'BC')).not.toBeNull()
  })

  it('finds smaller Ontario cities from fixtures', () => {
    expect(lookupCity('Dryden', 'ON')).not.toBeNull()
    expect(lookupCity('Kenora', 'ON')).not.toBeNull()
    expect(lookupCity('Hearst', 'ON')).not.toBeNull()
    expect(lookupCity('Wawa', 'ON')).not.toBeNull()
    expect(lookupCity('Sundridge', 'ON')).not.toBeNull()
    expect(lookupCity('Deep River', 'ON')).not.toBeNull()
    expect(lookupCity('Chapleau', 'ON')).not.toBeNull()
  })
})

describe('lookupAddress', () => {
  it('extracts city and province from an Address', () => {
    const coords = lookupAddress({ city: 'Ottawa', province: 'ON' })
    expect(coords).not.toBeNull()
    // @ts-expect-error - coords asserted non-null above
    expect(coords.lat).toBeCloseTo(45.42, 1)
  })

  it('returns null when address is missing city', () => {
    expect(lookupAddress({ province: 'ON' })).toBeNull()
    expect(lookupAddress({ city: '', province: 'ON' })).toBeNull()
  })

  it('finds city even when address is missing province', () => {
    const coords = lookupAddress({ city: 'Toronto' })
    expect(coords).not.toBeNull()
    // @ts-expect-error - coords asserted non-null above
    expect(coords.lat).toBeCloseTo(43.65, 1)
  })

  it('returns null for null/undefined address', () => {
    // @ts-expect-error - intentional boundary test: null address
    expect(lookupAddress(null)).toBeNull()
    // @ts-expect-error - intentional boundary test: undefined address
    expect(lookupAddress(undefined)).toBeNull()
  })
})
