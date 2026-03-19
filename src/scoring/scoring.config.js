// @ts-check

// The en-dash (–) in bucket labels matches what the DB stores.
export const DURATION_BUCKETS = [
  { label: 'A few days', min: 0, max: 7 },
  { label: 'Less than a month', min: 0, max: 30 },
  { label: '1-3 months', min: 30, max: 90 },
  { label: '3-6 months', min: 90, max: 180 },
  { label: '6+ months', min: 180, max: Infinity },
]

/**
 * @typedef {object} DurationScorerConfig
 * @property {number} [neutralScore]
 * @property {number} [minOverlapThreshold]
 * @property {number} [bucketMatchScore]
 * @property {number} [bucketPartialScore]
 */

/**
 * @typedef {'overlap' | 'bucket' | 'neutral'} DurationScoringMethod
 */

/**
 * @typedef {object} DurationBreakdown
 * @property {DurationScoringMethod} method
 * @property {number | null} overlapPct - overlap ratio [0–1] if overlap was computed, null otherwise
 * @property {boolean} usedBucketFallback
 */

/**
 * @typedef {object} DurationScoreResult
 * @property {number} score
 * @property {DurationBreakdown} breakdown
 */

export const DURATION_DEFAULTS = {
  neutralScore: 0.5,
  minOverlapThreshold: 0.05,
  bucketMatchScore: 0.6,
  bucketPartialScore: 0.3,
}

// ── EMR scoring ──────────────────────────────────────────────────────────────

/**
 * @typedef {object} EMRScorerConfig
 * @property {number} [matchScore]
 * @property {number} [noMatchScore]
 * @property {number} [neutralScore]
 */

export const EMR_DEFAULTS = {
  matchScore: 1.0,
  noMatchScore: 0.0,
  neutralScore: 0.5,
}
