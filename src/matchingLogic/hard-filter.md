# Hard Filter (Eligibility) — Documentation

This document describes the hard filtering layer used in the matching pipeline: what rules run, what we assume about workflow and reservations, how to change excluded statuses/stages, and how to tune behavior when data is missing.

---

## 1. Hard filter rules

The pipeline has two levels of hard filtering:

- **Job-level:** Should we run matching for this job at all? (Implemented in the matching engine / stub before the physician filter is called.) Can also be done inside filterEligiblePhysicians if wanted. This is a design decision, to keep filterEligiblePhysicians to only filter Physicians and not jobs that aren't open.
- **Physician-level:** For a given job, which physicians are eligible to be scored? (Implemented in `filterEligiblePhysicians`.)

A physician is only scored if the job passes the job level check and the physician passes every physician level rule.

### 1.1 Job-level rule (workflow / reservation status)

- **Rule:** Only run matching for jobs whose reservation is in an **eligible workflow status** (i.e. the job is still accepting applicants).
- **Where:** Matching engine stub: `isJobAcceptingApplicants(job, reservation)`.
- **Logic:** If there is no reservation, the job is treated as open. If there is a reservation, `reservation.status` must be one of:
  - `Pending`
  - `In Progress`
  - `Ongoing`
- **Effect:** If the status is something like `Completed`, `Cancelled`, or `Expired`, the engine returns no results for that job (the physician filter is not called).

### 1.2 Physician-level rules (in `filterEligiblePhysicians`)

Each rule is an AND: a physician must pass all of them to be eligible for scoring.

| #   | Rule                         | Field(s)                                                                                                             | Behavior                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Profession match**         | `physician.medProfession`, `job.medProfession`                                                                       | Must be equal (e.g. both `"Physician"`). Mismatch → excluded.                                                                                                                                                                                                                                                     |
| 2   | **Specialty match**          | `physician.medSpeciality`, `job.medSpeciality`                                                                       | Compared case-insensitively after trim. Empty/missing on physician → no match → excluded.                                                                                                                                                                                                                         |
| 3   | **Looking for locums**       | `physician.isLookingForLocums`, `physician.preferences?.isLookingForLocums`, `criteria.options.onlyLookingForLocums` | If `onlyLookingForLocums` is true (default): physician is excluded only when explicitly **not** looking (e.g. `false`). Missing → treated as "looking" (pass). If `onlyLookingForLocums` is false, this check is skipped.                                                                                         |
| 4   | **Not already an applicant** | `physician._id` / `physician.id`, `reservation.applicants[].userId`                                                  | If the physician's id appears in `reservation.applicants` (by `userId`), they are excluded. No reservation or no `applicants` → no one excluded by this rule.                                                                                                                                                     |
| 5   | **Duration mismatch**        | `physician.locumDurations` / `physician.preferences?.locumDurations`, `job.dateRange`                                | Job duration (in days) is bucketed into short/mid/long. Each bucket has a set of allowed physician duration labels. Physician is excluded only when none of their selected durations overlap the job's bucket. Missing/empty `locumDurations` → lenient (pass). No `dateRange` on job → skipped (pass). See §1.3. |

### 1.3 Duration filter rules

The duration filter excludes physicians whose preferred `locumDurations` clearly don't match the job's length. It only removes obvious mismatches; gray-area cases pass through and are handled by scoring.

**Job duration buckets** (computed from `job.dateRange.from` → `job.dateRange.to`):

| Bucket | Job duration             |
| ------ | ------------------------ |
| Short  | ≤ 30 days                |
| Mid    | 31–89 days (~1–3 months) |
| Long   | 90+ days (~3+ months)    |

**Physician `locumDurations` overlap per bucket:**

| Job bucket | Physician options that count as overlap         |
| ---------- | ----------------------------------------------- |
| Short      | "A few days", "Less than a month", "1–3 months" |
| Mid        | "1–3 months", "3–6 months"                      |
| Long       | "3–6 months", "6+ months"                       |

