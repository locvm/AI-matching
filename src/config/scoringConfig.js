// @ts-check

// Scoring Configuration
//
// Weights and parameters for the combine-and-rank stage.
// Change these to tune how much each category matters without touching the combiner logic.
//
// All weights must sum to 1.0. When a category is missing for a given pair,
// its weight is redistributed proportionally across the available categories.

/**
 * Per-category weights. Keys must match ScoreBreakdown fields exactly.
 * Sum must equal 1.0.
 */
export const WEIGHTS = {
  speciality: 0.3, // what they do matters most
  emr: 0.25, // system familiarity is critical for day-1 readiness
  province: 0.2, // licensing/geography
  location: 0.15, // proximity within province
  duration: 0.1, // scheduling flexibility is least decisive
}

/** Ordered list of scoring categories (must match WEIGHTS keys) */
export const CATEGORIES = /** @type {(keyof typeof WEIGHTS)[]} */ (Object.keys(WEIGHTS))
