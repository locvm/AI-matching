// @ts-check
//
// Inspects match-run-results documents for rollout health of the per-category
// detail blobs (locationDetail / emrDetail / durationDetail). Reports counts,
// flag distribution, and method distribution per category. Optionally prints a
// sample document matching a given flag or method.
//
// Usage:
//   node --env-file=../../.env scripts/check-detail.js
//   node --env-file=../../.env scripts/check-detail.js --sample-flag emr_mismatch
//   node --env-file=../../.env scripts/check-detail.js --sample-method location=gps_distance

import { connect, disconnect, getDb, COLLECTIONS } from '@locvm/database'

const DETAIL_CATEGORIES = /** @type {const} */ (['location', 'emr', 'duration'])

const args = process.argv.slice(2)
const sampleFlag = readArg(args, '--sample-flag')
const sampleMethod = readArg(args, '--sample-method') // form: "<category>=<method>"

await connect()
try {
  await run()
} finally {
  await disconnect()
}

async function run() {
  const db = await getDb()
  const results = db.collection(COLLECTIONS.MATCH_RUN_RESULTS)

  const baseQuery = { isActive: true }
  const withDetailQuery = { ...baseQuery, 'breakdown.locationDetail': { $exists: true } }

  const [total, withDetail] = await Promise.all([
    results.countDocuments(baseQuery),
    results.countDocuments(withDetailQuery),
  ])

  console.log(`Active results: ${total} total, ${withDetail} with detail`)
  if (total > 0) {
    const pct = ((withDetail / total) * 100).toFixed(1)
    console.log(`Detail coverage: ${pct}%`)
  }

  // Aggregate flag + method distributions in a single pass over the rolled-out subset.
  /** @type {Record<string, number>} */
  const flagCounts = {}
  /** @type {Record<string, Record<string, number>>} */
  const methodCounts = Object.fromEntries(DETAIL_CATEGORIES.map((c) => [c, {}]))

  const cursor = results.find(withDetailQuery)
  for await (const doc of cursor) {
    for (const f of doc.flags ?? []) {
      flagCounts[f] = (flagCounts[f] ?? 0) + 1
    }
    for (const category of DETAIL_CATEGORIES) {
      const method = doc.breakdown?.[`${category}Detail`]?.method
      if (typeof method === 'string') {
        methodCounts[category][method] = (methodCounts[category][method] ?? 0) + 1
      }
    }
  }

  console.log('\nFlag counts:')
  printSorted(flagCounts)

  for (const category of DETAIL_CATEGORIES) {
    console.log(`\n${category} method counts:`)
    printSorted(methodCounts[category])
  }

  if (sampleFlag) await printSample(results, { ...withDetailQuery, flags: sampleFlag }, `flag=${sampleFlag}`)
  if (sampleMethod) {
    const [category, method] = sampleMethod.split('=')
    if (!category || !method || !DETAIL_CATEGORIES.includes(/** @type {any} */ (category))) {
      console.error(`\nInvalid --sample-method "${sampleMethod}". Expected "<category>=<method>".`)
      return
    }
    await printSample(
      results,
      { ...withDetailQuery, [`breakdown.${category}Detail.method`]: method },
      `${category}.method=${method}`
    )
  }
}

/**
 * @param {import('mongodb').Collection} collection
 * @param {Record<string, unknown>} query
 * @param {string} label
 */
async function printSample(collection, query, label) {
  const sample = await collection.findOne(query)
  if (!sample) {
    console.log(`\nNo sample found for ${label}`)
    return
  }
  console.log(`\nSample (${label}):`)
  console.log(JSON.stringify({ flags: sample.flags, breakdown: sample.breakdown }, null, 2))
}

/**
 * Pretty-print a count map sorted by descending count.
 *
 * @param {Record<string, number>} counts
 */
function printSorted(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) {
    console.log('  (none)')
    return
  }
  for (const [key, count] of entries) {
    console.log(`  ${key}: ${count}`)
  }
}

/**
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | null}
 */
function readArg(argv, name) {
  const i = argv.indexOf(name)
  if (i === -1) return null
  const value = argv[i + 1]
  if (!value || value.startsWith('--')) return null
  return value
}
