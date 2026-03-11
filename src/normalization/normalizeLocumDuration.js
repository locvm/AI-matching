// @ts-check

// Locum Duration Normalizer
//
// The frontend has a dropdown with 5 duration options. The DB stores them
// as plain strings (no enum). This turns them into numeric day ranges
// so the scoring engine can just compare numbers instead of parsing strings.
//
// Raw values from 410 physicians:
//   "A few days"         (46x)  becomes  { minDays: 1,   maxDays: 7   }
//   "Less than a month"  (55x)  becomes  { minDays: 1,   maxDays: 30  }
//   "1-3 months"         (62x)  becomes  { minDays: 30,  maxDays: 90  }
//   "3-6 months"         (43x)  becomes  { minDays: 90,  maxDays: 180 }
//   "6+ months"          (23x)  becomes  { minDays: 180, maxDays: 365 }

/** @typedef {import("../interfaces/core/models.js").DurationRange} DurationRange */

/**
 * Lookup table. Keys are lowercased. We swap any fancy dashes to regular hyphens before lookup.
 * @type {Map<string, DurationRange>}
 */
const DURATION_MAP = new Map([
  ["a few days",         { minDays: 1,   maxDays: 7   }],
  ["less than a month",  { minDays: 1,   maxDays: 30  }],
  ["1-3 months",         { minDays: 30,  maxDays: 90  }],
  ["3-6 months",         { minDays: 90,  maxDays: 180 }],
  ["6+ months",          { minDays: 180, maxDays: 365 }],
]);

/**
 * Takes a raw duration string and gives back a numeric day range (or null if we dont recognize it).
 *
 * @param {string} raw
 * @returns {DurationRange | null}
 */
export function normalizeLocumDuration(raw) {
  if (typeof raw !== "string") return null;

  // Clean up: trim, lowercase, swap fancy dashes to regular hyphen
  const key = raw.trim().toLowerCase().replace(/[\u2013\u2014]/g, "-");

  return DURATION_MAP.get(key) ?? null;
}
