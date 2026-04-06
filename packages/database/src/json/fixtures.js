// @ts-check

import { readFile } from 'node:fs/promises'
import { physicianToDomain, locumJobToDomain, reservationToDomain } from '@locvm/matching-engine'
import { FIXTURE_PATHS } from './paths.js'

/** @param {unknown} value @returns {unknown} */
function normalizeMongoValue(value) {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(normalizeMongoValue)
  if (typeof value === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value)
    if ('$oid' in obj) return obj['$oid']
    if ('$date' in obj) return new Date(/** @type {string} */ (obj['$date']))
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, normalizeMongoValue(v)]))
  }
  return value
}

/** @param {string} path @returns {Promise<Record<string, any>[]>} */
async function readJsonArray(path) {
  const raw = JSON.parse(await readFile(path, 'utf-8'))
  return raw.map(normalizeMongoValue)
}

export async function loadFixtures() {
  const [rawJobs, rawUsers, rawReservations] = await Promise.all([
    readJsonArray(FIXTURE_PATHS.jobs),
    readJsonArray(FIXTURE_PATHS.users),
    readJsonArray(FIXTURE_PATHS.reservations),
  ])

  return {
    jobs: rawJobs.map(locumJobToDomain),
    physicians: rawUsers.map(physicianToDomain),
    reservations: rawReservations.map(reservationToDomain),
  }
}
