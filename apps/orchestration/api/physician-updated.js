// @ts-check

import { connect, disconnect } from '@locvm/database'
import { env } from '@locvm/env'
import { isAuthorized, readBody, applySecurityHeaders } from '../src/http/middleware.js'
import { PhysicianUpdatedHandler } from '../src/handlers/physician-updated.js'

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

  const payload = /** @type {any} */ (await readBody(req))
  if (!payload.physicianId || typeof payload.physicianId !== 'string') {
    res.writeHead(400).end('physicianId required')
    return
  }

  await connect()
  try {
    await new PhysicianUpdatedHandler().process({ physicianId: payload.physicianId }, (msg) => console.log(msg))
    res.writeHead(202).end()
  } finally {
    await disconnect()
  }
}
