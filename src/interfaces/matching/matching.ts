// LOCVM Matching Engine - Matching Data Shapes
//
// Just the input and output shapes for the matching pipeline.
// SearchCriteria = what we are looking for
// SearchResult = what comes back
//
// The actual engine that takes one and produces the other is code.
// These are just the contracts for what goes in and what comes out.

import type { GeoCoordinates } from "../core/models";

/**
 * The input to a matching search.
 *
 * Basically: "what are we looking for?" Usually built from a job posting, but could also be for ad-hoc queries not tied to a specific job (like the weekly digest batch)
 * Storage agnostic, doesnt know or care where the data comes from.
 */
export type SearchCriteria = {
  /** The job this search is for. Optional for batch runs */
  jobId?: string;

  /** Required profession to match, like "Physician" */
  medProfession: string;

  /** Required specialty, like "Family Medicine" or "Emergency Medicine" */
  medSpeciality: string;

  /** The job's location. Used for distance scoring against physician locations */
  location: GeoCoordinates;

  /** Province where the job is. Normalized to 2-letter code */
  province?: string;

  /** Date range the job needs to be filled */
  dateRange: {
    from: Date;
    to: Date;
  };

  /** EMR system at the facility. Optional, most jobs dont have this yet */
  emr?: string;

  /** Whether this is a short-term gig */
  isShortTerm?: boolean;

  /** Minimum total score to be included in results */
  threshold?: number;

  /** Max results to return. Sorted by score desc, capped here */
  limit?: number;
};

/**
 * A single physician match result.
 *
 * Has the total score AND a per-dimension breakdown so the platform can show WHY someone was matched, not just the final number
 */
export type SearchResult = {
  /** Matched physician's ID */
  physicianId: string;

  /** Aggregate match score, 0-1 range. Higher = better */
  score: number;

  /**
   * Score breakdown by dimension.
   * undefined = that dimension wasnt evaluated (different from 0)
   * Index signature lets us add new dimensions later without changing this type
   */
  breakdown: {
    location?: number;
    duration?: number;
    emr?: number;
    speciality?: number;
    province?: number;
    [key: string]: number | undefined;
  };
};
