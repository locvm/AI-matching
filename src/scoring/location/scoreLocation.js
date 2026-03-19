// @ts-check

// Location Scoring Implementation
//
// Scores how geographically close/convenient a job is for a physician
// Uses a reverse sigmoid for GPS distance, with fallback tiers for province/region matching
//
// Tier 1: GPS coordinates → reverse sigmoid on Haversine distance
// Tier 2: specificRegions → free-text region matching against job city
// Tier 3: preferredProvinces → province match
// Tier 4: workAddress.province → province match
// Tier 5: medicalProvince → province match
// Tier 6: no data → neutral 0.50

/** @typedef {import("../../interfaces/core/models.js").Physician} Physician */
/** @typedef {import("../../interfaces/core/models.js").GeoCoordinates} GeoCoordinates */
/** @typedef {import("../../interfaces/core/models.js").Address} Address */
/** @typedef {import("../../interfaces/core/models.js").ProvinceCode} ProvinceCode */

import { normalizeProvince } from '../../normalization/normalizeProvince.js'
import { LOCATION_CONFIG } from '../../config/locationConfig.js'

// ── Haversine distance ─────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371

/** @param {number} deg */
function toRadians(deg) {
  return (deg * Math.PI) / 180
}

/**
 * Haversine great-circle distance between two points.
 *
 * @param {GeoCoordinates} a
 * @param {GeoCoordinates} b
 * @returns {number} distance in kilometers
 */
export function haversineKm(a, b) {
  const phi1 = toRadians(a.lat)
  const phi2 = toRadians(b.lat)
  const deltaPhi = toRadians(b.lat - a.lat)
  const deltaLambda = toRadians(b.lng - a.lng)

  const halfChord = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2

  const angularDistance = 2 * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord))

  return EARTH_RADIUS_KM * angularDistance
}

/**
 * @typedef {"gps_distance" | "specific_region" | "preferred_province" | "work_province" | "medical_province" | "no_data"} ScoringMethod
 */

/**
 * @typedef {Object} LocationScoreDetail
 * @property {number} score - the final score in [0, 1]
 * @property {ScoringMethod} method - which tier was used
 * @property {number | null} distanceKm - Haversine distance, null when GPS not used
 * @property {"same_city" | "nearby" | "regional" | "far" | "very_far" | "unknown"} distanceBucket
 * @property {string | null} matchedRegion - the specificRegion string that matched, if any
 * @property {ProvinceCode | null} resolvedPhysicianProvince - physician province used for comparison
 * @property {ProvinceCode | null} resolvedJobProvince - job province used for comparison
 * @property {boolean} provinceMatch - whether provinces matched
 */

/**
 * Checks if coordinates are valid (not null, not [0,0] corrupted data)
 *
 * @param {GeoCoordinates | null | undefined} coords
 * @returns {boolean}
 */
function isValidCoords(coords) {
  if (!coords) return false
  if (coords.lat === 0 && coords.lng === 0) return false
  return true
}

/**
 * Applies the reverse sigmoid function to a distance
 *
 * score(d) = 1 / (1 + exp(k * (d - midpoint)))
 *
 * @param {number} distanceKm
 * @param {typeof LOCATION_CONFIG} [config]
 * @returns {number} score in [0, 1]
 */
function reverseSigmoid(distanceKm, config = LOCATION_CONFIG) {
  const { MIDPOINT_KM, STEEPNESS_K } = config
  return 1 / (1 + Math.exp(STEEPNESS_K * (distanceKm - MIDPOINT_KM)))
}

/**
 * Maps a distance to a human-readable bucket
 *
 * @param {number | null} distanceKm
 * @param {typeof LOCATION_CONFIG} [config]
 * @returns {"same_city" | "nearby" | "regional" | "far" | "very_far" | "unknown"}
 */
function getDistanceBucket(distanceKm, config = LOCATION_CONFIG) {
  if (distanceKm === null) return 'unknown'
  const { SAME_CITY, NEARBY, REGIONAL, FAR } = config.DISTANCE_BUCKETS
  if (distanceKm <= SAME_CITY) return 'same_city'
  if (distanceKm <= NEARBY) return 'nearby'
  if (distanceKm <= REGIONAL) return 'regional'
  if (distanceKm <= FAR) return 'far'
  return 'very_far'
}

/**
 * Checks if a specificRegion string is too coarse (just a province name)
 *
 * @param {string} region
 * @param {typeof LOCATION_CONFIG} [config]
 * @returns {boolean}
 */
function isCoarseRegion(region, config = LOCATION_CONFIG) {
  return config.COARSE_REGION_NAMES.includes(region.trim().toLowerCase())
}

/**
 * Checks if a specificRegion matches the job's city/address
 * Case-insensitive substring matching
 *
 * @param {string} region - the physician's specificRegion entry
 * @param {Address} jobAddress - the job's full address
 * @returns {boolean}
 */
function regionMatchesJob(region, jobAddress) {
  const regionLower = region.trim().toLowerCase()
  const cityLower = (jobAddress.city ?? '').trim().toLowerCase()

  if (!cityLower) return false

  // Check if region contains city or city contains region
  // e.g. "downtown toronto" contains "toronto", or "toronto" matches "toronto"
  return regionLower.includes(cityLower) || cityLower.includes(regionLower)
}

