// @ts-check

import { connect, disconnect, matchRunRepository } from '@locvm/database'
import { env } from '@locvm/env'
import ejs from 'ejs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applySecurityHeaders, isAuthorized } from '../src/http/middleware.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dashboardTemplate = fs.readFileSync(path.join(__dirname, '../src/http/views/dashboard.ejs'), 'utf-8')

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req, res) {
  applySecurityHeaders(res)

  if (req.method !== 'GET') {
    res.writeHead(405).end()
    return
  }

  if (!isAuthorized(env.DASHBOARD_TOKEN, req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Bearer' }).end('Unauthorized')
    return
  }

  await connect()
  try {
    const runs = await matchRunRepository.getRecentRuns(50)
    const html = ejs.render(dashboardTemplate, {
      queue: { active: 0, pending: 0 },
      runs,
    })
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html)
  } finally {
    await disconnect()
  }
}
