// @ts-check

// Reservation Data Mapper
//
// Takes a raw Reservation document from MongoDB and turns it into a clean Reservation.
//
// Schema: reference/schema/reservation.model.js (reservationSchema)
// Interface: src/interfaces/core/models.js (Reservation)
//
// What each field does:
//   _id                                        becomes  _id                              (coerceObjectId)
//   locumJobId                                  becomes  locumJobId                       (coerceObjectId)
//   status                                      becomes  status                           (validate against 8 value enum, default "Pending")
//   applicants[].userId                         becomes  applicants[].userId              (coerceObjectId)
//   applicants[]._id                            becomes  applicants[]._id                 (coerceObjectId)
//   applicants[].currentApplicationStage        becomes  applicants[].currentApplicationStage  (validate 5 value enum)
//   applicants[].applicationLog[].event         becomes  applicants[].applicationLog[].event   (validate stage)
//   applicants[].applicationLog[].at            becomes  applicants[].applicationLog[].at      (ensureDate)
//   applicants[].applicationLog[].note          becomes  applicants[].applicationLog[].note    (trimString)
//   reservationDate.from                        becomes  reservationDate.from             (ensureDate)
//   reservationDate.to                          becomes  reservationDate.to               (ensureDate)
//   createdBy                                   becomes  createdBy                        (coerceObjectId)
//   reservedBy                                  becomes  reservedBy                       (coerceObjectId)
//   createdAt                                   becomes  createdAt                        (ensureDate)
//   dateModified                                becomes  dateModified                     (ensureDate)

/** @typedef {import("../interfaces/core/models.js").Reservation} Reservation */
/** @typedef {import("../interfaces/core/models.js").ReservationStatus} ReservationStatus */
/** @typedef {import("../interfaces/core/models.js").ReservationApplicant} ReservationApplicant */
/** @typedef {import("../interfaces/core/models.js").ApplicationStage} ApplicationStage */

import { coerceObjectId, ensureDate, trimString } from './primitives.js'

/** @type {Set<string>} */
const VALID_STATUSES = new Set([
  'Pending',
  'Requested',
  'Awaiting Payment',
  'Confirmed',
  'In Progress',
  'Completed',
  'Cancelled',
  'Expired',
])

/** @type {Set<string>} */
const VALID_STAGES = new Set(['Applied', 'Selected', 'Archived', 'Withdrawn', 'Cancelled'])

/**
 * Checks if the status is one of the 8 valid ones. Falls back to "Pending" if not.
 *
 * @param {*} status
 * @returns {ReservationStatus}
 */
function validateStatus(status) {
  const s = typeof status === 'string' ? status.trim() : ''
  return /** @type {ReservationStatus} */ (VALID_STATUSES.has(s) ? s : 'Pending')
}

/**
 * Checks if the stage is one of the 5 valid ones. Returns undefined if not.
 *
 * @param {*} stage
 * @returns {ApplicationStage | undefined}
 */
function validateStage(stage) {
  const s = typeof stage === 'string' ? stage.trim() : ''
  return VALID_STAGES.has(s) ? /** @type {ApplicationStage} */ (s) : undefined
}

/**
 * Cleans up a single applicant entry.
 *
 * @param {*} raw
 * @returns {ReservationApplicant}
 */
function normalizeApplicant(raw) {
  if (!raw || typeof raw !== 'object') {
    return { _id: '', userId: undefined, applicationLog: [] }
  }

  const applicationLog = Array.isArray(raw.applicationLog)
    ? /** @type {any[]} */ (raw.applicationLog)
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          event: validateStage(entry.event) ?? trimString(entry.event),
          at: ensureDate(entry.at) ?? undefined,
          note: trimString(entry.note) || undefined,
        }))
    : []

  return {
    _id: coerceObjectId(raw._id),
    userId: coerceObjectId(raw.userId) || undefined,
    currentApplicationStage: validateStage(raw.currentApplicationStage),
    applicationLog,
  }
}

/**
 * Takes a raw Reservation doc from Mongo and gives back a clean Reservation.
 *
 * @param {Record<string, any>} raw
 * @returns {Reservation}
 */
export function toDomain(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('reservationMapper.toDomain: raw document is required')
  }

  const rawDate = raw.reservationDate ?? {}

  return {
    _id: coerceObjectId(raw._id),
    locumJobId: coerceObjectId(raw.locumJobId),
    status: validateStatus(raw.status),
    applicants: Array.isArray(raw.applicants) ? raw.applicants.map(normalizeApplicant) : [],
    reservationDate: {
      from: ensureDate(rawDate.from) ?? new Date(0),
      to: ensureDate(rawDate.to) ?? new Date(0),
    },
    createdBy: coerceObjectId(raw.createdBy) || undefined,
    reservedBy: coerceObjectId(raw.reservedBy) || undefined,
    createdAt: ensureDate(raw.createdAt) ?? undefined,
    dateModified: ensureDate(raw.dateModified) ?? undefined,
  }
}

/**
 * Turns a clean Reservation back into the raw Mongo shape.
 * Not built yet. Will be needed for write operations or SQL migration.
 *
 * @param {Reservation} _reservation
 * @returns {never}
 */
export function toPersistence(_reservation) {
  throw new Error('reservationMapper.toPersistence: not implemented')
}
