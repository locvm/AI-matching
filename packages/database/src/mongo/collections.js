// @ts-check

/**
 * MongoDB collection names used across all repositories.
 *
 * Import this instead of hardcoding strings in repository files.
 */
export const COLLECTIONS = Object.freeze({
  // locvm-app Mongoose collections
  USERS: 'users',
  LOCUM_JOBS: 'locumjobs',
  RESERVATIONS: 'reservations',
  MATCH_CACHES: 'matchcaches',

  // AI-matching-owned collections (no Mongoose model in locvm-app)
  MATCH_RUNS: 'matchruns',
  MATCH_RUN_RESULTS: 'matchrunresults',
})
