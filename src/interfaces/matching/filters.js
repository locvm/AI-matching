// @ts-check

// LOCVM Matching Engine - Filter Function Contracts (JavaScript / JSDoc version)
//
// Hard filters and checks that decide if a physician even qualifies before any scoring happens

/**
 * Checks whether a physician passes all hard filters and should be scored
 *
 * This is the first gate in the pipeline. Only physicians passing this function move on to scoring
 *
 * Steps:
 * 1) Check medProfession: physician.medProfession must match job.medProfession (case-insensitive). If not, return false
 * 2) Check medSpeciality: physician.medSpeciality must match job.medSpeciality (case-insensitive). If not, return false
 * 3) Check isLookingForLocums: if false, return false. (Missing values are cleaned to true before this so its always a boolean)
 * 4) Optionally check for scheduling conflicts: if the physician has an active reservation whose dates overlap with job.dateRange, return false
 * 5) Return true if all checks pass
 *
 * The isLookingForLocums check should be something you can turn on/off in case we want to match non-looking physicians in the future (per README §7.1)
 *
 * @callback IsEligiblePhysicianFn
 * @param {import("../core/models.js").Physician} physician - the clean physician profile
 * @param {import("../core/models.js").LocumJob} job - the locum job to match against
 * @param {import("../core/models.js").Reservation} [reservation] - optional reservation for scheduling conflict checks
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
 * @param {import("../core/models.js").LocumJob} job - the clean locum job
 * @returns {boolean} true if the job should trigger an immediate short-term matching run
 */

/**
 * Filters the full physician pool down to only those eligible for a given job
 *
 * This is the job-centric entry to Stage 1 of the pipeline
 * Loops all physicians, calls IsEligiblePhysicianFn on each, returns only those that pass
 *
 * @callback FilterPhysiciansForJobFn
 * @param {import("../core/models.js").LocumJob} job - the job to filter physicians against
 * @param {import("../core/models.js").Physician[]} physicians - the full pool of physicians
 * @param {import("../core/models.js").Reservation} [reservation] - optional reservation for scheduling conflict checks
 * @returns {import("../core/models.js").Physician[]} only the physicians that pass all hard filters
 */

/**
 * Filters the full job pool down to only those a given physician qualifies for
 *
 * This is the physician-centric entry to Stage 1 of the pipeline
 * Loops all jobs, calls IsEligiblePhysicianFn (with args flipped) on each, returns only those that pass
 *
 * @callback FilterJobsForPhysicianFn
 * @param {import("../core/models.js").Physician} physician - the physician to filter jobs for
 * @param {import("../core/models.js").LocumJob[]} jobs - the full pool of active jobs
 * @param {import("../core/models.js").Reservation[]} [reservations] - optional array of reservations (one per job, matched by locumJobId)
 * @returns {import("../core/models.js").LocumJob[]} only the jobs this physician qualifies for
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

export {}
