// @ts-check

import { createServer } from 'node:http'
import { env } from '@locvm/env'
import { applySecurityHeaders, isAuthorized } from './middleware.js'
import { PARSE_BASE } from '../config/index.js'
import { dashboardRoute, jobPostedRoute, physicianUpdatedRoute } from './routes.js'

/**
 * @param {import('../queue/index.js').MatchingQueue} queue
 * @returns {import('node:http').Server}
 */
export function createMatchingServer(queue) {
  return createServer(async (req, res) => {
    applySecurityHeaders(res)

    const { pathname } = new URL(req.url ?? '/', PARSE_BASE)

    try {
      if (req.method === 'GET' && pathname === '/') {
        if (!isAuthorized(env.DASHBOARD_TOKEN, req)) {
          res.writeHead(401, { 'WWW-Authenticate': 'Bearer' }).end('Unauthorized')
          return
        }
        await dashboardRoute(res, queue)
        return
      }

      if (req.method === 'POST') {
        if (!isAuthorized(env.MATCHING_SERVICE_SECRET, req)) {
          res.writeHead(401).end('Unauthorized')
          return
        }
        if (pathname === '/job-posted') {
          await jobPostedRoute(req, res, queue)
          return
        }
        if (pathname === '/physician-updated') {
          await physicianUpdatedRoute(req, res, queue)
          return
        }
      }

      res.writeHead(404).end()
    } catch (err) {
      console.error('[server] error:', err)
      res.writeHead(500).end()
    }
  })
}

/**
 * @param {import('node:http').Server} server
 * @returns {Promise<void>}
 */
export function startServer(server) {
  return new Promise((resolve) => {
    server.listen(env.PORT, () => {
      console.log(`Matching service listening on port ${env.PORT}`)
      resolve()
    })
  })
}
