// @ts-check

/**
 * Communication Layer: Get Top Matches for a Physician
 */

import { JsonStore } from '@locvm/database'

/** @typedef {import('@locvm/types').Reservation} Reservation */
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
 * @property {string} computedAt
 */

/** Reservation statuses that mean the job is still open and accepting matches */
const OPEN_STATUSES = new Set(['Pending', 'Awaiting Payment'])
const TOP_K = 5
const BASE_URL = 'https://locvm.ca/jobs'

/**
 * Returns the top-K best job matches for a given physician.
 *
 * Reads from the stored match-run results (populated by the orchestration layer),
 * keeps only active results whose jobs are still open, then ranks and truncates.
 *
 * @param {string} physicianId
 * @param {{ resultsStore: JsonStore, reservations: Reservation[] }} deps
 * @returns {Promise<{ topMatches: StoredMatchResult[], totalOpenMatches: number }>}
 */
export async function getTopMatchesForPhysician(physicianId, { resultsStore, reservations }) {
  // Only keep the open jobs
  const openJobIds = new Set(reservations.filter((r) => OPEN_STATUSES.has(r.status)).map((r) => r.locumJobId))

  const allResults = /** @type {StoredMatchResult[]} */ (
    await resultsStore.findMany((r) => r.physicianId === physicianId && r.isActive === true)
  )

  const filtered = allResults.filter((r) => openJobIds.has(r.jobId))
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
 * Takes the top matches (from getTopMatchesForPhysician) and enriches them
 * with job details and physician info so an email provider can render the email.
 *
 * @param {string} physicianId
 * @param {StoredMatchResult[]} topMatches - output from getTopMatchesForPhysician
 * @param {number} totalOpenMatches - total open matches before truncation
 * @param {{ physicians: Physician[], jobs: LocumJob[] }} data
 * @returns {{ physician: object, jobs: object[], totalOpenMatches: number }}
 */
export function buildEmailPayload(physicianId, topMatches, totalOpenMatches, { physicians, jobs }) {
  const physician = physicians.find((p) => p._id === physicianId)

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
    const job = jobs.find((j) => j._id === match.jobId)

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
    }
  })

  return { physician: physicianPayload, jobs: jobsPayload, totalOpenMatches }
}
