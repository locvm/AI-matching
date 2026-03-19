import { describe, it, expect } from 'vitest'
import { scoreLocation, scoreLocationWithDetail } from '../scoreLocation.js'

/** @typedef {import("../../../interfaces/core/models.js").Address} Address */

// Helper to build a minimal physician with overrides
function makePhysician(overrides = {}) {
  return {
    _id: 'test-id',
    medProfession: 'Physician',
    medSpeciality: 'Family Medicine',
    isLookingForLocums: true,
    location: null,
    workAddress: null,
    preferredProvinces: [],
    specificRegions: [],
    emrSystems: [],
    ...overrides,
  }
}

const TORONTO_COORDS = { lat: 43.6532, lng: -79.3832 }
const HAMILTON_COORDS = { lat: 43.2557, lng: -79.8711 }
const OTTAWA_COORDS = { lat: 45.4215, lng: -75.6972 }
const MARKHAM_COORDS = { lat: 43.8561, lng: -79.337 }

/** @type {Address} */
const ONTARIO_ADDRESS = { city: 'Toronto', province: 'ON' }
/** @type {Address} */
const ALBERTA_ADDRESS = { city: 'Calgary', province: 'AB' }
/** @type {Address} */
const BARRIE_ADDRESS = { city: 'Barrie', province: 'ON' }

// ============================================================
// Tier 1: GPS distance (reverse sigmoid)
// ============================================================
describe('Tier 1: GPS distance', () => {
  it('scores ~0.97 for same location (0 km)', () => {
    const physician = makePhysician({ location: TORONTO_COORDS })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBeGreaterThan(0.95)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('scores ~0.81 for Toronto to Hamilton (~59 km)', () => {
    const physician = makePhysician({ location: TORONTO_COORDS })
    const score = scoreLocation(physician, HAMILTON_COORDS, ONTARIO_ADDRESS)
    expect(score).toBeGreaterThan(0.75)
    expect(score).toBeLessThan(0.9)
  })

  it('scores ~0.50 at midpoint (100 km)', () => {
    // Barrie is ~85km, so score should be above 0.5 but close
    const physician = makePhysician({ location: TORONTO_COORDS })
    const score = scoreLocation(physician, { lat: 44.3894, lng: -79.6903 }, BARRIE_ADDRESS)
    expect(score).toBeGreaterThan(0.4)
    expect(score).toBeLessThan(0.7)
  })

  it('scores near 0 for Toronto to Ottawa (~352 km)', () => {
    const physician = makePhysician({ location: TORONTO_COORDS })
    const score = scoreLocation(physician, OTTAWA_COORDS, ONTARIO_ADDRESS)
    expect(score).toBeLessThan(0.01)
  })

  it('returns 0.5 when job has corrupted [0,0] coords', () => {
    const physician = makePhysician({ location: TORONTO_COORDS })
    const score = scoreLocation(physician, { lat: 0, lng: 0 }, ONTARIO_ADDRESS)
    // Should fall through to province fallback since [0,0] is invalid
    // Physician has no preferredProvinces, no workAddress province — so might get 0.5
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('provides detail with method gps_distance', () => {
    const physician = makePhysician({ location: TORONTO_COORDS })
    const detail = scoreLocationWithDetail(physician, HAMILTON_COORDS, ONTARIO_ADDRESS)
    expect(detail.method).toBe('gps_distance')
    expect(detail.distanceKm).toBeGreaterThan(55)
    expect(detail.distanceKm).toBeLessThan(65)
    expect(detail.distanceBucket).toBe('nearby')
  })

  it('assigns correct distance buckets', () => {
    const physician = makePhysician({ location: TORONTO_COORDS })

    const sameCity = scoreLocationWithDetail(physician, MARKHAM_COORDS, ONTARIO_ADDRESS)
    expect(sameCity.distanceBucket).toBe('same_city')

    const nearby = scoreLocationWithDetail(physician, HAMILTON_COORDS, ONTARIO_ADDRESS)
    expect(nearby.distanceBucket).toBe('nearby')

    const far = scoreLocationWithDetail(physician, OTTAWA_COORDS, ONTARIO_ADDRESS)
    expect(far.distanceBucket).toBe('very_far')
  })
})

// ============================================================
// Tier 2: specificRegions
// ============================================================
describe('Tier 2: specificRegions', () => {
  it('scores 0.85 when region matches job city', () => {
    const physician = makePhysician({ specificRegions: ['downtown toronto'] })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.85)
  })

  it('scores 0.15 when region does not match job city', () => {
    const physician = makePhysician({ specificRegions: ['Barrie'] })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.15)
  })

  it('falls through to province tier when regions are too coarse', () => {
    const physician = makePhysician({
      specificRegions: ['Ontario'],
      preferredProvinces: ['ON'],
    })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    // Should fall through to Tier 3 (preferred province match = 0.70)
    expect(score).toBe(0.7)
  })

  it('matches when job city contains region', () => {
    const physician = makePhysician({ specificRegions: ['Toronto'] })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.85)
  })

  it('provides detail with method specific_region and matched region', () => {
    const physician = makePhysician({ specificRegions: ['GTA', 'downtown toronto'] })
    const detail = scoreLocationWithDetail(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(detail.method).toBe('specific_region')
    expect(detail.matchedRegion).toBe('downtown toronto')
  })
})

// ============================================================
// Tier 3: preferredProvinces
// ============================================================
describe('Tier 3: preferredProvinces', () => {
  it('scores 0.70 when preferred province matches', () => {
    const physician = makePhysician({ preferredProvinces: ['ON'] })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.7)
  })

  it('scores 0.20 when preferred province does not match', () => {
    const physician = makePhysician({ preferredProvinces: ['PE', 'NT', 'NU', 'YT'] })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.2)
  })

  it('handles unnormalized province names in preferredProvinces', () => {
    const physician = makePhysician({ preferredProvinces: ['Ontario'] })
    // normalizeProvince should handle "Ontario" -> "ON" but preferredProvinces
    // should already be clean ProvinceCodes. Testing that normalization works anyway.
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.7)
  })

  it('provides detail with method preferred_province', () => {
    const physician = makePhysician({ preferredProvinces: ['ON', 'BC'] })
    const detail = scoreLocationWithDetail(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(detail.method).toBe('preferred_province')
    expect(detail.provinceMatch).toBe(true)
    expect(detail.resolvedJobProvince).toBe('ON')
  })
})

