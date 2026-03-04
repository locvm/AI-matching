// @ts-check

import { readFile } from 'node:fs/promises'

import { PATHS } from '../harness.config.js'

/**
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Physician} Physician
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
 * Flattens raw DB user into a clean Physician shape.
 * Unpacks preferences.* into top-level fields so the rest of the code
 * never has to deal with nested preferences.
 *
 * @param {Record<string, unknown>} raw
 * @returns {Physician}
 */
function toPhysician(raw) {
  const prefs = /** @type {Record<string, unknown>} */ (raw.preferences ?? {})
  return /** @type {Physician} */ ({
    _id: raw._id,
    medProfession: raw.medProfession ?? '',
    medSpeciality: raw.medSpeciality ?? '',
    isLookingForLocums: prefs.isLookingForLocums ?? true,
    location: raw.location ?? null,
    workAddress: raw.workAddress ?? null,
    medicalProvince: raw.medicalProvince,
    preferredProvinces: prefs.preferredProvinces ?? [],
    specificRegions: prefs.specificRegions ?? [],
    emrSystems: raw.emrSystems ?? [],
    facilityEMR: raw.facilityEMR,
    firstName: raw.firstName,
    lastName: raw.lastName,
    role: raw.role,
    languages: raw.languages,
    locumDurations: prefs.locumDurations,
    availabilityTypes: prefs.availabilityTypes,
    isProfileComplete: raw.isProfileComplete,
    isOnboardingCompleted: raw.isOnboardingCompleted,
  })
}

/**
 * Flattens raw DB job into a clean LocumJob shape.
 * Converts GeoJSON coordinates [lng, lat] to { lng, lat }.
 *
 * @param {Record<string, unknown>} raw
 * @returns {LocumJob}
 */
function toLocumJob(raw) {
  const geoJson = /** @type {{ coordinates?: [number, number] } | undefined} */ (raw.location)
  const coords = geoJson?.coordinates
  const rawAddress = /** @type {Record<string, unknown> | undefined} */ (raw.fullAddress)

  return /** @type {LocumJob} */ ({
    _id: raw._id,
    jobId: raw.jobId,
    postTitle: raw.postTitle,
    medProfession: /** @type {string} */ (raw.medProfession ?? ''),
    medSpeciality: /** @type {string} */ (raw.medSpeciality ?? ''),
    location: coords ? { lng: coords[0], lat: coords[1] } : null,
    fullAddress: {
      city: /** @type {string} */ (rawAddress?.city ?? ''),
      province: /** @type {string} */ (rawAddress?.province ?? ''),
      country: rawAddress?.country,
      postalCode: rawAddress?.postalCode,
      streetName: rawAddress?.streetName,
      streetNumber: rawAddress?.streetNumber,
    },
    dateRange: raw.dateRange,
    jobType: raw.jobType,
    facilityInfo: raw.facilityInfo ?? undefined,
    experience: raw.experience,
    locumPay: raw.locumPay,
    schedule: raw.schedule,
    locumCreatorId: raw.locumCreator,
    reservationId: raw.reservationId,
    facilityName: raw.facilityName,
    practiceType: raw.practiceType,
    patientType: raw.patientType,
  })
}

/**
 * Flattens raw DB reservation into a clean Reservation shape.
 *
 * @param {Record<string, unknown>} raw
 * @returns {Reservation}
 */
function toReservation(raw) {
  return /** @type {Reservation} */ ({
    _id: raw._id,
    locumJobId: raw.locumJobId,
    status: raw.status ?? 'Pending',
    applicants: raw.applicants,
    reservationDate: raw.reservationDate,
    createdBy: raw.createdBy,
    reservedBy: raw.reservedBy,
    createdAt: raw.createdAt,
    dateModified: raw.dateModified,
  })
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

  const rawUsers = /** @type {Record<string, unknown>[]} */ (parseMongoJsonArray(usersRaw))
  const rawJobs = /** @type {Record<string, unknown>[]} */ (parseMongoJsonArray(jobsRaw))
  const rawReservations = /** @type {Record<string, unknown>[]} */ (parseMongoJsonArray(reservationsRaw))

  return {
    jobs: rawJobs.map(toLocumJob),
    physicians: rawUsers.map(toPhysician),
    reservations: rawReservations.map(toReservation),
  }
}
