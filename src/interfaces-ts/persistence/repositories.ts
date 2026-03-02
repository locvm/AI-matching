// LOCVM Matching Engine - Repository Interfaces
//
// These dont care what storage you use, could be JSON files (dev/testing) or MongoDB (production)
// See README §13.5 for the authoritative spec

import type { MatchRun, MatchRunResult, OutboxItem } from "./records";

/**
 * Repository for managing match run records
 *
 * A match run = one time the matching engine ran, either triggered by a new job (SHORT_TERM) or by the weekly scheduler (WEEKLY_DIGEST)
 */
export interface MatchRunRepository {
  /**
   * Saves a new match run record
   *
   * Steps:
   * 1) Make sure run.id is unique (no duplicate runs)
   * 2) Set run.status to "PENDING" if not already set
   * 3) Set run.createdAt to now if not already set
   * 4) Write the record to storage
   *
   * @param run - the match run to create
   */
  createRun(run: MatchRun): Promise<void>;

  /**
   * Updates the status and timestamps of an existing run
   *
   * Steps:
   * 1) Find the run by runId. Throw if not found
   * 2) Update run.status to the new status
   * 3) If status is "RUNNING", set run.startedAt to now
   * 4) If status is "COMPLETED" or "FAILED", set run.completedAt to now
   * 5) If status is "FAILED" and an error message is provided, set run.error
   * 6) Save the update
   *
   * @param runId - the ID of the run to update
   * @param status - the new status
   * @param error - optional error message (for FAILED status)
   */
  updateRunStatus(
    runId: string,
    status: MatchRun["status"],
    error?: string
  ): Promise<void>;

  /**
   * Gets all runs in PENDING status, optionally filtered by type
   *
   * Steps:
   * 1) Query storage for runs where status is "PENDING"
   * 2) If type is provided, filter to only that run type
   * 3) Return results ordered by createdAt ascending (oldest first)
   *
   * @param type - optional run type filter ("SHORT_TERM" or "WEEKLY_DIGEST")
   * @returns array of pending match runs
   */
  getPendingRuns(type?: MatchRun["type"]): Promise<MatchRun[]>;
}

/**
 * Repository for storing and getting match result rows
 *
 * Each result ties a physician + score + breakdown to a specific run
 */
export interface MatchRunResultRepository {
  /**
   * Saves a bunch of match results for a given run
   *
   * Steps:
   * 1) Make sure the runId exists in the match_run table
   * 2) Write all result rows to storage in one go
   * 3) Update the parent runs resultCount field
   *
   * @param runId - the ID of the run these results belong to
   * @param results - array of match result records to save
   */
  saveResults(runId: string, results: MatchRunResult[]): Promise<void>;

  /**
   * Gets all results for a given run, ordered by score descending
   *
   * Steps:
   * 1) Query storage for all results where runId matches
   * 2) Sort by score descending (highest first)
   * 3) Return the array
   *
   * @param runId - the ID of the run to get results for
   * @returns array of match results, sorted by score descending
   */
  getResults(runId: string): Promise<MatchRunResult[]>;
}

/**
 * Repository for the notification outbox (passes notifications to the communications module)
 *
 * Outbox pattern: matching engine writes notifications here, a separate process picks them up and sends emails/push/in-app
 */
export interface NotificationOutboxRepository {
  /**
   * Adds one or more outbox items to the queue for sending later
   *
   * Steps:
   * 1) For each item, ensure id is set and unique
   * 2) Set createdAt to now if not already set
   * 3) Set attempts to 0 if not already set
   * 4) Write all items to storage in one go
   *
   * @param items - array of outbox items to add
   */
  enqueue(items: OutboxItem[]): Promise<void>;

  /**
   * Gets all unsent outbox items, optionally filtered by type
   *
   * Steps:
   * 1) Query storage for items where sentAt is null/undefined
   * 2) If type is provided, filter to that notification type
   * 3) Return results ordered by createdAt ascending
   *
   * @param type - optional notification type filter
   * @returns array of pending outbox items
   */
  getPending(type?: OutboxItem["type"]): Promise<OutboxItem[]>;

  /**
   * Marks an outbox item as sent
   *
   * Steps:
   * 1) Find the item by outboxId. Throw if not found
   * 2) Set sentAt to now
   * 3) Add 1 to attempts
   * 4) Save the update
   *
   * @param outboxId - the ID of the outbox item to mark as sent
   */
  markSent(outboxId: string): Promise<void>;
}
