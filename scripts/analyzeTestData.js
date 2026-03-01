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

/** Label for value type (used to surface non-string / unexpected types). */
function getTypeLabel(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.trim() === '' ? 'string(empty)' : 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
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

const RESERVATION_FIELDS = [
  { path: 'locumJobId', kind: 'oid' },
  { path: 'status', kind: 'string' },
  { path: 'applicants', kind: 'nonEmptyArray' },
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

  console.log('\n----- User field completeness (missingness) -----');
  for (const { path } of USER_FIELDS) {
    const r = results[path];
    console.log(`${path}: present ${r.present} (${percentageOfTotal(r.present)}%), missing ${r.missing} (${percentageOfTotal(r.missing)}%)`);
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

  console.log('\n----- User preferences & profile – frequency of inputs -----');
  for (const { path, label } of PREFERENCE_FREQUENCY_FIELDS) {
    const freq = countValueFrequencies(users, path);
    const top = topByFrequency(freq, 25);
    console.log(`\n${label}:`);
    if (top.length === 0) {
      console.log('  (no values)');
    } else {
      for (const [value, count] of top) {
        console.log(`  "${value}": ${count}`);
      }
    }
  }

  // Wrong/weird input: user provided something but it's wrong type or empty (missingness above = didn't type anything)
  const SKIP_TYPES_FOR_WRONG = new Set(['string', 'undefined', 'null']);
  console.log('\n----- Wrong or weird input (when something was provided – empty string, wrong type, etc.) -----');
  for (const { path } of PREFERENCE_FREQUENCY_FIELDS) {
    const typeCounts = countTypeBreakdown(users, path);
    const wrongOrWeird = Object.entries(typeCounts).filter(([type]) => !SKIP_TYPES_FOR_WRONG.has(type));
    if (wrongOrWeird.length === 0) {
      console.log(`\n${path}: (none – only missing or valid string)`);
    } else {
      console.log(`\n${path}:`);
      for (const [type, count] of wrongOrWeird.sort((a, b) => b[1] - a[1])) {
        console.log(`[${type}]: ${count}`);
      }
    }
  }
}

async function analyzeJobs() {
  const jsonString = await fs.readFile('./locum.locumjobs.formatted.json', 'utf8');
  const jobs = JSON.parse(jsonString);
  console.log('\n----- Jobs -----');
  console.log('Number of entries:', jobs.length);
  if (jobs.length > 0) {
    console.log(Object.keys(jobs[0]));
  }
}

async function analyzeReservations() {
  const jsonString = await fs.readFile('./locum.reservations.formatted.json', 'utf8');
  const reservations = JSON.parse(jsonString);
  console.log('\n----- Reservations -----');
  console.log('Number of entries:', reservations.length);
  if (reservations.length > 0){
    console.log(Object.keys(reservations[0]));
  }
    
}

async function main() {
  await analyzeUsers();
  await analyzeJobs();
  await analyzeReservations();
}

main().catch(console.error);
