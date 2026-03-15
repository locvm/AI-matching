/**
 * LOCVM Test Data Analysis Script
 * Analyzes users, jobs, reservations: missingness and frequency of user inputs (e.g. location preference).
 * @module scripts/analyzeTestData
 */
// @ts-check

import fs from 'fs/promises'

/**
 * Get a nested value from an object using dot-notation path.
 * @param {object | null | undefined} obj - Source object.
 * @param {string} path - Dot-separated path (e.g. "preferences.preferredProvinces").
 * @returns {*} The value at path, or undefined if any segment is null/undefined or not an object.
 */
function getByPath(obj, path) {
  if (obj == null) return undefined
  const parts = path.split('.')
  /** @type {any} */
  let currentObj = obj
  for (const p of parts) {
    if (currentObj == null || typeof currentObj !== 'object') return undefined
    currentObj = /** @type {Record<string, any>} */ (currentObj)[p]
  }
  return currentObj
}

/**
 * Count how often each string value appears; arrays are flattened (each element counted).
 * @param {Array<object>} collection - Array of objects (e.g. users or jobs).
 * @param {string} path - Dot-separated path to the field.
 * @returns {Record<string, number>} Map of value string -> count.
 */
function countValueFrequencies(collection, path) {
  /** @type {Record<string, number>} */
  const freq = {}
  for (const item of collection) {
    const value = getByPath(item, path)
    if (value == null) continue
    const items = Array.isArray(value) ? value : [value]
    for (const el of items) {
      if (typeof el !== 'string') continue
      const s = el.trim()
      if (s === '') continue
      freq[s] = (freq[s] || 0) + 1
    }
  }
  return freq
}

/**
 * Sort by count descending, return top N entries.
 * @param {Record<string, number>} freq - Map of value -> count.
 * @param {number} [limit=30] - Max number of entries to return.
 * @returns {Array<[string, number]>} Array of [value, count] pairs.
 */
function topByFrequency(freq, limit = 30) {
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

/**
 * Return a string label for the value's type (for diagnostics and wrong/weird checks).
 * @param {*} value - Any value.
 * @returns {string} Label such as 'string', 'string(empty)', 'array(2)', 'object($date)'.
 */
function getTypeLabel(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return value.trim() === '' ? 'string(empty)' : 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return `array(${value.length})`
  if (typeof value === 'object') {
    if ('$oid' in value) return 'object($oid)'
    if ('$date' in value) return 'object($date)'
    return 'object'
  }
  return 'unknown'
}

/**
 * Count occurrences by type for values at path. For arrays, counts each element's type.
 * @param {Array<object>} collection - Array of objects.
 * @param {string} path - Dot-separated path to the field.
 * @returns {Record<string, number>} Map of type label -> count.
 */
function countTypeBreakdown(collection, path) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const item of collection) {
    const value = getByPath(item, path)
    const items = Array.isArray(value) ? value : [value]
    for (const el of items) {
      const label = getTypeLabel(el)
      counts[label] = (counts[label] || 0) + 1
    }
  }
  return counts
}

/**
 * One type per item (for job-level fields like location.coordinates, dateRange.from).
 * @param {Array<object>} items - Array of objects.
 * @param {string} path - Dot-separated path to the field.
 * @returns {Record<string, number>} Map of type label -> count.
 */
function countTypeBreakdownScalar(items, path) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const item of items) {
    const value = getByPath(item, path)
    const label = getTypeLabel(value)
    counts[label] = (counts[label] || 0) + 1
  }
  return counts
}

// Expected user fields
const USER_FIELDS = [
  { path: 'medProfession', kind: 'string' },
  { path: 'medSpeciality', kind: 'string' },
  { path: 'preferences.isLookingForLocums', kind: 'boolean' },
  { path: 'preferences.preferredProvinces', kind: 'nonEmptyArray' },
  { path: 'preferences.specificRegions', kind: 'nonEmptyArray' },
  { path: 'preferences.locumDurations', kind: 'nonEmptyArray' },
  { path: 'preferences.availabilityDateRanges', kind: 'nonEmptyArray' },
  { path: 'workAddress', kind: 'object' },
  { path: 'emrSystems', kind: 'nonEmptyArray' },
  { path: 'facilityEMR', kind: 'string' },
]

// Expected job fields
const JOB_FIELDS = [
  { path: 'medProfession', kind: 'string' },
  { path: 'medSpeciality', kind: 'string' },
  { path: 'location.coordinates', kind: 'coords' },
  { path: 'fullAddress.city', kind: 'string' },
  { path: 'fullAddress.province', kind: 'string' },
  { path: 'dateRange.from', kind: 'date' },
  { path: 'dateRange.to', kind: 'date' },
  { path: 'facilityInfo.emr', kind: 'string' },
  { path: 'practiceType', kind: 'nonEmptyArray' },
  { path: 'patientType', kind: 'nonEmptyArray' },
]

