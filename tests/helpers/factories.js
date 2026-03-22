// @ts-check

/** @typedef {import("../../src/interfaces/core/models.js").Physician} Physician */

/**
 * @param {Partial<Physician>} [overrides]
 * @returns {Physician}
 */
export function makePhysician(overrides = {}) {
  return {
    _id: 'test-physician',
    firstName: 'Jane',
    lastName: 'Doe',
    medProfession: 'Physician',
    medSpeciality: 'Family Medicine',
    isLookingForLocums: true,
    location: null,
    workAddress: null,
    preferredProvinces: [],
    specificRegions: [],
    emrSystems: [],
    languages: ['English'],
    availabilityWindows: [],
    locumDurations: [],
    isProfileComplete: true,
    isOnboardingCompleted: true,
    ...overrides,
  }
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {{ from: Date, to: Date }}
 */
export function dateRange(from, to) {
  return { from: new Date(from), to: new Date(to) }
}
