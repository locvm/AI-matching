// @ts-check

import { SCORING } from '../harness.config.js'
import { filterEligiblePhysicians } from '../../../src/matchingLogic/filterEligiblePhysicians.js'

/**
 * @typedef {import('./types.js').User} User
 * @typedef {import('./types.js').LocumJob} LocumJob
 * @typedef {import('./types.js').Reservation} Reservation
 * @typedef {import('./types.js').SearchCriteria} SearchCriteria
 * @typedef {import('./types.js').SearchResult} SearchResult
 */

/** Reservation statuses that mean the job is still accepting applicants. Others (Completed, Cancelled, Expired) are excluded. */
const ELIGIBLE_RESERVATION_STATUSES = new Set(['Pending', 'In Progress', 'Ongoing'])

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

    if (!this.#isJobAcceptingApplicants(job, reservation)) {
      return []
    }

    const eligible = /** @type {User[]} */ (
      filterEligiblePhysicians(
        /** @type {any} */ (users),
        /** @type {any} */ (job),
        /** @type {any} */ (reservation ?? undefined),
        /** @type {any} */ (criteria)
      )
    )
    const results = []

    for (const user of eligible) {
      results.push(this.#stubScore(user, job))
    }

    results.sort((a, b) => b.score - a.score)
    return results
  }

  /**
   * True if we should run matching for this job. Excludes jobs whose reservation is not in an eligible workflow status.
   * @param {LocumJob} job
   * @param {Reservation | null | undefined} reservation
   * @returns {boolean}
   */
  #isJobAcceptingApplicants(job, reservation) {
    if (!reservation) return true
    const status = (reservation.status ?? '').trim()
    return ELIGIBLE_RESERVATION_STATUSES.has(status)
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
