// @ts-check

// Canadian Cities GPS Lookup Table
//
// A local lookup of Canadian city names to GPS coordinates.
// Used to enrich physician addresses with lat/lng so the location scorer
// can use Tier 1 (GPS distance) instead of falling back to province matching.
//
// Data sourced from job fixture coordinates (which come from geocoded addresses in production)
// plus additional common Canadian cities from GeoNames.
//
// To add a new city: just add a line to the CITIES Map below.
// Key format: "cityname:XX" where XX is 2-letter province code, all lowercase.

/** @typedef {import("../../interfaces/core/models.js").GeoCoordinates} GeoCoordinates */

/**
 * @type {Map<string, GeoCoordinates>}
 */
const CITIES = new Map([
  // Ontario (most physicians and jobs are here)
  ['toronto:on', { lat: 43.6532, lng: -79.3832 }],
  ['north york:on', { lat: 43.7615, lng: -79.4111 }],
  ['scarborough:on', { lat: 43.7731, lng: -79.2577 }],
  ['etobicoke:on', { lat: 43.6205, lng: -79.5132 }],
  ['mississauga:on', { lat: 43.589, lng: -79.6441 }],
  ['brampton:on', { lat: 43.6834, lng: -79.7664 }],
  ['hamilton:on', { lat: 43.2557, lng: -79.8711 }],
  ['ottawa:on', { lat: 45.4215, lng: -75.6972 }],
  ['london:on', { lat: 42.9849, lng: -81.2453 }],
  ['barrie:on', { lat: 44.3894, lng: -79.6903 }],
  ['guelph:on', { lat: 43.5448, lng: -80.2482 }],
  ['kitchener:on', { lat: 43.4516, lng: -80.4925 }],
  ['waterloo:on', { lat: 43.4643, lng: -80.5204 }],
  ['cambridge:on', { lat: 43.3616, lng: -80.3144 }],
  ['windsor:on', { lat: 42.3149, lng: -83.0364 }],
  ['sudbury:on', { lat: 46.4917, lng: -80.993 }],
  ['thunder bay:on', { lat: 48.3809, lng: -89.2477 }],
  ['kingston:on', { lat: 44.2312, lng: -76.486 }],
  ['orillia:on', { lat: 44.6083, lng: -79.4208 }],
  ['ajax:on', { lat: 43.8509, lng: -79.0204 }],
  ['markham:on', { lat: 43.8561, lng: -79.337 }],
  ['oakville:on', { lat: 43.4675, lng: -79.6877 }],
  ['burlington:on', { lat: 43.3255, lng: -79.799 }],
  ['thornhill:on', { lat: 43.8159, lng: -79.452 }],
  ['aurora:on', { lat: 44.0065, lng: -79.4504 }],
  ['whitby:on', { lat: 43.8975, lng: -78.9429 }],
  ['cobourg:on', { lat: 43.9595, lng: -78.168 }],
  ['cornwall:on', { lat: 45.0213, lng: -74.7307 }],
  ['north bay:on', { lat: 46.3091, lng: -79.4608 }],
  ['dryden:on', { lat: 49.7818, lng: -92.8375 }],
  ['kenora:on', { lat: 49.7669, lng: -94.4894 }],
  ['hearst:on', { lat: 49.6853, lng: -83.6791 }],
  ['wawa:on', { lat: 47.9317, lng: -84.7746 }],
  ['sundridge:on', { lat: 45.7734, lng: -79.3867 }],
  ['collingwood:on', { lat: 44.5014, lng: -80.2169 }],
  ['orangeville:on', { lat: 43.9201, lng: -80.0943 }],
  ['shelburne:on', { lat: 44.076, lng: -80.2003 }],
  ['midland:on', { lat: 44.7497, lng: -79.8862 }],
  ['dundas:on', { lat: 43.2669, lng: -79.9583 }],
  ['milton:on', { lat: 43.5183, lng: -79.8774 }],
  ['stratford:on', { lat: 43.37, lng: -80.9823 }],
  ['brantford:on', { lat: 43.1394, lng: -80.2644 }],
  ['st. catharines:on', { lat: 43.1594, lng: -79.2469 }],
  ['tilbury:on', { lat: 42.256, lng: -82.4313 }],
  ['manotick:on', { lat: 45.2233, lng: -75.6839 }],
  ['nobleton:on', { lat: 43.9001, lng: -79.6519 }],
  ['palmerston:on', { lat: 43.8347, lng: -80.8358 }],
  ['alton:on', { lat: 43.8595, lng: -80.0675 }],
  ['alliston:on', { lat: 44.1535, lng: -79.8726 }],
  ['perth:on', { lat: 44.8991, lng: -76.2491 }],
  ['smiths falls:on', { lat: 44.9042, lng: -76.0274 }],
  ['petawawa:on', { lat: 45.8964, lng: -77.2808 }],
  ['deep river:on', { lat: 46.0983, lng: -77.4969 }],
  ['gloucester:on', { lat: 45.3579, lng: -75.5118 }],
  ['osgoode:on', { lat: 45.1878, lng: -75.5894 }],
  ['hawkesbury:on', { lat: 45.6086, lng: -74.6058 }],
  ['gananoque:on', { lat: 44.3269, lng: -76.1641 }],
  ['alexandria:on', { lat: 45.3168, lng: -74.6447 }],
  ['leamington:on', { lat: 42.0537, lng: -82.5998 }],
  ['stoney creek:on', { lat: 43.2173, lng: -79.7672 }],
  ['woodbridge:on', { lat: 43.7765, lng: -79.5932 }],
  ['maple:on', { lat: 43.8528, lng: -79.5059 }],
  ['uxbridge:on', { lat: 44.1078, lng: -79.1204 }],
  ['strathroy:on', { lat: 42.9576, lng: -81.6161 }],
  ['meaford:on', { lat: 44.6058, lng: -80.593 }],
  ['morriston:on', { lat: 43.4551, lng: -80.2044 }],
  ['chapleau:on', { lat: 47.8399, lng: -83.3989 }],

  // Quebec
  ['montreal:qc', { lat: 45.5017, lng: -73.5673 }],
  ['quebec city:qc', { lat: 46.8139, lng: -71.208 }],
  ['salaberry-de-valleyfield:qc', { lat: 45.2536, lng: -74.1325 }],

  // Alberta
  ['edmonton:ab', { lat: 53.5461, lng: -113.4938 }],
  ['calgary:ab', { lat: 51.0447, lng: -114.0719 }],

  // British Columbia
  ['vancouver:bc', { lat: 49.2827, lng: -123.1207 }],
  ['surrey:bc', { lat: 49.1913, lng: -122.849 }],
  ['new westminster:bc', { lat: 49.2057, lng: -122.911 }],
])

