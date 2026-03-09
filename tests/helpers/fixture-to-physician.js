// @ts-check

/**
 * Temporary adapter: converts raw fixture User records into Physician shapes
 * for scorer tests. Lives here until the real cleanup layer exists.
 */

/** @typedef {import("../harness/lib/types.js").User} User */
/** @typedef {import("../../src/interfaces/core/models.js").Physician} Physician */
/** @typedef {import("../../src/interfaces/core/models.js").AvailabilityWindow} AvailabilityWindow */

const MONTH_INDEX = /** @type {Record<string, number>} */ ({
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
})

/**
 * Fixture data stores availability as { fromMonth, fromYear, toMonth, toYear } strings.
 * This converts them to { from: Date, to: Date } windows.
 *
 * @param {User} user
 * @returns {AvailabilityWindow[]}
 */
export function parseAvailability(user) {
  const ranges = user.preferences?.availabilityDateRanges
  if (!ranges?.length) return []

  /** @type {AvailabilityWindow[]} */
  const windows = []

  for (const r of ranges) {
    const raw = /** @type {any} */ (r)
    if (typeof raw.fromMonth !== 'string' || typeof raw.toMonth !== 'string') continue

    const fromIdx = MONTH_INDEX[raw.fromMonth.toLowerCase()]
    const toIdx = MONTH_INDEX[raw.toMonth.toLowerCase()]
    const fromYear = parseInt(raw.fromYear, 10)
    const toYear = parseInt(raw.toYear, 10)

    if (fromIdx === undefined || toIdx === undefined || isNaN(fromYear) || isNaN(toYear)) continue

    windows.push({
      from: new Date(fromYear, fromIdx, 1),
      to: new Date(toYear, toIdx + 1, 0),
    })
  }

  return windows
}

/**
 * @param {User} user
 * @returns {Physician}
 */
export function toPhysician(user) {
  return /** @type {Physician} */ ({
    id: user._id,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    medProfession: user.medProfession ?? '',
    medSpeciality: user.medSpeciality ?? '',
    isLookingForLocums: user.preferences?.isLookingForLocums ?? true,
    location: null,
    workAddress: null,
    preferredProvinces: [],
    emrSystems: user.emrSystems ?? [],
    languages: [],
    availability: parseAvailability(user),
    locumDurations: user.preferences?.locumDurations ?? [],
    availabilityTypes: user.preferences?.availabilityTypes ?? [],
    isProfileComplete: true,
    isOnboardingCompleted: true,
  })
}