// Expected reservation fields
const RESERVATION_FIELDS = [
  { path: 'status', kind: 'string' },
  { path: 'applicants', kind: 'nonEmptyArray' },
]

// Job fields we show frequency for (excludes coords and dates – too specific)
const JOB_FREQUENCY_FIELDS = [
  { path: 'medProfession', label: 'medProfession' },
  { path: 'medSpeciality', label: 'medSpeciality' },
  { path: 'fullAddress.city', label: 'fullAddress.city' },
  { path: 'fullAddress.province', label: 'fullAddress.province' },
  { path: 'facilityInfo.emr', label: 'facilityInfo.emr' },
  { path: 'practiceType', label: 'practiceType' },
  { path: 'patientType', label: 'patientType' },
]

/** Valid type labels per kind for wrong/weird (jobs). */
/**
 * Whether the type label is valid for the given job field kind.
 * @param {string} typeLabel - Label from getTypeLabel (e.g. 'array(2)', 'object($date)').
 * @param {string} kind - Field kind: 'string', 'coords', 'date', 'nonEmptyArray'.
 * @returns {boolean}
 */
function isValidJobType(typeLabel, kind) {
  if (kind === 'string') return typeLabel === 'string'
  if (kind === 'coords') return typeLabel === 'array(2)'
  if (kind === 'date') return typeLabel === 'object($date)'
  if (kind === 'nonEmptyArray') return typeLabel.startsWith('array(') && typeLabel !== 'array(0)'
  return false
}

/** Valid type labels per kind for wrong/weird (reservations). */
/**
 * Whether the type label is valid for the given reservation field kind.
 * @param {string} typeLabel - Label from getTypeLabel.
 * @param {string} kind - Field kind: 'string', 'nonEmptyArray'.
 * @returns {boolean}
 */
function isValidReservationType(typeLabel, kind) {
  if (kind === 'string') return typeLabel === 'string'
  if (kind === 'nonEmptyArray') return typeLabel.startsWith('array(') && typeLabel !== 'array(0)'
  return false
}

// What users actually enter: preferences & profile (frequency of inputs)
const PREFERENCE_FREQUENCY_FIELDS = [
  { path: 'medProfession', label: 'medProfession (e.g. Physician, Recruiter)' },
  { path: 'medSpeciality', label: 'medSpeciality (e.g. Family Medicine)' },
  { path: 'preferences.preferredProvinces', label: 'preferences.preferredProvinces (Ontario, ON, etc.)' },
  { path: 'preferences.specificRegions', label: 'preferences.specificRegions (cities, districts)' },
  { path: 'preferences.locumDurations', label: 'preferences.locumDurations (e.g. 1–3 months)' },
  { path: 'emrSystems', label: 'emrSystems (facility EMR / equipment)' },
  { path: 'facilityEMR', label: 'facilityEMR (primary EMR)' },
]

// --- Analyzers ---

/**
 * Analyze users JSON: missingness, frequency of inputs, wrong/weird types.
 * @returns {Promise<string>} Markdown section for the report.
 */
