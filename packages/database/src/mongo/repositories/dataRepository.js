// @ts-check

// Data repository — replaces loadFixtures for real MongoDB reads.
// All documents are normalized through the same mappers the fixture loader uses,
// so handlers receive identical domain objects regardless of the data source.

import { ObjectId } from 'mongodb'
import { physicianToDomain, locumJobToDomain, reservationToDomain } from '@locvm/matching-engine'
import { getDb } from '../connection.js'
import { COLLECTIONS } from '../collections.js'

/**
 * Fetches a single LocumJob by its MongoDB _id.
 *
 * @param {string} jobId
 * @returns {Promise<import('@locvm/types').LocumJob | null>}
 */
export async function findJobById(jobId) {
  const db = await getDb()
  const doc = await db.collection(COLLECTIONS.LOCUM_JOBS).findOne({ _id: new ObjectId(jobId) })
  return doc ? locumJobToDomain(doc) : null
}

/**
 * Fetches multiple LocumJobs by their MongoDB _ids.
 *
 * @param {string[]} jobIds
 * @returns {Promise<import('@locvm/types').LocumJob[]>}
 */
export async function findJobsByIds(jobIds) {
  if (!jobIds.length) return []
  const db = await getDb()
  const docs = await db
    .collection(COLLECTIONS.LOCUM_JOBS)
    .find({ _id: { $in: jobIds.map((id) => new ObjectId(id)) } })
    .toArray()
  return docs.map(locumJobToDomain)
}

/**
 * Fetches a single physician (User) by MongoDB _id.
 *
 * @param {string} physicianId
 * @returns {Promise<import('@locvm/types').Physician | null>}
 */
export async function findPhysicianById(physicianId) {
  const db = await getDb()
  const doc = await db
    .collection(COLLECTIONS.USERS)
    .findOne({ _id: new ObjectId(physicianId), medProfession: 'Physician' })
  return doc ? physicianToDomain(doc) : null
}

/**
 * Fetches all physicians who have completed onboarding.
 * Used by JobPostedHandler to score a new job against the full physician pool.
 *
 * @returns {Promise<import('@locvm/types').Physician[]>}
 */
export async function findEligiblePhysicians() {
  const db = await getDb()
  const docs = await db
    .collection(COLLECTIONS.USERS)
    .find({ medProfession: 'Physician', isOnboardingCompleted: true })
    .toArray()
  return docs.map(physicianToDomain)
}

/**
 * Fetches the reservation associated with a job.
 *
 * @param {string} jobId
 * @returns {Promise<import('@locvm/types').Reservation | null>}
 */
export async function findReservationByJobId(jobId) {
  const db = await getDb()
  const doc = await db.collection(COLLECTIONS.RESERVATIONS).findOne({ locumJobId: new ObjectId(jobId) })
  return doc ? reservationToDomain(doc) : null
}

/**
 * Fetches all reservations that are currently open (accepting applicants).
 *
 * @returns {Promise<import('@locvm/types').Reservation[]>}
 */
export async function findOpenReservations() {
  const db = await getDb()
  const docs = await db
    .collection(COLLECTIONS.RESERVATIONS)
    .find({ status: { $in: ['Pending', 'Requested', 'Awaiting Payment'] } })
    .toArray()
  return docs.map(reservationToDomain)
}
