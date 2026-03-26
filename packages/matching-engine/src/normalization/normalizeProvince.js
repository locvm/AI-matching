// @ts-check

// Province Normalizer
//
// Takes messy province strings from the DB and turns them into clean 2 letter codes.
// "Ontario" becomes "ON", "ontario" becomes "ON", "Québec " becomes "QC", "BC" stays "BC"

/** @typedef {import("@locvm/types").ProvinceCode} ProvinceCode */

/** @type {Record<string, ProvinceCode>} */
const PROVINCE_MAP = {
  // 2-letter codes (already clean)
  ab: 'AB',
  bc: 'BC',
  mb: 'MB',
  nb: 'NB',
  nl: 'NL',
  ns: 'NS',
  nt: 'NT',
  nu: 'NU',
  on: 'ON',
  pe: 'PE',
  qc: 'QC',
  sk: 'SK',
  yt: 'YT',

  // Full English names
  alberta: 'AB',
  'british columbia': 'BC',
  manitoba: 'MB',
  'new brunswick': 'NB',
  'newfoundland and labrador': 'NL',
  newfoundland: 'NL',
  'nova scotia': 'NS',
  'northwest territories': 'NT',
  nunavut: 'NU',
  ontario: 'ON',
  'prince edward island': 'PE',
  pei: 'PE',
  quebec: 'QC',
  québec: 'QC',
  saskatchewan: 'SK',
  yukon: 'YT',
}

/**
 * Takes a raw province string and gives back the 2 letter code (or null if we dont recognize it).
 *
 * @param {string | undefined | null} raw
 * @returns {ProvinceCode | null}
 */
export function normalizeProvince(raw) {
  if (!raw || typeof raw !== 'string') return null

  const cleaned = raw.trim().toLowerCase()
  if (!cleaned) return null

  return PROVINCE_MAP[cleaned] ?? null
}
