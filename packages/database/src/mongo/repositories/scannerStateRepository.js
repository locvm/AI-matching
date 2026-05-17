// @ts-check

// Scanner state repository — persists the timestamp of the last scanner pass
// so the scanner can pick up new + updated records on every tick.

import { getDb } from '../connection.js'
import { COLLECTIONS } from '../collections.js'

const LAST_SCAN_KEY = 'scanner.lastRun'

/**
 * Returns the timestamp of the last completed scan, or null if no scan has run yet.
 *
 * @returns {Promise<Date | null>}
 */
export async function getLastScanAt() {
  const db = await getDb()
  const doc = await db.collection(COLLECTIONS.SCANNER_STATE).findOne({ key: LAST_SCAN_KEY })
  return doc?.value instanceof Date ? doc.value : null
}

/**
 * Persists the timestamp of the last completed scan. Upserts a single row.
 *
 * @param {Date} date
 * @returns {Promise<void>}
 */
export async function setLastScanAt(date) {
  const db = await getDb()
  await db
    .collection(COLLECTIONS.SCANNER_STATE)
    .updateOne({ key: LAST_SCAN_KEY }, { $set: { key: LAST_SCAN_KEY, value: date } }, { upsert: true })
}
