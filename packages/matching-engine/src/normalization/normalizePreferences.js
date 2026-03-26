// @ts-check

// Physician Preference Normalizers
//
// The frontend stores physician preferences as free-text strings and dropdown values.
// These functions convert them into clean, structured domain types so scorers
// can compare numbers/dates/enums instead of parsing strings.
//
// All functions are used by physicianMapper.js to build the Physician domain model.

/** @typedef {import("@locvm/types").DayOfWeek} DayOfWeek */
/** @typedef {import("@locvm/types").CommitmentType} CommitmentType */
/** @typedef {import("@locvm/types").DurationRange} DurationRange */
/** @typedef {import("@locvm/types").AvailabilityWindow} AvailabilityWindow */

// ── Locum Duration ─────────────────────────────────────────────────────────
//
// Raw values from frontend dropdown:
//   "A few days"         → { minDays: 1,   maxDays: 7   }
//   "Less than a month"  → { minDays: 1,   maxDays: 30  }
//   "1-3 months"         → { minDays: 30,  maxDays: 90  }
//   "3-6 months"         → { minDays: 90,  maxDays: 180 }
//   "6+ months"          → { minDays: 180, maxDays: 365 }

/** @type {Map<string, DurationRange>} */
const DURATION_MAP = new Map([
  ['a few days', { minDays: 1, maxDays: 7 }],
  ['less than a month', { minDays: 1, maxDays: 30 }],
  ['1-3 months', { minDays: 30, maxDays: 90 }],
  ['3-6 months', { minDays: 90, maxDays: 180 }],
  ['6+ months', { minDays: 180, maxDays: 365 }],
])

/**
 * Takes a raw duration string and gives back a numeric day range (or null if unrecognized).
 *
 * @param {string} raw
 * @returns {DurationRange | null}
 */
export function normalizeLocumDuration(raw) {
  if (typeof raw !== 'string') return null
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
  return DURATION_MAP.get(key) ?? null
}

// ── Availability (Days + Commitment) ───────────────────────────────────────
//
// The frontend has a single dropdown with 5 options that mix two things:
//   WHEN:     "Weekdays" → Mon-Fri,  "Weekends" → Sat-Sun
//   HOW MUCH: "Full-time" → "full-time",  "Part-time" → "part-time",  "On-call or short notice" → "on-call"
//
// This splits them into two clean arrays.

/** @type {DayOfWeek[]} */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
/** @type {DayOfWeek[]} */
const WEEKEND = ['Sat', 'Sun']
/** @type {DayOfWeek[]} */
const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** @type {Map<string, DayOfWeek[]>} */
const DAY_MAP = new Map([
  ['weekdays', WEEKDAYS],
  ['weekends', WEEKEND],
])

/** @type {Map<string, CommitmentType>} */
const COMMITMENT_MAP = new Map([
  ['full-time', 'full-time'],
  ['part-time', 'part-time'],
  ['on-call or short notice', 'on-call'],
])

/**
 * Splits raw availabilityTypes into days and commitment levels.
 *
 * @param {string[]} rawTypes
 * @returns {{ availableDays: DayOfWeek[], commitmentTypes: CommitmentType[] }}
 */
export function normalizeAvailability(rawTypes) {
  if (!Array.isArray(rawTypes)) {
    return { availableDays: [], commitmentTypes: [] }
  }

  /** @type {Set<DayOfWeek>} */
  const daySet = new Set()
  /** @type {Set<CommitmentType>} */
  const commitmentSet = new Set()

  for (const raw of rawTypes) {
    if (typeof raw !== 'string') continue
    const key = raw.trim().toLowerCase()

    const days = DAY_MAP.get(key)
    if (days) {
      for (const d of days) daySet.add(d)
      continue
    }

    const commitment = COMMITMENT_MAP.get(key)
    if (commitment) {
      commitmentSet.add(commitment)
    }
  }

  const availableDays = DAY_ORDER.filter((d) => daySet.has(d))
  const commitmentTypes = /** @type {CommitmentType[]} */ ([...commitmentSet])

  return { availableDays, commitmentTypes }
}

// ── Availability Date Ranges ───────────────────────────────────────────────
//
// DB stores: { fromMonth: "november", fromYear: "2025", toMonth: "june", toYear: "2026" }
// We convert to: { from: Date(Nov 1 2025), to: Date(Jun 30 2026) }

/** @type {Map<string, number>} */
const MONTH_MAP = new Map([
  ['january', 0],
  ['february', 1],
  ['march', 2],
  ['april', 3],
  ['may', 4],
  ['june', 5],
  ['july', 6],
  ['august', 7],
  ['september', 8],
  ['october', 9],
  ['november', 10],
  ['december', 11],
])

/**
 * @param {*} month
 * @returns {number | null}
 */
function parseMonth(month) {
  if (typeof month !== 'string') return null
  return MONTH_MAP.get(month.trim().toLowerCase()) ?? null
}

/**
 * @param {*} year
 * @returns {number | null}
 */
function parseYear(year) {
  if (typeof year !== 'string' && typeof year !== 'number') return null
  const n = Number(year)
  if (isNaN(n) || n < 2000 || n > 2100) return null
  return n
}

/**
 * Converts a raw availability date range to clean Date objects.
 * Returns null if data is bad or incomplete.
 *
 * @param {*} raw
 * @returns {AvailabilityWindow | null}
 */
export function normalizeAvailabilityDateRange(raw) {
  if (!raw || typeof raw !== 'object') return null

  const fromMonthIndex = parseMonth(raw.fromMonth)
  const fromYear = parseYear(raw.fromYear)
  const toMonthIndex = parseMonth(raw.toMonth)
  const toYear = parseYear(raw.toYear)

  if (fromMonthIndex === null || fromYear === null || toMonthIndex === null || toYear === null) {
    return null
  }

  const from = new Date(fromYear, fromMonthIndex, 1)
  const to = new Date(toYear, toMonthIndex + 1, 0) // last day of the to month

  if (from > to) return null

  return { from, to }
}

/**
 * Normalizes an array of raw date range objects, filtering out bad ones.
 *
 * @param {*} rawArray
 * @returns {AvailabilityWindow[]}
 */
export function normalizeAvailabilityDateRanges(rawArray) {
  if (!Array.isArray(rawArray)) return []
  return rawArray
    .map((item) => normalizeAvailabilityDateRange(item))
    .filter(/** @returns {r is AvailabilityWindow} */ (r) => r !== null)
}

// ── Availability Years ─────────────────────────────────────────────────────
//
// DB stores: "Available in 2025" or just "2025"
// We extract the 4-digit year as a number.

/**
 * @param {*} raw
 * @returns {number | null}
 */
function parseAvailabilityYear(raw) {
  if (typeof raw !== 'string') return null
  const match = raw.match(/(\d{4})/)
  if (!match) return null
  const year = Number(match[1])
  if (year < 2000 || year > 2100) return null
  return year
}

/**
 * Extracts years from raw availability strings. Deduplicates and sorts ascending.
 *
 * @param {*} rawArray
 * @returns {number[]}
 */
export function normalizeAvailabilityYears(rawArray) {
  if (!Array.isArray(rawArray)) return []
  const years = rawArray
    .map((item) => parseAvailabilityYear(item))
    .filter(/** @returns {y is number} */ (y) => y !== null)
  return [...new Set(years)].sort((a, b) => a - b)
}
