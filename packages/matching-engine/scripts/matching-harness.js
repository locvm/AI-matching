#!/usr/bin/env node
// @ts-check

import { Command } from 'commander'
import { ZodError } from 'zod'

import { cliOptsSchema } from '../tests/harness/lib/cli-schema.js'
import { loadFixtures } from '../tests/harness/lib/fixture-loader.js'
import { MatchingTestHarness } from '../tests/harness/lib/matching-harness-runner.js'
import { SAMPLING, OUTPUT, PATHS, VALID_JOB_FILTERS } from '../tests/harness/harness.config.js'

/** @typedef {import('../tests/harness/lib/types.js').HarnessCliOptions} HarnessCliOptions */
/** @typedef {import('../tests/harness/lib/types.js').HarnessRunResult} HarnessRunResult */

const program = new Command()

program
  .name('matching-harness')
  .description('Run the LOCVM matching engine test harness against JSON fixtures')
  .version('0.1.0')
  .option('--maxJobs <number>', 'Maximum number of jobs to sample', String(SAMPLING.MAX_JOBS))
  .option('--maxUsers <number>', 'Maximum number of users to sample', String(SAMPLING.MAX_USERS))
  .option('--topK <number>', 'Number of top physicians to include per job', String(OUTPUT.TOP_K))
  .option('--seed <number>', 'Random seed for deterministic sampling')
  .option('--jobFilter <type>', `Filter jobs: ${VALID_JOB_FILTERS.map((f) => `"${f}"`).join(', ')}`)
  .option('--outputDir <path>', 'Output directory for artifacts', PATHS.OUTPUT_DIR)
  .option('--jobs <path>', 'Path to locumjobs JSON fixture')
  .option('--users <path>', 'Path to users JSON fixture')
  .option('--reservations <path>', 'Path to reservations JSON fixture')
  .action(async (rawOpts) => {
    try {
      const opts = /** @type {HarnessCliOptions} */ (cliOptsSchema.parse(rawOpts))

      const fixtures = await loadFixtures({
        jobs: opts.jobs,
        users: opts.users,
        reservations: opts.reservations,
      })

      const harness = new MatchingTestHarness(fixtures, {
        topK: opts.topK,
        outputDir: opts.outputDir,
        sampling: {
          maxJobs: opts.maxJobs,
          maxUsers: opts.maxUsers,
          seed: opts.seed,
          jobFilter: opts.jobFilter,
        },
      })

      const result = /** @type {HarnessRunResult} */ (await harness.run())
      console.log(`\nHarness complete.`)
      console.log(`  Jobs processed: ${result.jobsProcessed}`)
      console.log(`  Total matches:  ${result.totalMatches}`)
      console.log(`  Seed used:      ${result.seed}`)
      console.log(`  Output file:    ${result.outputPath}`)
    } catch (err) {
      if (err instanceof ZodError) {
        console.error('Invalid CLI options:')
        for (const issue of err.issues) {
          console.error(`  --${issue.path.join('.')}: ${issue.message}`)
        }
        process.exit(1)
      }
      console.error('Harness failed:', err)
      process.exit(1)
    }
  })

program.parse()
