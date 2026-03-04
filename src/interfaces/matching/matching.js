// @ts-check

// LOCVM Matching Engine - Matching Data Shapes (JavaScript / JSDoc version)
//
// The function takes the core models directly (LocumJob, Physician[], Reservation)
// and handles all filtering, extraction, and scoring internally
//
// SearchResult = what comes back

/**
 * Per-category score breakdown. Each field is the score for that category.
 * undefined = that category wasnt scored (different from 0)
 *
 * @typedef {Object} ScoreBreakdown
 * @property {number} [location]
 * @property {number} [duration]
 * @property {number} [emr]
 * @property {number} [speciality]
 * @property {number} [province]
 */

/**
 * Per-category score breakdown. Each field is the score for that category.
 * undefined = that category wasnt scored (different from 0)
 *
 * @typedef {Object} ScoreBreakdown
 * @property {number} [location]
 * @property {number} [duration]
 * @property {number} [emr]
 * @property {number} [speciality]
 * @property {number} [province]
 */

/**
 * A single physician match result
 *
 * Has the total score AND a per-category breakdown so the platform can show WHY someone was matched, not just the final number
 *
 * @typedef {Object} SearchResult
 * @property {string} physicianId - Matched physicians ID
 * @property {string} jobId - The job that was matched against
 * @property {number} score - Total match score, 0-1 range. Higher = better
 * @property {ScoreBreakdown} breakdown - Score breakdown by category
 * @property {string[]} [flags] - Data quality flags, e.g. "missing_physician_location", "missing_emr_data"
<<<<<<< HEAD
=======
 */

/**
 * Bundled search input: job + optional reservation + options
 *
 * @typedef {Object} SearchCriteria
 * @property {LocumJob} job
 * @property {Reservation} [reservation]
 * @property {{ onlyLookingForLocums?: boolean }} [options]
 */

/**
 * Interface for the matching engine (stub or real)
 *
 * @typedef {{ searchPhysicians(criteria: SearchCriteria, physicians: Physician[]): Promise<SearchResult[]> }} MatchingEngine
>>>>>>> 00e3701 (Unify harness types with interfaces and rename User to Physician)
 */

/**
 * Optional config for the search function
 *
 * @typedef {Object} SearchOptions
 * @property {number} [threshold] - Minimum total score to be included in results
 * @property {number} [limit] - Max results to return
 * @property {boolean} [isShortTerm] - Whether this is a short-term gig
 */

// ─── Stage 2: Score One Pair ─────────────────────────────────────────────────

/**
 * In-memory intermediate result from scoring a single physician-job pair
 *
 * Contains the 5 individual category scores (each 0-1) and data quality flags
 * NO total score yet — that happens in Stage 3 (combineAndRank)
 *
<<<<<<< HEAD
 * This is never stored in the database. It lives only during pipeline execution
=======
 * The function is responsible for:
 * - Extracting the fields it needs from the LocumJob (medProfession, medSpeciality, location, dateRange, province, emr)
 * - Filtering the physician pool (hard filters: medProfession must match, medSpeciality must match, isLookingForLocums must be true)
 * - Scoring each eligible physician on each category:
 *    - scoreLocation(physician, job.location, job.fullAddress)
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
>>>>>>> 00e3701 (Unify harness types with interfaces and rename User to Physician)
 *
 * @typedef {Object} ScoredPair
 * @property {string} physicianId
 * @property {string} jobId
 * @property {ScoreBreakdown} breakdown - 5 individual 0-1 scores (location, duration, emr, province, speciality)
 * @property {string[]} flags - Data quality flags, e.g. "missing_physician_location", "missing_emr_data"
 */

/**
 * Scores a single physician-job pair across all 5 categories
 *
 * Calls all 5 scorers internally:
 *   scoreLocation(physician, job.location, job.fullAddress)  → 0 to 1
 *   scoreDuration(physician, job.dateRange)                  → 0 to 1
 *   scoreEMR(physician.emrSystems, job.emr)                 → 0 to 1
 *   scoreProvince(physician, job.fullAddress.province)       → 0 to 1
 *   scoreSpeciality(physician, job.medSpeciality)            → 0 to 1
 *
 * Collects data quality flags for any missing data (e.g. no location, no EMR)
 * Does NOT apply weights or compute a total score — that's combineAndRank's job
 *
 * @callback ScoreMatchFn
 * @param {import("../core/models.js").Physician} physician - the physician to score
 * @param {import("../core/models.js").LocumJob} job - the job to score against
 * @returns {ScoredPair} the raw category scores and flags for this pair
 */

// ─── Stage 3: Combine + Rank ─────────────────────────────────────────────────

/**
 * Applies weights to scored pairs, computes total scores, filters, sorts, and caps
 *
 * Steps:
 * 1) For each ScoredPair, apply configurable weights to each breakdown category → total score (0-1)
 * 2) Build a SearchResult with the total score, breakdown, and flags
 * 3) Filter out results below options.threshold (if provided)
 * 4) Sort by score descending
 * 5) Cap at options.limit (if provided)
 * 6) Return SearchResult[]
 *
 * @callback CombineAndRankFn
 * @param {ScoredPair[]} scoredPairs - raw scored pairs from Stage 2
 * @param {SearchOptions} [options] - threshold, limit
 * @returns {SearchResult[]} ranked, filtered, capped results
 */

// ─── Top Level Orchestrators ─────────────────────────────────────────────────

/**
 * Job-centric orchestrator: "A new job was posted, find matching physicians"
 *
 * Runs the full pipeline: filter → score each pair → combine+rank → return
 *
 * Steps:
 * 1) Call filterPhysiciansForJob(job, physicians, reservation) → eligible physicians
 * 2) For each eligible physician, call scoreMatch(physician, job) → ScoredPair
 * 3) Call combineAndRank(scoredPairs, options) → SearchResult[]
 * 4) Return SearchResult[]
 *
 * @callback ScoreJobFn
 * @param {import("../core/models.js").LocumJob} job - the job to find physicians for
 * @param {import("../core/models.js").Physician[]} physicians - the full pool of physicians
 * @param {import("../core/models.js").Reservation} [reservation] - optional reservation for scheduling conflict checks
 * @param {SearchOptions} [options] - threshold, limit
 * @returns {Promise<SearchResult[]>} ranked physician matches for this job
 */

/**
 * Physician-centric orchestrator: "A new physician signed up, find matching jobs"
 *
 * Runs the full pipeline: filter → score each pair → combine+rank → return
 *
 * Steps:
 * 1) Call filterJobsForPhysician(physician, jobs, reservations) → eligible jobs
 * 2) For each eligible job, call scoreMatch(physician, job) → ScoredPair
 * 3) Call combineAndRank(scoredPairs, options) → SearchResult[]
 * 4) Return SearchResult[]
 *
 * @callback ScorePhysicianFn
 * @param {import("../core/models.js").Physician} physician - the physician to find jobs for
 * @param {import("../core/models.js").LocumJob[]} jobs - the full pool of active jobs
 * @param {import("../core/models.js").Reservation[]} [reservations] - optional array of reservations (matched by locumJobId)
 * @param {SearchOptions} [options] - threshold, limit
 * @returns {Promise<SearchResult[]>} ranked job matches for this physician
 */

export {}
