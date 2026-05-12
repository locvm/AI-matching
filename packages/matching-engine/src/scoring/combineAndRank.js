// @ts-check

// Stage 3: Combine + Rank
//
// Takes scored pairs (each with per-category 0-1 scores) and produces
// ranked SearchResults with a total 0-5 score.
//
// Missing categories are handled by re-normalizing weights across
// available categories, so physicians with incomplete data aren't penalized.

import { WEIGHTS, CATEGORIES } from '../config/scoringConfig.js'

/** @typedef {import('@locvm/types').ScoredPair} ScoredPair */
/** @typedef {import('@locvm/types').SearchResult} SearchResult */
/** @typedef {import('@locvm/types').SearchOptions} SearchOptions */
/** @typedef {import('@locvm/types').ScoreBreakdown} ScoreBreakdown */

/**
 * Round to 2 decimal places.
 * @param {number} n
 * @returns {number}
 */
function round2(n) {
  return Math.round(n * 100) / 100
}

/**
 * Compute the weighted score for a single pair with re-normalization for missing categories.
 *
 * Returns totalScore in [0, 5] and a breakdown carrying each category's raw 0-1
 * score plus any `<category>Detail` blob the scorer produced.
 *
 * @param {ScoreBreakdown} breakdown - per-category 0-1 scores (undefined = not scored)
 * @returns {{ totalScore: number, breakdown: ScoreBreakdown }}
 */
export function computeWeightedScore(breakdown) {
  let weightSum = 0
  let weightedSum = 0
  /** @type {ScoreBreakdown} */
  const outBreakdown = {}

  for (const category of CATEGORIES) {
    const score = breakdown[category]
    if (score === undefined || score === null) continue

    weightSum += WEIGHTS[category]
    weightedSum += score * WEIGHTS[category]
    outBreakdown[category] = round2(score)
  }

  if (weightSum === 0) {
    return { totalScore: 0, breakdown: {} }
  }

  copyScorerDetails(breakdown, outBreakdown)

  // Re-normalize by the *available* weight sum (not 1.0) so missing categories
  // don't drag the score down — their weight is redistributed proportionally.
  // Final score is scaled to the 0-5 product range.
  const totalScore = Math.min(5, Math.max(0, round2((weightedSum / weightSum) * 5)))

  return { totalScore, breakdown: outBreakdown }
}

/**
 * Carry over the `*Detail` blobs from input to output untouched. These are
 * informational only (no math) — they're preserved so the UI and analytics
 * can explain *why* each category scored what it did.
 *
 * @param {ScoreBreakdown} from
 * @param {ScoreBreakdown} to
 */
function copyScorerDetails(from, to) {
  if (from.locationDetail) to.locationDetail = from.locationDetail
  if (from.durationDetail) to.durationDetail = from.durationDetail
  if (from.emrDetail) to.emrDetail = from.emrDetail
}

/**
 * Combine scored pairs into ranked search results.
 *
 * Steps:
 * 1. Compute weighted score per pair (re-normalizing for missing categories)
 * 2. Filter by threshold (if provided)
 * 3. Sort descending by totalScore
 * 4. Cap at limit (if provided)
 *
 * @param {ScoredPair[]} scoredPairs - raw scored pairs from Stage 2
 * @param {SearchOptions} [options] - threshold, limit
 * @returns {SearchResult[]} ranked, filtered, capped results
 */
export function combineAndRank(scoredPairs, options = {}) {
  const { threshold, limit } = options

  // 1. Compute scores
  /** @type {SearchResult[]} */
  let results = scoredPairs.map((pair) => {
    const { totalScore, breakdown } = computeWeightedScore(pair.breakdown)
    return {
      physicianId: pair.physicianId,
      jobId: pair.jobId,
      score: totalScore,
      breakdown,
      flags: pair.flags,
    }
  })

  // 2. Filter by threshold
  if (threshold !== undefined && threshold !== null) {
    results = results.filter((r) => r.score >= threshold)
  }

  // 3. Sort descending
  results.sort((a, b) => b.score - a.score)

  // 4. Cap at limit
  if (limit !== undefined && limit !== null && limit >= 0) {
    results = results.slice(0, limit)
  }

  return results
}
