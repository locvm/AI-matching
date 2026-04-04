// @ts-check

import { loadFixtures, JsonStore, STORE_PATHS } from '@locvm/database'
import { getTopMatchesForPhysician, buildEmailPayload } from './get-top-matches.js'

export { getTopMatchesForPhysician, buildEmailPayload }

// --- CLI runner: node src/index.js <physicianId> ---

const physicianId = process.argv[2]

if (physicianId) {
  const { jobs, physicians, reservations } = await loadFixtures()
  const resultsStore = new JsonStore(STORE_PATHS.matchRunResults)

  console.log(`Fetching top matches for physician ${physicianId}...\n`)

  const { topMatches, totalOpenMatches } = await getTopMatchesForPhysician(physicianId, {
    resultsStore,
    reservations,
  })

  if (topMatches.length === 0) {
    console.log('No matches found.')
  } else {
    console.log(`Top ${topMatches.length} of ${totalOpenMatches} open matches:\n`)
    for (const m of topMatches) {
      console.log(`  #${m.rank ?? '-'}  job=${m.jobId}  score=${m.score}  breakdown=${JSON.stringify(m.breakdown)}`)
    }

    const payload = buildEmailPayload(physicianId, topMatches, totalOpenMatches, { physicians, jobs })
    console.log('\n--- Email Payload ---\n')
    console.log(JSON.stringify(payload, null, 2))
  }
}
