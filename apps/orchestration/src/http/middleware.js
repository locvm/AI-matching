// @ts-check

import crypto from 'node:crypto'
import { SERVER, PARSE_BASE } from '../config/index.js'

/** @param {import('node:http').ServerResponse} res */
export function applySecurityHeaders(res) {
  for (const [key, value] of Object.entries(SERVER.SECURITY_HEADERS)) {
    res.setHeader(key, value)
  }
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
export function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > SERVER.BODY_LIMIT) reject(new Error('Payload too large'))
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
  })
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {string | null}
 */
export function extractBearer(req) {
  const header = req.headers['authorization'] ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

/**
 * Returns true if the request is authorized, false otherwise.
 * If no secret is configured, always returns true (local dev).
 *
 * @param {string | undefined} secret
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {string | null}
 */
function extractQueryToken(req) {
  return new URL(req.url ?? '/', PARSE_BASE).searchParams.get('token')
}

/**
 * Returns true if the request is authorized, false otherwise.
 * Accepts token via Authorization header or ?token= query param.
 * If no secret is configured, always returns true (local dev).
 *
 * @param {string | undefined} secret
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isAuthorized(secret, req) {
  if (!secret) return true
  const token = extractBearer(req) ?? extractQueryToken(req)
  if (!token || token.length !== secret.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))
}
