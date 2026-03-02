/**
 * LOCVM Test Data Analysis Script
 * Analyzes users, jobs, reservations: missingness and frequency of user inputs (e.g. location preference).
 */


import fs from 'fs/promises';

function getByPath(obj, path) {
  if (obj == null) return undefined;
  const parts = path.split('.'); 
  let currentObj = obj;
  for (const p of parts) {
    if (currentObj == null || typeof currentObj !== 'object') 
      return undefined;
    currentObj = currentObj[p];
  }
  return currentObj;
}

/** Count how often each string value appears; arrays are flattened (each element counted). */
function countValueFrequencies(users, path) {
  const freq = {};
  for (const user of users) {
    const value = getByPath(user, path);
    if (value == null) continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (typeof item !== 'string') continue;
      const s = item.trim();
      if (s === '') continue;
      freq[s] = (freq[s] || 0) + 1;
    }
  }
  return freq;
}

/** Sort by count descending, return top N [ [value, count] ]. */
function topByFrequency(freq, limit = 30) {
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** Label for value type (used to surface non-string / unexpected types). Arrays get array(n) for coords/date-style checks. */
function getTypeLabel(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.trim() === '' ? 'string(empty)' : 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') {
    if ('$oid' in value) return 'object($oid)';
    if ('$date' in value) return 'object($date)';
    return 'object';
  }
  return 'unknown';
}

/** Count occurrences by type for values at path. For arrays, counts each element's type. */
function countTypeBreakdown(users, path) {
  const counts = {};
  for (const user of users) {
    const value = getByPath(user, path);
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const label = getTypeLabel(item);
      counts[label] = (counts[label] || 0) + 1;
    }
  }
  return counts;
}

/** One type per item (for job level fields like location.coordinates, dateRange.from). */
function countTypeBreakdownScalar(items, path) {
  const counts = {};
  for (const item of items) {
    const value = getByPath(item, path);
    const label = getTypeLabel(value);
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
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
];

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
];

// Expected reservation fields
const RESERVATION_FIELDS = [
  { path: 'locumJobId', kind: 'oid' },
  { path: 'status', kind: 'string' },
  { path: 'applicants', kind: 'nonEmptyArray' },
];

// Job fields we show frequency for (excludes coords and dates – too specific)
const JOB_FREQUENCY_FIELDS = [
  { path: 'medProfession', label: 'medProfession' },
  { path: 'medSpeciality', label: 'medSpeciality' },
  { path: 'fullAddress.city', label: 'fullAddress.city' },
  { path: 'fullAddress.province', label: 'fullAddress.province' },
  { path: 'facilityInfo.emr', label: 'facilityInfo.emr' },
  { path: 'practiceType', label: 'practiceType' },
  { path: 'patientType', label: 'patientType' },
];

/** Valid type labels per kind for wrong/weird (jobs). */
function isValidJobType(typeLabel, kind) {
  if (kind === 'string') return typeLabel === 'string';
  if (kind === 'coords') return typeLabel === 'array(2)';
  if (kind === 'date') return typeLabel === 'object($date)';
  if (kind === 'nonEmptyArray') return typeLabel.startsWith('array(') && typeLabel !== 'array(0)';
  return false;
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
];

// Analyzers
async function analyzeUsers() {
  const jsonString = await fs.readFile('./locum.users.formatted.json', 'utf8');
  const users = JSON.parse(jsonString);

  console.log('Total users:', users.length);
  console.log('First user keys:', Object.keys(users[0]));

  const results = {};
  for (const { path } of USER_FIELDS) {
    results[path] = { present: 0, missing: 0 };
  }

  for (const user of users) {
    for (const { path, kind } of USER_FIELDS) {
      const value = getByPath(user, path);
      let present = false;
      if (value != null) {
        if (kind === 'string') present = typeof value === 'string' && value.trim() !== '';
        else if (kind === 'boolean') present = typeof value === 'boolean';
        else if (kind === 'nonEmptyArray') present = Array.isArray(value) && value.length > 0;
        else if (kind === 'object') present = typeof value === 'object';
      }
      if (present) results[path].present++;
      else results[path].missing++;
    }
  }

  const total = users.length;
  const percentageOfTotal = (n) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1));

  const md = [];

  console.log('\n----- User field completeness (missingness) -----');
  md.push('## User field completeness (missingness)\n');
  md.push('| Field | Present | Missing |');
  md.push('|-------|---------|---------|');
  for (const { path } of USER_FIELDS) {
    const r = results[path];
    const line = `${path}: present ${r.present} (${percentageOfTotal(r.present)}%), missing ${r.missing} (${percentageOfTotal(r.missing)}%)`;
    console.log(line);
    md.push(`| ${path} | ${r.present} (${percentageOfTotal(r.present)}%) | ${r.missing} (${percentageOfTotal(r.missing)}%) |`);
  }

  console.log('\n----- User preferences & profile - frequency of inputs -----');
  md.push('\n## User preferences & profile - frequency of inputs\n');
  for (const { path, label } of PREFERENCE_FREQUENCY_FIELDS) {
    const freq = countValueFrequencies(users, path);
    const top = topByFrequency(freq, 25);
    console.log(`\n${label}:`);
    md.push(`### ${label}\n`);
    if (top.length === 0) {
      console.log('  (no values)');
      md.push('(no values)\n');
    } else {
      md.push('| Value | Count |');
      md.push('|-------|-------|');
      for (const [value, count] of top) {
        console.log(`  "${value}": ${count}`);
        md.push(`| ${value.replace(/\|/g, '\\|')} | ${count} |`);
      }
      md.push('');
    }
  }

  const SKIP_TYPES_FOR_WRONG = new Set(['string', 'undefined', 'null']);
  console.log('\n----- Wrong or weird input (when something was provided - empty string, wrong type, etc.) -----');
  md.push('## Wrong or weird input (when something was provided)\n');
  md.push('Empty string, wrong type, etc. Excludes undefined/null (see missingness for those who did not type anything).\n');
  for (const { path } of PREFERENCE_FREQUENCY_FIELDS) {
    const typeCounts = countTypeBreakdown(users, path);
    const wrongOrWeird = Object.entries(typeCounts).filter(([type]) => !SKIP_TYPES_FOR_WRONG.has(type));
    if (wrongOrWeird.length === 0) {
      console.log(`\n${path}: (none - only missing or valid string)`);
      md.push(`- **${path}**: (none - only missing or valid string)\n`);
    } else {
      console.log(`\n${path}:`);
      md.push(`- **${path}**:`);
      for (const [type, count] of wrongOrWeird.sort((a, b) => b[1] - a[1])) {
        console.log(`[${type}]: ${count}`);
        md.push(`[${type}]: ${count}`);
      }
      md.push('');
    }
  }

  return md.join('\n');
}

