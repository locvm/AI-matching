// @ts-check

// LOCVM Matching Engine - Persistence Data Shapes (JavaScript / JSDoc version)
//
// Shapes of records that get stored in the database
// MatchRun and MatchRunResult are DB entities
//
// The actual code that reads/writes these is implementation
// These just define what the records look like

/**
 * One execution of the matching engine, stored in the DB
 *
 * A run gets created when either:
 *   - A new job is posted (JOB_POSTED run for that job)
 *   - A physician profile is updated (PHYSICIAN_UPDATED run for that physician)
 *   - The weekly digest scheduler fires (WEEKLY_DIGEST across all jobs)
 *
 * We track these so we can avoid duplicates, retry failures, and audit when matching happened
 *
 * @typedef {Object} MatchRun
 * @property {string} id
 * @property {"JOB_POSTED" | "PHYSICIAN_UPDATED" | "WEEKLY_DIGEST"} type - What triggered it
 * @property {"PENDING" | "RUNNING" | "COMPLETED" | "FAILED"} status - Where its at right now
 * @property {string} [jobId] - Set for JOB_POSTED runs
 * @property {string} [physicianId] - Set for PHYSICIAN_UPDATED runs
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
 * @property {boolean} isActive - false when superseded by a newer run for this physician
 * @property {Date | null} [notifiedAt] - When the physician was notified about this match. Null = not yet notified
 */

export {}