async function analyzeUsers() {
  const jsonString = await fs.readFile('./fixtures/locum.users.formatted.json', 'utf8')
  const users = JSON.parse(jsonString)

  /** @type {Record<string, { present: number; missing: number }>} */
  const results = {}
  for (const { path } of USER_FIELDS) {
    results[path] = { present: 0, missing: 0 }
  }

  for (const user of users) {
    for (const { path, kind } of USER_FIELDS) {
      const value = getByPath(user, path)
      let present = false
      if (value != null) {
        if (kind === 'string') present = typeof value === 'string' && value.trim() !== ''
        else if (kind === 'boolean') present = typeof value === 'boolean'
        else if (kind === 'nonEmptyArray') present = Array.isArray(value) && value.length > 0
        else if (kind === 'object') present = typeof value === 'object'
      }
      if (present) results[path].present++
      else results[path].missing++
    }
  }

  const total = users.length
  /** @param {number} n */
  const percentageOfTotal = (n) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1))

  const md = []

  md.push('## User field completeness (missingness)\n')
  md.push('| Field | Present | Missing |')
  md.push('|-------|---------|---------|')
  for (const { path } of USER_FIELDS) {
    const r = results[path]
    md.push(
      `| ${path} | ${r.present} (${percentageOfTotal(r.present)}%) | ${r.missing} (${percentageOfTotal(r.missing)}%) |`
    )
  }

  md.push('\n## User preferences & profile - frequency of inputs\n')
  for (const { path, label } of PREFERENCE_FREQUENCY_FIELDS) {
    const freq = countValueFrequencies(users, path)
    const top = topByFrequency(freq, 25)
    md.push(`### ${label}\n`)
    if (top.length === 0) {
      md.push('(no values)\n')
    } else {
      md.push('| Value | Count |')
      md.push('|-------|-------|')
      for (const [value, count] of top) {
        md.push(`| ${value.replace(/\|/g, '\\|')} | ${count} |`)
      }
      md.push('')
    }
  }

  const SKIP_TYPES_FOR_WRONG = new Set(['string', 'undefined', 'null'])
  md.push('## Wrong or weird input (when something was provided)\n')
  md.push(
    'Empty string, wrong type, etc. Excludes undefined/null (see missingness for those who did not type anything).\n'
  )
  for (const { path } of PREFERENCE_FREQUENCY_FIELDS) {
    const typeCounts = countTypeBreakdown(users, path)
    const wrongOrWeird = Object.entries(typeCounts).filter(
      /** @param {[string, number]} entry */
      ([type]) => !SKIP_TYPES_FOR_WRONG.has(type)
    )
    if (wrongOrWeird.length === 0) {
      md.push(`- **${path}**: (none - only missing or valid string)\n`)
    } else {
      md.push(`- **${path}**:`)
      for (const [type, count] of wrongOrWeird.sort(
        /** @param {[string, number]} a @param {[string, number]} b */
        (a, b) => b[1] - a[1]
      )) {
        md.push(`  - [${type}]: ${count}`)
      }
      md.push('')
    }
  }

  return md.join('\n')
}

/**
 * Analyze locum jobs JSON: missingness, frequency of inputs, wrong/weird types.
 * @returns {Promise<string>} Markdown section for the report.
 */
async function analyzeJobs() {
  const jsonString = await fs.readFile('./fixtures/locum.locumjobs.formatted.json', 'utf8')
  const jobs = JSON.parse(jsonString)

  /** @type {Record<string, { present: number; missing: number }>} */
  const results = {}
  for (const { path } of JOB_FIELDS) {
    results[path] = { present: 0, missing: 0 }
  }

  /**
   * @param {any} value
   * @param {string} kind
   */
  function isPresent(value, kind) {
    if (value == null) return false
    if (kind === 'string') return typeof value === 'string' && value.trim() !== ''
    if (kind === 'coords') return Array.isArray(value) && value.length === 2
    if (kind === 'date') return typeof value === 'object' && value !== null && '$date' in value
    if (kind === 'nonEmptyArray') return Array.isArray(value) && value.length > 0
    return false
  }

  for (const job of jobs) {
    for (const { path, kind } of JOB_FIELDS) {
      const value = getByPath(job, path)
      if (isPresent(value, kind)) results[path].present++
      else results[path].missing++
    }
  }

  const total = jobs.length
  /** @param {number} n */
  const percentageOfTotal = (n) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1))

  const md = []
  const keys = jobs.length > 0 ? Object.keys(jobs[0]).join(', ') : '(none)'
  md.push('## Jobs\n')
  md.push(`- **Entries:** ${jobs.length}\n`)

  md.push('## Job field completeness (missingness)\n')
  md.push('| Field | Present | Missing |')
  md.push('|-------|---------|---------|')
  for (const { path } of JOB_FIELDS) {
    const r = results[path]
    md.push(
      `| ${path} | ${r.present} (${percentageOfTotal(r.present)}%) | ${r.missing} (${percentageOfTotal(r.missing)}%) |`
    )
  }

  md.push('\n## Job frequency of inputs (selected fields)\n')
  for (const { path, label } of JOB_FREQUENCY_FIELDS) {
    const freq = countValueFrequencies(jobs, path)
    const top = topByFrequency(freq, 25)
    md.push(`### ${label}\n`)
    if (top.length === 0) {
      md.push('(no values)\n')
    } else {
      md.push('| Value | Count |')
      md.push('|-------|-------|')
      for (const [value, count] of top) {
        md.push(`| ${value.replace(/\|/g, '\\|')} | ${count} |`)
      }
      md.push('')
    }
  }

  const SKIP_WRONG = new Set(['undefined', 'null'])
  md.push('## Job wrong or weird input (when something was provided)\n')
  md.push('Excludes undefined/null. Invalid type or empty for coords, date, string, nonEmptyArray.\n')
  for (const { path, kind } of JOB_FIELDS) {
    const typeCounts = countTypeBreakdownScalar(jobs, path)
    const wrongOrWeird = Object.entries(typeCounts).filter(
      /** @param {[string, number]} entry */
      ([type]) => !SKIP_WRONG.has(type) && !isValidJobType(type, kind)
    )
    if (wrongOrWeird.length === 0) {
      md.push(`- **${path}**: (none - only missing or valid type)\n`)
    } else {
      md.push(`- **${path}**:`)
      for (const [type, count] of wrongOrWeird.sort(
        /** @param {[string, number]} a @param {[string, number]} b */
        (a, b) => b[1] - a[1]
      )) {
        md.push(`  - [${type}]: ${count}`)
      }
      md.push('')
    }
  }

  return md.join('\n')
}

