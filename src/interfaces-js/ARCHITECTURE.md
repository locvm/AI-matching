# LOCVM Matching Engine - Interface Architecture - JavaScript / JSDoc

## What Is This

This is the **JavaScript version** of the interface definitions, using JSDoc `@typedef` and `@callback` annotations with `// @ts-check` for type safety without TypeScript

The TypeScript version lives in `src/interfaces-ts/`. Both versions are the same thing, same data shapes, same function contracts, same step-by-step skeleton comments. The only difference is syntax

These files define the **data shapes** and **function contracts** for the matching engine. Nothing here computes anything. The data shapes describe "this is what a Physician looks like". The function contracts describe "this function takes X and returns Y, and heres what it must do step-by-step"

```
src/interfaces-js/
├── core/                # domain models and shared types
│   ├── models.js        # Physician, LocumJob, Reservation, GeoCoordinates, Address, etc
│   └── index.js
├── matching/            # search input/output shapes + function contracts
│   ├── matching.js      # matchingCriteria, SearchResult, SearchPhysiciansFn
│   ├── filters.js       # IsEligiblePhysicianFn, IsShortTermJobFn
│   └── index.js
├── scoring/             # individual scoring contracts
│   ├── scorers.js       # ScoreLocationFn, ScoreDurationFn, ScoreEMRFn, etc
│   └── index.js
├── persistence/         # DB record shapes + repository interfaces
│   ├── records.js       # MatchRun, MatchRunResult, OutboxItem
│   ├── repositories.js  # MatchRunRepository, MatchRunResultRepository, NotificationOutboxRepository
│   └── index.js
├── orchestration/       # orchestration service interfaces
│   ├── services.js      # ShortTermMatchService, WeeklyDigestService
│   └── index.js
├── reporting/           # report generation contract
│   ├── report.js        # ReportOptions, MatchingReport, GenerateMatchingReportFn
│   └── index.js
└── index.js             # barrel export
```

---

## How JSDoc Types Work

Types are defined via `@typedef` and `@callback` in `.js` files with `// @ts-check` at the top. To use a type from another file:

```javascript
/** @typedef {import("../core/models.js").Physician} Physician */
```

This gives you full type checking in VS Code / any editor that supports TypeScript language services, without needing a build step

---

## The 6 Modules

### Core (`/core`) - Domain Models

| Type | What it is |
|------|-----------|
| `Physician` | Clean doctor profile, only fields relevant to matching |
| `LocumJob` | Clean job posting with location, dates, specialty, optional EMR |
| `Reservation` | Booking record linking doctor to job |
| `GeoCoordinates` | `{ lng, lat }` pair |
| `Address` | Clean address, province always as 2-letter code |
| `ProvinceCode` | Union type, all 13 Canadian province/territory codes |
| `AvailabilityWindow` | Date range when a doctor is free |
| `ReservationStatus` | Union type, "Pending", "In Progress", "Completed", etc |

### Matching (`/matching`) - Search Interface + Filters

| Type | What it is |
|------|-----------|
| `matchingCriteria` | "What are we looking for", specialty, location, dates, EMR, thresholds |
| `SearchResult` | "What came back", physician ID + total score + per-category breakdown |
| `SearchPhysiciansFn` | **Function contract** the core matching function |
| `IsEligiblePhysicianFn` | **Function contract** hard filter check |
| `IsShortTermJobFn` | **Function contract** short-term job check |

### Scoring (`/scoring`) - Scorers

| Type | What it scores |
|------|---------------|
| `ScoreLocationFn` | Distance between physician and job |
| `ScoreDurationFn` | Date overlap |
| `ScoreEMRFn` | EMR system match |
| `ScoreProvinceFn` | Province preference match |
| `ScoreSpecialityFn` | Speciality match |

### Persistence (`/persistence`) - Records + Repositories

| Type | What it is |
|------|-----------|
| `MatchRun` | One execution of the matching engine |
| `MatchRunResult` | One score result from a run |
| `OutboxItem` | A notification waiting to be sent |
| `MatchRunRepository` | **Interface** createRun, updateRunStatus, getPendingRuns |
| `MatchRunResultRepository` | **Interface** saveResults, getResults |
| `NotificationOutboxRepository` | **Interface** enqueue, getPending, markSent |

### Orchestration (`/orchestration`) - Service Interfaces

| Type | What it is |
|------|-----------|
| `ShortTermMatchService` | **Interface** runForJob(jobId) |
| `WeeklyDigestService` | **Interface** runWeekly() |

### Reporting (`/reporting`) - Output Files

| Type | What it is |
|------|-----------|
| `ReportOptions` | Settings for report output |
| `ReportJobSection` | Per-job section with criteria, top results, and summary stats |
| `MatchingReport` | The full report object |
| `GenerateMatchingReportFn` | **Function contract** produces CSV/JSON report |

---

## How to Import Types

```javascript
// @ts-check

// Import specific types from a module
/** @typedef {import("./interfaces-js/core/models.js").Physician} Physician */
/** @typedef {import("./interfaces-js/core/models.js").LocumJob} LocumJob */
/** @typedef {import("./interfaces-js/matching/matching.js").SearchPhysiciansFn} SearchPhysiciansFn */
/** @typedef {import("./interfaces-js/scoring/scorers.js").ScoreLocationFn} ScoreLocationFn */

// Then use them in your code:
/** @type {ScoreLocationFn} */
const scoreLocation = (physician, jobLocation) => {
  // implementation here...
};
```

---

## System Flow

```
1) Database loads raw data
2) Cleanup layer cleans data → produces Physician[] and LocumJob[]
3) Hard filters (IsEligiblePhysicianFn) kick out non-matching physicians
4) Scorers run on each physician that passed:
   ScoreLocationFn, ScoreDurationFn, ScoreEMRFn, ScoreProvinceFn, ScoreSpecialityFn
5) Scores combined into one total → SearchResult[]
6) SearchPhysiciansFn wraps steps 3-5 into one call
7) Orchestration services (ShortTermMatchService / WeeklyDigestService)
   call SearchPhysiciansFn and save results via repositories
8) GenerateMatchingReportFn produces CSV/JSON output file for SME review
```
