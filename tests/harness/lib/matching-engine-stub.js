// @ts-check

import { SCORING } from '../harness.config.js'

/**
 * @typedef {import('./types.js').Physician} Physician
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').SearchCriteria} SearchCriteria
 * @typedef {import('./types.js').SearchResult} SearchResult
 */

/**
 * Stub implementation of the matching engine.
 * Replace with the real engine once real scorers are built.
 */
export class MatchingEngineStub {
  /**
   * @param {SearchCriteria} criteria
   * @param {Physician[]} physicians
   * @returns {Promise<SearchResult[]>}
   */
  async searchPhysicians(criteria, physicians) {
    const { job, reservation, options } = criteria
    const onlyLooking = options?.onlyLookingForLocums ?? true

    const applicantIds = this.#getApplicantIds(reservation ?? null)

    const results = []

    for (const physician of physicians) {
      if (!this.#passesHardFilters(physician, job, applicantIds, onlyLooking)) continue

      results.push(this.#stubScore(physician, job))
    }

    results.sort((a, b) => b.score - a.score)
    return results
  }

  /**
   * @param {Physician} physician
   * @param {LocumJob} job
   * @param {Set<string>} applicantIds
   * @param {boolean} onlyLooking
   * @returns {boolean}
   */
  #passesHardFilters(physician, job, applicantIds, onlyLooking) {
    if (physician.medProfession !== job.medProfession) return false

    const pSpec = (physician.medSpeciality ?? '').trim().toLowerCase()
    const jSpec = (job.medSpeciality ?? '').trim().toLowerCase()
    if (pSpec !== jSpec) return false

    if (onlyLooking && !physician.isLookingForLocums) return false
    if (applicantIds.has(physician._id)) return false

    return true
  }

  /**
   * @param {Physician} physician
   * @param {LocumJob} job
   * @returns {SearchResult}
   */
  #stubScore(physician, job) {
    const hash = this.#simpleHash(`${physician._id}:${job._id}`)
    const normalized = (hash % 1000) / 1000

    const { WEIGHTS, MAX_SCORE } = SCORING

    const location = Math.round(normalized * MAX_SCORE * 100) / 100
    const duration = Math.round((((hash >> 8) % 1000) / 1000) * MAX_SCORE * 100) / 100
    const emr = Math.round((((hash >> 16) % 1000) / 1000) * MAX_SCORE * 100) / 100

    const score =
      Math.round((location * WEIGHTS.LOCATION + duration * WEIGHTS.DURATION + emr * WEIGHTS.EMR) * 100) / 100

    /** @type {string[]} */
    const flags = []

    if (!(physician.workAddress?.city && physician.workAddress?.province)) {
      flags.push('missing_physician_location')
    }

    if (!(job.fullAddress?.city && job.fullAddress?.province)) {
      flags.push('missing_job_location')
    }

    if (!job.facilityInfo?.emr && !(Array.isArray(physician.emrSystems) && physician.emrSystems.length > 0) && !physician.facilityEMR) {
      flags.push('missing_emr_data')
    }

    return {
      physicianId: physician._id,
      score,
      breakdown: { location, duration, emr },
      flags,
    }
  }

  /**
   * @param {Reservation | null} reservation
   * @returns {Set<string>}
   */
  #getApplicantIds(reservation) {
    const ids = new Set()
    if (!reservation?.applicants) return ids
    for (const a of reservation.applicants) {
      if (a.userId) ids.add(a.userId)
    }
    return ids
  }

  /**
   * @param {string} str
   * @returns {number}
   */
  #simpleHash(str) {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
  }
}
