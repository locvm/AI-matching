// @ts-check

import { z } from 'zod'

import { VALID_JOB_FILTERS } from '../harness.config.js'

export const cliOptsSchema = z.object({
  maxJobs: z.coerce.number().int().positive(),
  maxUsers: z.coerce.number().int().positive(),
  topK: z.coerce.number().int().positive(),
  seed: z.preprocess((v) => (v != null ? Number(v) : undefined), z.number().int().positive().optional()),
  jobFilter: z.enum(/** @type {[string, ...string[]]} */ (VALID_JOB_FILTERS)).optional(),
  outputDir: z.string(),
  jobs: z.string().optional(),
  users: z.string().optional(),
  reservations: z.string().optional(),
})
