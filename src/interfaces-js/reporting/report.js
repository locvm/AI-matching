// @ts-check

// LOCVM Matching Engine - Report Generation Contract (JavaScript / JSDoc version)
//
// Defines the output file for SME review
// The matching engine produces SearchResult[], this module defines how those results get turned into a human-readable report (CSV/JSON)

/** @typedef {import("../matching/matching.js").SearchResult} SearchResult */
/** @typedef {import("../matching/matching.js").matchingCriteria} matchingCriteria */

/**
 * Settings for the matching report output
 *
 * @typedef {Object} ReportOptions
 * @property {number} [topK] - Max number of top physicians to include per job. Default: 10
 * @property {boolean} [includeBreakdown] - Whether to include per-category score breakdown columns. Default: true
 * @property {boolean} [includeSummaryStats] - Whether to include summary stats. Default: true
 * @property {"csv" | "json"} [format] - Output format. Default: "csv"
 * @property {string} [outputPath] - Output file path. If not set, returns content as string only
 */

/**
 * Per-job section of the report, grouping results by the job that was matched
 *
 * @typedef {Object} ReportJobSection
 * @property {matchingCriteria} criteria - The criteria used for this jobs matching run
 * @property {SearchResult[]} topResults - Top K results for this job, sorted by score descending
 * @property {Object} stats - Summary stats for this jobs full result set (not just top K)
 * @property {number} stats.totalQualified - Total physicians that passed hard filters
 * @property {number} stats.minScore - Minimum score across all qualified physicians
 * @property {number} stats.maxScore - Maximum score across all qualified physicians
 * @property {number} stats.medianScore - Median score across all qualified physicians
 * @property {number} stats.meanScore - Mean score across all qualified physicians
 * @property {string[]} stats.missingDataFlags - Flags for missing data, for example ["no physician location available: 43%"]
 */

/**
 * The full output of a matching report
 *
 * @typedef {Object} MatchingReport
 * @property {Date} generatedAt - When the report was generated
 * @property {ReportOptions} options - The settings used to generate this report
 * @property {ReportJobSection[]} sections - Per-job sections of the report
 * @property {string} content - The formatted report content as a string (CSV rows or JSON string)
 */

/**
 * Generates a matching report from search results
 *
 * This function produces a formatted output file (CSV or JSON) for SME review
 *
 * The CSV output should contain for each job:
 * - Job info row: Job ID, specialty, province/city, date range, EMR (if present)
 * - Top K physician rows, each with: physician ID, total score (0-5 scale for human readability, mapped from internal 0-1), breakdown scores for location/duration/emr/speciality/province
 * - Summary row: qualified physicians, min/median/max scores, missing-data flags
 *
 * Steps:
 * 1) For each job section (criteria + results pair):
 *    a) Sort results by score descending
 *    b) Take the top K results (from options.topK, default 10)
 *    c) Calculate summary stats across ALL results (not just top K): qualified physician count, min/max/median/mean scores, missing-data flags (for example "no physician location available" with percentage)
 * 2) Format output based on options.format: CSV gets a header row then per-job sections with job info + physician rows + summary. JSON gets a structured object with sections array
 * 3) If options.outputPath is set, write the file to disk at ./artifacts/matching_test_results_<timestamp>.csv
 * 4) Return a MatchingReport object with the formatted content and metadata
 *
 * @callback GenerateMatchingReportFn
 * @param {{ criteria: matchingCriteria, results: SearchResult[] }[]} sections - array of job sections
 * @param {ReportOptions} [options] - settings for the report
 * @returns {MatchingReport} a structured report object containing the formatted output
 */

export {};
