// @ts-check

/**
 * Filter stage of the Filter → Score → Rank pipeline. Eligibility only, no scoring.
 * Returns only physicians who pass all v1 hard filters so the next stage can score them.
 *
 * Aligned with SearchCriteria: when the pipeline passes only criteria, call with
 * (physicians, criteria.job, criteria.reservation, criteria).
 */

/** @typedef {import('../interfaces/core/models.js').Physician} Physician */
/** @typedef {import('../interfaces/core/models.js').LocumJob} LocumJob */
/** @typedef {import('../interfaces/core/models.js').Reservation} Reservation */
/** @typedef {Physician & { preferences?: { isLookingForLocums?: boolean, locumDurations?: string[] }, _id?: string, locumDurations?: string[] }} PhysicianInput */
/** @typedef {Reservation & { applicants?: Array<{ userId?: string }> }} ReservationInput */

/**
 * Hard filtering layer: returns only physicians who pass all v1 eligibility rules.
 *
 * @param {PhysicianInput[]} physicians - Pool of physicians (clean or raw fixture shape)
 * @param {LocumJob} job - Locum job to match against
 * @param {ReservationInput} [reservation] - Optional reservation (applicants with userId)
 * @param {{ job?: LocumJob, reservation?: Reservation, options?: { onlyLookingForLocums?: boolean } }} [criteria] - Optional SearchCriteria style options
 * @returns {PhysicianInput[]} Subset of physicians who pass all hard filters
 */
export function filterEligiblePhysicians(physicians, job, reservation, criteria) {
  const onlyLooking = criteria?.options?.onlyLookingForLocums ?? true
  const applicantIds = getApplicantIds(reservation ?? null)

  return physicians.filter((physician) =>
    isEligiblePhysician(physician, job, applicantIds, onlyLooking)
  )
}

/**
 * Single physician eligibility check (v1: profession, specialty, isLookingForLocums, not already in applicants).
 * TODO: When subscriptions launch, exclude physicians where CPSOProof.status is not confirmed (per product). (Q9 from Georage)
 * TODO: When onboarding is required, exclude physicians where !isOnboardingCompleted or !isProfileComplete. (Q10 from Georage)
 *
 * @param {PhysicianInput} physician
 * @param {LocumJob} job
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

  return true
}

// ── Job Duration filter ──────────────────────────────────────────────────
//
// Excludes physicians whose preferred locumDurations clearly don't match
// the job's length. Only removes obvious mismatches; gray-area cases
// pass through and are handled by scoring.
//
// Job duration buckets (from dateRange):
//   short  = ≤ 30 days
//   mid    = 31–89 days  (~1–3 months)
//   long   = 90+ days    (~3 months and above)
//
// For each bucket, which physician locumDurations options count as overlap:
//   short jobs  → "A few days", "Less than a month", "1–3 months"
//   mid jobs    → "1–3 months", "3–6 months"
//   long jobs   → "3–6 months", "6+ months"
//
// We exclude only when NONE of the physician's selected durations overlap.
// If locumDurations is missing or empty → lenient (pass through).

const MS_PER_DAY = 86_400_000 // 86,400,000 milliseconds in a day to calculate the number of days between dateRange.from and dateRange.to

/** @type {Record<string, Set<string>>} */
const DURATION_OVERLAP = {
  short: new Set(['A few days', 'Less than a month', '1–3 months']),
  mid:   new Set(['1–3 months', '3–6 months']),
  long:  new Set(['3–6 months', '6+ months']),
}

/**
 * @param {{ from: Date | string, to: Date | string }} dateRange
 * @returns {'short' | 'mid' | 'long'}
 */
function getJobDurationBucket(dateRange) {
  const from = new Date(dateRange.from)
  const to = new Date(dateRange.to)
  const days = (to.getTime() - from.getTime()) / MS_PER_DAY
  if (days <= 30) return 'short'
  if (days <= 89) return 'mid'
  return 'long'
}

/**
 * @param {PhysicianInput} physician
 * @param {LocumJob} job
 * @returns {boolean}
 */
function passesDurationFilter(physician, job) {
  if (!job.dateRange?.from || !job.dateRange?.to) return true

  const durations = physician.locumDurations ?? physician.preferences?.locumDurations ?? []
  if (durations.length === 0) return true

  const bucket = getJobDurationBucket(job.dateRange)
  const allowed = DURATION_OVERLAP[bucket]

  return durations.some((d) => allowed.has(d))
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


