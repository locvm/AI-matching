// @ts-check

import { SCORING } from '../harness.config.js'

/**
 * @typedef {import('./types.js').User} User
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').SearchCriteria} SearchCriteria
 * @typedef {import('./types.js').SearchResult} SearchResult
 */

/**
 * Stub implementation of the matching engine.
 * Replace with the real engine once it is built.
 */
export class MatchingEngineStub {
  /**
   * @param {SearchCriteria} criteria
   * @param {User[]} users
   * @returns {Promise<SearchResult[]>}
   */
  async searchPhysicians(criteria, users) {
    const { job, reservation, options } = criteria
    const onlyLooking = options?.onlyLookingForLocums ?? true

    const applicantIds = this.#getApplicantIds(reservation ?? null)

    const results = []

    for (const user of users) {
      if (!this.#passesHardFilters(user, job, applicantIds, onlyLooking)) continue

      results.push(this.#stubScore(user, job))
    }

    results.sort((a, b) => b.score - a.score)
    return results
  }

  /**
   * @param {User} user
   * @param {LocumJob} job
   * @param {Set<string>} applicantIds
   * @param {boolean} onlyLooking
   * @returns {boolean}
   */
  #passesHardFilters(user, job, applicantIds, onlyLooking) {
    if (user.medProfession !== job.medProfession) return false

    const uSpec = (user.medSpeciality ?? '').trim().toLowerCase()
    const jSpec = (job.medSpeciality ?? '').trim().toLowerCase()
    if (uSpec !== jSpec) return false

    if (onlyLooking && !user.preferences?.isLookingForLocums) return false
    if (applicantIds.has(user._id)) return false

    return true
  }

  /**
   * @param {User} user
   * @param {LocumJob} job
   * @returns {SearchResult}
   */
  #stubScore(user, job) {
    const hash = this.#simpleHash(`${user._id}:${job._id}`)
    const normalized = (hash % 1000) / 1000

    const { WEIGHTS, MAX_SCORE } = SCORING

    const location = Math.round(normalized * MAX_SCORE * 100) / 100
    const duration = Math.round((((hash >> 8) % 1000) / 1000) * MAX_SCORE * 100) / 100
    const emr = Math.round((((hash >> 16) % 1000) / 1000) * MAX_SCORE * 100) / 100

    const score =
      Math.round((location * WEIGHTS.LOCATION + duration * WEIGHTS.DURATION + emr * WEIGHTS.EMR) * 100) / 100

    /** @type {string[]} */
    const flags = []
    const hasUserLocation = !!(user.workAddress?.city && user.workAddress?.province)

    if (!hasUserLocation) {
      flags.push('missing_physician_location')
    }

    const hasJobLocation = !!(job.fullAddress?.city && job.fullAddress?.province)

    if (!hasJobLocation) {
      flags.push('missing_job_location')
    }

    const hasEmrInfo =
      !!job.facilityInfo?.emr || (Array.isArray(user.emrSystems) && user.emrSystems.length > 0) || !!user.facilityEMR

    if (!hasEmrInfo) {
      flags.push('missing_emr_data')
    }

    return {
      physicianId: user._id,
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
