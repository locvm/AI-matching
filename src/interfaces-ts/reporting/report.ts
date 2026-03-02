// LOCVM Matching Engine - Report Generation Contract
//
// Defines the output file for SME review
// The matching engine produces SearchResult[], this module defines how those results get turned into a human-readable report (CSV/JSON)

import type { SearchResult, matchingCriteria } from "../matching/matching";

/**
 * Settings for the matching report output
 */
export type ReportOptions = {
  /** Max number of top physicians to include per job. Default: 10 */
  topK?: number;

  /** Whether to include the per-category score breakdown columns. Default: true */
  includeBreakdown?: boolean;

  /** Whether to include summary stats. Default: true */
  includeSummaryStats?: boolean;

  /** Output format. Default: "csv" */
  format?: "csv" | "json";

  /** Output file path. If not set, returns content as string only */
  outputPath?: string;
};

/**
 * Per-job section of the report, grouping results by the job that was matched
 */
export type ReportJobSection = {
  /** The criteria used for this jobs matching run */
  criteria: matchingCriteria;

  /** Top K results for this job, sorted by score descending */
  topResults: SearchResult[];

  /** Summary stats for this jobs full result set (not just top K) */
  stats: {
    /** Total physicians that passed hard filters */
    totalQualified: number;
    /** Score spread across ALL qualified physicians */
    minScore: number;
    maxScore: number;
    medianScore: number;
    meanScore: number;
    /** Flags for missing data, for example ["no physician location available: 43%"] */
    missingDataFlags: string[];
  };
};

/**
 * The full output of a matching report
 */
export type MatchingReport = {
  /** When the report was generated */
  generatedAt: Date;

  /** The settings used to generate this report */
  options: ReportOptions;

  /** Per-job sections of the report */
  sections: ReportJobSection[];

  /** The formatted report content as a string (CSV rows or JSON string) */
  content: string;
};

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
 * @param sections - array of job sections, each with criteria and results
 * @param options - settings for the report
 * @returns a structured report object containing the formatted output
 */
export type GenerateMatchingReportFn = (
  sections: { criteria: matchingCriteria; results: SearchResult[] }[],
  options?: ReportOptions
) => MatchingReport;
