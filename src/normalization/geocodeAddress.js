// @ts-check

// Nominatim Geocoding
//
// Calls OpenStreetMap's free Nominatim API to convert an address into GPS coordinates.
// Rate limit: 1 request per second on the public API. See src/scoring/location/README.md.
//
// For most cases, use the local canadianCities.js lookup first (instant, no network).
// This is the fallback for addresses the local table doesnt cover.

/** @typedef {import("../interfaces/core/models.js").GeoCoordinates} GeoCoordinates */
/** @typedef {import("../interfaces/core/models.js").Address} Address */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'LOCVM-matching-service/0.1.0 (locum physician matching engine)'

/**
 * Geocodes an address using the Nominatim API.
 *
 * @param {Address} address
 * @returns {Promise<GeoCoordinates | null>} coordinates or null if not found/error
 */
export async function geocodeAddress(address) {
  if (!address?.city) return null

  const parts = []
  if (address.streetNumber) parts.push(address.streetNumber)
  if (address.streetName) parts.push(address.streetName)
  parts.push(address.city)
  if (address.province) parts.push(address.province)
  if (address.country) parts.push(address.country)

  const query = parts.join(', ')

  try {
    const url = new URL(NOMINATIM_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'ca')

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!response.ok) return null

    const results = /** @type {Array<{ lat: string, lon: string }>} */ (await response.json())
    if (!results || results.length === 0) return null

    const lat = parseFloat(results[0].lat)
    const lng = parseFloat(results[0].lon)

    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    return { lat, lng }
  } catch {
    return null
  }
}
