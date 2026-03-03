// @ts-check

// LOCVM Matching Engine - Matching Data Shapes (JavaScript / JSDoc version)
//
// The function takes the core models directly (LocumJob, Physician[], Reservation)
// and handles all filtering, extraction, and scoring internally
//
// SearchResult = what comes back

/** @typedef {import("../core/models.js").LocumJob} LocumJob */
/** @typedef {import("../core/models.js").Physician} Physician */
/** @typedef {import("../core/models.js").Reservation} Reservation */

/**
 * A single physician match result
 *
 * Has the total score AND a per-category breakdown so the platform can show WHY someone was matched, not just the final number
 *
 * @typedef {Object} SearchResult
 * @property {string} physicianId - Matched physicians ID
 * @property {number} score - Total match score, 0-1 range. Higher = better
 * @property {Object} breakdown - Score breakdown by category. undefined = that category wasnt scored (different from 0). May contain extra categories beyond the named ones
 * @property {number} [breakdown.location]
 * @property {number} [breakdown.duration]
 * @property {number} [breakdown.emr]
 * @property {number} [breakdown.speciality]
 * @property {number} [breakdown.province]
 */

/**
 * Optional config for the search function
 *
 * @typedef {Object} SearchOptions
 * @property {number} [threshold] - Minimum total score to be included in results
 * @property {number} [limit] - Max results to return
 * @property {boolean} [isShortTerm] - Whether this is a short-term gig
 */

/**
 * The core matching function. Takes a job, the full physician pool, and an optional reservation, then returns ranked results
 *
 * This is THE main function of the matching engine. Everything else feeds into this
 *
 * The function is responsible for:
 * - Extracting the fields it needs from the LocumJob (medProfession, medSpeciality, location, dateRange, province, emr)
 * - Filtering the physician pool (hard filters: medProfession must match, medSpeciality must match, isLookingForLocums must be true)
 * - Scoring each eligible physician on each category:
 *    - scoreLocation(physician, job.location)
 *    - scoreDuration(physician, job.dateRange)
 *    - scoreEMR(physician.emrSystems, job.emr)
 *    - scoreProvince(physician, job.fullAddress.province)
 *    - scoreSpeciality(physician, job.medSpeciality)
 * - Combining all category scores into one total score using configurable weights (NOT hardcoded, see README §9)
 * - Building a SearchResult for each physician with the total score and breakdown
 * - Filtering out results below the threshold (if provided via options)
 * - Sorting results by score descending
 * - Capping results at the limit (if provided via options)
 * - Returning the final SearchResult[]
 *
 * @callback SearchPhysiciansFn
 * @param {LocumJob} job - the locum job to match physicians against
 * @param {Physician[]} physicians - the full pool of physicians to match against
 * @param {Reservation} [reservation] - optional reservation tied to this job (for scheduling conflict checks)
 * @param {SearchOptions} [options] - optional config like threshold and limit
 * @returns {Promise<SearchResult[]>} Promise resolving to an array of ranked search results
 */

export {};
