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
 * TODO: When subscriptions launch, exclude physicians where CPSOProof.status is not confirmed (per product). (Q9)
 * TODO: When onboarding is required, exclude physicians where !isOnboardingCompleted or !isProfileComplete. (Q10)
 *
 * @param {PhysicianInput} physician
 * @param {LocumJob} job
 * @param {Set<string>} applicantIds
 * @param {boolean} onlyLooking
 * @returns {boolean}
 */

// for all the missing values like isLookingForLocums, we treat it as not looking, if the field is not present, we exclude them. So we only suggest jobs to people who have effectively said they’re looking 
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

  return true
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


