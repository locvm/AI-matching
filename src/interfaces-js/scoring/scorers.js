// @ts-check

// LOCVM Matching Engine - Scoring Function Contracts (JavaScript / JSDoc version)
//
// Each scorer looks at one thing about how well a physician fits a job. All return a score from 0 to 1
//
// These are type definitions only (contracts). The actual code lives elsewhere and must follow these signatures

/** @typedef {import("../core/models.js").Physician} Physician */
/** @typedef {import("../core/models.js").GeoCoordinates} GeoCoordinates */
/** @typedef {import("../core/models.js").ProvinceCode} ProvinceCode */

/**
 * Scores how close a physician is to the job location
 *
 * Steps:
 * 1) If physician.location is null, return middle score (0.5). 43% of physicians have no location data so dont penalize them
 * 2) Calculate the distance between physician.location and jobLocation using the Haversine formula (great-circle distance)
 * 3) Apply a distance drop-off function (Gaussian or inverse-linear, up to you):
 *    - 1.0 when distance is 0 km
 *    - ~0.5 at a midpoint you can set (for example 100 km)
 *    - goes toward 0 as distance grows
 * 4) Clamp the result to [0, 1]
 *
 * No hard travel radius in v1, use smooth drop-off instead of cutoffs
 * Eves current algo uses lat/lng distance scoring for those who have it
 *
 * @callback ScoreLocationFn
 * @param {Physician} physician - the clean physician profile
 * @param {GeoCoordinates} jobLocation - the jobs geographic coordinates
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
 * @callback ScoreDurationFn
 * @param {Physician} physician - the clean physician profile
 * @param {{ from: Date, to: Date }} jobDateRange - the jobs start and end dates
 * @returns {number} score between 0 and 1 where 1 = full date-range coverage
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
 * @param {Physician} physician - the clean physician profile
 * @param {ProvinceCode | undefined} jobProvince - the 2-letter province code where the job is
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
 * @param {Physician} physician - the clean physician profile
 * @param {string} jobSpeciality - the required speciality for the job
 * @returns {number} score between 0 and 1
 */

export {};
