import { describe, it, expect } from 'vitest'
import { scoreEMR, scoreEMRWithDetail } from '../scoreEMR.js'

/** @typedef {import("@locvm/types").Physician} Physician */
/** @typedef {import("@locvm/types").LocumJob} LocumJob */

/** @param {Partial<Physician>} [overrides] */
function makePhysician(overrides = {}) {
  return /** @type {Physician} */ ({
    _id: 'test-physician',
    medProfession: 'Physician',
    medSpeciality: 'Family Medicine',
    isLookingForLocums: true,
    location: null,
    workAddress: null,
    preferredProvinces: [],
    specificRegions: [],
    emrSystems: [],
    ...overrides,
  })
}

/** @param {Partial<LocumJob>} [overrides] */
function makeJob(overrides = {}) {
  return /** @type {LocumJob} */ ({
    _id: 'test-job',
    medProfession: 'Physician',
    medSpeciality: 'Family Medicine',
    location: null,
    fullAddress: { city: 'Toronto', province: /** @type {const} */ ('ON') },
    dateRange: { from: new Date('2025-01-01'), to: new Date('2025-03-01') },
    ...overrides,
  })
}

// ── Core scoring rules ──────────────────────────────────────────────────────

describe('scoreEMR – match', () => {
  it('returns 1.0 when physician emrSystems contains the job EMR', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite', 'Accuro'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('returns 1.0 when match comes from facilityEMR (not in emrSystems)', () => {
    const physician = makePhysician({ emrSystems: [], facilityEMR: 'OSCAR Pro' })
    const job = makeJob({ facilityInfo: { emr: 'OSCAR Pro' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('returns 1.0 for case-insensitive match', () => {
    const physician = makePhysician({ emrSystems: ['ps suite'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('returns 1.0 when match comes from emrSystems with extra whitespace', () => {
    const physician = makePhysician({ emrSystems: ['  PS Suite  '] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })
})

describe('scoreEMR – no match', () => {
  it('returns 0.0 when physician has EMR data but none match', () => {
    const physician = makePhysician({ emrSystems: ['Accuro', 'OSCAR Pro'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job)).toBe(0.0)
  })
})

describe('scoreEMR – missing data (neutral)', () => {
  it('returns 0.5 when job has no facilityInfo', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({})
    expect(scoreEMR(physician, job)).toBe(0.5)
  })

  it('returns 0.5 when job facilityInfo.emr is undefined', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({ facilityInfo: {} })
    expect(scoreEMR(physician, job)).toBe(0.5)
  })

  it('returns 0.5 when job facilityInfo.emr is empty string', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({ facilityInfo: { emr: '  ' } })
    expect(scoreEMR(physician, job)).toBe(0.5)
  })

  it('returns 0.5 when physician has no EMR data at all', () => {
    const physician = makePhysician({ emrSystems: [] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job)).toBe(0.5)
  })

  it('returns 0.5 when both sides have no EMR data', () => {
    const physician = makePhysician({ emrSystems: [] })
    const job = makeJob({})
    expect(scoreEMR(physician, job)).toBe(0.5)
  })
})

// ── Dedup ────────────────────────────────────────────────────────────────────

describe('scoreEMR – dedup', () => {
  it('handles same EMR in both emrSystems and facilityEMR without issues', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'], facilityEMR: 'PS Suite' })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches via facilityEMR even when emrSystems has different entries', () => {
    const physician = makePhysician({ emrSystems: ['Accuro'], facilityEMR: 'PS Suite' })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })
})

// ── Alias / canonicalization ─────────────────────────────────────────────────

describe('scoreEMR – alias matching', () => {
  it('matches "Avaros Inc." physician against "Avaros EMR" job', () => {
    const physician = makePhysician({ emrSystems: ['Avaros Inc.'] })
    const job = makeJob({ facilityInfo: { emr: 'Avaros EMR' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches "Avaros EMR" physician against "Avaros Inc." job', () => {
    const physician = makePhysician({ emrSystems: ['Avaros EMR'] })
    const job = makeJob({ facilityInfo: { emr: 'Avaros Inc.' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches bare "Avaros" physician against "Avaros EMR" job', () => {
    const physician = makePhysician({ facilityEMR: 'Avaros' })
    const job = makeJob({ facilityInfo: { emr: 'Avaros EMR' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches "OSCAR Pro" against full OSCAR name', () => {
    const physician = makePhysician({ emrSystems: ['OSCAR Pro'] })
    const job = makeJob({ facilityInfo: { emr: 'OSCAR McMaster - Professional Edition (OSCAR Pro)' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches bare "OSCAR" against "OSCAR Pro"', () => {
    const physician = makePhysician({ emrSystems: ['OSCAR'] })
    const job = makeJob({ facilityInfo: { emr: 'OSCAR Pro' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches "PS Suite" against "PS Suite EMR"', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite EMR' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches "Accuro" against "Accuro EMR"', () => {
    const physician = makePhysician({ emrSystems: ['Accuro'] })
    const job = makeJob({ facilityInfo: { emr: 'Accuro EMR' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches "Juno" against "Juno EMR"', () => {
    const physician = makePhysician({ facilityEMR: 'Juno' })
    const job = makeJob({ facilityInfo: { emr: 'Juno EMR' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('matches "CHR" against full Collaborative Health Record name', () => {
    const physician = makePhysician({ emrSystems: ['CHR'] })
    const job = makeJob({ facilityInfo: { emr: 'Collaborative Health Record (CHR)' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('still returns 0.0 when aliases resolve to different systems', () => {
    const physician = makePhysician({ emrSystems: ['Accuro EMR'] })
    const job = makeJob({ facilityInfo: { emr: 'Avaros EMR' } })
    expect(scoreEMR(physician, job)).toBe(0.0)
  })

  it('unknown EMR names still work via exact match fallback', () => {
    const physician = makePhysician({ emrSystems: ['SomeNewEMR'] })
    const job = makeJob({ facilityInfo: { emr: 'SomeNewEMR' } })
    expect(scoreEMR(physician, job)).toBe(1.0)
  })

  it('unknown EMR names that differ still return 0.0', () => {
    const physician = makePhysician({ emrSystems: ['SomeNewEMR'] })
    const job = makeJob({ facilityInfo: { emr: 'AnotherNewEMR' } })
    expect(scoreEMR(physician, job)).toBe(0.0)
  })
})

describe('scoreEMRWithDetail – alias breakdown', () => {
  it('reports canonical names in breakdown for alias match', () => {
    const physician = makePhysician({ emrSystems: ['Avaros Inc.'] })
    const job = makeJob({ facilityInfo: { emr: 'Avaros EMR' } })
    const detail = scoreEMRWithDetail(physician, job)

    expect(detail.score).toBe(1.0)
    expect(detail.method).toBe('match')
    expect(detail.matched).toBe(true)
    expect(detail.jobEMR).toBe('avaros')
    expect(detail.physicianEMRs).toContain('avaros')
  })
})

// ── Output range ─────────────────────────────────────────────────────────────

describe('scoreEMR – output range', () => {
  it('score is always in [0, 1]', () => {
    const scenarios = [
      { physician: makePhysician({ emrSystems: ['PS Suite'] }), job: makeJob({ facilityInfo: { emr: 'PS Suite' } }) },
      { physician: makePhysician({ emrSystems: ['Accuro'] }), job: makeJob({ facilityInfo: { emr: 'PS Suite' } }) },
      { physician: makePhysician({ emrSystems: [] }), job: makeJob({ facilityInfo: { emr: 'PS Suite' } }) },
      { physician: makePhysician({ emrSystems: ['PS Suite'] }), job: makeJob({}) },
      { physician: makePhysician({}), job: makeJob({}) },
    ]

    for (const { physician, job } of scenarios) {
      const score = scoreEMR(physician, job)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
      expect(Number.isNaN(score)).toBe(false)
    }
  })
})

// ── Detail / breakdown ───────────────────────────────────────────────────────

describe('scoreEMRWithDetail – breakdown', () => {
  it('reports method "match" and matched=true on match', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    const detail = scoreEMRWithDetail(physician, job)

    expect(detail.method).toBe('match')
    expect(detail.matched).toBe(true)
    expect(detail.jobEMR).toBe('ps suite')
    expect(detail.physicianEMRs).toContain('ps suite')
  })

  it('reports method "no_match" when physician has EMR but no match', () => {
    const physician = makePhysician({ emrSystems: ['Accuro'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    const detail = scoreEMRWithDetail(physician, job)

    expect(detail.method).toBe('no_match')
    expect(detail.matched).toBe(false)
  })

  it('reports method "no_job_emr" when job has no EMR', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({})
    const detail = scoreEMRWithDetail(physician, job)

    expect(detail.method).toBe('no_job_emr')
    expect(detail.jobEMR).toBe(null)
  })

  it('reports method "no_physician_emr" when physician has no EMR', () => {
    const physician = makePhysician({})
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    const detail = scoreEMRWithDetail(physician, job)

    expect(detail.method).toBe('no_physician_emr')
    expect(detail.physicianEMRs).toEqual([])
  })
})

// ── Configurable defaults ────────────────────────────────────────────────────

describe('scoreEMR – configurable', () => {
  it('uses custom neutralScore when provided', () => {
    const physician = makePhysician({})
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job, { neutralScore: 0.3 })).toBe(0.3)
  })

  it('uses custom matchScore when provided', () => {
    const physician = makePhysician({ emrSystems: ['PS Suite'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job, { matchScore: 0.9 })).toBe(0.9)
  })

  it('uses custom noMatchScore when provided', () => {
    const physician = makePhysician({ emrSystems: ['Accuro'] })
    const job = makeJob({ facilityInfo: { emr: 'PS Suite' } })
    expect(scoreEMR(physician, job, { noMatchScore: 0.1 })).toBe(0.1)
  })
})
