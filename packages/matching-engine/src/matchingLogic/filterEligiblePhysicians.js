// @ts-check

/**
 * Filter stage of the Filter → Score → Rank pipeline. Eligibility only, no scoring.
 * Returns only physicians who pass all v1 hard filters so the next stage can score them.
 *
 * Aligned with SearchCriteria: when the pipeline passes only criteria, call with
 * (physicians, criteria.job, criteria.reservation, criteria).
 */

/** @typedef {import('@locvm/types').Physician} Physician */
/** @typedef {import('@locvm/types').LocumJob} LocumJob */
/** @typedef {import('@locvm/types').Reservation} Reservation */
/** @typedef {import('@locvm/types').DurationRange} DurationRange */
/**
 * @typedef {Object} PhysicianInput
 * @property {string} [medProfession]
 * @property {string} [medSpeciality]
 * @property {boolean} [isLookingForLocums]
 * @property {{ isLookingForLocums?: boolean }} [preferences]
 * @property {string} [_id]
 * @property {string} [id]
 * @property {DurationRange[]} [locumDurations]
 * @property {string[]} [preferredProvinces]
 */

/**
 * @typedef {Object} JobInput
 * @property {string} [_id]
 * @property {string} [medProfession]
 * @property {string} [medSpeciality]
 * @property {{ from: Date | string, to: Date | string }} [dateRange]
 * @property {{ province?: string, city?: string }} [fullAddress]
 */

/**
 * @typedef {Object} ReservationInput
 * @property {Array<{ userId?: string }>} [applicants]
 */

/**
 * Hard filtering layer: returns only physicians who pass all v1 eligibility rules.
 *
 * @param {PhysicianInput[]} physicians - Pool of physicians (clean or raw fixture shape)
 * @param {JobInput} job - Locum job to match against
 * @param {ReservationInput | null} [reservation] - Optional reservation (applicants with userId)
 * @param {{ job?: JobInput, reservation?: ReservationInput | null, options?: { onlyLookingForLocums?: boolean } }} [criteria] - Optional SearchCriteria style options
 * @returns {PhysicianInput[]} Subset of physicians who pass all hard filters
 */
export function filterEligiblePhysicians(physicians, job, reservation, criteria) {
  const onlyLooking = criteria?.options?.onlyLookingForLocums ?? true
  const applicantIds = getApplicantIds(reservation ?? null)

  return physicians.filter((physician) => isEligiblePhysician(physician, job, applicantIds, onlyLooking))
}

/**
 * Single physician eligibility check (v1: profession, specialty, isLookingForLocums, not already in applicants).
 * TODO: When subscriptions launch, exclude physicians where CPSOProof.status is not confirmed (per product). (Q9 from George)
 * TODO: When onboarding is required, exclude physicians where !isOnboardingCompleted or !isProfileComplete. (Q10 from George)
 *
 * @param {PhysicianInput} physician
 * @param {JobInput} job
 * @param {Set<string>} applicantIds
 * @param {boolean} onlyLooking
 * @returns {boolean}
 */

// For missing values like isLookingForLocums, we assume they are looking (treat as true)
function isEligiblePhysician(physician, job, applicantIds, onlyLooking) {
  if (physician.medProfession !== job.medProfession) return false

  const pSpec = (physician.medSpeciality ?? '').trim().toLowerCase()
  const jSpec = (job.medSpeciality ?? '').trim().toLowerCase()
  if (pSpec !== jSpec) return false

  // Missing = assume true (e.g. abandoned onboarding); only exclude when explicitly false
  const isLooking = physician.isLookingForLocums ?? physician.preferences?.isLookingForLocums ?? true
  if (onlyLooking && !isLooking) return false

  const physicianId = physician._id ?? physician.id
  if (applicantIds.has(String(physicianId))) return false

  if (!passesDurationFilter(physician, job)) return false

  if (!passesProvinceFilter(physician, job)) return false

  return true
}

// ── Job Duration filter ──────────────────────────────────────────────────
//
// Excludes physicians whose preferred locumDurations clearly don't match
// the job's length. Only removes obvious mismatches; gray-area cases
// pass through and are handled by scoring.
//
// Works with normalized DurationRange[] ({ minDays, maxDays }) from the
// normalization layer. The job is bucketed by duration into short/mid/long,
// and each bucket has a day range. A physician passes if any of their
// DurationRanges overlap with the job bucket's day range.
//
// Bucket ranges (intentionally overlapping for leniency):
//   short  = 0–90 days    (covers "A few days", "Less than a month", "1–3 months")
//   mid    = 30–180 days  (covers "1–3 months", "3–6 months")
//   long   = 90–365 days  (covers "3–6 months", "6+ months")
//
// We exclude only when NONE of the physician's ranges overlap the bucket.
// If locumDurations is missing or empty → lenient (pass through).

const MS_PER_DAY = 86_400_000

/** @type {Record<string, { min: number, max: number }>} */
const BUCKET_RANGES = {
  short: { min: 0, max: 90 },
  mid: { min: 30, max: 180 },
  long: { min: 90, max: 365 },
}

/**
 * @param {{ from: Date | string, to: Date | string }} dateRange
 * @returns {number}
 */
function getJobDurationDays(dateRange) {
  const from = new Date(dateRange.from)
  const to = new Date(dateRange.to)
  return (to.getTime() - from.getTime()) / MS_PER_DAY
}

/**
 * @param {number} days
 * @returns {'short' | 'mid' | 'long'}
 */
function getJobBucket(days) {
  if (days <= 30) return 'short'
  if (days <= 89) return 'mid'
  return 'long'
}

/**
 * Two ranges overlap if one starts before the other ends and vice versa.
 *
 * @param {DurationRange} physician
 * @param {{ min: number, max: number }} bucket
 * @returns {boolean}
 */
function rangesOverlap(physician, bucket) {
  return physician.minDays <= bucket.max && physician.maxDays >= bucket.min
}

/**
 * @param {PhysicianInput} physician
 * @param {JobInput} job
 * @returns {boolean}
 */
function passesDurationFilter(physician, job) {
  if (!job.dateRange?.from || !job.dateRange?.to) return true

  const durations = physician.locumDurations ?? []
  if (durations.length === 0) return true

  const jobDays = getJobDurationDays(job.dateRange)
  const bucket = BUCKET_RANGES[getJobBucket(jobDays)]

  return durations.some((d) => rangesOverlap(d, bucket))
}

// ── Province filter ─────────────────────────────────────────────────────
//
// Excludes physicians whose preferredProvinces don't include the job's province.
// Lenient on both sides: if job has no province or physician has no preferred provinces, pass through.
// All province values are normalized to ProvinceCode (2-letter) before this stage.

/**
 * @param {PhysicianInput} physician
 * @param {JobInput} job
 * @returns {boolean}
 */
function passesProvinceFilter(physician, job) {
  const jobProvince = job.fullAddress?.province
  if (!jobProvince) return true

  const preferred = physician.preferredProvinces ?? []
  if (preferred.length === 0) return true

  return preferred.includes(jobProvince)
}

/**
 * @param {ReservationInput | null} reservation
 * @returns {Set<string>}
 */
function getApplicantIds(reservation) {
  const ids = new Set()
  const applicants = reservation?.applicants
  if (!applicants) return ids
  for (const a of applicants) {
    if (a.userId) ids.add(String(a.userId))
  }
  return ids
}
