// @ts-check

// LOCVM Matching Engine - Filter Function Contracts (JavaScript / JSDoc version)
//
// Hard filters and checks that decide if a physician even qualifies before any scoring happens

/** @typedef {import("../core/models.js").Physician} Physician */
/** @typedef {import("../core/models.js").LocumJob} LocumJob */
/** @typedef {import("../core/models.js").Reservation} Reservation */

/**
 * Options the caller can pass to control filter behavior.
 * Aligns with the SearchCriteria contract from the ClickUp spec.
 *
 * @typedef {Object} SearchCriteria
 * @property {LocumJob} [job] - the job (also passed as a direct arg for convenience)
 * @property {Reservation} [reservation] - the reservation (also passed as a direct arg)
 * @property {{ onlyLookingForLocums?: boolean }} [options] - toggles for individual filters
 */

/**
 * Checks whether a single physician passes all hard filters for a given job (private helper)
 *
 * This is an internal function, not exported. It receives pre-computed values
 * (applicantIds Set, onlyLooking boolean) so the batch wrapper only does that
 * work once for the whole list instead of per physician.
 *
 * Steps:
 * 1) Check medProfession: physician.medProfession must match job.medProfession (exact). If not, return false
 * 2) Check medSpeciality: physician.medSpeciality must match job.medSpeciality (case-insensitive, trimmed). If not, return false
 * 3) Check isLookingForLocums: if onlyLooking is true and physician is not looking, return false. (Missing values default to true)
 * 4) Check applicants: if physician is already in the applicantIds Set, return false
 * 5) Check duration: physician's locumDurations must overlap with the job's duration bucket. If not, return false
 * 6) Check province: physician's preferredProvinces must include the job's province. If not, return false
 * 7) Return true if all checks pass
 *
 * The isLookingForLocums check can be toggled off via criteria.options.onlyLookingForLocums (per README §7.1)
 *
 * @callback IsEligiblePhysicianFn
 * @param {Physician} physician - the clean physician profile
 * @param {LocumJob} job - the locum job to match against
 * @param {Set<string>} applicantIds - pre-built Set of user IDs who already applied
 * @param {boolean} onlyLooking - whether to enforce the isLookingForLocums check
 * @returns {boolean} true if the physician should be scored, false if excluded
 */

/**
 * Checks whether a job counts as "short-term" so it triggers immediate notifications
 *
 * This is a check you can change the rules on (README §13.2). The definition of "short-term" is owned by product/CTO and may change so make the thresholds something you can change, not hardcoded
 *
 * Steps:
 * 1) Calculate job duration in days from job.dateRange.from to job.dateRange.to
 * 2) If duration is below a threshold you can set (for example 14 days), return true
 * 3) Optionally check job.schedule for "on-call" or "short notice" keywords
 * 4) Optionally check if job start date is within X days from now
 * 5) Return false if none of the short-term rules are met
 *
 * When this returns true, ShortTermMatchService.runForJob() gets triggered
 * The exact thresholds should come from a config object, not hardcoded values
 *
 * @callback IsShortTermJobFn
 * @param {LocumJob} job - the clean locum job
 * @returns {boolean} true if the job should trigger an immediate short-term matching run
 */

/**
 * Filters the full physician pool down to only those eligible for a given job
 *
 * This is the job-centric entry to Stage 1 of the pipeline (batch API).
 * Builds a Set of applicant IDs from the reservation once, derives onlyLooking
 * from criteria, then loops all physicians through isEligiblePhysician.
 *
 * @callback FilterPhysiciansForJobFn
 * @param {Physician[]} physicians - the full pool of physicians
 * @param {LocumJob} job - the job to filter physicians against
 * @param {Reservation} [reservation] - optional reservation (used to build applicant ID set)
 * @param {SearchCriteria} [criteria] - optional search criteria with filter toggles
 * @returns {Physician[]} only the physicians that pass all hard filters
 */

/**
 * Filters the full job pool down to only those a given physician qualifies for
 *
 * This is the physician-centric entry to Stage 1 of the pipeline
 * Loops all jobs, calls IsEligiblePhysicianFn (with args flipped) on each, returns only those that pass
 *
 * @callback FilterJobsForPhysicianFn
 * @param {Physician} physician - the physician to filter jobs for
 * @param {LocumJob[]} jobs - the full pool of active jobs
 * @param {Reservation[]} [reservations] - optional array of reservations (one per job, matched by locumJobId)
 * @returns {LocumJob[]} only the jobs this physician qualifies for
 */

// FUTURE FILTERS (not implemented yet, per Eve's feedback March 2026)
//
// These are gates that will eventually go inside IsEligiblePhysicianFn.
// Right now they are all OFF so every doctor can see matches.
// Turn them on one at a time as the platform matures.
//
// 1. CPSOProof.status
//    When subscriptions launch, require CPSOProof.status === "Confirmed" before matching.
//    Physicians with "Pending" or "Rejected" would be excluded from results.
//    Field lives in UserSchema but is currently in the "intentionally omitted" list in models.js.
//    To enable: add CPSOProof to Physician type, add check in IsEligiblePhysicianFn step 3.5.
//
// 2. isProfileComplete
//    Skip physicians whose profile is not complete.
//    Already on the Physician type, just not checked anywhere.
//    To enable: add check in IsEligiblePhysicianFn after isLookingForLocums.
//
// 3. isOnboardingCompleted
//    Skip physicians who havent finished onboarding.
//    Already on the Physician type, just not checked anywhere.
//    Eve said this is the most likely first candidate to become a real filter.
//    To enable: add check in IsEligiblePhysicianFn after isLookingForLocums.
//
// 4. Email verification
//    Eve is building email verification. Once live, add as another gate.
//    Field does not exist yet in the schema. Will need to be added to Physician type first.
//    To enable: add field to models.js, add check in IsEligiblePhysicianFn.

export {};
