// @ts-check

import { exec } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { connect, disconnect } from '@locvm/database'
import { getTopMatchesForPhysician, buildEmailPayload } from './get-top-matches.js'
import { renderEmailToFile } from './render-email.js'

export { getTopMatchesForPhysician, buildEmailPayload, renderEmailToFile }

// --- CLI runner: node --env-file=../../.env src/index.js <physicianId> ---

const physicianId = process.argv[2]

if (physicianId) {
  await connect()
  try {
    console.log(`Fetching top matches for physician ${physicianId}...\n`)

    const { topMatches, totalOpenMatches } = await getTopMatchesForPhysician(physicianId)

    if (topMatches.length === 0) {
      console.log('No matches found.')
    } else {
      console.log(`Top ${topMatches.length} of ${totalOpenMatches} open matches:\n`)
      for (const m of topMatches) {
        console.log(`  #${m.rank ?? '-'}  job=${m.jobId}  score=${m.score}  breakdown=${JSON.stringify(m.breakdown)}`)
      }

      const payload = await buildEmailPayload(physicianId, topMatches, totalOpenMatches)
      console.log('\n--- Email Payload ---\n')
      console.log(JSON.stringify(payload, null, 2))

      const __dirname = dirname(fileURLToPath(import.meta.url))
      const outputPath = join(__dirname, 'emailTemplateHTML', `email-preview-${physicianId}.html`)
      await renderEmailToFile(payload, outputPath)
      console.log(`\nEmail preview written to: ${outputPath}`)
      exec(`open "${outputPath}"`)
    }
  } finally {
    await disconnect()
  }
}
