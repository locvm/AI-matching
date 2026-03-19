// @ts-check

// LocumJob Data Mapper
//
// Takes a raw LocumJob document from MongoDB and turns it into a clean LocumJob.
//
// Schema: reference/schema/locumJob.model.js (LocumJobSchema)
// Interface: src/interfaces/core/models.js (LocumJob)
//
// What each field does:
//   _id                    becomes  _id              (coerceObjectId)
//   jobId                  becomes  jobId            (trimString)
//   medProfession          becomes  medProfession    (trimString)
//   medSpeciality          becomes  medSpeciality    (trimString)
//   location.coordinates   becomes  location         (GeoJSON [lng,lat] to {lng, lat} or null)
//   fullAddress            becomes  fullAddress      (normalizeAddress, province "Ontario" becomes "ON")
//   dateRange.from         becomes  dateRange.from   (ensureDate, default new Date(0))
//   dateRange.to           becomes  dateRange.to     (ensureDate, default new Date(0))
//   schedule               becomes  schedule         (trimString)
//   (jobType)              becomes  jobType          (trimString, schema has this commented out)
//   facilityName           becomes  facilityName     (trimString)
//   facilityInfo.emr       becomes  facilityInfo.emr (trimString)
//   experience             becomes  experience       (trimString)
//   locumPay               becomes  locumPay         (trimString)
//   practiceType           becomes  practiceType     (ensureStringArray)
//   patientType            becomes  patientType      (ensureStringArray)
//   postTitle              becomes  postTitle        (trimString)
//   locumCreator           becomes  locumCreatorId   (renamed + coerceObjectId)
//   reservationId          becomes  reservationId    (coerceObjectId)

/** @typedef {import("../interfaces/core/models.js").LocumJob} LocumJob */
/** @typedef {import("../interfaces/core/models.js").GeoCoordinates} GeoCoordinates */

import { coerceObjectId, ensureDate, trimString, ensureStringArray, normalizeAddress } from './primitives.js'

/**
 * Pulls out lat/lng from a GeoJSON Point. Mongo stores it as {type: "Point", coordinates: [lng, lat]}.
 *
 * @param {*} raw
 * @returns {GeoCoordinates | null}
 */
function extractGeoCoordinates(raw) {
  if (!raw || typeof raw !== 'object') return null

  const coords = raw.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null

  const lng = Number(coords[0])
  const lat = Number(coords[1])

  if (isNaN(lng) || isNaN(lat)) return null

  return { lng, lat }
}

/**
 * Takes a raw LocumJob doc from Mongo and gives back a clean LocumJob.
 *
 * @param {Record<string, any>} raw
 * @returns {LocumJob}
 */
export function toDomain(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('locumJobMapper.toDomain: raw document is required')
  }

  const rawDateRange = raw.dateRange ?? {}

  return {
    _id: coerceObjectId(raw._id),
    jobId: trimString(raw.jobId) || undefined,
    postTitle: trimString(raw.postTitle) || undefined,
    medProfession: trimString(raw.medProfession),
    medSpeciality: trimString(raw.medSpeciality),
    location: extractGeoCoordinates(raw.location),
    fullAddress: normalizeAddress(raw.fullAddress) ?? {
      province: /** @type {import("../interfaces/core/models.js").ProvinceCode} */ ('ON'),
    },
    dateRange: {
      from: ensureDate(rawDateRange.from) ?? new Date(0),
      to: ensureDate(rawDateRange.to) ?? new Date(0),
    },
    jobType: trimString(raw.jobType) || undefined,
    facilityInfo: raw.facilityInfo ? { emr: trimString(raw.facilityInfo.emr) || undefined } : undefined,
    experience: trimString(raw.experience) || undefined,
    locumPay: trimString(raw.locumPay) || undefined,
    schedule: trimString(raw.schedule) || undefined,
    locumCreatorId: coerceObjectId(raw.locumCreator) || undefined,
    reservationId: coerceObjectId(raw.reservationId) || undefined,
    facilityName: trimString(raw.facilityName) || undefined,
    practiceType: ensureStringArray(raw.practiceType).length > 0 ? ensureStringArray(raw.practiceType) : undefined,
    patientType: ensureStringArray(raw.patientType).length > 0 ? ensureStringArray(raw.patientType) : undefined,
  }
}

/**
 * Turns a clean LocumJob back into the raw Mongo shape.
 * Not built yet. Will be needed for write operations or SQL migration.
 *
 * @param {LocumJob} _job
 * @returns {never}
 */
export function toPersistence(_job) {
  throw new Error('locumJobMapper.toPersistence: not implemented')
}
