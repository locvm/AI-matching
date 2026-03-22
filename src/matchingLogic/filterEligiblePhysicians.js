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
/** @typedef {import('../interfaces/core/models.js').DurationRange} DurationRange */
/** @typedef {Physician & { preferences?: { isLookingForLocums?: boolean }, _id?: string }} PhysicianInput */
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
 * TODO: When subscriptions launch, exclude physicians where CPSOProof.status is not confirmed (per product). (Q9 from George)
 * TODO: When onboarding is required, exclude physicians where !isOnboardingCompleted or !isProfileComplete. (Q10 from George)
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
// Works with normalized DurationRange[] ({ minDays, maxDays }) from the
// normalization layer. A physician passes if any of their duration ranges
// overlap with the job's duration in days.
//
// We exclude only when NONE of the physician's ranges overlap.
// If locumDurations is missing or empty → lenient (pass through).

const MS_PER_DAY = 86_400_000

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
 * @param {PhysicianInput} physician
 * @param {LocumJob} job
 * @returns {boolean}
 */
function passesDurationFilter(physician, job) {
  if (!job.dateRange?.from || !job.dateRange?.to) return true

  const durations = physician.locumDurations ?? []
  if (durations.length === 0) return true

  const jobDays = getJobDurationDays(job.dateRange)

  return durations.some((d) => jobDays >= d.minDays && jobDays <= d.maxDays)
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


