// @ts-check

// Availability Date Range Normalizer
//
// The frontend lets physicians pick "from month/year to month/year" windows.
// The DB stores these as strings like { fromMonth: "november", fromYear: "2025", toMonth: "june", toYear: "2026" }.
// This turns them into real Date objects so the scorer can compare them against job date ranges.
//
// The "from" date is the first day of the from month.
// The "to" date is the last day of the to month.
// So "november 2025 to june 2026" becomes Nov 1 2025 to Jun 30 2026.

/** @typedef {import("../interfaces/core/models.js").AvailabilityWindow} AvailabilityWindow */

/** @type {Map<string, number>} */
const MONTH_MAP = new Map([
  ["january", 0],
  ["february", 1],
  ["march", 2],
  ["april", 3],
  ["may", 4],
  ["june", 5],
  ["july", 6],
  ["august", 7],
  ["september", 8],
  ["october", 9],
  ["november", 10],
  ["december", 11],
]);

/**
 * Turns a month string into a 0 based index (January is 0, December is 11).
 * Returns null if we dont recognize it.
 *
 * @param {*} month
 * @returns {number | null}
 */
function parseMonth(month) {
  if (typeof month !== "string") return null;
  return MONTH_MAP.get(month.trim().toLowerCase()) ?? null;
}

/**
 * Turns a year string into a number. Returns null if its not a valid year.
 *
 * @param {*} year
 * @returns {number | null}
 */
function parseYear(year) {
  if (typeof year !== "string" && typeof year !== "number") return null;
  const n = Number(year);
  if (isNaN(n) || n < 2000 || n > 2100) return null;
  return n;
}

/**
 * Takes a raw availability date range object and gives back a clean AvailabilityWindow.
 * Returns null if the data is bad or incomplete.
 *
 * The "from" date is the first day of the from month.
 * The "to" date is the last day of the to month (we go to the next month and subtract 1 day).
 *
 * @param {*} raw
 * @returns {AvailabilityWindow | null}
 */
export function normalizeAvailabilityDateRange(raw) {
  if (!raw || typeof raw !== "object") return null;

  const fromMonthIndex = parseMonth(raw.fromMonth);
  const fromYear = parseYear(raw.fromYear);
  const toMonthIndex = parseMonth(raw.toMonth);
  const toYear = parseYear(raw.toYear);

  // All 4 fields are required.
  if (fromMonthIndex === null || fromYear === null || toMonthIndex === null || toYear === null) {
    return null;
  }

  // First day of the from month.
  const from = new Date(fromYear, fromMonthIndex, 1);

  // Last day of the to month. We go to the 1st of the next month and subtract 1 day.
  const to = new Date(toYear, toMonthIndex + 1, 0);

  // Sanity check. "from" should be before or equal to "to".
  if (from > to) return null;

  return { from, to };
}

/**
 * Takes an array of raw availability date range objects and normalizes all of them.
 * Filters out any bad ones. Returns a clean array.
 *
 * @param {*} rawArray
 * @returns {AvailabilityWindow[]}
 */
export function normalizeAvailabilityDateRanges(rawArray) {
  if (!Array.isArray(rawArray)) return [];

  return rawArray
    .map((item) => normalizeAvailabilityDateRange(item))
    .filter(/** @returns {r is AvailabilityWindow} */ (r) => r !== null);
}
