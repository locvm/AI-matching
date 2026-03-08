# LOCVM Matching Engine. The Full Picture.

This is the full breakdown of how the matching engine works. What the interfaces look like, what gets saved to the database vs what lives in memory, how the pipeline flows, and what the test harness does.


## The 5 Real Database Tables

These are the only things that actually get saved. Everything else is temporary and lives in memory while the code is running.

### Physician (`src/interfaces/core/models.js`)

A doctor profile. Only the fields we need for matching.

| Column | Type | What it is |
|--------|------|-----------|
| _id | string | MongoDB ObjectId |
| medProfession | string | "Physician" or "Recruiter". Only Physicians get matched |
| medSpeciality | string | Like "Family Medicine", "Emergency Medicine" |
| medicalProvince | ProvinceCode? | Province where licensed. Almost everyone is "ON" |
| emrSystems | string[] | EMR systems the doctor knows. Only 42 out of 410 have this |
| location | GeoCoordinates or null | Always null. User schema has no coordinates |
| workAddress | Address or null | Work address with city, province, postal code |
| isLookingForLocums | boolean | Actively looking. If missing we default to true |
| preferredProvinces | ProvinceCode[] | Provinces the doctor prefers |
| specificRegions | string[] | Free text regions like "downtown toronto", "GTA" |
| locumDurations | DurationRange[]? | How long they want to work, as numeric day ranges |
| availableDays | DayOfWeek[]? | Which days they can work |
| commitmentTypes | CommitmentType[]? | Full time, part time, or on call |
| availabilityWindows | AvailabilityWindow[]? | Specific date ranges when they can work |
| availabilityYears | number[]? | Which years they are available |
| facilityName | string? | Name of the doctors facility |
| facilityEMR | string? | EMR system at the doctors facility |
| firstName | string? | First name |
| lastName | string? | Last name |
| role | string? | "Admin" or "User" |
| languages | string[]? | Languages spoken |
| isProfileComplete | boolean? | Profile completion flag |
| isOnboardingCompleted | boolean? | Onboarding completion flag |

### LocumJob (`src/interfaces/core/models.js`)

A job posting. All 108 in production have coordinates, date ranges, and specialty.

| Column | Type | What it is |
|--------|------|-----------|
| _id | string | MongoDB ObjectId |
| jobId | string? | Short readable ID like "EuXagtm" |
| medProfession | string | "Physician" etc |
| medSpeciality | string | Required specialty for the job |
| location | GeoCoordinates or null | GPS coords from GeoJSON |
| fullAddress | Address | Full address with province normalized to 2 letter code |
| dateRange | { from: Date, to: Date } | When the locum needs to be filled |
| schedule | string? | Work schedule description |
| jobType | string? | "FTE" or "PT" |
| facilityName | string? | Facility name |
| facilityInfo | { emr?: string }? | Facility EMR system. No job has this yet |
| experience | string? | Experience level, free text |
| locumPay | string? | Pay amount as string like "8000" |
| practiceType | string[]? | Practice types |
| patientType | string[]? | Patient types |
| postTitle | string? | Job title for display |
| locumCreatorId | string? | Who created this job |
| reservationId | string? | Associated reservation |

### Reservation (`src/interfaces/core/models.js`)

Links a doctor to a job. Tracks who applied and the booking status.

| Column | Type | What it is |
|--------|------|-----------|
| _id | string | MongoDB ObjectId |
| locumJobId | string | Which job this reservation is for |
| status | ReservationStatus | "Pending", "Requested", "Awaiting Payment", "Confirmed", "In Progress", "Completed", "Cancelled", "Expired" |
| applicants | ReservationApplicant[]? | Array of applicants. Each has _id, userId, currentApplicationStage, applicationLog |
| reservationDate | { from: Date, to: Date }? | Booking date range |
| createdBy | string? | Who created it |
| reservedBy | string? | Who reserved it |
| createdAt | Date? | Creation timestamp |
| dateModified | Date? | Last modified timestamp |

### MatchRun (`src/interfaces/persistence/records.js`)

A log entry for every time the matching engine ran. One row per execution.

| Column | Type | What it is |
|--------|------|-----------|
| id | string | Unique run ID |
| type | "SHORT_TERM" or "WEEKLY_DIGEST" | What triggered it |
| status | "PENDING" or "RUNNING" or "COMPLETED" or "FAILED" | Where its at right now |
| jobId | string? | The job this run is for (SHORT_TERM only). Null for WEEKLY_DIGEST |
| createdAt | Date | When it was created |
| startedAt | Date? | When it started running |
| completedAt | Date? | When it finished |
| error | string? | Error message if it failed |
| resultCount | number? | How many results it produced |