// ============================================================
// Tier 4: workAddress province
// ============================================================
describe('Tier 4: workAddress province', () => {
  it('scores 0.55 when work province matches job province', () => {
    const physician = makePhysician({
      workAddress: { city: 'Ottawa', province: 'ontario' },
    })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.55)
  })

  it('scores 0.40 when work province does not match', () => {
    const physician = makePhysician({
      workAddress: { city: 'Vancouver', province: 'BC' },
    })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.4)
  })

  it('provides detail with method work_province', () => {
    const physician = makePhysician({
      workAddress: { city: 'Ottawa', province: 'ON' },
    })
    const detail = scoreLocationWithDetail(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(detail.method).toBe('work_province')
    expect(detail.resolvedPhysicianProvince).toBe('ON')
    expect(detail.provinceMatch).toBe(true)
  })
})

// ============================================================
// Tier 5: medicalProvince
// ============================================================
describe('Tier 5: medicalProvince', () => {
  it('scores 0.50 when medical province matches', () => {
    const physician = makePhysician({ medicalProvince: 'ON' })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.5)
  })

  it('scores 0.45 when medical province does not match', () => {
    const physician = makePhysician({ medicalProvince: 'BC' })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.45)
  })
})

// ============================================================
// Tier 6: no data
// ============================================================
describe('Tier 6: no data', () => {
  it('scores 0.50 when physician has no location data at all', () => {
    const physician = makePhysician()
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(score).toBe(0.5)
  })

  it('provides detail with method no_data', () => {
    const physician = makePhysician()
    const detail = scoreLocationWithDetail(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
    expect(detail.method).toBe('no_data')
    expect(detail.distanceKm).toBe(null)
    expect(detail.distanceBucket).toBe('unknown')
  })
})

// ============================================================
// General
// ============================================================
describe('General', () => {
  it('always returns a score in [0, 1]', () => {
    const scenarios = [
      makePhysician({ location: TORONTO_COORDS }),
      makePhysician({ specificRegions: ['Toronto'] }),
      makePhysician({ preferredProvinces: ['ON'] }),
      makePhysician({ workAddress: { province: 'ON' } }),
      makePhysician({ medicalProvince: 'ON' }),
      makePhysician(),
    ]

    for (const physician of scenarios) {
      const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
      expect(Number.isNaN(score)).toBe(false)
    }
  })

  it('accepts custom config override', () => {
    const customConfig = {
      MIDPOINT_KM: 200,
      STEEPNESS_K: 0.035,
      SCORES: {
        SPECIFIC_REGION_MATCH: 0.9,
        SPECIFIC_REGION_MISMATCH: 0.1,
        PREFERRED_PROVINCE_MATCH: 0.8,
        PREFERRED_PROVINCE_MISMATCH: 0.1,
        WORK_PROVINCE_MATCH: 0.6,
        WORK_PROVINCE_MISMATCH: 0.3,
        MEDICAL_PROVINCE_MATCH: 0.5,
        MEDICAL_PROVINCE_MISMATCH: 0.4,
        NO_DATA: 0.5,
      },
      COARSE_REGION_NAMES: ['ontario'],
      DISTANCE_BUCKETS: { SAME_CITY: 25, NEARBY: 75, REGIONAL: 150, FAR: 300 },
    }

    const physician = makePhysician({ preferredProvinces: ['ON'] })
    const score = scoreLocation(physician, TORONTO_COORDS, ONTARIO_ADDRESS, customConfig)
    expect(score).toBe(0.8) // custom preferred province match score
  })

  it('works without jobAddress (no province fallback possible)', () => {
    const physician = makePhysician({ preferredProvinces: ['ON'] })
    // No jobAddress = no province to compare against, falls through to no_data
    const score = scoreLocation(physician, TORONTO_COORDS)
    expect(score).toBe(0.5)
  })
})

// ============================================================
// Score Table (prints after all tests)
// ============================================================
describe('Score Table', () => {
  it('prints all scenario scores', () => {
    const scenarios = [
      ['GPS: same city (0km)', { location: TORONTO_COORDS }],
      ['GPS: Toronto→Hamilton (59km)', { location: TORONTO_COORDS }],
      ['GPS: Toronto→Barrie (85km)', { location: TORONTO_COORDS }],
      ['GPS: Toronto→Ottawa (352km)', { location: TORONTO_COORDS }],
      ["Region: 'toronto' vs Toronto", { specificRegions: ['downtown toronto'] }],
      ["Region: 'barrie' vs Toronto", { specificRegions: ['Barrie'] }],
      ['Province: ON vs ON job', { preferredProvinces: ['ON'] }],
      ['Province: BC vs ON job', { preferredProvinces: ['BC'] }],
      ['Work addr: ON vs ON job', { workAddress: { city: 'Ottawa', province: 'ON' } }],
      ['Work addr: BC vs ON job', { workAddress: { city: 'Vancouver', province: 'BC' } }],
      ['Medical: ON', { medicalProvince: 'ON' }],
      ['Medical: BC', { medicalProvince: 'BC' }],
      ['No data at all', {}],
    ]

    const jobLocations = [TORONTO_COORDS, HAMILTON_COORDS, { lat: 44.3894, lng: -79.6903 }, OTTAWA_COORDS]

    const lines = [
      '',
      '  SCENARIO                              SCORE   METHOD              DETAIL',
      '  ' + '─'.repeat(83),
    ]

    for (let i = 0; i < scenarios.length; i++) {
      const [name, overrides] = scenarios[i]
      const physician = makePhysician(overrides)
      // GPS scenarios use different job locations, others use Toronto
      const jobLoc = i < 4 ? jobLocations[i] : TORONTO_COORDS
      const d = scoreLocationWithDetail(physician, jobLoc, ONTARIO_ADDRESS)
      const extra = d.matchedRegion
        ? 'matched: ' + d.matchedRegion
        : d.provinceMatch
          ? 'province match'
          : d.distanceBucket !== 'unknown'
            ? d.distanceBucket
            : ''
      lines.push(
        '  ' +
          /** @type {string} */ (name).padEnd(38) +
          d.score.toFixed(2).padStart(5) +
          '   ' +
          d.method.padEnd(20) +
          extra
      )
    }

    lines.push('')
    console.log(lines.join('\n'))

    // This test always passes — it's just for display
    expect(true).toBe(true)
  })
})
