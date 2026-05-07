// @ts-check

import { buildEmailPayload, getTopMatchesForPhysician } from '@locvm/communication'
import { connect, disconnect } from '@locvm/database'
import { env } from '@locvm/env'
import { applySecurityHeaders, isAuthorized, readBody } from '../src/http/middleware.js'

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req, res) {
  applySecurityHeaders(res)

  if (req.method !== 'POST') {
    res.writeHead(405).end()
    return
  }

  if (!isAuthorized(env.MATCHING_SERVICE_SECRET, req)) {
    res.writeHead(401).end('Unauthorized')
    return
  }

  const body = /** @type {any} */ (await readBody(req))
  if (!body.physicianId || typeof body.physicianId !== 'string') {
    res.writeHead(400).end('physicianId required')
    return
  }

  await connect()
  try {
    const { topMatches, totalOpenMatches } = await getTopMatchesForPhysician(body.physicianId)
    const payload = await buildEmailPayload(body.physicianId, topMatches, totalOpenMatches)
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload))
  } finally {
    await disconnect()
  }
}