**How it works:**

- We only exclude when **none** of the physician's selected durations overlap the job's bucket.
- Physicians can have multiple `locumDurations` (e.g. both "A few days" and "6+ months"). If any one of them overlaps, they pass.
- "1–3 months" overlaps with short and mid but **not** long. So a physician with only "1–3 months" is excluded from long jobs (90+ days).
- "3–6 months" overlaps with mid and long but **not** short. So a physician with only "3–6 months" is excluded from short jobs (≤ 30 days).
- Missing or empty `locumDurations` → **lenient** (physician passes, not excluded).
- Job without `dateRange` → filter is skipped (physician passes).

**Where:** `src/matchingLogic/filterEligiblePhysicians.js` — `DURATION_OVERLAP` constant, `getJobDurationBucket()`, and `passesDurationFilter()`.

**To change cutoffs:** Edit the day thresholds in `getJobDurationBucket()` (e.g. change 30 to 14 for a stricter "short" definition) and/or edit which labels are in each set in `DURATION_OVERLAP`.

Planned (not yet implemented):

- **CPSOProof status** (when subscriptions launch): exclude when status is not confirmed.
- **Onboarding / profile complete** (when required): exclude when `!isOnboardingCompleted` or `!isProfileComplete`.

---

## 2. Workflow / reservation assumptions

- **Eligible statuses** are fixed in code as: `Pending`, `In Progress`, `Ongoing`. Any other status (including `Completed`, `Cancelled`, `Expired`, or missing) means "job not accepting applicants" and matching is skipped for that job.
- **Reservation optional:** The physician filter is called with `(physicians, job, reservation?, criteria?)`. If `reservation` is null/undefined, the "not already an applicant" rule has no effect (no applicant list).
- **Applicant list shape:** We only use `reservation.applicants[].userId` to build the set of applicant ids. Other fields on applicants (e.g. stages) are not used in the current hard filter; "applicant stages" in the task refers to excluding physicians who are already in `applicants`, not to a specific stage value.
- **Id format:** Physician id is taken as `physician._id ?? physician.id` and compared to `userId` as strings (`String(...)`) so ObjectId vs string doesn't matter.

---

## 3. How to adjust excluded statuses / stages

### 3.1 Job-level (which reservation statuses allow matching)

- **Where:** `tests/harness/lib/matching-engine-stub.js` (and, when the real engine exists, the equivalent place in the real matching service).
- **Constant:** `ELIGIBLE_RESERVATION_STATUSES` — a `Set` of status strings.
- **To change:** Add or remove status strings from that set. For example, to allow matching for "Draft" or "Open":
  - Add `'Draft'` or `'Open'` to the array used to create the set.
- **Product alignment:** Confirm with product/backend that these strings match the actual `reservation.status` values in your system.

### 3.2 Physician-level (applicant exclusion)

- **Where:** `src/matchingLogic/filterEligiblePhysicians.js`, helper `getApplicantIds(reservation)`.
- **Current behavior:** We collect every `applicant.userId` from `reservation.applicants` and exclude any physician whose id is in that set. We do **not** filter by applicant stage (e.g. "rejected" vs "shortlisted").
- **To exclude only certain stages:** Change `getApplicantIds` (or add a parameter) so it only adds `userId` when `applicant.stage` (or similar) is in an "excluded stages" set. Document the chosen stages and keep that set configurable so product can change it without code edits if needed.

### 3.3 Duration filter (cutoffs and allowed labels)

- **Where:** `src/matchingLogic/filterEligiblePhysicians.js` — `DURATION_OVERLAP` and `getJobDurationBucket()`.
- **To change bucket boundaries:** Edit the day thresholds in `getJobDurationBucket()`. Currently: short ≤ 30, mid 31–89, long 90+.
- **To change which labels overlap:** Edit the `DURATION_OVERLAP` sets. For example, to also allow "1–3 months" for long jobs, add it to the `long` set.
- **To make strict when missing:** In `passesDurationFilter()`, change the early return for empty `durations` from `return true` to `return false`.

