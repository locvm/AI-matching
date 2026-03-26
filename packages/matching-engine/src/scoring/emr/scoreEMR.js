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
//   Case-insensitive, trimmed, canonicalized. "Avaros Inc." and "Avaros EMR"
//   both resolve to "avaros" via a static alias table, so they match.
//   Unknown names fall through unchanged — exact match still works for anything
//   not in the table.

/** @typedef {import("@locvm/types").Physician} Physician */
/** @typedef {import("@locvm/types").LocumJob} LocumJob */
/** @typedef {import("../scoring.config.js").EMRScorerConfig} EMRScorerConfig */

import { EMR_DEFAULTS } from '../scoring.config.js'

/** @param {number} n */
const clamp01 = (n) => Math.max(0, Math.min(1, n))

// Maps every known variant (lowercased) to a single canonical name.
// Unknown values fall through via the ?? fallback in canonicalize().
const EMR_ALIASES = /** @type {Record<string, string>} */ ({
  'avaros emr': 'avaros',
  'avaros inc.': 'avaros',
  'avaros inc': 'avaros',
  avaros: 'avaros',
  'ps suite emr': 'ps suite',
  'ps suite': 'ps suite',
  'oscar mcmaster - professional edition (oscar pro)': 'oscar pro',
  'oscar pro': 'oscar pro',
  oscar: 'oscar pro',
  'accuro emr': 'accuro',
  accuro: 'accuro',
  'juno emr': 'juno',
  juno: 'juno',
  'med access emr': 'med access',
  'med access': 'med access',
  'collaborative health record (chr)': 'chr',
  chr: 'chr',
  medesync: 'medesync',
  cerner: 'cerner',
  cerebrum: 'cerebrum',
  wolfe: 'wolfe',
  other: 'other',
})

/**
 * Normalizes an EMR name to its canonical form.
 * Trims, lowercases, then looks up in the alias table.
 * Unknown names pass through unchanged so exact matching still works.
 *
 * @param {string} name
 * @returns {string}
 */
function canonicalize(name) {
  const key = name.trim().toLowerCase()
  return EMR_ALIASES[key] ?? key
}

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
 * Builds a deduplicated, canonicalized set of EMR names from the physician's two fields.
 *
 * @param {Physician} physician
 * @returns {Set<string>} canonical EMR names
 */
function getKnownEMRs(physician) {
  /** @type {Set<string>} */
  const emrs = new Set()

  if (Array.isArray(physician.emrSystems)) {
    for (const e of physician.emrSystems) {
      const canonical = canonicalize(e ?? '')
      if (canonical) emrs.add(canonical)
    }
  }

  if (physician.facilityEMR) {
    const canonical = canonicalize(physician.facilityEMR)
    if (canonical) emrs.add(canonical)
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
  const jobEMR = jobEMRRaw?.trim() ? canonicalize(jobEMRRaw) : null

  const knownEMRs = getKnownEMRs(physician)
  const physicianEMRs = [...knownEMRs]

  if (!jobEMR) {
    return {
      score: clamp01(opts.neutralScore),
      method: 'no_job_emr',
      jobEMR: null,
      physicianEMRs,
      matched: false,
    }
  }

  if (knownEMRs.size === 0) {
    return {
      score: clamp01(opts.neutralScore),
      method: 'no_physician_emr',
      jobEMR,
      physicianEMRs,
      matched: false,
    }
  }

  const matched = knownEMRs.has(jobEMR)

  return {
    score: clamp01(matched ? opts.matchScore : opts.noMatchScore),
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