### MatchRunResult (`src/interfaces/persistence/records.js`)

One row per match result. This is what the frontend queries to show matches on a profile.

| Column | Type | What it is |
|--------|------|-----------|
| runId | string | Which run produced this |
| physicianId | string | The matched doctor |
| jobId | string | The job that was matched |
| score | number | Total match score |
| breakdown | Record<string, number> | Per category breakdown (location, duration, emr, etc) |
| computedAt | Date | When this score was calculated |
| notifiedAt | Date? | When the doctor was emailed about this match. Null means not yet notified |

Thats it. 5 tables. Nothing else gets persisted.


## The In Memory Shapes (not saved anywhere)

These exist only while the pipeline is running. They get created, used, and then thrown away.

| Shape | What it is | Where its defined |
|-------|-----------|-------------------|
| ScoreBreakdown | The 5 individual category scores (location, duration, emr, province, speciality). Each one is 0 to 1 | `src/interfaces/matching/matching.js` |
| SearchResult | The final output for one match. Has physicianId, jobId, total score, breakdown, and data quality flags | `src/interfaces/matching/matching.js` |
| SearchOptions | Config you pass into the pipeline. Threshold (minimum score to include), limit (max results), isShortTerm flag | `src/interfaces/matching/matching.js` |
| ScoredPair | Intermediate result from scoring one physician against one job. Has the 5 raw scores but NO total score yet. That gets calculated in the combine step | `src/interfaces/matching/matching.js` |

The key thing is ScoredPair. It only exists between Stage 2 and Stage 3 of the pipeline. Its the raw scores before they get weighted and combined into a final number.


## The Pipeline (3 Stages)

The matching engine is a 3 stage pipeline. It has two entry points depending on what triggered it.

### Entry Point A: A new job was posted (ScoreJobFn)

Takes 1 job and ALL physicians. Finds the best physicians for that job.

### Entry Point B: A new physician signed up (ScorePhysicianFn)

Takes 1 physician and ALL jobs. Finds the best jobs for that physician.

Both entry points run the exact same 3 stages. Just the loop direction is flipped.

```
INPUT
  Entry A: 1 job + all physicians
  Entry B: 1 physician + all jobs
  |
  v
STAGE 1: FILTER
  Remove anyone who obviously doesnt qualify.
  Hard checks: profession must match, specialty must match,
  physician must be looking for locums, no scheduling conflicts.
  |
  Only eligible pairs move forward.
  |
  v
STAGE 2: SCORE ONE PAIR (runs once per eligible pair)
  Call all 5 scorers on this physician + job combo:
    scoreLocation()    -> 0 to 1
    scoreDuration()    -> 0 to 1
    scoreEMR()         -> 0 to 1
    scoreProvince()    -> 0 to 1
    scoreSpeciality()  -> 0 to 1
  |
  Output: ScoredPair (raw scores, no total yet)
  |
  v
STAGE 3: COMBINE + RANK
  Apply weights to each category:
    location  * 0.45
    duration  * 0.35
    emr       * 0.20
  Add them up for a total score.
  Filter out anything below the threshold.
  Sort by score (highest first).
  Cap at the limit.
  |
  v
OUTPUT: SearchResult[]
  { physicianId, jobId, score, breakdown, flags }
```


## All The Functions

### Filter Functions (`src/interfaces/matching/filters.js`)

| Function | What it does |
|----------|-------------|
| IsEligiblePhysicianFn(physician, job, reservation?) | Checks if one physician passes all hard filters for one job. Returns true or false |
| IsShortTermJobFn(job) | Checks if a job counts as "short term" so it triggers immediate matching. Configurable threshold |
| FilterPhysiciansForJobFn(job, physicians, reservation?) | Loops all physicians, calls IsEligiblePhysicianFn on each, returns only the ones that pass. This is the Stage 1 entry for job centric |
| FilterJobsForPhysicianFn(physician, jobs, reservations?) | Loops all jobs, calls the eligibility check (flipped) on each, returns only the jobs that pass. This is the Stage 1 entry for physician centric |

### Scorer Functions (`src/interfaces/scoring/scorers.js`)

All 5 return a number from 0 to 1. These are the Stage 2 building blocks.

