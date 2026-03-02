// LOCVM Matching Engine - Matching Data Shapes
//
// Just the input and output shapes for the matching pipeline
// SearchCriteria = what we are looking for
// SearchResult = what comes back
//
// The actual engine that takes one and produces the other is code
// These are just the contracts for what goes in and what comes out

import type { GeoCoordinates, Physician } from "../core/models";

/**
 * The input to a matching search
 *
 * Basically: "what are we looking for?" Usually built from a job posting, but could also be for one-off queries not tied to a specific job (like the weekly digest run)
 * Doesnt know or care where the data comes from
 */
export type matchingCriteria = {
  /** The job this search is for. Optional for bulk runs */
  jobId?: string;

  /** Required profession to match, like "Physician" */
  medProfession: string;

  /** Required specialty, like "Family Medicine" or "Emergency Medicine" */
  medSpeciality: string;

  /** The jobs location. Used for distance scoring against physician locations */
  location: GeoCoordinates;

  /** Province where the job is. Cleaned to 2-letter code */
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
 * A single physician match result
 *
 * Has the total score AND a per-category breakdown so the platform can show WHY someone was matched, not just the final number
 */
export type SearchResult = {
  /** Matched physicians ID */
  physicianId: string;

  /** Total match score, 0-1 range. Higher = better */
  score: number;

  /**
   * Score breakdown by category
   * undefined = that category wasnt scored (different from 0)
   * Index signature lets us add new categories later without changing this type
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

/**
 * The core matching function. Takes search criteria and a pool of physicians, returns ranked results
 *
 * This is THE main function of the matching engine. Everything else feeds into this
 *
 * Steps:
 * 1) Filter the physician pool using isEligiblePhysician (hard filters): medProfession must match, medSpeciality must match, isLookingForLocums must be true
 * 2) For each physician that passed, score them on each category:
 *    - scoreLocation(physician, criteria.location)
 *    - scoreDuration(physician, criteria.dateRange)
 *    - scoreEMR(physician.emrSystems, criteria.emr)
 *    - scoreProvince(physician, criteria.province)
 *    - scoreSpeciality(physician, criteria.medSpeciality)
 * 3) Combine all category scores into one total score using weights you can change. Weights should NOT be hardcoded (README §9)
 * 4) Build a SearchResult for each physician with the total score and breakdown
 * 5) Filter out results below criteria.threshold (if set)
 * 6) Sort results by score descending
 * 7) Cap results at criteria.limit (if set)
 * 8) Return the final SearchResult[]
 *
 * @param criteria - what to search for (built from a job posting or one-off query)
 * @param physicians - the pool of physicians to match against
 * @returns Promise resolving to an array of ranked search results
 */
export type SearchPhysiciansFn = (
  criteria: matchingCriteria,
  physicians: Physician[]
) => Promise<SearchResult[]>;
