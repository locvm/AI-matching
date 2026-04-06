// @ts-check

import { MongoClient } from 'mongodb'
import { env } from '@locvm/env'

/** @type {MongoClient | null} */
let client = null

/**
 * Returns a connected MongoClient singleton.
 * Safe to call multiple times — reuses the existing connection.
 *
 * @returns {Promise<MongoClient>}
 */
export async function connect() {
  if (client) return client

  client = new MongoClient(env.MONGODB_URI)
  await client.connect()
  return client
}

/**
 * Returns the default database derived from the MONGODB_URI connection string.
 *
 * @returns {Promise<import('mongodb').Db>}
 */
export async function getDb() {
  const c = await connect()
  return c.db()
}

/**
 * Closes the MongoDB connection. Call on process shutdown.
 *
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (client) {
    await client.close()
    client = null
  }
}