| Function | What it scores |
|----------|---------------|
| ScoreLocationFn(physician, jobLocation, jobAddress?) | How close the doctor is to the job. Uses GPS when available, falls back through regions, provinces, work address |
| ScoreDurationFn(physician, jobDateRange) | How well the doctors availability overlaps with the job dates |
| ScoreEMRFn(physicianEMRs, jobEMR?) | Whether the doctor knows the EMR system used at the facility. 0.5 if data is missing (most jobs dont have this yet) |
| ScoreProvinceFn(physician, jobProvince?) | Whether the job is in a province the doctor prefers |
| ScoreSpecialityFn(physician, jobSpeciality) | Specialty match. Mostly 1.0 or 0.0 since the hard filter already kicks out non matches |

### Pipeline Functions (`src/interfaces/matching/matching.js`)

| Function | What it does |
|----------|-------------|
| ScoreMatchFn(physician, job) | Stage 2. Calls all 5 scorers on one pair. Returns a ScoredPair with raw 0 to 1 scores. No total score yet |
| CombineAndRankFn(scoredPairs[], options?) | Stage 3. Takes all the ScoredPairs, applies weights, computes totals, filters, sorts, caps. Returns SearchResult[] |
| ScoreJobFn(job, physicians, reservation?, options?) | Top level orchestrator A. Runs filter, score, combine for 1 job against all physicians |
| ScorePhysicianFn(physician, jobs, reservations?, options?) | Top level orchestrator B. Runs filter, score, combine for 1 physician against all jobs |

### Persistence (`src/interfaces/persistence/`)

| Thing | What it does |
|-------|-------------|
| MatchRunRepository | createRun(), updateRunStatus(), getPendingRuns(). Manages the log of when the engine ran |
| MatchRunResultRepository | saveResults(), getResults(). Stores and retrieves the actual match results |

### Orchestration Services (`src/interfaces/orchestration/services.js`)

| Service | When it runs |
|---------|-------------|
| ShortTermMatchService.runForJob(jobId) | When a new short term job is posted. Loads everything, calls ScoreJobFn, saves results |
| WeeklyDigestService.runWeekly() | On a cron schedule. Loops all active jobs, calls ScoreJobFn for each, combines per physician, saves results |


## What Changed in the Interfaces (the cleanup)

### Removed

1. **SearchPhysiciansFn** (was in matching.js). This was one big monolithic function that did everything. Replaced by the 3 stage pipeline with ScoreJobFn and ScorePhysicianFn as the two entry points.

2. **OutboxItem** (was in records.js). This was a whole separate table just for tracking notifications. We killed it and added a `notifiedAt` field directly on MatchRunResult instead. If notifiedAt is null, the doctor hasnt been emailed yet. If it has a date, they have been. Way simpler.

3. **NotificationOutboxRepository** (was in repositories.js). The repository for OutboxItem. Gone because OutboxItem is gone.

### Added

1. **ScoredPair** (matching.js). In memory intermediate shape. Holds the 5 raw scores before they get combined into a total.

2. **ScoreMatchFn** (matching.js). Stage 2 function. Scores one physician against one job across all 5 categories.

3. **CombineAndRankFn** (matching.js). Stage 3 function. Applies weights, combines, sorts, filters, caps.

4. **ScoreJobFn** (matching.js). Job centric orchestrator. Replaces the old SearchPhysiciansFn.

5. **ScorePhysicianFn** (matching.js). Physician centric orchestrator. Brand new. This is the "new doctor signed up, find them jobs" path.

6. **FilterPhysiciansForJobFn** (filters.js). Stage 1 filter for job centric pipeline.

7. **FilterJobsForPhysicianFn** (filters.js). Stage 1 filter for physician centric pipeline.

8. **jobId field on SearchResult** (matching.js). Results now always carry both physicianId and jobId so you know which pair produced this score.

9. **notifiedAt field on MatchRunResult** (records.js). Replaces the entire OutboxItem table. Simple date field.

### Updated

1. **ShortTermMatchService** (services.js). Now references scoreJob() instead of searchPhysicians(). Removed all OutboxItem and notification outbox stuff.

2. **WeeklyDigestService** (services.js). Same cleanup. References scoreJob() now.


## The Test Harness (what changed and what was added)

The harness is the test system that loads real fixture data (108 jobs, 410 physicians, reservations) and runs the matching pipeline with stub scorers to verify everything works.

### What Was Already There (Job Centric)

The harness had one direction: for each sampled job, find matching physicians.

**MatchingTestHarness class** (matching-harness-runner.js)
  1. Sample a subset of jobs and physicians (seeded for determinism)
  2. For each sampled job, call searchPhysicians(job, physicians, reservation)
  3. Take the top K results
  4. Compute stats (min score, median, max, data quality flags)
  5. Write a CSV report
  6. Return everything

