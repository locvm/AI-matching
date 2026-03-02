// @ts-check

// LOCVM Matching Engine - Filter Function Contracts (JavaScript / JSDoc version)
//
// Hard filters and checks that decide if a physician even qualifies before any scoring happens

/** @typedef {import("../core/models.js").Physician} Physician */
/** @typedef {import("../core/models.js").LocumJob} LocumJob */
/** @typedef {import("./matching.js").matchingCriteria} matchingCriteria */

/**
 * Checks whether a physician passes all hard filters and should be scored
 *
 * This is the first gate in the pipeline. Only physicians passing this function move on to scoring
 *
 * Steps:
 * 1) Check medProfession: physician.medProfession must match criteria.medProfession (case-insensitive). If not, return false
 * 2) Check medSpeciality: physician.medSpeciality must match criteria.medSpeciality (case-insensitive). If not, return false
 * 3) Check isLookingForLocums: if false, return false. (Missing values are cleaned to true before this so its always a boolean)
 * 4) Optionally check for scheduling conflicts: if the physician has an active reservation whose dates overlap with criteria.dateRange, return false
 * 5) Return true if all checks pass
 *
 * The isLookingForLocums check should be something you can turn on/off in case we want to match non-looking physicians in the future (per README §7.1)
 *
 * @callback IsEligiblePhysicianFn
 * @param {Physician} physician - the clean physician profile
 * @param {matchingCriteria} criteria - the search criteria
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

export {};
