// @ts-check

import { readFile } from 'node:fs/promises'

import { PATHS } from '../harness.config.js'

/**
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').User} User
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').FixtureData} FixtureData
 */

/**
 * Normalizes MongoDB Extended JSON values into plain JS types.
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
 * @returns {unknown[]}
 */
function parseMongoJsonArray(jsonString) {
  const raw = JSON.parse(jsonString)
  if (!Array.isArray(raw)) {
    throw new Error('Expected a JSON array at the top level')
  }
  return /** @type {unknown[]} */ (raw.map(normalizeMongoValue))
}

/**
 * @param {object} [paths]
 * @param {string} [paths.jobs]
 * @param {string} [paths.users]
 * @param {string} [paths.reservations]
 * @returns {Promise<FixtureData>}
 */
export async function loadFixtures(paths = {}) {
  const [jobsRaw, usersRaw, reservationsRaw] = await Promise.all([
    readFile(paths.jobs ?? PATHS.JOBS_FIXTURE, 'utf-8'),
    readFile(paths.users ?? PATHS.USERS_FIXTURE, 'utf-8'),
    readFile(paths.reservations ?? PATHS.RESERVATIONS_FIXTURE, 'utf-8'),
  ])

  return {
    jobs: /** @type {LocumJob[]} */ (parseMongoJsonArray(jobsRaw)),
    users: /** @type {User[]} */ (parseMongoJsonArray(usersRaw)),
    reservations: /** @type {Reservation[]} */ (parseMongoJsonArray(reservationsRaw)),
  }
}
