// @ts-check

/**
 * Harness-backed integration tests for the hard filter.
 * Uses real fixture data (physicians, jobs, reservations), samples with configurable maxJobs/maxUsers/seed,
 * runs filterEligiblePhysicians per job, and asserts invariants on the eligible list.
 *
 * Run: npm test -- tests/harness/hard-filter-integration.test.js
 * Custom sampling: pass { maxJobs, maxUsers, seed } to runHardFilterWithSampling() (see "configurable sampling" describe).
 * Full harness with CLI flags: npm run test:harness -- --maxJobs 10 --maxUsers 500 --seed 123
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { loadFixtures } from './lib/fixture-loader.js'
import { Sampler } from './lib/sampler.js'
import { filterEligiblePhysicians } from '../../src/matchingLogic/filterEligiblePhysicians.js'
import { TEST } from './harness.config.js'

/** @type {import('./lib/fixture-loader.js').FixtureData} */
let fixtures

/** @type {ReturnType<typeof runHardFilterWithSampling>} */
let defaultRun

beforeAll(async () => {
  fixtures = await loadFixtures()
  defaultRun = runHardFilterWithSampling()
})

/**
 * Run the hard filter over sampled jobs and users. Returns { sampledJobs, sampledUsers, results }
 * where results[i] = { job, reservation, eligible } for each sampled job.
 *
 * @param {{ maxJobs?: number, maxUsers?: number, seed?: number }} [sampling]
 */
function runHardFilterWithSampling(sampling = {}) {
  const config = {
    maxJobs: sampling.maxJobs ?? TEST.MAX_JOBS,
    maxUsers: sampling.maxUsers ?? TEST.MAX_USERS,
    seed: sampling.seed ?? TEST.SEED,
  }
  const sampler = new Sampler(config)
  const sampledJobs = sampler.sampleJobs(fixtures.jobs)
  const sampledPhysicians = sampler.sampleUsers(fixtures.physicians)

  const results = []
  for (const job of sampledJobs) {
    const reservation =
      fixtures.reservations.find((r) => r.locumJobId === job._id) ?? null
    const criteria = {
      job,
      reservation: reservation ?? undefined,
      options: { onlyLookingForLocums: true },
    }
    const eligible = filterEligiblePhysicians(
      /** @type {any} */ (sampledPhysicians),
      /** @type {any} */ (job),
      /** @type {any} */ (reservation ?? undefined),
      /** @type {any} */ (criteria)
    )
    results.push({ job, reservation, eligible })
  }

  return { sampledJobs, sampledPhysicians, results }
}

describe('Hard filter – harness-backed integration', () => {
  it('uses sampled jobs and users from fixtures', () => {
    const { sampledJobs, sampledPhysicians } = defaultRun
    expect(sampledJobs.length).toBeGreaterThan(0)
    expect(sampledJobs.length).toBeLessThanOrEqual(TEST.MAX_JOBS)
    expect(sampledPhysicians.length).toBeGreaterThan(0)
    expect(sampledPhysicians.length).toBeLessThanOrEqual(TEST.MAX_USERS)
  })

  it('returns one result set per sampled job', () => {
    const { sampledJobs, results } = defaultRun
    expect(results.length).toBe(sampledJobs.length)
  })

  it('every returned physician has matching profession and specialty', () => {
    const { results } = defaultRun
    for (const { job, eligible } of results) {
      const jSpec = (job.medSpeciality ?? '').trim().toLowerCase()
      const jProf = job.medProfession
      for (const p of eligible) {
        expect(p.medProfession).toBe(jProf)
        expect((p.medSpeciality ?? '').trim().toLowerCase()).toBe(jSpec)
      }
    }
  })

  it('no returned physician is explicitly not looking (when onlyLooking is true)', () => {
    const { results } = defaultRun
    for (const { eligible } of results) {
      for (const p of eligible) {
        expect(p.isLookingForLocums !== false).toBe(true)
        expect(p.preferences?.isLookingForLocums !== false).toBe(true)
      }
    }
  })

  it('no returned physician is in reservation.applicants', () => {
    const { results } = defaultRun
    for (const { reservation, eligible } of results) {
      const applicantIds = new Set(
        (reservation?.applicants ?? [])
          .map((a) => a.userId)
          .filter(Boolean)
          .map(String)
      )
      for (const p of eligible) {
        const id = String(p._id ?? p.id ?? '')
        expect(applicantIds.has(id)).toBe(false)
      }
    }
  })

  it('returned list size is <= input list size for each job', () => {
    const { sampledPhysicians, results } = defaultRun
    for (const { eligible } of results) {
      expect(eligible.length).toBeLessThanOrEqual(sampledPhysicians.length)
    }
  })

  it('no returned physician has a duration mismatch with the job', () => {
    const MS_PER_DAY = 86_400_000
    const BUCKET_RANGES = {
      short: { min: 0,  max: 90  },
      mid:   { min: 30, max: 180 },
      long:  { min: 90, max: 365 },
    }

    /** @param {number} days */
    function getBucket(days) {
      if (days <= 30) return 'short'
      if (days <= 89) return 'mid'
      return 'long'
    }

    const { results } = defaultRun
    for (const { job, eligible } of results) {
      if (!job.dateRange?.from || !job.dateRange?.to) continue
      const jobDays = (new Date(job.dateRange.to).getTime() - new Date(job.dateRange.from).getTime()) / MS_PER_DAY
      const bucket = BUCKET_RANGES[getBucket(jobDays)]

      for (const p of eligible) {
        const durations = p.locumDurations ?? []
        if (durations.length === 0) continue
        const hasOverlap = durations.some((/** @type {{ minDays: number, maxDays: number }} */ d) =>
          d.minDays <= bucket.max && d.maxDays >= bucket.min
        )
        expect(hasOverlap).toBe(true)
      }
    }
  })
})

describe('Hard filter – configurable sampling', () => {
  it('runs with custom maxJobs, maxUsers, seed', () => {
    const { sampledJobs, sampledPhysicians, results } = runHardFilterWithSampling({
      maxJobs: 10,
      maxUsers: 500,
      seed: 123,
    })
    expect(sampledJobs.length).toBeLessThanOrEqual(10)
    expect(sampledPhysicians.length).toBeLessThanOrEqual(500)
    expect(results.length).toBe(sampledJobs.length)

    for (const { eligible } of results) {
      expect(eligible.length).toBeLessThanOrEqual(sampledPhysicians.length)
      for (const p of eligible) {
        expect(p.medProfession).toBeTruthy()
        expect((p.medSpeciality ?? '').trim().toLowerCase()).toBeTruthy()
      }
    }
  })
})
