// @ts-check

// Throwaway base used only to parse relative req.url paths with new URL().
// The host is never used — only pathname and searchParams are read.
export const PARSE_BASE = 'http://x'

export const SERVER = /** @type {const} */ ({
  BODY_LIMIT: 10_240,
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
  },
})

export const QUEUE = /** @type {const} */ ({
  CONCURRENCY: 3,
  RECOVERY_INTERVAL_MS: 60 * 60 * 1000,
})

/** @typedef {import('@locvm/types').MatchRun['type']} MatchRunType */
export const JOB_TYPES = /** @type {const} */ ({
  JOB_POSTED: 'JOB_POSTED',
  PHYSICIAN_UPDATED: 'PHYSICIAN_UPDATED',
  WEEKLY_DIGEST: 'WEEKLY_DIGEST',
})
