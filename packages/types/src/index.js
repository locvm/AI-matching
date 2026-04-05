// @ts-check

// LOCVM matching — JSDoc type barrel. Import domain and contract types from this module, e.g.
//   /** @typedef {import("../interfaces/index.js").Physician} Physician */

// ── Core (src/interfaces/core) ─────────────────────────────────────────────
/** @typedef {import("./core/models.js").GeoCoordinates} GeoCoordinates */
/** @typedef {import("./core/models.js").ProvinceCode} ProvinceCode */
/** @typedef {import("./core/models.js").Address} Address */
/** @typedef {import("./core/models.js").AvailabilityWindow} AvailabilityWindow */
/** @typedef {import("./core/models.js").DurationRange} DurationRange */
/** @typedef {import("./core/models.js").DayOfWeek} DayOfWeek */
/** @typedef {import("./core/models.js").CommitmentType} CommitmentType */
/** @typedef {import("./core/models.js").Physician} Physician */
/** @typedef {import("./core/models.js").LocumJob} LocumJob */
/** @typedef {import("./core/models.js").ReservationStatus} ReservationStatus */
/** @typedef {import("./core/models.js").ApplicationStage} ApplicationStage */
/** @typedef {import("./core/models.js").ApplicationLogEntry} ApplicationLogEntry */
/** @typedef {import("./core/models.js").ReservationApplicant} ReservationApplicant */
/** @typedef {import("./core/models.js").Reservation} Reservation */

// ── Matching (src/interfaces/matching/matching.js) ───────────────────────────
/** @typedef {import("./matching/matching.js").ScoreBreakdown} ScoreBreakdown */
/** @typedef {import("./matching/matching.js").MatchCacheMatchEntry} MatchCacheMatchEntry */
/** @typedef {import("./matching/matching.js").SearchResult} SearchResult */
/** @typedef {import("./matching/matching.js").SearchOptions} SearchOptions */
/** @typedef {import("./matching/matching.js").ScoredPair} ScoredPair */
/** @typedef {import("./matching/matching.js").ScoreMatchFn} ScoreMatchFn */
/** @typedef {import("./matching/matching.js").CombineAndRankFn} CombineAndRankFn */
/** @typedef {import("./matching/matching.js").ScoreJobFn} ScoreJobFn */
/** @typedef {import("./matching/matching.js").ScorePhysicianFn} ScorePhysicianFn */

// ── Filters (src/interfaces/matching/filters.js) ─────────────────────────────
/** @typedef {import("./matching/filters.js").IsEligiblePhysicianFn} IsEligiblePhysicianFn */
/** @typedef {import("./matching/filters.js").IsShortTermJobFn} IsShortTermJobFn */
/** @typedef {import("./matching/filters.js").FilterPhysiciansForJobFn} FilterPhysiciansForJobFn */
/** @typedef {import("./matching/filters.js").FilterJobsForPhysicianFn} FilterJobsForPhysicianFn */

// ── Scorer contracts (src/interfaces/scoring/scorers.js) ─────────────────────
/** @typedef {import("./scoring/scorers.js").ScoreLocationFn} ScoreLocationFn */
/** @typedef {import("./scoring/scorers.js").ScoreDurationFn} ScoreDurationFn */
/** @typedef {import("./scoring/scorers.js").ScoreEMRFn} ScoreEMRFn */
/** @typedef {import("./scoring/scorers.js").ScoreProvinceFn} ScoreProvinceFn */
/** @typedef {import("./scoring/scorers.js").ScoreSpecialityFn} ScoreSpecialityFn */

// ── Persistence (src/interfaces/persistence) ────────────────────────────────
/** @typedef {import("./persistence/records.js").MatchRun} MatchRun */
/** @typedef {import("./persistence/records.js").MatchRunResult} MatchRunResult */
/** @typedef {import("./persistence/repositories.js").MatchRunRepository} MatchRunRepository */
/** @typedef {import("./persistence/repositories.js").MatchRunResultRepository} MatchRunResultRepository */

// ── Orchestration (src/interfaces/orchestration/services.js) ─────────────────
/** @typedef {import("./orchestration/services.js").ShortTermMatchService} ShortTermMatchService */
/** @typedef {import("./orchestration/services.js").WeeklyDigestService} WeeklyDigestService */

// ── Reporting (src/interfaces/reporting/report.js) ───────────────────────────
/** @typedef {import("./reporting/report.js").ReportOptions} ReportOptions */
/** @typedef {import("./reporting/report.js").ReportJobSection} ReportJobSection */
/** @typedef {import("./reporting/report.js").MatchingReport} MatchingReport */
/** @typedef {import("./reporting/report.js").GenerateMatchingReportFn} GenerateMatchingReportFn */

export * from './core/models.js'
export * from './matching/matching.js'
export * from './matching/filters.js'
export * from './scoring/scorers.js'
export * from './persistence/records.js'
export * from './persistence/repositories.js'
export * from './orchestration/services.js'
export * from './reporting/report.js'
