// @ts-check

// LOCVM Matching Engine - Matching Data Shapes (JavaScript / JSDoc version)
//
// Just the input and output shapes for the matching pipeline, plus the core search function contract

/** @typedef {import("../core/models.js").GeoCoordinates} GeoCoordinates */
/** @typedef {import("../core/models.js").Physician} Physician */

/**
 * The input to a matching search
 *
 * Basically: "what are we looking for?" Usually built from a job posting, but could also be for one-off queries not tied to a specific job (like the weekly digest run)
 * Doesnt know or care where the data comes from
 *
 * @typedef {Object} matchingCriteria
 * @property {string} [jobId] - The job this search is for. Optional for bulk runs
 * @property {string} medProfession - Required profession to match, like "Physician"
 * @property {string} medSpeciality - Required specialty, like "Family Medicine"
 * @property {GeoCoordinates} location - The jobs location. Used for distance scoring
 * @property {string} [province] - Province where the job is. Cleaned to 2 letter code
 * @property {{ from: Date, to: Date }} dateRange - Date range the job needs to be filled
 * @property {string} [emr] - EMR system at the facility. Optional, most jobs dont have this yet
 * @property {boolean} [isShortTerm] - Whether this is a short-term gig
 * @property {number} [threshold] - Minimum total score to be included in results
 * @property {number} [limit] - Max results to return. Sorted by score desc, capped here
 */

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
 * The core matching function. Takes search criteria and a pool of physicians, returns ranked results
 *
 * This is THE main function of the matching engine. Everything else feeds into this
 *
 * Steps:
 * 1) Filter the physician pool using isEligiblePhysician (hard filters): medProfession must match, medSpeciality must match, isLookingForLocums must be true
 * 2) For each physician that passed, score them on each category:
 *    - scoreLocation(physician, criteria.location)
 *    - scoreDuration(physician, criteria.dateRange)
 *    - scoreEMR(physician.emrSystems, criteria.emr)
 *    - scoreProvince(physician, criteria.province)
 *    - scoreSpeciality(physician, criteria.medSpeciality)
 * 3) Combine all category scores into one total score using weights you can change. Weights should NOT be hardcoded (README §9)
 * 4) Build a SearchResult for each physician with the total score and breakdown
 * 5) Filter out results below criteria.threshold (if set)
 * 6) Sort results by score descending
 * 7) Cap results at criteria.limit (if set)
 * 8) Return the final SearchResult[]
 *
 * @callback SearchPhysiciansFn
 * @param {matchingCriteria} criteria - what to search for (built from a job posting or one-off query)
 * @param {Physician[]} physicians - the pool of physicians to match against
 * @returns {Promise<SearchResult[]>} Promise resolving to an array of ranked search results
 */

export {};
