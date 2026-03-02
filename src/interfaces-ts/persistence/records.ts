// LOCVM Matching Engine - Persistence Data Shapes
//
// Shapes of records that get stored in the database
// MatchRun, MatchRunResult, OutboxItem are all DB entities
//
// The actual code that reads/writes these is implementation
// These just define what the records look like

/**
 * One execution of the matching engine, stored in the DB
 *
 * A run gets created when either:
 *   - A new job is posted (SHORT_TERM run for that job)
 *   - The weekly digest scheduler fires (WEEKLY_DIGEST across all jobs)
 *
 * We track these so we can avoid duplicates, retry failures, and audit when matching happened
 */
export type MatchRun = {
  id: string;

  /** What triggered it */
  type: "SHORT_TERM" | "WEEKLY_DIGEST";

  /** Where its at right now */
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

  /** The job this run is for (SHORT_TERM only). Null for WEEKLY_DIGEST */
  jobId?: string;

  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  /** Error message if it failed */
  error?: string;

  /** How many results it produced */
  resultCount?: number;
};

/**
 * One result row from a match run. Stored in the DB. The saved version of SearchResult, tied to a specific run
 */
export type MatchRunResult = {
  /** Which run produced this */
  runId: string;

  /** The matched doctor */
  physicianId: string;

  /** The job that was matched */
  jobId: string;

  score: number;

  /** Per-category breakdown */
  breakdown: Record<string, number>;

  computedAt: Date;
};

/**
 * A notification waiting to be sent. Stored in the DB
 *
 * Outbox pattern: matching engine writes "notify doctor X about job Y" here. A separate process picks them up and sends emails or push or in-app
 * Note to self: need to check with Eve if the existing codebase already has notification infra. If it does we should use that instead
 */
export type OutboxItem = {
  id: string;

  type: "SHORT_TERM_MATCH" | "WEEKLY_DIGEST";

  /** Who gets it */
  recipientId: string;

  /**
   * The payload, shape depends on type
   * SHORT_TERM_MATCH: { jobId, score, jobTitle, ... }
   * WEEKLY_DIGEST: { matches: [{ jobId, score, ... }] }
   */
  payload: Record<string, unknown>;

  createdAt: Date;

  /** When it was actually sent (null = not yet) */
  sentAt?: Date;

  /** How many times we tried to send it */
  attempts: number;

  /** Last error if sending failed */
  lastError?: string;
};
