// @ts-check

import { describe, it, expect, beforeAll } from 'vitest'
import { loadFixtures } from '../harness/lib/fixture-loader.js'
import { scoreEMR, scoreEMRWithDetail } from '../../src/scoring/emr/scoreEMR.js'

/** @type {import('../harness/lib/types.js').FixtureData} */
let fixtures

/** @type {import('../harness/lib/types.js').LocumJob[]} */
let jobsWithEMR

/** @type {import('../harness/lib/types.js').Physician[]} */
let physiciansWithEMR

/** @type {import('../harness/lib/types.js').Physician[]} */
let physiciansWithoutEMR

beforeAll(async () => {
  fixtures = await loadFixtures()

  jobsWithEMR = fixtures.jobs.filter((j) => j.facilityInfo?.emr?.trim())

  physiciansWithEMR = fixtures.physicians.filter(
    (p) => (p.emrSystems?.length ?? 0) > 0 || p.facilityEMR
  )

  physiciansWithoutEMR = fixtures.physicians.filter(
    (p) => (p.emrSystems?.length ?? 0) === 0 && !p.facilityEMR
  )
})

describe('score-emr harness – sanity', () => {
  it('no NaN or out-of-range scores across sampled jobs × physicians', () => {
    for (const job of fixtures.jobs.slice(0, 20)) {
      for (const physician of fixtures.physicians.slice(0, 100)) {
        const score = scoreEMR(physician, job)

        expect(score).not.toBeNaN()
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      }
    }
  })

  it('scoreEMRWithDetail returns valid method for every pair', () => {
    const validMethods = new Set(['match', 'no_match', 'no_job_emr', 'no_physician_emr'])

    for (const job of fixtures.jobs.slice(0, 20)) {
      for (const physician of fixtures.physicians.slice(0, 100)) {
        const detail = scoreEMRWithDetail(physician, job)

        expect(validMethods.has(detail.method)).toBe(true)
        expect(typeof detail.matched).toBe('boolean')
        expect(Array.isArray(detail.physicianEMRs)).toBe(true)
      }
    }
  })
})

describe('score-emr harness – missing data neutrality', () => {
  it('jobs without facilityInfo.emr always score 0.5 (neutral)', () => {
    const jobsWithoutEMR = fixtures.jobs.filter((j) => !j.facilityInfo?.emr?.trim())
    expect(jobsWithoutEMR.length).toBeGreaterThan(0)

    for (const job of jobsWithoutEMR.slice(0, 10)) {
      for (const physician of fixtures.physicians.slice(0, 20)) {
        const detail = scoreEMRWithDetail(physician, job)
        expect(detail.score).toBe(0.5)
        expect(detail.method).toBe('no_job_emr')
      }
    }
  })

  it('physicians without EMR data score 0.5 against jobs with EMR', () => {
    expect(physiciansWithoutEMR.length).toBeGreaterThan(0)

    if (jobsWithEMR.length === 0) return

    for (const job of jobsWithEMR.slice(0, 10)) {
      for (const physician of physiciansWithoutEMR.slice(0, 20)) {
        const detail = scoreEMRWithDetail(physician, job)
        expect(detail.score).toBe(0.5)
        expect(detail.method).toBe('no_physician_emr')
      }
    }
  })
})

describe('score-emr harness – match existence', () => {
  it('at least one physician-job pair with matching EMR exists', () => {
    if (jobsWithEMR.length === 0 || physiciansWithEMR.length === 0) return

    let foundMatch = false
    for (const job of jobsWithEMR) {
      for (const physician of physiciansWithEMR) {
        const detail = scoreEMRWithDetail(physician, job)
        if (detail.matched) {
          foundMatch = true
          break
        }
      }
      if (foundMatch) break
    }

    expect(foundMatch).toBe(true)
  })
})

describe('score-emr harness – method distribution', () => {
  it('no_physician_emr + no_job_emr dominate given sparse EMR data', () => {
    /** @type {Record<string, number>} */
    const methodCounts = { match: 0, no_match: 0, no_job_emr: 0, no_physician_emr: 0 }

    for (const job of fixtures.jobs.slice(0, 10)) {
      for (const physician of fixtures.physicians) {
        const detail = scoreEMRWithDetail(physician, job)
        methodCounts[detail.method]++
      }
    }

    const total = Object.values(methodCounts).reduce((a, b) => a + b, 0)
    expect(total).toBe(fixtures.jobs.slice(0, 10).length * fixtures.physicians.length)

    // ~90% of physicians lack EMR data, so missing-data methods should dominate
    expect(methodCounts['no_physician_emr'] + methodCounts['no_job_emr']).toBeGreaterThan(
      methodCounts['match'] + methodCounts['no_match']
    )
  })
})
