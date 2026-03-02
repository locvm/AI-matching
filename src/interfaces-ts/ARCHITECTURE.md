# LOCVM Matching Engine - Interface Architecture - TypeScript

## What Is This

These files define the **data shapes** and **function contracts** for the matching engine. Nothing here computes anything. The data shapes describe "this is what a Physician looks like", "this is what a search result looks like". The function contracts describe "this function takes X and returns Y, and heres what it must do step-by-step"

All actual logic (scoring, matching, cleanup, repositories, orchestration) is built elsewhere and must follow the contracts defined here

```
src/interfaces-ts/
├── core/                # domain models and shared types
│   ├── models.ts        # Physician, LocumJob, Reservation, GeoCoordinates, Address, etc
│   └── index.ts
├── matching/            # search input/output shapes + function contracts
│   ├── matching.ts      # matchingCriteria, SearchResult, SearchPhysiciansFn
│   ├── filters.ts       # IsEligiblePhysicianFn, IsShortTermJobFn
│   └── index.ts
├── scoring/             # individual scoring contracts
│   ├── scorers.ts       # ScoreLocationFn, ScoreDurationFn, ScoreEMRFn, etc
│   └── index.ts
├── persistence/         # DB record shapes + repository interfaces
│   ├── records.ts       # MatchRun, MatchRunResult, OutboxItem
│   ├── repositories.ts  # MatchRunRepository, MatchRunResultRepository, NotificationOutboxRepository
│   └── index.ts
├── orchestration/       # orchestration service interfaces
│   ├── services.ts      # ShortTermMatchService, WeeklyDigestService
│   └── index.ts
├── reporting/           # report generation contract
│   ├── report.ts        # ReportOptions, MatchingReport, GenerateMatchingReportFn
│   └── index.ts
└── index.ts             # barrel export
```

---

## The 6 Modules

### Core (`/core`) - Domain Models

All the domain types. Everything else depends on these

| Type | What it is |
|------|-----------|
| `Physician` | Clean doctor profile, only fields relevant to matching |
| `LocumJob` | Clean job posting with location, dates, specialty, optional EMR |
| `Reservation` | Booking record linking doctor to job |
| `GeoCoordinates` | `{ lng, lat }` pair |
| `Address` | Clean address, province always as 2-letter code |
| `ProvinceCode` | Union type, all 13 Canadian province/territory codes |
| `AvailabilityWindow` | Date range when a doctor is free (with optional location for v2) |
| `ReservationStatus` | Union type, "Pending", "In Progress", "Completed", etc |

### Matching (`/matching`) - Search Interface + Filters

The input shape, output shape, main search function, and filters

| Type | What it is |
|------|-----------|
| `matchingCriteria` | "What are we looking for", specialty, location, dates, EMR, thresholds |
| `SearchResult` | "What came back", physician ID + total score + per-category breakdown |
| `SearchPhysiciansFn` | **Function contract** the core matching function. Takes criteria + physicians, returns ranked results |
| `IsEligiblePhysicianFn` | **Function contract** hard filter check (profession, specialty, isLookingForLocums) |
| `IsShortTermJobFn` | **Function contract** check if a job is short-term (rules you can change) |

### Scoring (`/scoring`) - Scorers

Each scorer looks at one thing about how well a physician fits a job. All return 0-1

| Type | What it scores |
|------|---------------|
| `ScoreLocationFn` | Distance between physician and job (Haversine + drop-off) |
| `ScoreDurationFn` | Date overlap between physician availability and job date range |
| `ScoreEMRFn` | EMR system match |
| `ScoreProvinceFn` | Province preference match |
| `ScoreSpecialityFn` | Speciality match (yes/no in v1, partial match in future) |

### Persistence (`/persistence`) - Records + Repositories

Data shapes for DB records AND repository interfaces that work with any storage

| Type | What it is |
|------|-----------|
| `MatchRun` | One execution of the matching engine (status, timing, errors) |
| `MatchRunResult` | One score result from a run (physician + job + score + breakdown) |
| `OutboxItem` | A notification waiting to be sent |
| `MatchRunRepository` | **Interface** createRun, updateRunStatus, getPendingRuns |
| `MatchRunResultRepository` | **Interface** saveResults, getResults |
| `NotificationOutboxRepository` | **Interface** enqueue, getPending, markSent |

### Orchestration (`/orchestration`) - Service Interfaces

Defines WHEN matching runs happen and HOW results get saved + passed along

| Type | What it is |
|------|-----------|
| `ShortTermMatchService` | **Interface** runForJob(jobId) triggers immediate matching for a new short-term job |
| `WeeklyDigestService` | **Interface** runWeekly() runs the weekly digest across all active jobs |

### Reporting (`/reporting`) - Output Files

Defines the report generation contract for SME review

| Type | What it is |
|------|-----------|
| `ReportOptions` | Settings for report output (topK, format, includeBreakdown, etc) |
| `ReportJobSection` | Per-job section with criteria, top results, and summary stats |
| `MatchingReport` | The full report object with formatted content |
| `GenerateMatchingReportFn` | **Function contract** takes results + settings, produces formatted CSV/JSON report |

---

## Decisions Baked Into the Shapes (from Max + Eve)

| # | What | Decision | Where it shows up |
|---|------|----------|-------------------|
| 1 | Province cleanup | All cleaned to 2-letter codes | `ProvinceCode` type (cleanup logic lives in code) |
| 2 | Missing `isLookingForLocums` | Treated as `true` during cleanup | `Physician.isLookingForLocums` is always a boolean |
| 3 | Optional EMR | Missing = middle score (0.5), not 0 | Documented in `ScoreEMRFn` contract |
| 4 | Missing physician location | Nullable, scoring gives middle score | `Physician.location: GeoCoordinates | null`, documented in `ScoreLocationFn` |
| 5 | No hard travel radius | No radius field in v1, distance is smooth drop-off | Documented in `ScoreLocationFn` contract |
| 6 | Vacation location override | Parked for v2, interface ready | `AvailabilityWindow.location?: GeoCoordinates` |

---

## How to Import

**Single import:**
```typescript
import {
  Physician, LocumJob, Reservation,
  matchingCriteria, SearchResult, SearchPhysiciansFn,
  ScoreLocationFn, ScoreDurationFn,
  MatchRun, MatchRunResult, OutboxItem,
  MatchRunRepository, MatchRunResultRepository,
  ShortTermMatchService, WeeklyDigestService,
  GenerateMatchingReportFn,
  ProvinceCode
} from "./interfaces-ts";
```

**Module-specific:**
```typescript
import { Physician, LocumJob } from "./interfaces-ts/core";
import { matchingCriteria, SearchResult, SearchPhysiciansFn } from "./interfaces-ts/matching";
import { ScoreLocationFn, ScoreDurationFn } from "./interfaces-ts/scoring";
import { MatchRun, MatchRunRepository } from "./interfaces-ts/persistence";
import { ShortTermMatchService } from "./interfaces-ts/orchestration";
import { GenerateMatchingReportFn } from "./interfaces-ts/reporting";
```

---

## System Flow (How Everything Connects)

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
