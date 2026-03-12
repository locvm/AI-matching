// @ts-check

/**
 * Harness-backed integration tests for the hard filter.
 * Uses real fixture data (users, jobs, reservations), samples with configurable maxJobs/maxUsers/seed,
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
 * @returns {{ sampledJobs: import('./lib/types.js').LocumJob[], sampledUsers: import('./lib/types.js').User[], results: Array<{ job: import('./lib/types.js').LocumJob, reservation: import('./lib/types.js').Reservation | null, eligible: import('./lib/types.js').User[] }> }}
 */
function runHardFilterWithSampling(sampling = {}) {
  const config = {
    maxJobs: sampling.maxJobs ?? TEST.MAX_JOBS,
    maxUsers: sampling.maxUsers ?? TEST.MAX_USERS,
    seed: sampling.seed ?? TEST.SEED,
  }
  const sampler = new Sampler(config)
  const sampledJobs = sampler.sampleJobs(fixtures.jobs)
  const sampledUsers = sampler.sampleUsers(fixtures.users)

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
      /** @type {any} */ (sampledUsers),
      /** @type {any} */ (job),
      /** @type {any} */ (reservation ?? undefined),
      /** @type {any} */ (criteria)
    )
    results.push({ job, reservation, eligible })
  }

  return { sampledJobs, sampledUsers, results }
}

describe('Hard filter – harness-backed integration', () => {
  it('uses sampled jobs and users from fixtures', () => {
    const { sampledJobs, sampledUsers } = defaultRun
    expect(sampledJobs.length).toBeGreaterThan(0)
    expect(sampledJobs.length).toBeLessThanOrEqual(TEST.MAX_JOBS)
    expect(sampledUsers.length).toBeGreaterThan(0)
    expect(sampledUsers.length).toBeLessThanOrEqual(TEST.MAX_USERS)
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
    const { sampledUsers, results } = defaultRun
    for (const { eligible } of results) {
      expect(eligible.length).toBeLessThanOrEqual(sampledUsers.length)
    }
  })
})

describe('Hard filter – configurable sampling', () => {
  it('runs with custom maxJobs, maxUsers, seed', () => {
    const { sampledJobs, sampledUsers, results } = runHardFilterWithSampling({
      maxJobs: 10,
      maxUsers: 500,
      seed: 123,
    })
    expect(sampledJobs.length).toBeLessThanOrEqual(10)
    expect(sampledUsers.length).toBeLessThanOrEqual(500)
    expect(results.length).toBe(sampledJobs.length)

    for (const { eligible } of results) {
      expect(eligible.length).toBeLessThanOrEqual(sampledUsers.length)
      for (const p of eligible) {
        expect(p.medProfession).toBeTruthy()
        expect((p.medSpeciality ?? '').trim().toLowerCase()).toBeTruthy()
      }
    }
  })
})
