// @ts-check

import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export const FIXTURES_DIR = join(ROOT, 'fixtures')
export const DATA_DIR = join(ROOT, 'data')

export const FIXTURE_PATHS = {
  jobs: join(FIXTURES_DIR, 'locum.locumjobs.formatted.json'),
  users: join(FIXTURES_DIR, 'locum.users.formatted.json'),
  reservations: join(FIXTURES_DIR, 'locum.reservations.formatted.json'),
}

export const STORE_PATHS = {
  matchRuns: join(DATA_DIR, 'match-runs.json'),
  matchRunResults: join(DATA_DIR, 'match-run-results.json'),
}
