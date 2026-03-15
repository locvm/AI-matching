// @ts-check

// Shared helpers for the normalization layer.
//
// These handle all the messy stuff from MongoDB documents.
// ObjectIds, dates, nulls, whitespace, you name it.
//
// When we migrate to SQL most of these get way simpler.

/** @typedef {import("../interfaces/core/models.js").Address} Address */
/** @typedef {import("../interfaces/core/models.js").ProvinceCode} ProvinceCode */

import { normalizeProvince } from './normalizeProvince.js'

/**
 * Turns any kind of ID into a plain string.
 * Works with Mongoose ObjectIds, Extended JSON {$oid: "abc123"}, plain strings, or null.
 *
 * @param {*} value
 * @returns {string}
 */
export function coerceObjectId(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value.$oid) return String(value.$oid)
  if (typeof value.toString === 'function') return value.toString()
  return ''
}

/**
 * Turns any kind of date value into a real Date object (or null if its bad).
 * Works with Date objects, ISO strings, Extended JSON {$date: "..."}, or timestamps.
 *
 * @param {*} value
 * @returns {Date | null}
 */
export function ensureDate(value) {
  if (value == null) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'object' && value.$date) {
    const d = new Date(value.$date)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Trims whitespace off a string. Returns the fallback if its not a string or empty.
 *
 * @param {*} value
 * @param {string} [fallback=""]
 * @returns {string}
 */
export function trimString(value, fallback = '') {
  if (value == null || typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

/**
 * Makes sure you get back an array of clean strings.
 * Filters out anything thats not a string, empty, or just whitespace.
 *
 * @param {*} value
 * @returns {string[]}
 */
export function ensureStringArray(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * Cleans up a raw address object. Province gets normalized to a 2 letter code.
 *
 * @param {*} raw
 * @returns {Address | null}
 */
export function normalizeAddress(raw) {
  if (!raw || typeof raw !== 'object') return null

  /** @type {Address} */
  const address = {}

  if (raw.streetNumber != null) address.streetNumber = trimString(raw.streetNumber) || undefined
  if (raw.streetName != null) address.streetName = trimString(raw.streetName) || undefined
  if (raw.city != null) address.city = trimString(raw.city) || undefined
  if (raw.postalCode != null) address.postalCode = trimString(raw.postalCode) || undefined
  if (raw.country != null) address.country = trimString(raw.country) || undefined

  const province = normalizeProvince(raw.province)
  if (province) address.province = province

  return address
}
