// @ts-check

// Availability Years Normalizer
//
// The frontend lets physicians pick which years they are available.
// The DB stores these as strings like "Available in 2025" or just "2025".
// This turns them into plain numbers so the scorer can compare them against job date ranges.

/**
 * Pulls the year out of a string like "Available in 2025" or just "2025".
 * Returns null if we cant find a valid year.
 *
 * @param {*} raw
 * @returns {number | null}
 */
function parseAvailabilityYear(raw) {
  if (typeof raw !== "string") return null;

  const match = raw.match(/(\d{4})/);
  if (!match) return null;

  const year = Number(match[1]);
  if (year < 2000 || year > 2100) return null;

  return year;
}

/**
 * Takes an array of raw availability year strings and gives back clean numbers.
 * Filters out bad ones and deduplicates.
 *
 * "Available in 2025" becomes 2025.
 * "2026" becomes 2026.
 *
 * @param {*} rawArray
 * @returns {number[]}
 */
export function normalizeAvailabilityYears(rawArray) {
  if (!Array.isArray(rawArray)) return [];

  const years = rawArray
    .map((item) => parseAvailabilityYear(item))
    .filter(/** @returns {y is number} */ (y) => y !== null);

  // Deduplicate and sort
  return [...new Set(years)].sort((a, b) => a - b);
}
