// @ts-check

// Stub scorers for the matching harness.
//
// Each function returns a deterministic 0-1 score based on a hash.
// When a real scorer is built, just swap one import here and nothing else changes.
//
// The combine function scales everything to 0-MAX_SCORE for harness test compatibility.

import { SCORING } from '../harness.config.js'
import { scoreLocation } from '../../../src/scoring/location/scoreLocation.js'

/**
 * @typedef {import('./types.js').Physician} Physician
 * @typedef {import('./types.js').LocumJob} LocumJob
 */

// ── Hash utility ─────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash. Same input = same output every time.
 *
 * @param {string} str
 * @returns {number}
 */
function simpleHash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Hash a physician+job pair with a salt to get a deterministic 0-1 float.
 * Different salt = different score for the same pair.
 *
 * @param {string} physicianId
 * @param {string} jobId
 * @param {string} salt
 * @returns {number} 0 to 1
 */
function hashToScore(physicianId, jobId, salt) {
  const hash = simpleHash(`${physicianId}:${jobId}:${salt}`)
  return (hash % 1000) / 1000
}

// ── Stub scorers (each returns 0-1) ─────────────────────────────────────────

/**
 * Real location scorer. Uses 6-tier fallback:
 * GPS distance (reverse sigmoid) → specificRegions → preferredProvinces → workProvince → medicalProvince → no data (0.5)
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {number} 0 to 1
 */
export function stubScoreLocation(physician, job) {
  return scoreLocation(physician, job.location, job.fullAddress)
}

/**
 * Stub duration scorer. Returns hash-based 0-1.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {number} 0 to 1
 */
export function stubScoreDuration(physician, job) {
  return hashToScore(physician._id, job._id, 'duration')
}

/**
 * Stub EMR scorer. Returns hash-based 0-1.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {number} 0 to 1
 */
export function stubScoreEMR(physician, job) {
  return hashToScore(physician._id, job._id, 'emr')
}

/**
 * Stub province scorer. Returns hash-based 0-1.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {number} 0 to 1
 */
export function stubScoreProvince(physician, job) {
  return hashToScore(physician._id, job._id, 'province')
}

/**
 * Stub speciality scorer. Returns hash-based 0-1.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @returns {number} 0 to 1
 */
export function stubScoreSpeciality(physician, job) {
  return hashToScore(physician._id, job._id, 'speciality')
}

// ── Combine ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CategoryScores
 * @property {number} location - 0 to 1
 * @property {number} duration - 0 to 1
 * @property {number} emr - 0 to 1
 * @property {number} province - 0 to 1
 * @property {number} speciality - 0 to 1
 */

/**
 * Takes 5 individual 0-1 scores and produces a combined result.
 *
 * @param {CategoryScores} scores - the 5 individual 0-1 scores
 * @returns {{ score: number, breakdown: import('./types.js').ScoreBreakdown }}
 */
export function stubCombineScores(scores) {
  const { WEIGHTS, MAX_SCORE } = SCORING

  // Scale each 0-1 score to 0-MAX_SCORE for the breakdown
  const location = Math.round(scores.location * MAX_SCORE * 100) / 100
  const duration = Math.round(scores.duration * MAX_SCORE * 100) / 100
  const emr = Math.round(scores.emr * MAX_SCORE * 100) / 100

  // Weighted sum of the scaled values
  const score =
    Math.round((location * WEIGHTS.LOCATION + duration * WEIGHTS.DURATION + emr * WEIGHTS.EMR) * 100) / 100

  return {
    score,
    breakdown: { location, duration, emr },
  }
}
