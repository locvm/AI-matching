// @ts-check

// Haversine great-circle distance
//
// Computes the distance in km between two lat/lng points on Earth
// Error is under 0.3% for distances under 500km (good enough for Canadian locum matching)

/** @typedef {import("../../interfaces/core/models.js").GeoCoordinates} GeoCoordinates */

const EARTH_RADIUS_KM = 6371;

/**
 * Converts degrees to radians
 *
 * @param {number} deg
 * @returns {number}
 */
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Computes the Haversine great-circle distance between two points
 *
 * @param {GeoCoordinates} a - first point { lng, lat }
 * @param {GeoCoordinates} b - second point { lng, lat }
 * @returns {number} distance in kilometers
 */
export function haversineKm(a, b) {
  const phi1 = toRadians(a.lat);
  const phi2 = toRadians(b.lat);
  const deltaPhi = toRadians(b.lat - a.lat);
  const deltaLambda = toRadians(b.lng - a.lng);

  const halfChord =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  const angularDistance = 2 * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord));

  return EARTH_RADIUS_KM * angularDistance;
}