/**
 * Analyze reservations JSON: missingness, frequency (status), wrong/weird types.
 * @returns {Promise<string>} Markdown section for the report.
 */
async function analyzeReservations() {
  const jsonString = await fs.readFile('./fixtures/locum.reservations.formatted.json', 'utf8')
  const reservations = JSON.parse(jsonString)

  /** @type {Record<string, { present: number; missing: number }>} */
  const results = {}
  for (const { path } of RESERVATION_FIELDS) {
    results[path] = { present: 0, missing: 0 }
  }

  /**
   * @param {any} value
   * @param {string} kind
   */
  function isPresent(value, kind) {
    if (value == null) return false
    if (kind === 'string') return typeof value === 'string' && value.trim() !== ''
    if (kind === 'nonEmptyArray') return Array.isArray(value) && value.length > 0
    return false
  }

  for (const res of reservations) {
    for (const { path, kind } of RESERVATION_FIELDS) {
      const value = getByPath(res, path)
      if (isPresent(value, kind)) results[path].present++
      else results[path].missing++
    }
  }

  const total = reservations.length
  /** @param {number} n */
  const percentageOfTotal = (n) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1))

  const md = []
  const keys = reservations.length > 0 ? Object.keys(reservations[0]).join(', ') : '(none)'
  md.push('## Reservations\n')
  md.push(`- **Entries:** ${reservations.length}\n`)

  md.push('## Reservation field completeness (missingness)\n')
  md.push('| Field | Present | Missing |')
  md.push('|-------|---------|---------|')
  for (const { path } of RESERVATION_FIELDS) {
    const r = results[path]
    md.push(
      `| ${path} | ${r.present} (${percentageOfTotal(r.present)}%) | ${r.missing} (${percentageOfTotal(r.missing)}%) |`
    )
  }

  md.push('\n## Reservation frequency of inputs (status)\n')
  const statusFreq = countValueFrequencies(reservations, 'status')
  const statusTop = topByFrequency(statusFreq, 15)
  md.push('| Value | Count |')
  md.push('|-------|-------|')
  if (statusTop.length === 0) {
    md.push('(no values)\n')
  } else {
    for (const [value, count] of statusTop) {
      md.push(`| ${value.replace(/\|/g, '\\|')} | ${count} |`)
    }
    md.push('')
  }

  const SKIP_WRONG = new Set(['undefined', 'null'])
  md.push('## Reservation wrong or weird input (when something was provided)\n')
  md.push('Excludes undefined/null.\n')
  for (const { path, kind } of RESERVATION_FIELDS) {
    const typeCounts = countTypeBreakdownScalar(reservations, path)
    const wrongOrWeird = Object.entries(typeCounts).filter(
      /** @param {[string, number]} entry */
      ([type]) => !SKIP_WRONG.has(type) && !isValidReservationType(type, kind)
    )
    if (wrongOrWeird.length === 0) {
      md.push(`- **${path}**: (none – only missing or valid type)\n`)
    } else {
      md.push(`- **${path}**:`)
      for (const [type, count] of wrongOrWeird.sort(
        /** @param {[string, number]} a @param {[string, number]} b */
        (a, b) => b[1] - a[1]
      )) {
        md.push(`  - [${type}]: ${count}`)
      }
      md.push('')
    }
  }

  return md.join('\n')
}

/**
 * Run all analyzers and write combined report to docs/test-data-analysis.md.
 * @returns {Promise<void>}
 */
async function main() {
  const userMd = await analyzeUsers()
  const jobsMd = await analyzeJobs()
  const reservationsMd = await analyzeReservations()

  const report = `# Test Data Analysis

Generated by \`node scripts/analyzeTestData.js\`.

## Executive summary

User, job, and reservation analysis: missingness, frequency of inputs, and wrong/weird input (when something was provided).

---

${userMd}

---

${jobsMd}

---

${reservationsMd}
`

  await fs.writeFile('./docs/test-data-analysis.md', report, 'utf8')
  console.log('Wrote docs/test-data-analysis.md')
}

main().catch(console.error)