/**
 * Scores a physician's location match against a job location with full detail
 *
 * @param {Physician} physician
 * @param {GeoCoordinates | null} jobLocation
 * @param {Address} [jobAddress]
 * @param {typeof LOCATION_CONFIG} [config]
 * @returns {LocationScoreDetail}
 */
export function scoreLocationWithDetail(physician, jobLocation, jobAddress, config = LOCATION_CONFIG) {
  const { SCORES } = config
  const jobProvince = jobAddress ? normalizeProvince(jobAddress.province) : null

  // Base detail object
  /** @type {LocationScoreDetail} */
  const detail = {
    score: SCORES.NO_DATA,
    method: 'no_data',
    distanceKm: null,
    distanceBucket: 'unknown',
    matchedRegion: null,
    resolvedPhysicianProvince: null,
    resolvedJobProvince: jobProvince,
    provinceMatch: false,
  }

  // Tier 1: GPS coordinates
  if (isValidCoords(physician.location) && isValidCoords(jobLocation)) {
    const distance = haversineKm(
      /** @type {GeoCoordinates} */ (physician.location),
      /** @type {GeoCoordinates} */ (jobLocation)
    )
    const score = reverseSigmoid(distance, config)

    detail.score = Math.max(0, Math.min(1, score))
    detail.method = 'gps_distance'
    detail.distanceKm = Math.round(distance * 100) / 100
    detail.distanceBucket = getDistanceBucket(distance, config)

    // Also resolve province for informational purposes
    const physicianProvince = normalizeProvince(physician.workAddress?.province)
    detail.resolvedPhysicianProvince = physicianProvince
    detail.provinceMatch = physicianProvince !== null && physicianProvince === jobProvince

    return detail
  }

  // Tier 2: specificRegions
  if (physician.specificRegions && physician.specificRegions.length > 0 && jobAddress) {
    // Filter out coarse regions (just province names)
    const granularRegions = physician.specificRegions.filter((r) => !isCoarseRegion(r, config))

    if (granularRegions.length > 0) {
      const matchedRegion = granularRegions.find((r) => regionMatchesJob(r, jobAddress))

      detail.method = 'specific_region'
      detail.score = matchedRegion ? SCORES.SPECIFIC_REGION_MATCH : SCORES.SPECIFIC_REGION_MISMATCH
      detail.matchedRegion = matchedRegion ?? null

      const physicianProvince = normalizeProvince(physician.workAddress?.province)
      detail.resolvedPhysicianProvince = physicianProvince
      detail.provinceMatch = physicianProvince !== null && physicianProvince === jobProvince

      return detail
    }
    // If all regions are coarse, fall through to Tier 3
  }

  // Tier 3: preferredProvinces
  if (physician.preferredProvinces && physician.preferredProvinces.length > 0 && jobProvince) {
    // preferredProvinces should already be clean ProvinceCodes but normalize just in case
    const normalizedPreferred = physician.preferredProvinces
      .map((p) => normalizeProvince(p))
      .filter(/** @returns {p is ProvinceCode} */ (p) => p !== null)

    if (normalizedPreferred.length > 0) {
      const match = normalizedPreferred.includes(jobProvince)

      detail.method = 'preferred_province'
      detail.score = match ? SCORES.PREFERRED_PROVINCE_MATCH : SCORES.PREFERRED_PROVINCE_MISMATCH
      detail.resolvedPhysicianProvince = normalizedPreferred[0]
      detail.provinceMatch = match

      return detail
    }
  }

  // Tier 4: workAddress province
  if (physician.workAddress?.province && jobProvince) {
    const workProvince = normalizeProvince(physician.workAddress.province)

    if (workProvince) {
      const match = workProvince === jobProvince

      detail.method = 'work_province'
      detail.score = match ? SCORES.WORK_PROVINCE_MATCH : SCORES.WORK_PROVINCE_MISMATCH
      detail.resolvedPhysicianProvince = workProvince
      detail.provinceMatch = match

      return detail
    }
  }

  // Tier 5: medicalProvince
  if (physician.medicalProvince && jobProvince) {
    const medProvince = normalizeProvince(physician.medicalProvince)

    if (medProvince) {
      const match = medProvince === jobProvince

      detail.method = 'medical_province'
      detail.score = match ? SCORES.MEDICAL_PROVINCE_MATCH : SCORES.MEDICAL_PROVINCE_MISMATCH
      detail.resolvedPhysicianProvince = medProvince
      detail.provinceMatch = match

      return detail
    }
  }

  // Tier 6: no usable location data
  return detail
}

/**
 * Scores a physician's location match against a job location
 *
 * Conforms to the ScoreLocationFn interface:
 *   (physician, jobLocation, jobAddress?) -> number in [0, 1]
 *
 * @param {Physician} physician
 * @param {GeoCoordinates | null} jobLocation
 * @param {Address} [jobAddress]
 * @param {typeof LOCATION_CONFIG} [config]
 * @returns {number} score in [0, 1]
 */
export function scoreLocation(physician, jobLocation, jobAddress, config = LOCATION_CONFIG) {
  return scoreLocationWithDetail(physician, jobLocation, jobAddress, config).score
}
