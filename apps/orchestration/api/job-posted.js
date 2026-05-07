// @ts-check

import { connect, disconnect } from '@locvm/database'
import { env } from '@locvm/env'
import { JobPostedHandler } from '../src/handlers/job-posted.js'
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

  const payload = /** @type {any} */ (await readBody(req))
  if (!payload.jobId || typeof payload.jobId !== 'string') {
    res.writeHead(400).end('jobId required')
    return
  }

  await connect()
  try {
    await new JobPostedHandler().process({ jobId: payload.jobId }, (msg) => console.log(msg))
    res.writeHead(202).end()
  } finally {
    await disconnect()
  }
}
