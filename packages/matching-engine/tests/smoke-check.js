// @ts-check
//
// Smoke check for scoreJob and scorePhysician.
//
// Usage:
//   node tests/smoke-check.js scorePhysician <physicianId>
//   node tests/smoke-check.js scoreJob <jobId>

import { loadFixtures } from '@locvm/database'
import { scoreJob, scorePhysician } from '@locvm/matching-engine'

const [command, id] = process.argv.slice(2)

if (!command || !id) {
  console.log('Usage:')
  console.log('  node tests/smoke-check.js scorePhysician <physicianId>')
  console.log('  node tests/smoke-check.js scoreJob <jobId>')
  process.exit(1)
}

const { jobs, physicians, reservations } = await loadFixtures()

if (command === 'scorePhysician') {
  const physician = physicians.find((p) => p._id === id)
  if (!physician) {
    console.error(`Physician "${id}" not found. ${physicians.length} physicians in fixtures.`)
    process.exit(1)
  }

  console.log(`\nPhysician: ${physician._id}`)
  console.log(`Profession: ${physician.medProfession ?? 'n/a'}  |  Specialty: ${physician.medSpeciality ?? 'n/a'}`)
  console.log(`Scoring against ${jobs.length} jobs...\n`)

  const results = await scorePhysician(physician, jobs, reservations)

  if (results.length === 0) {
    console.log('No matching jobs found.')
  } else {
    console.log(`Top ${results.length} jobs:`)
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const job = jobs.find((j) => j._id === r.jobId)
      console.log(
        `  #${i + 1}  score=${r.score}  loc=${r.breakdown.location ?? '-'}  dur=${r.breakdown.duration ?? '-'}  emr=${r.breakdown.emr ?? '-'}  "${job?.postTitle ?? '?'}" (${r.jobId})`
      )
    }
  }
} else if (command === 'scoreJob') {
  const job = jobs.find((j) => j._id === id)
  if (!job) {
    console.error(`Job "${id}" not found. ${jobs.length} jobs in fixtures.`)
    process.exit(1)
  }

  console.log(`\nJob: ${job._id}`)
  console.log(`Title: ${job.postTitle ?? 'n/a'}  |  Specialty: ${job.medSpeciality ?? 'n/a'}`)
  console.log(`Scoring against ${physicians.length} physicians...\n`)

  const reservation = reservations.find((r) => r.locumJobId === job._id) ?? null
  const results = await scoreJob(job, physicians, reservation)

  if (results.length === 0) {
    console.log('No matching physicians found.')
  } else {
    console.log(`Top ${results.length} physicians:`)
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const doc = physicians.find((p) => p._id === r.physicianId)
      console.log(
        `  #${i + 1}  score=${r.score}  loc=${r.breakdown.location ?? '-'}  dur=${r.breakdown.duration ?? '-'}  emr=${r.breakdown.emr ?? '-'}  ${doc?.firstName ?? '?'} ${doc?.lastName ?? '?'} — ${doc?.medSpeciality ?? '?'} (${r.physicianId})`
      )
    }
  }
} else {
  console.error(`Unknown command "${command}". Use "scorePhysician" or "scoreJob".`)
  process.exit(1)
}

console.log()
