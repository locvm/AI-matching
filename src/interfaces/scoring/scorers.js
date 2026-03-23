// @ts-check

// LOCVM Matching Engine - Scoring Function Contracts (JavaScript / JSDoc version)
//
// Each scorer looks at one thing about how well a physician fits a job. All return a score from 0 to 1
//
// These are type definitions only (contracts). The actual code lives elsewhere and must follow these signatures

/**
 * Scores how close a physician is to the job location
 *
 * Uses a reverse sigmoid on Haversine distance when GPS coords are available,
 * with a multi-tier fallback chain when they are not:
 *
 * Tier 1: GPS coordinates → reverse sigmoid: score(d) = 1 / (1 + exp(k * (d - midpoint)))
 * Tier 2: specificRegions → free-text region matching against job city (0.85 match / 0.15 mismatch)
 * Tier 3: preferredProvinces → province match (0.70 match / 0.20 mismatch)
 * Tier 4: workAddress.province → province match (0.55 match / 0.40 mismatch)
 * Tier 5: medicalProvince → province match (0.50 match / 0.45 mismatch)
 * Tier 6: no data → 0.50 neutral
 *
 * Implementation: src/scoring/location/scoreLocation.js
 *
 * @callback ScoreLocationFn
 * @param {import("../core/models.js").Physician} physician - the clean physician profile
 * @param {import("../core/models.js").GeoCoordinates} jobLocation - the jobs geographic coordinates
 * @param {import("../core/models.js").Address} [jobAddress] - optional full address of the job, used for province/region fallback when physician has no GPS coords
 * @returns {number} score between 0 and 1 where 1 = same spot, 0 = super far
 */

/**
 * Scores how well a physicians availability overlaps with the jobs date range
 *
 * Steps:
 * 1) If physician.availability is empty, return middle score (0.5)
 * 2) For each AvailabilityWindow in physician.availability:
 *    a) Figure out the overlap in days between the window and jobDateRange
 *    b) Track the biggest overlap found across all windows
 * 3) Compute overlapRatio = maxOverlapDays / jobDurationDays
 * 4) Optionally factor in locumDurations bucket alignment as a bonus signal (for example if the job is 2 weeks and the physician prefers "1 day to 2 weeks")
 * 5) Clamp the result to [0, 1]
 *
 * DB stores availability as month/year strings, cleanup layer converts them to proper Dates before they reach this function
 * Partial overlap is allowed and should still produce a positive score
 *
 * Returns a result object with the score and a breakdown indicating which scoring
 * method was used (overlap, bucket, or neutral), the overlap percentage if computed,
 * and whether the bucket fallback path was taken
 *
 * @callback ScoreDurationFn
 * @param {import("../core/models.js").Physician} physician - the clean physician profile
 * @param {{ from: Date, to: Date }} jobDateRange - the jobs start and end dates
 * @returns {import("../../scoring/scoring.config.js").DurationScoreResult}
 */

/**
 * Scores EMR system match between physician and job
 *
 * Steps:
 * 1) If jobEMR is undefined/null, return middle score (0.5). Most jobs dont have this field yet
 * 2) If physicianEMRs is empty, return middle score (0.5). Only 42 out of 410 physicians have EMR data
 * 3) Clean up EMR names (case-insensitive, trim whitespace)
 * 4) If any of the physicians EMR systems exactly matches jobEMR, return 1.0
 * 5) Optionally apply fuzzy matching for close matches (for example "OSCAR" vs "OSCAR Pro")
 * 6) If no match, return 0.0
 *
 * EMR field literally doesnt exist on any job document right now
 * Lower weight than specialty/location in the total score
 * Eve said its a nice feature but not a dealbreaker
 *
 * @callback ScoreEMRFn
 * @param {string[]} physicianEMRs - the physicians known EMR systems
 * @param {string | undefined} jobEMR - the EMR system used at the jobs facility
 * @returns {number} score between 0 and 1
 */

/**
 * Scores how well the jobs province lines up with the physicians preferences
 *
 * Steps:
 * 1) If jobProvince is undefined, return middle score (0.5)
 * 2) If physician.preferredProvinces is empty, return middle score (0.5)
 * 3) If jobProvince is in physician.preferredProvinces, return 1.0
 * 4) If physician.medicalProvince matches jobProvince, return a high score (for example 0.8)
 * 5) Otherwise return 0.0
 *
 * Province data is cleaned to 2-letter codes before this
 * Currently almost everyone is "ON" (Ontario)
 * preferredProvinces had messy variants in raw data, already cleaned up
 *
 * @callback ScoreProvinceFn
 * @param {import("../core/models.js").Physician} physician - the clean physician profile
 * @param {import("../core/models.js").ProvinceCode | undefined} jobProvince - the 2-letter province code where the job is
 * @returns {number} score between 0 and 1
 */

/**
 * Scores speciality match between physician and job
 *
 * Steps:
 * 1) Clean up both strings (lowercase, trim)
 * 2) If physician.medSpeciality exactly matches jobSpeciality, return 1.0
 * 3) Optionally check a speciality chart for related specialities (for example "Emergency Medicine" and "Urgent Care" could be partial matches)
 * 4) If no match, return 0.0
 *
 * Speciality is ALSO used as a hard filter in isEligiblePhysician. This scorer exists so the breakdown includes a speciality category and to support future partial-match cases
 * In v1 this will mostly be yes/no (1.0 or 0.0) since the hard filter already kicks out non-matching specialities
 *
 * @callback ScoreSpecialityFn
 * @param {import("../core/models.js").Physician} physician - the clean physician profile
 * @param {string} jobSpeciality - the required speciality for the job
 * @returns {number} score between 0 and 1
 */

export {}
