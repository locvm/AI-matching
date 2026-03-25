// @ts-check

// Test-harness-only JSDoc types. Domain types live in src/interfaces/index.js.

export {}

// ── Domain types (from interfaces) ──────────────────────────────────────────
/** @typedef {import('../../../src/interfaces/core/models.js').LocumJob} LocumJob */
/** @typedef {import('../../../src/interfaces/core/models.js').Physician} Physician */
/** @typedef {import('../../../src/interfaces/core/models.js').Reservation} Reservation */
/** @typedef {import('../../../src/interfaces/core/models.js').ReservationApplicant} ReservationApplicant */
/** @typedef {import('../../../src/interfaces/matching/matching.js').SearchResult} SearchResult */
/** @typedef {import('../../../src/interfaces/matching/matching.js').ScoreBreakdown} ScoreBreakdown */
/** @typedef {import('../../../src/interfaces/matching/matching.js').ScoreJobFn} ScoreJobFn */
/** @typedef {import('../../../src/interfaces/matching/matching.js').ScorePhysicianFn} ScorePhysicianFn */

// Harness-specific types

/**
 * Sampling controls for deterministic job/user selection.
 *
 * @typedef {object} SamplerConfig
 * @property {number} [maxJobs]
 * @property {number} [maxUsers]
 * @property {number} [seed]
 * @property {string} [jobFilter]
 */

/**
 * Per-job score distribution and data-quality summary.
 *
 * @typedef {object} JobSummaryStats
 * @property {string} jobId
 * @property {number} eligibleCandidates
 * @property {number} totalResults
 * @property {number} minScore
 * @property {number} medianScore
 * @property {number} maxScore
 * @property {string[]} missingDataFlags
 */

/**
 * Single job's top matches + stats, written as one CSV group.
 *
 * @typedef {object} HarnessJobResult
 * @property {import('../../../src/interfaces/index.js').LocumJob} job
 * @property {import('../../../src/interfaces/index.js').SearchResult[]} topResults
 * @property {JobSummaryStats} stats
 */

/**
 * Options passed to MatchingTestHarness constructor.
 *
 * @typedef {object} HarnessConfig
 * @property {number} [topK]
 * @property {string} [outputDir]
 * @property {SamplerConfig} [sampling]
 */

/**
 * Return value of MatchingTestHarness.run().
 *
 * @typedef {object} HarnessRunResult
 * @property {string} outputPath
 * @property {number} jobsProcessed
 * @property {number} totalMatches
 * @property {number} seed
 * @property {HarnessJobResult[]} results
 */

/**
 * Validated CLI options after Zod parsing.
 *
 * @typedef {object} HarnessCliOptions
 * @property {number} maxJobs
 * @property {number} maxUsers
 * @property {number} topK
 * @property {number} [seed]
 * @property {string} [jobFilter]
 * @property {string} outputDir
 * @property {string} [jobs]
 * @property {string} [users]
 * @property {string} [reservations]
 */

/**
 * Combined fixtures loaded from disk for the harness.
 *
 * @typedef {object} FixtureData
 * @property {import('../../../src/interfaces/index.js').LocumJob[]} jobs
 * @property {import('../../../src/interfaces/index.js').Physician[]} physicians
 * @property {import('../../../src/interfaces/index.js').Reservation[]} reservations
 */

// Physician-centric harness types

/**
 * Per-physician score distribution and data-quality summary.
 *
 * @typedef {object} PhysicianSummaryStats
 * @property {string} physicianId
 * @property {number} eligibleJobs
 * @property {number} totalResults
 * @property {number} minScore
 * @property {number} medianScore
 * @property {number} maxScore
 * @property {string[]} missingDataFlags
 */

/**
 * Single physician's top job matches + stats, written as one CSV group.
 *
 * @typedef {object} HarnessPhysicianResult
 * @property {import('../../../src/interfaces/index.js').Physician} physician
 * @property {import('../../../src/interfaces/index.js').SearchResult[]} topResults
 * @property {PhysicianSummaryStats} stats
 */

/**
 * Return value of PhysicianTestHarness.run().
 *
 * @typedef {object} PhysicianHarnessRunResult
 * @property {string} outputPath
 * @property {number} physiciansProcessed
 * @property {number} totalMatches
 * @property {number} seed
 * @property {HarnessPhysicianResult[]} results
 */
