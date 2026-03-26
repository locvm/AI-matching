// @ts-check

import { resolve } from 'node:path'

// paths
const FIXTURES_DIR = resolve('fixtures')

const OUTPUT_ROOT = resolve('artificats')

export const PATHS = {
  FIXTURES_DIR,
  JOBS_FIXTURE: resolve(FIXTURES_DIR, 'locum.locumjobs.formatted.json'),
  USERS_FIXTURE: resolve(FIXTURES_DIR, 'locum.users.formatted.json'),
  RESERVATIONS_FIXTURE: resolve(FIXTURES_DIR, 'locum.reservations.formatted.json'),
  OUTPUT_DIR: OUTPUT_ROOT,
  JOB_OUTPUT_DIR: resolve(OUTPUT_ROOT, 'job-to-physicians'),
  PHYSICIAN_OUTPUT_DIR: resolve(OUTPUT_ROOT, 'physician-to-jobs'),
}

// sampling controls
export const SAMPLING = {
  MAX_JOBS: 25,
  MAX_USERS: 1000,
  DEFAULT_SEED: undefined,
}

// output
export const OUTPUT = {
  TOP_K: 10,
  CSV_PREFIX: 'matching_test_results',
  PHYSICIAN_CSV_PREFIX: 'physician_matching_results',
}

// scoring (stub weights)
export const SCORING = {
  MAX_SCORE: 5,
  WEIGHTS: {
    LOCATION: 0.45,
    DURATION: 0.35,
    EMR: 0.2,
  },
}

// job filter thresholds
export const JOB_FILTERS = {
  SHORT_TERM_MAX_DAYS: 30,
}

export const VALID_JOB_FILTERS = ['short-term', 'long-term']

// test defaults
export const TEST = {
  SEED: 42,
  // job-centric: few random jobs, ALL physicians
  JOB_MAX_JOBS: 20,
  JOB_MAX_USERS: Infinity,
  // physician-centric: few random physicians, ALL jobs
  PHYSICIAN_MAX_USERS: 20,
  PHYSICIAN_MAX_JOBS: Infinity,
}