---

## 4. Tuning hard filter rules for missing data

Hard filters can be **strict** (missing → exclude) or **lenient** (missing → allow through and let scoring/ranking handle it). The right choice depends on product policy and how much users actually fill in.

### 4.1 Current behavior by field

| Field                                                   | When it's missing                   | Effect                                                    |
| ------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| `medProfession`                                         | Physician has no profession         | **Strict:** no match to job → excluded.                   |
| `medSpeciality`                                         | Physician has no specialty          | **Strict:** no match to job → excluded.                   |
| `isLookingForLocums` / `preferences.isLookingForLocums` | Not set or no `preferences`         | **Lenient:** treated as "looking" → passes this rule.     |
| `reservation.applicants`                                | Reservation has no applicants array | **Lenient:** no one excluded by "already applicant" rule. |
| `locumDurations` / `preferences.locumDurations`         | Not set or empty array              | **Lenient:** duration filter skipped → passes this rule.  |
| `job.dateRange`                                         | Job has no date range               | **Lenient:** duration filter skipped → passes this rule.  |

So today: profession and specialty are strict; "looking for locums", "applicants", and "duration" are lenient when missing.

### 4.2 Why this matters

- **Strict** (missing = exclude): Fewer physicians get scored, fewer recommendations. Good when the field is required for a meaningful match and you're trying to force collection (e.g. specialty).
- **Lenient** (missing = pass): More physicians get scored; you rely on other signals (e.g. score, rank, or downstream filters). Good when the field is optional or when many users don't fill it yet (e.g. abandoned onboarding) and you still want to show them jobs.

As you make onboarding or profile completeness stricter, you can later tighten the hard filter (e.g. treat missing `isLookingForLocums` as "not looking") without changing the scoring logic.

### 4.3 How to change strictness

- **`filterEligiblePhysicians.js` — profession/specialty:**
  - To keep strict: leave as-is (no match ⇒ exclude).
  - To relax: e.g. if specialty becomes optional, you could allow empty physician specialty to pass (e.g. "no specialty declared" matches any job). That would be a product decision and a small code change in `isEligiblePhysician`.

- **`filterEligiblePhysicians.js` — isLookingForLocums:**
  - Current: `isLooking = physician.isLookingForLocums ?? physician.preferences?.isLookingForLocums ?? true` (missing → true → pass).
  - To be strict: change the default from `true` to `false` so missing → excluded.
  - Optional: make the default configurable via `criteria.options` (e.g. `treatMissingIsLookingAsTrue: boolean`) so you can A/B test or switch by environment.

- **Reservation / applicants:**
  - When `applicants` is often missing, staying lenient (don't exclude anyone) avoids over-excluding. When the field is reliably populated, the current "exclude if in applicants" rule is the right one. If you add stage-based exclusion, document which stages count as "already applied" so future changes are clear.

- **Duration / locumDurations:**
  - Current: missing or empty `locumDurations` → pass (lenient). This means physicians who never set duration preferences still get scored for all jobs.
  - To be strict: change `passesDurationFilter()` to return `false` when `durations.length === 0`, so physicians without duration preferences are excluded.
  - As more users fill in `locumDurations`, you can tighten the rule without changing the bucket or overlap logic.

### 4.4 Using real data to decide

- Run your data analysis (`npm run analyze-data`) and check missingness for `medProfession`, `medSpeciality`, `preferences.isLookingForLocums`, `reservation.applicants`, and `preferences.locumDurations`.
- If a large share of physicians is missing a required field (e.g. specialty), either:
  - **Product/UX:** Make the field required or nudged so more people fill it, then keep the hard filter strict, or
  - **Temporary:** Relax the rule for that field (e.g. allow missing specialty to pass) until data quality improves, and document the trade-off (more recommendations vs less precise targeting).

Keeping this in a doc (or in code comments) next to the filter makes it clear why each rule is strict or lenient and what to change when product or data quality evolves.
