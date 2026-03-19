// @ts-check

// Batch Geocoding
//
// Geocodes all physicians that have a workAddress but no GPS coordinates.
// Supports two modes: local lookup (instant) and Nominatim API (1 req/sec).
//
// The local lookup uses canadianCities.js and covers ~100 known cities.
// Nominatim is the fallback for cities the local table doesnt have.

/** @typedef {import("../interfaces/core/models.js").Physician} Physician */
/** @typedef {import("../interfaces/core/models.js").GeoCoordinates} GeoCoordinates */
/** @typedef {import("../interfaces/core/models.js").Address} Address */

import { lookupAddress } from '../scoring/location/canadianCities.js'
import { geocodeAddress } from './geocodeAddress.js'

/**
 * Delays execution for a given number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Enriches a single physician with GPS coordinates.
 * Tries local lookup first, then optionally falls back to Nominatim.
 *
 * @param {Physician} physician
 * @param {{ useNominatim?: boolean }} [options]
 * @returns {Promise<Physician>}
 */
async function enrichOne(physician, options = {}) {
  if (physician.location) return physician
  if (!physician.workAddress?.city) return physician

  // Try local lookup first (instant)
  const local = lookupAddress(physician.workAddress)
  if (local) {
    return { ...physician, location: local }
  }

  // Fallback to Nominatim if enabled
  if (options.useNominatim) {
    const remote = await geocodeAddress(physician.workAddress)
    if (remote) {
      return { ...physician, location: remote }
    }
  }

  return physician
}

/**
 * Batch geocodes all physicians.
 *
 * @param {Physician[]} physicians
 * @param {{ useNominatim?: boolean, onProgress?: (done: number, total: number) => void }} [options]
 * @returns {Promise<{ physicians: Physician[], enriched: number, localHits: number, nominatimHits: number, missed: number }>}
 */
export async function geocodeBatch(physicians, options = {}) {
  const { useNominatim = false, onProgress } = options
  let enriched = 0
  let localHits = 0
  let nominatimHits = 0
  let missed = 0
  let nominatimCalls = 0

  const results = []

  for (let i = 0; i < physicians.length; i++) {
    const physician = physicians[i]

    if (physician.location || !physician.workAddress?.city) {
      results.push(physician)
      continue
    }

    // Try local first
    const local = lookupAddress(physician.workAddress)
    if (local) {
      results.push({ ...physician, location: local })
      enriched++
      localHits++
      if (onProgress) onProgress(i + 1, physicians.length)
      continue
    }

    // Try Nominatim
    if (useNominatim) {
      // Rate limit: 1 req/sec
      if (nominatimCalls > 0) {
        await delay(1100)
      }
      nominatimCalls++

      const remote = await geocodeAddress(physician.workAddress)
      if (remote) {
        results.push({ ...physician, location: remote })
        enriched++
        nominatimHits++
      } else {
        results.push(physician)
        missed++
      }
    } else {
      results.push(physician)
      missed++
    }

    if (onProgress) onProgress(i + 1, physicians.length)
  }

  return { physicians: results, enriched, localHits, nominatimHits, missed }
}
