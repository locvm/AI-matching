// @ts-check

// Stage 3: Combine + Rank
//
// Takes scored pairs (each with per-category 0-1 scores) and produces
// ranked SearchResults with a total 0-1 score (directly usable as a percentage).
//
// Missing categories are handled by re-normalizing weights across
// available categories, so physicians with incomplete data aren't penalized.

import { WEIGHTS, CATEGORIES } from '../config/scoringConfig.js'

/** @typedef {import('../interfaces/matching/matching.js').ScoredPair} ScoredPair */
/** @typedef {import('../interfaces/matching/matching.js').SearchResult} SearchResult */
/** @typedef {import('../interfaces/matching/matching.js').SearchOptions} SearchOptions */
/** @typedef {import('../interfaces/matching/matching.js').ScoreBreakdown} ScoreBreakdown */

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
 * Returns totalScore in [0, 1] and breakdown with each category's raw 0-1 score.
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

    const weight = WEIGHTS[category]
    weightSum += weight
    weightedSum += score * weight
    outBreakdown[category] = round2(score)
  }

  if (weightSum === 0) {
    return { totalScore: 0, breakdown: {} }
  }

  // Re-normalize: divide by the sum of available weights (not 1.0)
  // This redistributes missing categories' weights proportionally
  const totalScore = Math.min(1, Math.max(0, round2(weightedSum / weightSum)))

  return { totalScore, breakdown: outBreakdown }
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
