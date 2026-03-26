// @ts-check

import { describe, it, expect, beforeAll } from 'vitest'
import { loadFixtures } from '../harness/lib/fixture-loader.js'
import { createDurationScorer } from '../../src/scoring/duration/scoreDuration.js'

const scoreDuration = createDurationScorer()

/** @type {import('../harness/lib/types.js').FixtureData} */
let fixtures

/** @type {import('../harness/lib/types.js').LocumJob[]} */
let validJobs

/** @type {import('../harness/lib/types.js').Physician[]} */
let physiciansWithRanges

beforeAll(async () => {
  fixtures = await loadFixtures()

  validJobs = fixtures.jobs.filter((j) => {
    if (!j.dateRange?.from || !j.dateRange?.to) return false
    return j.dateRange.to > j.dateRange.from
  })

  physiciansWithRanges = fixtures.physicians.filter((p) => (p.availabilityWindows?.length ?? 0) > 0)
})

describe('score-duration harness – sanity', () => {
  it('no NaN or out-of-range scores across sampled jobs × physicians', () => {
    for (const job of validJobs.slice(0, 20)) {
      for (const physician of fixtures.physicians.slice(0, 100)) {
        const r = scoreDuration(physician, job.dateRange)

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
  it('physicians with availability ranges produce breakdown with overlapPct', () => {
    if (physiciansWithRanges.length === 0) return

    let foundOverlapBreakdown = false

    for (const physician of physiciansWithRanges) {
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
    let insideSum = 0,
      insideN = 0
    let outsideSum = 0,
      outsideN = 0

    for (const physician of physiciansWithRanges) {
      const windows = physician.availabilityWindows ?? []
      if (windows.length === 0) continue

      const earliest = windows.reduce((m, w) => (w.from < m ? w.from : m), windows[0].from)
      const latest = windows.reduce((m, w) => (w.to > m ? w.to : m), windows[0].to)

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
