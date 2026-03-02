// @ts-check

// LOCVM Matching Engine - Orchestration Service Interfaces (JavaScript / JSDoc version)
//
// These define WHEN matching runs happen and HOW results get saved
// The matching engine itself (searchPhysicians) is the building block
// These services call it at the right time and store the outputs
//
// See README §13.5 for the authoritative spec

/**
 * Service that handles immediate matching when a short-term job is posted
 *
 * This is the entry point called when a "job published" event fires for a job that passes the isShortTermJob check
 * In production, a "job published" event will call runForJob(jobId)
 *
 * @typedef {Object} ShortTermMatchService
 *
 * @property {(jobId: string) => Promise<string>} runForJob
 *   Runs a short-term matching run for a specific job
 *
 *   Steps:
 *   1) Load the job by jobId from the data source
 *   2) Make sure the job passes the isShortTermJob check
 *   3) Build a matchingCriteria object from the jobs fields: medProfession, medSpeciality, location, dateRange, emr, province. Set isShortTerm = true
 *   4) Create a new MatchRun record with type "SHORT_TERM", status "PENDING"
 *   5) Update run status to "RUNNING"
 *   6) Load all physicians from the data source
 *   7) Call searchPhysicians(criteria, physicians) to get ranked results
 *   8) Filter results above the configured score threshold
 *   9) Save results via MatchRunResultRepository.saveResults()
 *   10) Create OutboxItem entries (type "SHORT_TERM_MATCH") for each qualifying physician and add them to the queue via NotificationOutboxRepository.enqueue(). Payload should include { jobId, score, jobTitle, ... }
 *   11) Update run status to "COMPLETED" (or "FAILED" if an error happened)
 *   12) Return the runId
 *
 *   Error handling: if any step fails, catch the error, set run status to "FAILED" with the error message, and re-throw
 */

/**
 * Service that handles the weekly (or bi-weekly) digest matching run
 *
 * Called by a scheduler (cron) on a recurring basis
 * In production, a cron job will call runWeekly()
 *
 * @typedef {Object} WeeklyDigestService
 *
 * @property {() => Promise<string>} runWeekly
 *   Runs a weekly digest matching run across all active jobs
 *
 *   Recommended approach is Job-centric (per README §13.3 Option A)
 *
 *   Steps:
 *   1) Create a new MatchRun record with type "WEEKLY_DIGEST", status "PENDING"
 *   2) Update run status to "RUNNING"
 *   3) Load all active, unfilled jobs from the data source. Active = reservation status is "Pending" or "Awaiting Payment" (per README §7.1)
 *   4) Load all physicians from the data source
 *   5) For each job: build matchingCriteria from the jobs fields, call searchPhysicians(criteria, physicians)
 *   6) Combine results per physician: for each physician, collect their top N job matches across all jobs (no duplicate jobIds)
 *   7) Save all results via MatchRunResultRepository.saveResults()
 *   8) For each physician with at least one qualifying match, create a single OutboxItem of type "WEEKLY_DIGEST" with payload containing the list of matching jobs: { matches: [{ jobId, score, jobTitle, ... }] }
 *   9) Add all outbox items to the queue via NotificationOutboxRepository.enqueue()
 *   10) Update run status to "COMPLETED" (or "FAILED" if an error happened)
 *   11) Return the runId
 *
 *   Error handling: if any step fails, catch the error, set run status to "FAILED" with the error message, and re-throw
 */

export {};
