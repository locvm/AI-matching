// @ts-check

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = join(__dirname, 'emailTemplateHTML', 'LOCVM_Email_Digest_Preview.html')

/** @param {string} str @param {number} max @returns {string} */
function truncate(str, max) {
  if (!str || str.length <= max) return str
  return str.slice(0, max).trim() + '…'
}

/** @param {Record<string, string>} job @param {boolean} isFirst @returns {string} */
function renderJobCard(job, isFirst) {
  const pills = []
  if (job.locumPay) pills.push(`<span class="pill pay">$${job.locumPay}</span>`)
  if (job.dateFrom && job.dateTo) pills.push(`<span class="pill">${job.dateFrom} – ${job.dateTo}</span>`)
  if (job.schedule) pills.push(`<span class="pill">${truncate(job.schedule, 30)}</span>`)
  if (job.emr) pills.push(`<span class="pill">${job.emr}</span>`)

  return `      <div class="job-card${isFirst ? ' top' : ''}">
        ${isFirst ? '<div class="top-badge">Best match</div>' : ''}
        <div class="job-title">${job.postTitle}</div>
        <div class="job-facility">${job.facilityName} · ${job.city}, ${job.province}</div>
        <div class="job-meta">
          ${pills.join('\n          ')}
        </div>
        <a class="job-cta" href="${job.viewUrl}">${isFirst ? `→ View assignment, starts ${job.dateFrom}` : '→ View assignment'}</a>
      </div>`
}

/**
 * @param {{ physician: any, jobs: any[], totalOpenMatches: number }} payload
 * @returns {Promise<string>}
 */
export async function renderEmail(payload) {
  const template = await readFile(TEMPLATE_PATH, 'utf-8')
  const { physician, jobs, totalOpenMatches } = payload

  const lastName = physician.lastName || 'Physician'
  const specialty = physician.medSpeciality || 'Medicine'
  const specialtyLower = specialty.toLowerCase()
  const province = physician.preferredProvinces?.[0] || 'Ontario'
  const count = String(jobs.length)
  const totalOpen = String(totalOpenMatches)

  const topJob = jobs[0] || {}
  const preheader = topJob.locumPay
    ? `Top pick: $${topJob.locumPay} · ${topJob.city} · starts ${topJob.dateFrom}`
    : `${count} ${specialty} matches`

  const now = new Date()
  const weekOf = now.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })
  const monthYear = now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })

  const jobCardsHtml = jobs.map((job, i) => renderJobCard(job, i === 0)).join('\n')

  const replacements = {
    '{{LAST_NAME}}': lastName,
    '{{SPECIALTY}}': specialty,
    '{{SPECIALTY_LOWER}}': specialtyLower,
    '{{COUNT}}': count,
    '{{TOTAL_OPEN}}': totalOpen,
    '{{PROVINCE}}': province,
    '{{PREHEADER}}': preheader,
    '{{WEEK_OF}}': weekOf,
    '{{MONTH_YEAR}}': monthYear,
    '{{JOB_CARDS}}': jobCardsHtml,
  }

  let html = template
  for (const [placeholder, value] of Object.entries(replacements)) {
    html = html.replaceAll(placeholder, value)
  }

  return html
}

/**
 * @param {{ physician: any, jobs: any[], totalOpenMatches: number }} payload
 * @param {string} outputPath
 * @returns {Promise<string>}
 */
export async function renderEmailToFile(payload, outputPath) {
  const html = await renderEmail(payload)
  await writeFile(outputPath, html, 'utf-8')
  return outputPath
}
