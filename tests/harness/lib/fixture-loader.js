// @ts-check

import { readFile } from 'node:fs/promises'

import { PATHS } from '../harness.config.js'
import { physicianToDomain, locumJobToDomain, reservationToDomain } from '../../../src/normalization/index.js'
import { geocodeBatch } from '../../../src/normalization/geocodeBatch.js'

/**
 * @typedef {import('../../../src/interfaces/index.js').LocumJob} LocumJob
 * @typedef {import('../../../src/interfaces/index.js').Physician} Physician
 * @typedef {import('../../../src/interfaces/index.js').Reservation} Reservation
 * @typedef {import('./types.js').FixtureData} FixtureData
 */

/**
 * Normalizes MongoDB Extended JSON values into plain JS types.
 * Fixture files use Mongo's extended JSON format ($oid, $date),
 * but the domain mappers expect plain JS values.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function normalizeMongoValue(value) {
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    return value.map(normalizeMongoValue)
  }

  if (typeof value === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value)

    if ('$oid' in obj && typeof obj['$oid'] === 'string') {
      return obj['$oid']
    }

    if ('$date' in obj && typeof obj['$date'] === 'string') {
      return new Date(obj['$date'])
    }

    /** @type {Record<string, unknown>} */
    const normalized = {}
    for (const [key, val] of Object.entries(obj)) {
      normalized[key] = normalizeMongoValue(val)
    }
    return normalized
  }

  return value
}

/**
 * @param {string} jsonString
 * @returns {Record<string, any>[]}
 */
function parseMongoJsonArray(jsonString) {
  const raw = JSON.parse(jsonString)
  if (!Array.isArray(raw)) {
    throw new Error('Expected a JSON array at the top level')
  }
  return /** @type {Record<string, any>[]} */ (raw.map(normalizeMongoValue))
}

/**
 * @param {object} [options]
 * @param {string} [options.jobs] - path to jobs fixture
 * @param {string} [options.users] - path to users fixture
 * @param {string} [options.reservations] - path to reservations fixture
 * @param {false | "local" | "nominatim"} [options.enrichGps] - enrich physicians with GPS coordinates
 *   - false (default): no enrichment, physicians keep location: null
 *   - "local": use canadianCities.js lookup (instant, covers ~100 cities)
 *   - "nominatim": local lookup first, then Nominatim API fallback (slow, 1 req/sec)
 * @returns {Promise<FixtureData>}
 */
export async function loadFixtures(options = {}) {
  const [jobsRaw, usersRaw, reservationsRaw] = await Promise.all([
    readFile(options.jobs ?? PATHS.JOBS_FIXTURE, 'utf-8'),
    readFile(options.users ?? PATHS.USERS_FIXTURE, 'utf-8'),
    readFile(options.reservations ?? PATHS.RESERVATIONS_FIXTURE, 'utf-8'),
  ])

  const rawUsers = parseMongoJsonArray(usersRaw)
  const rawJobs = parseMongoJsonArray(jobsRaw)
  const rawReservations = parseMongoJsonArray(reservationsRaw)

  // Use the real normalization mappers — same pipeline as production
  let physicians = rawUsers.map(physicianToDomain)
  const jobs = rawJobs.map(locumJobToDomain)
  const reservations = rawReservations.map(reservationToDomain)

  // Optionally enrich physicians with GPS coordinates
  if (options.enrichGps) {
    const useNominatim = options.enrichGps === 'nominatim'
    const result = await geocodeBatch(physicians, { useNominatim })
    physicians = result.physicians
  }

  return { jobs, physicians, reservations }
}
