// @ts-check

import { describe, it, expect, beforeAll } from 'vitest'
import { loadFixtures } from '../harness/lib/fixture-loader.js'
import { createDurationScorer } from '../../src/scoring/score-duration.js'
import { toPhysician } from '../helpers/fixture-to-physician.js'

const scoreDuration = createDurationScorer()

/** @type {import('../harness/lib/types.js').FixtureData} */
let fixtures

/** @type {import('../harness/lib/types.js').LocumJob[]} */
let validJobs

/** @type {import('../harness/lib/types.js').User[]} */
let usersWithRanges

beforeAll(async () => {
  fixtures = await loadFixtures()

  validJobs = fixtures.jobs.filter((j) => {
    if (!j.dateRange?.from || !j.dateRange?.to) return false
    return j.dateRange.to > j.dateRange.from
  })

  usersWithRanges = fixtures.users.filter((u) => (u.preferences?.availabilityDateRanges?.length ?? 0) > 0)
})

describe('score-duration harness – sanity', () => {
  it('no NaN or out-of-range scores across sampled jobs × users', () => {
    for (const job of validJobs.slice(0, 20)) {
      for (const user of fixtures.users.slice(0, 100)) {
        const r = scoreDuration(toPhysician(user), job.dateRange)

        expect(r.score).not.toBeNaN()
        expect(r.score).toBeGreaterThanOrEqual(0)
        expect(r.score).toBeLessThanOrEqual(1)
        expect(r.breakdown).toBeDefined()
        expect(r.breakdown.method).toMatch(/^(overlap|bucket|neutral)$/)
      }
    }
  })
})

describe('score-duration harness – overlap metric', () => {
  it('users with availability ranges produce breakdown with overlapPct', () => {
    if (usersWithRanges.length === 0) return

    let foundOverlapBreakdown = false

    for (const user of usersWithRanges) {
      const physician = toPhysician(user)
      for (const job of validJobs.slice(0, 30)) {
        const r = scoreDuration(physician, job.dateRange)
        if (r.breakdown.method === 'overlap' && r.breakdown.overlapPct !== null) {
          foundOverlapBreakdown = true
          expect(r.breakdown.overlapPct).toBeGreaterThanOrEqual(0)
          expect(r.breakdown.usedBucketFallback).toBe(false)
          break
        }
      }
      if (foundOverlapBreakdown) break
    }

    expect(foundOverlapBreakdown).toBe(true)
  })
})

describe('score-duration harness – contained vs outside', () => {
  it('jobs inside availability average higher than jobs fully outside', () => {
    let insideSum = 0, insideN = 0
    let outsideSum = 0, outsideN = 0

    for (const user of usersWithRanges) {
      const physician = toPhysician(user)
      if (physician.availability.length === 0) continue

      const earliest = physician.availability.reduce((m, w) => w.from < m ? w.from : m, physician.availability[0].from)
      const latest = physician.availability.reduce((m, w) => w.to > m ? w.to : m, physician.availability[0].to)

      for (const job of validJobs) {
        const r = scoreDuration(physician, job.dateRange)
        const from = job.dateRange.from
        const to = job.dateRange.to

        if (from >= earliest && to <= latest) {
          insideSum += r.score
          insideN++
        } else if (to < earliest || from > latest) {
          outsideSum += r.score
          outsideN++
        }
      }
    }

    if (insideN > 0 && outsideN > 0) {
      expect(insideSum / insideN).toBeGreaterThan(outsideSum / outsideN)
    }
  })
})