async function analyzeJobs() {
  const jsonString = await fs.readFile('./locum.locumjobs.formatted.json', 'utf8');
  const jobs = JSON.parse(jsonString);

  console.log('\n----- Jobs -----');
  console.log('Number of entries:', jobs.length);
  if (jobs.length > 0) console.log('data[0] keys:', Object.keys(jobs[0]));

  const results = {};
  for (const { path } of JOB_FIELDS) {
    results[path] = { present: 0, missing: 0 };
  }

  function isPresent(value, kind) {
    if (value == null) return false;
    if (kind === 'string') return typeof value === 'string' && value.trim() !== '';
    if (kind === 'coords') return Array.isArray(value) && value.length === 2;
    if (kind === 'date') return typeof value === 'object' && value !== null && '$date' in value;
    if (kind === 'nonEmptyArray') return Array.isArray(value) && value.length > 0;
    return false;
  }

  for (const job of jobs) {
    for (const { path, kind } of JOB_FIELDS) {
      const value = getByPath(job, path);
      if (isPresent(value, kind)) results[path].present++;
      else results[path].missing++;
    }
  }

  const total = jobs.length;
  const pct = (n) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1));

  console.log('\n----- Job field completeness (missingness) -----');
  for (const { path } of JOB_FIELDS) {
    const r = results[path];
    console.log(`${path}: present ${r.present} (${pct(r.present)}%), missing ${r.missing} (${pct(r.missing)}%)`);
  }

  console.log('\n----- Job frequency of inputs (selected fields only) -----');
  for (const { path, label } of JOB_FREQUENCY_FIELDS) {
    const freq = countValueFrequencies(jobs, path);
    const top = topByFrequency(freq, 25);
    console.log(`\n${label}:`);
    if (top.length === 0) console.log('  (no values)');
    else for (const [value, count] of top) console.log(`  "${value}": ${count}`);
  }

  const SKIP_WRONG = new Set(['undefined', 'null']);
  console.log('\n----- Job wrong or weird input (when something was provided) -----');
  for (const { path, kind } of JOB_FIELDS) {
    const typeCounts = countTypeBreakdownScalar(jobs, path);
    const wrongOrWeird = Object.entries(typeCounts).filter(
      ([type]) => !SKIP_WRONG.has(type) && !isValidJobType(type, kind)
    );
    if (wrongOrWeird.length === 0) {
      console.log(`${path}: (none – only missing or valid type)`);
    } else {
      console.log(`${path}:`);
      for (const [type, count] of wrongOrWeird.sort((a, b) => b[1] - a[1])) {
        console.log(`  [${type}]: ${count}`);
      }
    }
  }

  const keys = jobs.length > 0 ? Object.keys(jobs[0]).join(', ') : '(none)';
  return `## Jobs\n\n- **Entries:** ${jobs.length}\n- **data[0] keys:** ${keys}\n`;
}

async function analyzeReservations() {
  const jsonString = await fs.readFile('./locum.reservations.formatted.json', 'utf8');
  const reservations = JSON.parse(jsonString);
  console.log('\n----- Reservations -----');
  console.log('Number of entries:', reservations.length);
  if (reservations.length > 0) {
    console.log(Object.keys(reservations[0]));
  }
  const keys = reservations.length > 0 ? Object.keys(reservations[0]).join(', ') : '(none)';
  return `## Reservations\n\n- **Entries:** ${reservations.length}\n- **data[0] keys:** ${keys}\n`;
}

async function main() {
  const userMd = await analyzeUsers();
  const jobsMd = await analyzeJobs();
  const reservationsMd = await analyzeReservations();

  const report = `# Test Data Analysis

Generated by \`node scripts/analyzeTestData.js\`.

## Executive summary

User analysis: missingness, frequency of inputs (what users type), and wrong/weird input (non-string or empty when something was provided). Jobs and reservations: entry counts and field keys only.

---

${userMd}

---

${jobsMd}

---

${reservationsMd}
`;

  await fs.writeFile('./docs/test-data-analysis.md', report, 'utf8');
  console.log('\nWrote docs/test-data-analysis.md');
}

main().catch(console.error);
