// @ts-check

/**
 * Communication Layer: Get Top Matches for a Physician
 *
 * Reads scored pairs from the `matchrunresults` collection (written by the
 * orchestration layer), keeps only active rows whose jobs are still open, and
 * returns the top-K by score. Enrichment for the email payload pulls the
 * physician and matched jobs straight from mongo.
 */

import { dataRepository, matchRunResultRepository } from '@locvm/database'

/** @typedef {import('@locvm/types').Physician} Physician */
/** @typedef {import('@locvm/types').LocumJob} LocumJob */

/**
 * @typedef {Object} StoredMatchResult
 * @property {string} runId
 * @property {string} physicianId
 * @property {string} jobId
 * @property {number} rank
 * @property {number} score
 * @property {Record<string, number>} breakdown
 * @property {string[]} flags
 * @property {boolean} isActive
 * @property {Date} computedAt
 */

/** Reservation statuses that mean the job is still open and accepting matches */
const OPEN_STATUSES = new Set(['Pending', 'Awaiting Payment'])
const TOP_K = 5
const BASE_URL = 'https://locvm.ca/jobs'

/**
 * Returns the top-K best job matches for a given physician from MongoDB.
 *
 * @param {string} physicianId
 * @returns {Promise<{ topMatches: StoredMatchResult[], totalOpenMatches: number }>}
 */
export async function getTopMatchesForPhysician(physicianId) {
  const reservations = await dataRepository.findOpenReservations()
  const openJobIds = new Set(reservations.filter((r) => OPEN_STATUSES.has(r.status)).map((r) => r.locumJobId))

  const active = /** @type {StoredMatchResult[]} */ (
    await matchRunResultRepository.findActiveResultsByPhysicianId(physicianId)
  )

  const filtered = active.filter((r) => openJobIds.has(r.jobId))
  filtered.sort((a, b) => b.score - a.score || a.jobId.localeCompare(b.jobId))
  return { topMatches: filtered.slice(0, TOP_K), totalOpenMatches: filtered.length }
}

/**
 * Formats a Date into "May 5, 2026" style.
 * @param {Date | string | undefined} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Builds the JSON payload for a physician's email notification.
 *
 * Fetches the physician and matched jobs from mongo and shapes them into the
 * structure the email renderer consumes.
 *
 * @param {string} physicianId
 * @param {StoredMatchResult[]} topMatches - output from getTopMatchesForPhysician
 * @param {number} totalOpenMatches - total open matches before truncation
 * @returns {Promise<{ physician: object, jobs: object[], totalOpenMatches: number }>}
 */
export async function buildEmailPayload(physicianId, topMatches, totalOpenMatches) {
  const physician = await dataRepository.findPhysicianById(physicianId)
  const jobs = await dataRepository.findJobsByIds(topMatches.map((m) => m.jobId))
  const jobsById = new Map(jobs.map((j) => [j._id, j]))

  const physicianPayload = {
    firstName: physician?.firstName ?? '',
    lastName: physician?.lastName ?? '',
    medSpeciality: physician?.medSpeciality ?? '',
    medicalProvince: physician?.medicalProvince ?? '',
    preferredProvinces: physician?.preferredProvinces ?? [],
    workAddress: {
      city: physician?.workAddress?.city ?? '',
      province: physician?.workAddress?.province ?? '',
    },
  }

  const jobsPayload = topMatches.map((match, i) => {
    const job = jobsById.get(match.jobId)

    return {
      rank: i + 1,
      postTitle: job?.postTitle ?? '',
      facilityName: job?.facilityName ?? '',
      city: job?.fullAddress?.city ?? '',
      province: job?.fullAddress?.province ?? '',
      dateFrom: formatDate(job?.dateRange?.from),
      dateTo: formatDate(job?.dateRange?.to),
      schedule: job?.schedule ?? '',
      locumPay: job?.locumPay ?? '',
      emr: job?.facilityInfo?.emr ?? '',
      score: match.score,
      viewUrl: job?.jobId ? `${BASE_URL}/${job.jobId}` : '',
      jobID: match.jobId,
      runID: match.runId,
    }
  })

  return { physician: physicianPayload, jobs: jobsPayload, totalOpenMatches }
}
