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
  emr: 0.4, // system familiarity is critical for day-1 readiness
  location: 0.35, // proximity (includes province fallback chain)
  duration: 0.25, // scheduling flexibility
}

/** Ordered list of scoring categories (must match WEIGHTS keys) */
export const CATEGORIES = /** @type {(keyof typeof WEIGHTS)[]} */ (Object.keys(WEIGHTS))