**10 tests** covering: sample counts, output file path, seed returned, results per job, job context, topK limit, score invariants (0 to MAX_SCORE), summary stats sanity, determinism (same seed = same results), different seeds = different results.

### What Was Added (Physician Centric)

A whole second direction: for each sampled physician, find matching jobs.

**searchJobs() function** (matching-engine-stub.js)
  Mirrors searchPhysicians() but flipped. Takes 1 physician + all jobs + all reservations. Filters jobs by profession, specialty, and whether the physician already applied. Scores each eligible job with the same 5 stub scorers. Sorts by score. Returns SearchResult[].

**PhysicianTestHarness class** (matching-harness-runner.js)
  Same structure as MatchingTestHarness but loops physicians instead of jobs.
  1. Sample physicians and jobs
  2. For each sampled physician, call searchJobs(physician, jobs, reservations)
  3. Top K, stats, CSV, return

**PhysicianCsvReportWriter** (csv-report-writer.js)
  Flipped CSV columns. Instead of "here are the top physicians for this job" its "here are the top jobs for this physician". Columns: physician_id, physician_name, specialty, province, rank, job_id, score, breakdowns, stats.

**computeForPhysician()** (summary-stats-collector.js)
  Same stats logic as computeForJob() but returns PhysicianSummaryStats with eligibleJobs instead of eligibleCandidates.

**New types** (types.js)
  PhysicianSummaryStats, HarnessPhysicianResult, PhysicianHarnessRunResult. Plus updated imports from ScoreJobFn and ScorePhysicianFn (replacing old SearchPhysiciansFn).

**12 new tests** covering the physician centric path with the exact same invariants: sample counts, output file, seed, results per physician, physician context, topK, score range 0 to MAX_SCORE, physicianId and jobId present, stats sanity, determinism both ways.

### Other Changes to Existing Harness

1. **searchPhysicians() now includes jobId** in every result. Before it only had physicianId. Now both directions always have both IDs.

2. **Shared helper functions** extracted in matching-engine-stub.js. The scoring logic (scoreAndBuild) and flag collection (collectFlags) are now shared between searchPhysicians and searchJobs instead of being duplicated.

3. **New test** in the job centric suite that verifies every match result has a jobId that matches the job being scored.

4. **PHYSICIAN_CSV_PREFIX** added to harness.config.js for the physician centric CSV output filename.

### Final Test Count

22 harness tests (was 10). 189 total tests across the whole project. All passing.


## File Map

```
src/interfaces/
  core/
    models.js           Physician, LocumJob, Reservation (no changes)
  matching/
    filters.js          IsEligiblePhysicianFn, IsShortTermJobFn,
                        FilterPhysiciansForJobFn (NEW), FilterJobsForPhysicianFn (NEW)
    matching.js         ScoreBreakdown, SearchResult (added jobId), SearchOptions,
                        ScoredPair (NEW), ScoreMatchFn (NEW), CombineAndRankFn (NEW),
                        ScoreJobFn (NEW, replaces SearchPhysiciansFn),
                        ScorePhysicianFn (NEW)
  scoring/
    scorers.js          5 scorer contracts (no changes)
  persistence/
    records.js          MatchRun (no changes),
                        MatchRunResult (added notifiedAt),
                        OutboxItem (DELETED)
    repositories.js     MatchRunRepository (no changes),
                        MatchRunResultRepository (no changes),
                        NotificationOutboxRepository (DELETED)
  orchestration/
    services.js         ShortTermMatchService (updated to scoreJob),
                        WeeklyDigestService (updated to scoreJob)

tests/harness/
  harness.config.js     Added PHYSICIAN_CSV_PREFIX
  harness.test.js       22 tests (was 10). Added physician centric suites
  lib/
    matching-engine-stub.js   searchPhysicians (updated), searchJobs (NEW),
                              scoreAndBuild (NEW shared helper),
                              collectFlags (NEW shared helper)
    matching-harness-runner.js  MatchingTestHarness (updated labels),
                                PhysicianTestHarness (NEW)
    csv-report-writer.js        CsvReportWriter (no changes),
                                PhysicianCsvReportWriter (NEW)
    summary-stats-collector.js  computeForJob (no changes),
                                computeForPhysician (NEW)
    types.js                    Added PhysicianSummaryStats,
                                HarnessPhysicianResult,
                                PhysicianHarnessRunResult.
                                Updated ScoreJobFn/ScorePhysicianFn imports
    stub-scorers.js             No changes (scorers are symmetric)
    Sampler.js                  No changes
    fixture-loader.js           No changes
    random-seeder.js            No changes
```
