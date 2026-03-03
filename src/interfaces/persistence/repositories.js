// @ts-check

// LOCVM Matching Engine - Repository Interfaces (JavaScript / JSDoc version)
//
// These dont care what storage you use, could be JSON files (dev/testing) or MongoDB (production)
// See README §13.5 for the authoritative spec

/** @typedef {import("./records.js").MatchRun} MatchRun */
/** @typedef {import("./records.js").MatchRunResult} MatchRunResult */
/** @typedef {import("./records.js").OutboxItem} OutboxItem */

/**
 * Repository for managing match run records
 *
 * A match run = one time the matching engine ran, either triggered by a new job (SHORT_TERM) or by the weekly scheduler (WEEKLY_DIGEST)
 *
 * @typedef {Object} MatchRunRepository
 *
 * @property {(run: MatchRun) => Promise<void>} createRun
 *   Saves a new match run record
 *
 *   Steps:
 *   1) Make sure run.id is unique (no duplicate runs)
 *   2) Set run.status to "PENDING" if not already set
 *   3) Set run.createdAt to now if not already set
 *   4) Write the record to storage
 *
 * @property {(runId: string, status: MatchRun["status"], error?: string) => Promise<void>} updateRunStatus
 *   Updates the status and timestamps of an existing run
 *
 *   Steps:
 *   1) Find the run by runId. Throw if not found
 *   2) Update run.status to the new status
 *   3) If status is "RUNNING", set run.startedAt to now
 *   4) If status is "COMPLETED" or "FAILED", set run.completedAt to now
 *   5) If status is "FAILED" and an error message is provided, set run.error
 *   6) Save the update
 *
 * @property {(type?: MatchRun["type"]) => Promise<MatchRun[]>} getPendingRuns
 *   Gets all runs in PENDING status, optionally filtered by type
 *
 *   Steps:
 *   1) Query storage for runs where status is "PENDING"
 *   2) If type is provided, filter to only that run type
 *   3) Return results ordered by createdAt ascending (oldest first)
 */

/**
 * Repository for storing and getting match result rows
 *
 * Each result ties a physician + score + breakdown to a specific run
 *
 * @typedef {Object} MatchRunResultRepository
 *
 * @property {(runId: string, results: MatchRunResult[]) => Promise<void>} saveResults
 *   Saves a bunch of match results for a given run
 *
 *   Steps:
 *   1) Make sure the runId exists in the match_run table
 *   2) Write all result rows to storage in one go
 *   3) Update the parent runs resultCount field
 *
 * @property {(runId: string) => Promise<MatchRunResult[]>} getResults
 *   Gets all results for a given run, ordered by score descending
 *
 *   Steps:
 *   1) Query storage for all results where runId matches
 *   2) Sort by score descending (highest first)
 *   3) Return the array
 */

/**
 * Repository for the notification outbox (passes notifications to the communications module)
 *
 * Outbox pattern: matching engine writes notifications here, a separate process picks them up and sends emails/push/in-app
 *
 * @typedef {Object} NotificationOutboxRepository
 *
 * @property {(items: OutboxItem[]) => Promise<void>} enqueue
 *   Adds one or more outbox items to the queue for sending later
 *
 *   Steps:
 *   1) For each item, ensure id is set and unique
 *   2) Set createdAt to now if not already set
 *   3) Set attempts to 0 if not already set
 *   4) Write all items to storage in one go
 *
 * @property {(type?: OutboxItem["type"]) => Promise<OutboxItem[]>} getPending
 *   Gets all unsent outbox items, optionally filtered by type
 *
 *   Steps:
 *   1) Query storage for items where sentAt is null/undefined
 *   2) If type is provided, filter to that notification type
 *   3) Return results ordered by createdAt ascending
 *
 * @property {(outboxId: string) => Promise<void>} markSent
 *   Marks an outbox item as sent
 *
 *   Steps:
 *   1) Find the item by outboxId. Throw if not found
 *   2) Set sentAt to now
 *   3) Add 1 to attempts
 *   4) Save the update
 */

export {};