// Toronto subdivision aliases (these neighborhoods are often listed as cities)
const TORONTO_ALIASES = new Set(['north york', 'scarborough', 'etobicoke', 'east york', 'york'])

/**
 * Looks up GPS coordinates for a Canadian city.
 *
 * @param {string} city - city name (any case, gets trimmed and lowercased)
 * @param {string} province - 2-letter province code like "ON", "BC", "AB"
 * @returns {GeoCoordinates | null} coordinates or null if not found
 */
export function lookupCity(city, province) {
  if (!city || !province) return null

  const cleanCity = city.trim().toLowerCase()
  const cleanProvince = province.trim().toLowerCase()
  const key = cleanCity + ':' + cleanProvince

  // Direct lookup
  const direct = CITIES.get(key)
  if (direct) return direct

  // Toronto subdivision fallback: "North York" with province "ON" -> Toronto coords
  if (cleanProvince === 'on' && TORONTO_ALIASES.has(cleanCity)) {
    return CITIES.get('toronto:on') ?? null
  }

  return null
}

/**
 * Looks up GPS coordinates from an Address object.
 * Convenience wrapper around lookupCity that handles province normalization.
 *
 * @param {import("../../interfaces/core/models.js").Address} address
 * @returns {GeoCoordinates | null}
 */
export function lookupAddress(address) {
  if (!address?.city || !address?.province) return null
  return lookupCity(address.city, address.province)
}
