import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { scoreEMR, scoreEMRWithDetail } from '../scoreEMR.js'

/** @type {any[]} */
let rawUsers
/** @type {any[]} */
let rawJobs

function toPhysician(raw) {
  return {
    _id: raw._id?.$oid ?? raw._id ?? 'unknown',
    medProfession: raw.medProfession ?? '',
    medSpeciality: raw.medSpeciality ?? '',
    isLookingForLocums: raw.preferences?.isLookingForLocums ?? true,
    location: null,
    workAddress: raw.workAddress ?? null,
    preferredProvinces: [],
    specificRegions: [],
    emrSystems: raw.emrSystems ?? [],
    facilityEMR: raw.facilityEMR ?? undefined,
  }
}

function toJob(raw) {
  return {
    _id: raw._id?.$oid ?? raw._id ?? 'unknown',
    medProfession: raw.medProfession ?? '',
    medSpeciality: raw.medSpeciality ?? '',
    location: null,
    fullAddress: raw.fullAddress ?? {},
    dateRange: raw.dateRange ?? { from: new Date(), to: new Date() },
    facilityInfo: raw.facilityInfo ?? undefined,
  }
}

beforeAll(() => {
  const fixtureDir = resolve(import.meta.dirname, '../../../fixtures')
  rawUsers = JSON.parse(readFileSync(resolve(fixtureDir, 'locum.users.formatted.json'), 'utf-8'))
  rawJobs = JSON.parse(readFileSync(resolve(fixtureDir, 'locum.locumjobs.formatted.json'), 'utf-8'))
})

describe('Harness: EMR score distribution', () => {
  it('all scores are in [0, 1] with no NaN', () => {
    const physicians = rawUsers.map(toPhysician)
    const jobs = rawJobs.map(toJob)

    for (const job of jobs) {
      for (const physician of physicians) {
        const score = scoreEMR(physician, job)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
        expect(Number.isNaN(score)).toBe(false)
      }
    }
  })

  it('jobs without facilityInfo.emr always score 0.5 (neutral)', () => {
    const physicians = rawUsers.map(toPhysician)
    const jobs = rawJobs.map(toJob)
    const jobsWithoutEMR = jobs.filter((j) => !j.facilityInfo?.emr?.trim())

    expect(jobsWithoutEMR.length).toBeGreaterThan(0)

    for (const job of jobsWithoutEMR) {
      for (const physician of physicians.slice(0, 20)) {
        const detail = scoreEMRWithDetail(physician, job)
        expect(detail.score).toBe(0.5)
        expect(detail.method).toBe('no_job_emr')
      }
    }
  })

  it('physicians without EMR data score 0.5 against jobs with EMR', () => {
    const physicians = rawUsers.map(toPhysician)
    const jobs = rawJobs.map(toJob)

    const noEMRPhysicians = physicians.filter((p) => p.emrSystems.length === 0 && !p.facilityEMR)
    const jobsWithEMR = jobs.filter((j) => j.facilityInfo?.emr?.trim())

    expect(noEMRPhysicians.length).toBeGreaterThan(0)

    if (jobsWithEMR.length === 0) return

    for (const job of jobsWithEMR) {
      for (const physician of noEMRPhysicians.slice(0, 20)) {
        const detail = scoreEMRWithDetail(physician, job)
        expect(detail.score).toBe(0.5)
        expect(detail.method).toBe('no_physician_emr')
      }
    }
  })
})

describe('Harness: EMR match existence', () => {
  it('at least one physician-job pair with matching EMR exists (soft)', () => {
    const physicians = rawUsers.map(toPhysician)
    const jobs = rawJobs.map(toJob)

    const jobsWithEMR = jobs.filter((j) => j.facilityInfo?.emr?.trim())
    const physiciansWithEMR = physicians.filter((p) => p.emrSystems.length > 0 || p.facilityEMR)

    if (jobsWithEMR.length === 0 || physiciansWithEMR.length === 0) {
      return
    }

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

describe('Harness: EMR alias resolution', () => {
  it('"Avaros Inc." physicians match "Avaros EMR" jobs via alias', () => {
    const physicians = rawUsers.map(toPhysician)
    const jobs = rawJobs.map(toJob)

    const avarosIncPhysicians = physicians.filter((p) => p.emrSystems.some((e) => /avaros inc/i.test(e)))
    const avarosEMRJobs = jobs.filter((j) => j.facilityInfo?.emr && /avaros emr/i.test(j.facilityInfo.emr))

    if (avarosIncPhysicians.length === 0 || avarosEMRJobs.length === 0) return

    for (const job of avarosEMRJobs) {
      for (const physician of avarosIncPhysicians) {
        const detail = scoreEMRWithDetail(physician, job)
        expect(detail.score).toBe(1.0)
        expect(detail.method).toBe('match')
        expect(detail.matched).toBe(true)
      }
    }
  })
})

describe('Harness: EMR method distribution', () => {
  it('reports method counts across all pairs for a sample of jobs', () => {
    const physicians = rawUsers.map(toPhysician)
    const jobs = rawJobs.map(toJob).slice(0, 10)

    /** @type {Record<string, number>} */
    const methodCounts = { match: 0, no_match: 0, no_job_emr: 0, no_physician_emr: 0 }

    for (const job of jobs) {
      for (const physician of physicians) {
        const detail = scoreEMRWithDetail(physician, job)
        methodCounts[detail.method]++
      }
    }

    const total = Object.values(methodCounts).reduce((a, b) => a + b, 0)
    expect(total).toBe(jobs.length * physicians.length)

    // no_physician_emr should be the majority given ~90% of physicians lack EMR data
    expect(methodCounts['no_physician_emr'] + methodCounts['no_job_emr']).toBeGreaterThan(
      methodCounts['match'] + methodCounts['no_match']
    )
  })
})
