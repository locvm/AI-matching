// @ts-check

import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    MONGODB_URI: z.string().url(),
    PORT: z.coerce.number().default(3001),
    // Shared secret between locvm-app and this service. Required in production.
    // Shared secret between locvm-app and this service. Required in production.
    MATCHING_SERVICE_SECRET: z.string().optional(),
    // Token to access the dashboard UI. Required in production.
    DASHBOARD_TOKEN: z.string().optional(),
  },
  runtimeEnv: process.env,
})
