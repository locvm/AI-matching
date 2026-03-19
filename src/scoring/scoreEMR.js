// @ts-check

// EMR Compatibility Scoring (v1)
//
// Rewards physicians whose known EMR system(s) match the job's facility EMR.
//
// Inputs:
//   Job:       facilityInfo.emr?: string          (present in ~44% of jobs)
//   Physician: emrSystems?: string[]              (present in ~10% of physicians)
//              facilityEMR?: string               (present in ~7% of physicians)
//   Derived:   knownEMRs = dedupe(emrSystems + facilityEMR)
//
// Scoring rules:
//   ┌─────────────────────────────────────────────────┬───────┐
//   │ Scenario                                        │ Score │
//   ├─────────────────────────────────────────────────┼───────┤
//   │ Job EMR missing                                 │  0.5  │
//   │ Job EMR exists, physician has a matching EMR    │  1.0  │
//   │ Job EMR exists, physician has EMR but no match  │  0.0  │
//   │ Job EMR exists, physician has no EMR data       │  0.5  │
//   └─────────────────────────────────────────────────┴───────┘
//
// Missing data rationale:
//   ~90% of physicians have no EMR data at all. Penalizing them (0.0) would
//   unfairly tank their overall score. Neutral (0.5) means "we don't know"
//   so they aren't rewarded or punished.
//
// Matching:
//   Case-insensitive, trimmed. "PS Suite" matches "ps suite".
//
// TODO: v2 — add alias mapping so variants like "Avaros" vs "Avaros Inc."
//   or "OSCAR Pro" vs "Oscar" resolve to the same system. Would require a
//   lookup table (e.g. { "avaros inc.": "avaros", "oscar": "oscar pro" }).

/** @typedef {import("../interfaces/core/models.js").Physician} Physician */
/** @typedef {import("../interfaces/core/models.js").LocumJob} LocumJob */
/** @typedef {import("./scoring.config.js").EMRScorerConfig} EMRScorerConfig */

import { EMR_DEFAULTS } from './scoring.config.js'

/**
 * @typedef {'match' | 'no_match' | 'no_job_emr' | 'no_physician_emr'} EMRScoringMethod
 */

/**
 * @typedef {Object} EMRScoreDetail
 * @property {number} score - 0 to 1
 * @property {EMRScoringMethod} method
 * @property {string | null} jobEMR - the job's EMR (normalized), null if missing
 * @property {string[]} physicianEMRs - deduplicated physician EMR list (normalized)
 * @property {boolean} matched - whether any physician EMR matched the job EMR
 */

/**
 * Builds a deduplicated, normalized set of EMR names from the physician's two fields.
 *
 * @param {Physician} physician
 * @returns {Set<string>} lowercased, trimmed EMR names
 */
function getKnownEMRs(physician) {
  /** @type {Set<string>} */
  const emrs = new Set()

  if (Array.isArray(physician.emrSystems)) {
    for (const e of physician.emrSystems) {
      const normalized = (e ?? '').trim().toLowerCase()
      if (normalized) emrs.add(normalized)
    }
  }

  if (physician.facilityEMR) {
    const normalized = physician.facilityEMR.trim().toLowerCase()
    if (normalized) emrs.add(normalized)
  }

  return emrs
}

/**
 * Scores EMR compatibility with full detail breakdown.
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @param {EMRScorerConfig} [config]
 * @returns {EMRScoreDetail}
 */
export function scoreEMRWithDetail(physician, job, config = {}) {
  const opts = { ...EMR_DEFAULTS, ...config }

  const jobEMRRaw = job.facilityInfo?.emr
  const jobEMR = (jobEMRRaw ?? '').trim().toLowerCase() || null

  const knownEMRs = getKnownEMRs(physician)
  const physicianEMRs = [...knownEMRs]

  if (!jobEMR) {
    return {
      score: opts.neutralScore,
      method: 'no_job_emr',
      jobEMR: null,
      physicianEMRs,
      matched: false,
    }
  }

  if (knownEMRs.size === 0) {
    return {
      score: opts.neutralScore,
      method: 'no_physician_emr',
      jobEMR,
      physicianEMRs,
      matched: false,
    }
  }

  const matched = knownEMRs.has(jobEMR)

  return {
    score: matched ? opts.matchScore : opts.noMatchScore,
    method: matched ? 'match' : 'no_match',
    jobEMR,
    physicianEMRs,
    matched,
  }
}

/**
 * Scores EMR compatibility. Returns a number in [0, 1].
 *
 * @param {Physician} physician
 * @param {LocumJob} job
 * @param {EMRScorerConfig} [config]
 * @returns {number} 0 to 1
 */
export function scoreEMR(physician, job, config) {
  return scoreEMRWithDetail(physician, job, config).score
}
