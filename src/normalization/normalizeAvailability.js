// @ts-check

// Availability Normalizer
//
// The frontend has a single dropdown with 5 options but they mix
// two totally different things.
//
// WHEN (which days):
//   "Weekdays"  (81x)  becomes  Mon, Tue, Wed, Thu, Fri
//   "Weekends"  (50x)  becomes  Sat, Sun
//
// HOW MUCH (commitment level):
//   "Full-time"                (46x)  becomes  "full-time"
//   "Part-time"                (73x)  becomes  "part-time"
//   "On-call or short notice"  (35x)  becomes  "on-call"
//
// So this module splits them into two clean fields.
//   availableDays:   ["Mon", "Tue", ...]  (no duplicates, sorted Mon to Sun)
//   commitmentTypes: ["full-time", "part-time", "on-call"]

/** @typedef {import("../interfaces/core/models.js").DayOfWeek} DayOfWeek */
/** @typedef {import("../interfaces/core/models.js").CommitmentType} CommitmentType */

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
 * Takes the raw availabilityTypes array and splits it into days and commitment levels.
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

  // Sort days Mon to Sun
  const availableDays = DAY_ORDER.filter((d) => daySet.has(d))
  const commitmentTypes = /** @type {CommitmentType[]} */ ([...commitmentSet])

  return { availableDays, commitmentTypes }
}
