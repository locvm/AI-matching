// @ts-check

// Physician Data Mapper
//
// Takes a raw User document from MongoDB and turns it into a clean Physician.
//
// Schema: reference/schema/user.models.js (UserSchema)
// Interface: src/interfaces/core/models.js (Physician)
//
// What each field does:
//   _id                                becomes  _id                  (coerceObjectId)
//   medProfession                      becomes  medProfession        (trimString)
//   medSpeciality                      becomes  medSpeciality        (trimString)
//   medicalProvince                    becomes  medicalProvince      (normalizeProvince, "Ontario" becomes "ON")
//   emrSystems                         becomes  emrSystems           (ensureStringArray, default [])
//   (no GeoJSON field)                 becomes  location             (always null)
//   workAddress                        becomes  workAddress          (normalizeAddress)
//   preferences.isLookingForLocums     becomes  isLookingForLocums   (flatten, default true)
//   preferences.preferredProvinces     becomes  preferredProvinces   (flatten + normalizeProvince each)
//   preferences.specificRegions        becomes  specificRegions      (flatten, ensureStringArray)
//   preferences.locumDurations         becomes  locumDurations       (flatten, normalizeLocumDuration each)
//   preferences.availabilityTypes      becomes  availableDays        (normalizeAvailability, "Weekdays" becomes ["Mon","Tue","Wed","Thu","Fri"])
//                                      becomes  commitmentTypes      (normalizeAvailability, "Full-time" becomes "full-time")
//   facilityName                       becomes  facilityName         (trimString)
//   facilityEMR                        becomes  facilityEMR          (trimString)
//   firstName                          becomes  firstName            (trimString)
//   lastName                           becomes  lastName             (trimString)
//   role                               becomes  role                 (trimString)
//   languages                          becomes  languages            (ensureStringArray)
//   preferences.availabilityDateRanges  becomes  availabilityWindows  (normalizeAvailabilityDateRanges, month/year strings become Date objects)
//   preferences.availabilityYears       becomes  availabilityYears    (normalizeAvailabilityYears, "Available in 2025" becomes 2025)
//   isProfileComplete                  becomes  isProfileComplete    (passthrough)
//   isOnboardingCompleted              becomes  isOnboardingCompleted (passthrough)

/** @typedef {import("../interfaces/core/models.js").Physician} Physician */

import { coerceObjectId, trimString, ensureStringArray, normalizeAddress } from './primitives.js'
import { normalizeProvince } from './normalizeProvince.js'
import { normalizeLocumDuration } from './normalizeLocumDuration.js'
import { normalizeAvailability } from './normalizeAvailability.js'
import { normalizeAvailabilityDateRanges } from './normalizeAvailabilityDateRange.js'
import { normalizeAvailabilityYears } from './normalizeAvailabilityYears.js'

/**
 * Takes a raw User doc from Mongo and gives back a clean Physician.
 *
 * @param {Record<string, any>} raw
 * @returns {Physician}
 */
export function toDomain(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('physicianMapper.toDomain: raw document is required')
  }

  const prefs = raw.preferences ?? {}

  // Clean provinces: "Ontario" becomes "ON", filter out anything we dont recognize
  const preferredProvinces = ensureStringArray(prefs.preferredProvinces)
    .map((p) => normalizeProvince(p))
    .filter(/** @returns {p is import("../interfaces/core/models.js").ProvinceCode} */ (p) => p !== null)

  // Split availabilityTypes into days + commitment
  const availability = normalizeAvailability(ensureStringArray(prefs.availabilityTypes))

  // Convert month/year date ranges into real Date objects
  const availabilityWindows = normalizeAvailabilityDateRanges(prefs.availabilityDateRanges)

  // Extract years from strings like "Available in 2025"
  const availabilityYears = normalizeAvailabilityYears(prefs.availabilityYears)

  return {
    _id: coerceObjectId(raw._id),
    medProfession: trimString(raw.medProfession),
    medSpeciality: trimString(raw.medSpeciality),
    isLookingForLocums: prefs.isLookingForLocums ?? true,
    location: null, // User schema has no coordinates
    workAddress: normalizeAddress(raw.workAddress),
    medicalProvince: normalizeProvince(raw.medicalProvince) ?? undefined,
    preferredProvinces,
    specificRegions: ensureStringArray(prefs.specificRegions),
    emrSystems: ensureStringArray(raw.emrSystems),
    facilityName: trimString(raw.facilityName) || undefined,
    facilityEMR: trimString(raw.facilityEMR) || undefined,
    firstName: trimString(raw.firstName) || undefined,
    lastName: trimString(raw.lastName) || undefined,
    role: trimString(raw.role) || undefined,
    languages: ensureStringArray(raw.languages),
    locumDurations: ensureStringArray(prefs.locumDurations)
      .map((d) => normalizeLocumDuration(d))
      .filter(/** @returns {d is import("../interfaces/core/models.js").DurationRange} */ (d) => d !== null),
    availableDays: availability.availableDays.length > 0 ? availability.availableDays : undefined,
    commitmentTypes: availability.commitmentTypes.length > 0 ? availability.commitmentTypes : undefined,
    availabilityWindows: availabilityWindows.length > 0 ? availabilityWindows : undefined,
    availabilityYears: availabilityYears.length > 0 ? availabilityYears : undefined,
    isProfileComplete: raw.isProfileComplete ?? undefined,
    isOnboardingCompleted: raw.isOnboardingCompleted ?? undefined,
  }
}

/**
 * Enriches a Physician with GPS coordinates from their workAddress.
 * Call this AFTER toDomain() when you need GPS quality location scoring.
 *
 * Takes a geocode function so you can swap between local lookup and Nominatim.
 *
 * @param {Physician} physician
 * @param {(address: import("../interfaces/core/models.js").Address) => Promise<import("../interfaces/core/models.js").GeoCoordinates | null> | import("../interfaces/core/models.js").GeoCoordinates | null} geocodeFn
 * @returns {Promise<Physician>}
 */
export async function enrichWithCoordinates(physician, geocodeFn) {
  if (physician.location) return physician
  if (!physician.workAddress?.city) return physician

  const coords = await geocodeFn(physician.workAddress)
  return coords ? { ...physician, location: coords } : physician
}

/**
 * Turns a clean Physician back into the raw Mongo shape.
 * Not built yet. Will be needed for write operations or SQL migration.
 *
 * @param {Physician} _physician
 * @returns {never}
 */
export function toPersistence(_physician) {
  throw new Error('physicianMapper.toPersistence: not implemented')
}
