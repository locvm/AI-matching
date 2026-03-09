// @ts-check

import { DURATION_BUCKETS, DURATION_DEFAULTS } from './scoring.config.js'

/** @typedef {import("../interfaces/core/models.js").Physician} Physician */
/** @typedef {import("../interfaces/core/models.js").AvailabilityWindow} AvailabilityWindow */
/** @typedef {import("./scoring.config.js").DurationScorerConfig} DurationScorerConfig */
/** @typedef {import("./scoring.config.js").DurationScoreResult} DurationScoreResult */

/**
 * @param {DurationScorerConfig} [config]
 * @returns {(physician: Physician, jobDateRange: { from: Date, to: Date }) => DurationScoreResult}
 */
export function createDurationScorer(config = {}) {
  const opts = { ...DURATION_DEFAULTS, ...config }

  return function scoreDuration(physician, jobDateRange) {
    const jobDays = daysBetween(jobDateRange.from, jobDateRange.to)
    if (jobDays <= 0) return neutral(opts.neutralScore)

    if (physician.availability.length > 0) {
      return scoreByOverlap(physician.availability, jobDateRange, jobDays, opts)
    }

    if (physician.locumDurations.length > 0) {
      return scoreByBucket(physician.locumDurations, jobDays, opts)
    }

    return neutral(opts.neutralScore)
  }
}

/**
 * @param {AvailabilityWindow[]} windows
 * @param {{ from: Date, to: Date }} jobRange
 * @param {number} jobDays
 * @param {typeof DURATION_DEFAULTS} opts
 * @returns {DurationScoreResult}
 */
function scoreByOverlap(windows, jobRange, jobDays, opts) {
  let best = 0

  for (const w of windows) {
    const start = w.from > jobRange.from ? w.from : jobRange.from
    const end = w.to < jobRange.to ? w.to : jobRange.to
    const days = daysBetween(start, end)
    if (days > best) best = days
  }

  const ratio = best / jobDays
  const score = ratio < opts.minOverlapThreshold ? 0 : ratio

  return {
    score,
    breakdown: { method: 'overlap', overlapPct: ratio, usedBucketFallback: false },
  }
}

/**
 * @param {string[]} preferred
 * @param {number} jobDays
 * @param {typeof DURATION_DEFAULTS} opts
 * @returns {DurationScoreResult}
 */
function scoreByBucket(preferred, jobDays, opts) {
  const set = new Set(preferred)

  for (const b of DURATION_BUCKETS) {
    if (set.has(b.label) && jobDays >= b.min && jobDays < b.max) {
      return bucket(opts.bucketMatchScore)
    }
  }

  for (const b of DURATION_BUCKETS) {
    if (!set.has(b.label)) continue
    const margin = Math.max((b.max - b.min) * 0.25, 7)
    if (jobDays >= b.min - margin && jobDays < b.max + margin) {
      return bucket(opts.bucketPartialScore)
    }
  }

  return bucket(0)
}

/** @param {number} score @returns {DurationScoreResult} */
function neutral(score) {
  return { score, breakdown: { method: 'neutral', overlapPct: null, usedBucketFallback: false } }
}

/** @param {number} score @returns {DurationScoreResult} */
function bucket(score) {
  return { score, breakdown: { method: 'bucket', overlapPct: null, usedBucketFallback: true } }
}

/** @param {Date} a @param {Date} b @returns {number} */
function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
