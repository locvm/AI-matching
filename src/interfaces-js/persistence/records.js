// @ts-check

// LOCVM Matching Engine - Persistence Data Shapes (JavaScript / JSDoc version)
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
 *
 * @typedef {Object} MatchRun
 * @property {string} id
 * @property {"SHORT_TERM" | "WEEKLY_DIGEST"} type - What triggered it
 * @property {"PENDING" | "RUNNING" | "COMPLETED" | "FAILED"} status - Where its at right now
 * @property {string} [jobId] - The job this run is for (SHORT_TERM only). Null for WEEKLY_DIGEST
 * @property {Date} createdAt
 * @property {Date} [startedAt]
 * @property {Date} [completedAt]
 * @property {string} [error] - Error message if it failed
 * @property {number} [resultCount] - How many results it produced
 */

/**
 * One result row from a match run. Stored in the DB. The saved version of SearchResult, tied to a specific run
 *
 * @typedef {Object} MatchRunResult
 * @property {string} runId - Which run produced this
 * @property {string} physicianId - The matched doctor
 * @property {string} jobId - The job that was matched
 * @property {number} score
 * @property {Record<string, number>} breakdown - Per-category breakdown
 * @property {Date} computedAt
 */

/**
 * A notification waiting to be sent. Stored in the DB
 *
 * Outbox pattern: matching engine writes "notify doctor X about job Y" here. A separate process picks them up and sends emails or push or in-app
 * Note to self: need to check with Eve if the existing codebase already has notification infra. If it does we should use that instead
 *
 * @typedef {Object} OutboxItem
 * @property {string} id
 * @property {"SHORT_TERM_MATCH" | "WEEKLY_DIGEST"} type
 * @property {string} recipientId - Who gets it
 * @property {Record<string, unknown>} payload - The payload, shape depends on type. SHORT_TERM_MATCH: { jobId, score, jobTitle, ... } WEEKLY_DIGEST: { matches: [{ jobId, score, ... }] }
 * @property {Date} createdAt
 * @property {Date} [sentAt] - When it was actually sent (null = not yet)
 * @property {number} attempts - How many times we tried to send it
 * @property {string} [lastError] - Last error if sending failed
 */

export {};
