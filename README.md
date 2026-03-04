# LOCVM Matching Engine – Internship Project

- [LOCVM Matching Engine – Internship Project](#locvm-matching-engine--internship-project)
  - [Overview](#overview)
- [1. About LOCVM](#1-about-locvm)
- [2. Current Matching Method (Production Today)](#2-current-matching-method-production-today)
- [3. Objective of This Project](#3-objective-of-this-project)
    - [Two Notification Types](#two-notification-types)
- [4. Architectural Objective](#4-architectural-objective)
- [5. Why Rule-Based (For Now)](#5-why-rule-based-for-now)
- [6. Data Model Overview](#6-data-model-overview)
  - [6.1 LocumJob Collection](#61-locumjob-collection)
  - [6.2 User Collection](#62-user-collection)
  - [6.3 Reservation Collection](#63-reservation-collection)
- [7. Matching Rules – v1 Scope](#7-matching-rules--v1-scope)
  - [7.1 Exclusions](#71-exclusions)
  - [7.2 Mandatory (Hard Filters)](#72-mandatory-hard-filters)
  - [7.3 Strong (Mid-Weight Scoring)](#73-strong-mid-weight-scoring)
    - [📍 Location](#-location)
    - [📅 Duration / Date Overlap](#-duration--date-overlap)
    - [💻 EMR Compatibility](#-emr-compatibility)
- [8. Future Fields (Not in v1 Scoring)](#8-future-fields-not-in-v1-scoring)
- [9. Expected Engineering Practices](#9-expected-engineering-practices)
- [10. Repository Workflow](#10-repository-workflow)
  - [Branching](#branching)
  - [Pull Requests](#pull-requests)
- [11. Meetings \& Deliverables](#11-meetings--deliverables)
- [12. Performance Expectations](#12-performance-expectations)
- [13. Orchestration: Triggering Searches + Persisting Results (Short-Term + Weekly)](#13-orchestration-triggering-searches--persisting-results-short-term--weekly)
  - [13.1 Core Concepts](#131-core-concepts)
    - [A) Search Run](#a-search-run)
    - [B) Handoff to Communications Module](#b-handoff-to-communications-module)
  - [13.2 Short-Term Triggered Search (Job → Physicians)](#132-short-term-triggered-search-job--physicians)
    - [Trigger Condition (definition owned by product/CTO)](#trigger-condition-definition-owned-by-productcto)
    - [Execution Flow](#execution-flow)
    - [Notification Copy (owned by comms module)](#notification-copy-owned-by-comms-module)
  - [13.3 Weekly (or Bi-Weekly) Search (Physician → Jobs or Job → Physicians)](#133-weekly-or-bi-weekly-search-physician--jobs-or-job--physicians)
  - [13.4 Persistence Model (Required)](#134-persistence-model-required)
    - [Required Entities (Proposed)](#required-entities-proposed)
      - [`match_run`](#match_run)
      - [`match_run_result`](#match_run_result)
      - [`notification_outbox` (handoff queue)](#notification_outbox-handoff-queue)
  - [13.5 Interfaces to Implement (Orchestration + Persistence)](#135-interfaces-to-implement-orchestration--persistence)
    - [A) Persistence Repositories](#a-persistence-repositories)
    - [B) Orchestration Services](#b-orchestration-services)
  - [13.6 Testing Expectations](#136-testing-expectations)
  - [13.7 Notes on Production Integration](#137-notes-on-production-integration)
- [14. Final Goal](#14-final-goal)
- [15. Runtime & Compatibility Requirements](#15-runtime--compatibility-requirements)


<img width="1545" height="1999" alt="Beige Professional Company Brand Values List Flyer A4-2" src="https://github.com/user-attachments/assets/0902e089-7fb9-4da5-928a-e0c5a5396b07" />

## Overview

Welcome to the LOCVM Matching Engine repository.

This project’s objective is to build a **modular, production-ready Node.js matching module with orchestration and persistence** that will be embedded into the existing LOCVM platform.

You will work collaboratively in this repository. Each intern must:

* Create their own feature branch
* Implement their assigned tasks
* Open a Pull Request for review before merging
* Ensure all tests pass before requesting merge

This project is designed to simulate real-world production development.

---

# 1. About LOCVM

LOCVM (pronounced *“locum”*) is a physician-led digital platform that connects physicians with clinics, hospitals, and recruiters seeking temporary medical coverage (locums).

* In medicine, a **locum** provides temporary coverage.
* Coverage sourcing today is largely manual (Facebook groups, phone calls, job boards).
* LOCVM centralizes:

  * Job discovery
  * Smart matching
  * Verified profiles
  * Booking
  * Payments

LOCVM is **not just a job board** — it is a two-sided platform designed to complete transactions in-platform.

The matching engine is a core component of this vision.

---

# 2. Current Matching Method (Production Today)

The current matching process:

1. For each job posting:

   * All physicians are assessed.
2. A score is computed for each user.
3. Any user above a threshold appears in an internal dashboard.
4. The team manually reviews the list.
5. Emails are triggered manually.

Important notes:

* The method already exists.
* New structured fields have since been added to the data models.
* The review step is manual.
* Emails are not automatically triggered.

This process does not scale and introduces delay.

---

# 3. Objective of This Project

Your goal is to build a **new rule-based matching module** that:

* Generates a score to assess the _fit_ between a user and a job posting
* Eliminates manual review
* Triggers automated emails

### Two Notification Types

To replace the manual review and manual triggering of emails, we expect this new system to automatically generate two types of user notifications

**Immediate Notification**
* Triggered when a new short-term or on-call job is posted. (e.g.: “A new opportunity that might interest you!”)
* Sent to all physicians above a defined score threshold.

**Weekly (or Bi-Weekly) Digest**

* Triggered weekly, and for each  user (when applicable), contains a list of appropriate jobs (e.g.: “A few locums available that might interest you”)
* All physicians who have a strong enough match with at least one active job posting.

---

# 4. Architectural Objective

For the scoring sub-module, you are building a **Node.js module** with a strict interface:

```ts
searchPhysicians(criteria): Promise<SearchResult[]>
```

Where:

```ts
type SearchResult = {
  physicianId: string
  score: number
  breakdown: {
    location: number
    duration: number
    emr: number
    ...
  }
}
```

This module will later be embedded in the main platform.

You will NOT:

* Connect directly to MongoDB
* Modify the main LOCVM backend

Instead:

* You will use JSON data included in this repository as a proxy for Mongo collections.
* Your code must assume that data could later come from Mongo.

Design accordingly.

---

# 5. Why Rule-Based (For Now)

At this stage:

* Most relevant fields are structured.
* The matching rules are interpretable and deterministic.
* The scoring logic is relatively straightforward.

Therefore:

A **rule-based scoring algorithm is sufficient and appropriate**.

Benefits:

* Transparent
* Easy to debug
* Easy to tune
* Lower infrastructure complexity
* Suitable for structured fields

This will serve as a benchmark for future versions, which may explore embedding-based, vector similarity algorithms.

---

# 6. Data Model Overview

You will be working with mock JSON data reflecting Mongo collections.

---

## 6.1 LocumJob Collection

| Field              | Type                             | Notes                                        |
| ------------------ | -------------------------------- | -------------------------------------------- |
| `_id`              | string                           | Mongo ObjectId                               |
| `medSpeciality`    | string                           | e.g. "Family Medicine"                       |
| `medProfession`    | string                           | "Physician"                                  |
| `fullAddress`      | object                           | city, province, etc.                         |
| `location`         | GeoJSON Point                    | `{ type: "Point", coordinates: [lng, lat] }` |
| `dateRange`        | `{ from: ISODate, to: ISODate }` | Mandatory                                    |
| `facilityInfo.emr` | string                           | e.g. "OSCAR Pro"                             |
| `practiceType`     | string[]                         | (Future use)                                 |
| `patientType`      | string[]                         | (Future use)                                 |

---

## 6.2 User Collection

| Field                                | Type                      | Notes                            |
| ------------------------------------ | ------------------------- | -------------------------------- |
| `_id`                                | string                    | Mongo ObjectId                   |
| `medSpeciality`                      | string                    | Mandatory                        |
| `medProfession`                      | "Physician" | "Recruiter" | Hard filter                      |
| `preferences.isLookingForLocums`     | boolean                   | Hard filter                      |
| `preferences.preferredProvinces`     | string[]                  | Soft filter (see next field)     |
| `preferences.specificRegions`        | string[]                  | Medium filter (Free text)        |
| `preferences.locumDurations`         | string[]                  | Medium filter (Duration bucket)  |
| `preferences.availabilityDateRanges` | array                     | Optional structured availability |
| `workAddress`                        | object                    | Use if preferences empty         |
| `emrSystems`                         | string[]                  | Known EMRs                       |
| `facilityEMR`                        | string                    | EMR used in clinic               |

---

## 6.3 Reservation Collection

| Field              | Type                             | Notes                                        |
| ------------------ | -------------------------------- | -------------------------------------------- |
| `_id`              | string                           | Mongo ObjectId                               |
| `locumJobId`       | string                           | e.g. "Family Medicine"                       |
| `stats`            | enum                             | e.g. "Pending", "Requested", etc.            |
| `applicants`       | array                            | Array of current and past applicants         |

---

# 7. Matching Rules – v1 Scope

We divide fields into:


## 7.1 Exclusions

- Only jobs that are active and not filled should be scored (In Reservation > "status" = "Pending" or "Awaiting Payment")
- Only users that have not yet applied to the job posting should be scored
- Only users who are looking for locums should be scored (make this a parameter in case we even want to match others as well)

## 7.2 Mandatory (Hard Filters)

Must match or user excluded:

* `medProfession`
* `medSpeciality`

---

## 7.3 Strong (Mid-Weight Scoring)

### 📍 Location

Job Posting:

* Has exact coordinates (longitude, latitude).

User:

* May have:

  * `preferredProvinces`
  * `specificRegions` (free text)
  * Or none

Scoring goal:

* Higher score the closer the job is to one of the user's preferences.

Special cases:

* If user enters "Ontario":

  * Province-level match.
  * If too coarse, fallback to user primary address.
* If user enters "Downtown Toronto":

  * Expect much tighter radius.
* If missing preferences:

  * Use `workAddress`.

You may explore:

* H3 spatial indexing ([https://h3geo.org](https://h3geo.org))
* Distance bucket scoring

Return normalized score 0–1.

---

### 📅 Duration / Date Overlap

Job:

* `dateRange.from`
* `dateRange.to`

User:

* `availabilityDateRanges`
* `locumDurations` (bucket: "1–3 months", etc.)

Scoring goal:

* Higher score if strong overlap.
* Partial overlap allowed.
* Duration bucket may serve as fallback if exact ranges missing.

Must:

* Define overlap %
* Normalize score

---

### 💻 EMR Compatibility

Job:

* `facilityInfo.emr`

User:

* `emrSystems`
* `facilityEMR`

Combine:

```ts
knownEMRs = dedupe(emrSystems + facilityEMR)
```

Scoring:

* Higher score if EMR matches
* Lower weight than specialty/location
* facilityEMR might have a higher weight - to be explored

---

# 8. Future Fields (Not in v1 Scoring)

These may be used later:

* `practiceType`
* `patientType`
* virtual vs in-person
* historical performance
* physician bio text
* behavioral signals

You may structure code to allow easy future integration.

---

# 9. Expected Engineering Practices

You must:

* Use TypeScript
* Define clear interfaces
* Separate concerns:

  * Filtering layer
  * Scoring layer
  * Aggregation layer
* Avoid hardcoding weights
* Use dependency injection where appropriate
* Write unit tests
* Keep functions pure where possible
* Avoid circular dependencies

Think production-ready module.

---

# 10. Repository Workflow

## Branching

* `main` → protected
* Create branch:

  ```
  feature/location-scoring
  feature/duration-scoring
  feature/search-interface
  ```

## Pull Requests

Each PR must include:

* Description
* Test coverage
* Performance note
* Assumptions made

No direct commits to main.

---

# 11. Meetings & Deliverables

We will meet weekly.

Each intern must present:

* What was completed
* Key design decisions
* Challenges encountered
* Tests written
* Plan for next week

You are expected to:

* Update ClickUp tasks
* Keep documentation current
* Raise architectural concerns early

---

# 12. Performance Expectations

Target:

* Clean, modular design
* Minimal refactor required to integrate with Mongo later
* Search execution under Xms for dataset ~1000 physicians (To be determined)

---

# 13. Orchestration: Triggering Searches + Persisting Results (Short-Term + Weekly)

The `searchPhysicians(criteria)` interface is the *core matching primitive*.

To remove manual review, we also need **orchestration logic** that determines **when** to call `searchPhysicians`, **how** to persist results, and **how** to hand results off to the communications module (email/push/dashboard).

This repository will therefore include design + implementation of two “search runs”:

1. **Short-term (real-time) run**: triggered when a new short-term / on-call job is published.
2. **Weekly run**: scheduled run that prepares a digest of relevant jobs for each physician.

> Note: Interns will not integrate directly into production services (no Mongo access, no production job events). You will implement these components in a way that can later be wired into the real platform.

---

## 13.1 Core Concepts

### A) Search Run

A **Search Run** is a single execution of matching, producing a set of ranked results.

A run has:

* A trigger type: `SHORT_TERM` or `WEEKLY`
* A timestamp
* A query payload (criteria)
* A list of results (physicians + scores)
* A downstream delivery status (pending/processed)

### B) Handoff to Communications Module

The orchestration layer must produce a persisted output that the communications module can pick up without recomputing matches.

The communications module should be able to:

* Query “pending” runs
* Retrieve the relevant recipients + job(s)
* Send notifications
* Mark run outputs as processed

---

## 13.2 Short-Term Triggered Search (Job → Physicians)

**Goal:** When a new *short-term / on-call* job is published, automatically identify high-quality physician matches and persist them for immediate notification.

### Trigger Condition (definition owned by product/CTO)

A job is considered “short-term/on-call” if it matches criteria such as:

* “On-call or short notice” schedule
* Start date within X days
* Duration bucket = “A few days” / “Less than a month”

The orchestration layer should implement this as a **configurable predicate**:

```ts
isShortTermJob(job: LocumJob): boolean
```

### Execution Flow

1. Receive `jobId` (or job payload)
2. Build `SearchCriteria` from the job posting
3. Call `searchPhysicians(criteria)`
4. Filter results above a threshold
5. Persist a “short-term run output” for comms pickup

### Notification Copy (owned by comms module)

Immediate email subject/body should be along the lines of:

> “A new opportunity that might interest you!”

---

## 13.3 Weekly (or Bi-Weekly) Search (Physician → Jobs or Job → Physicians)

**Goal:** Once per week (or bi-weekly), prepare “digest-ready” matches so physicians receive a curated list of opportunities.

There are two possible approaches; you will design the one that scales best:

**Option A (recommended for v1): Job-centric**

* For each active job, run `searchPhysicians(jobCriteria)`
* Aggregate per physician: keep top X jobs

**Option B: Physician-centric**

* For each physician, evaluate all active jobs (typically more expensive)

Because this repo uses mock JSON data (small scale), either is acceptable for implementation, but the design should clearly justify the preferred approach for production.

Weekly email copy should be along the lines of:

> “A few locums available that might interest you”

---

## 13.4 Persistence Model (Required)

We must persist search outputs for two reasons:

1. **Decoupling**: communications module can operate asynchronously without recomputing.
2. **Future evaluation**: we want to analyze matching effectiveness over time (open/click/apply/accept).

Interns will implement persistence using a simple repository abstraction (file-based JSON or lightweight DB). In production this will be backed by Mongo (or another store).

### Required Entities (Proposed)

#### `match_run`

Represents a single run.

Suggested fields:

* `runId: string`
* `runType: "SHORT_TERM" | "WEEKLY"`
* `createdAt: ISODate`
* `criteria: SearchCriteria` (or a reference to jobId)
* `jobId?: string` (for SHORT_TERM)
* `status: "PENDING" | "PROCESSED" | "FAILED"`
* `metadata?: { threshold: number; limit: number; version: string }`

#### `match_run_result`

Stores the per-physician results for a run.

Suggested fields:

* `runId: string`
* `physicianId: string`
* `score: number`
* `breakdown: { ... }`
* `rank: number`
* `eligible: boolean`
* `createdAt: ISODate`

#### `notification_outbox` (handoff queue)

Represents what comms should send.

Suggested fields:

* `outboxId: string`
* `runId: string`
* `recipientUserId: string`
* `notificationType: "SHORT_TERM_EMAIL" | "WEEKLY_DIGEST_EMAIL"`
* `payload: { jobId?: string; jobIds?: string[]; topScores?: any }`
* `status: "PENDING" | "SENT" | "FAILED"`
* `createdAt: ISODate`
* `sentAt?: ISODate`
* `error?: string`

**Important:** even if the comms module is not implemented here, this outbox design is the contract for downstream pickup.

---

## 13.5 Interfaces to Implement (Orchestration + Persistence)

To keep design clean, implement these interfaces (TypeScript):

### A) Persistence Repositories

```ts
interface MatchRunRepository {
  createRun(run: MatchRun): Promise<void>
  updateRunStatus(runId: string, status: RunStatus): Promise<void>
  getPendingRuns(type?: RunType): Promise<MatchRun[]>
}

interface MatchRunResultRepository {
  saveResults(runId: string, results: MatchRunResult[]): Promise<void>
  getResults(runId: string): Promise<MatchRunResult[]>
}

interface NotificationOutboxRepository {
  enqueue(items: OutboxItem[]): Promise<void>
  getPending(type?: NotificationType): Promise<OutboxItem[]>
  markSent(outboxId: string): Promise<void>
}
```

### B) Orchestration Services

```ts
interface ShortTermMatchService {
  runForJob(jobId: string): Promise<string /* runId */>
}

interface WeeklyDigestService {
  runWeekly(): Promise<string /* runId */>
}
```

Use dependency injection so persistence can be swapped later.

---

## 13.6 Testing Expectations

* Unit tests for:

  * `isShortTermJob`
  * run creation + persistence
  * result persistence ordering (rank)
  * outbox creation rules
* A small end-to-end test using mock JSON data:

  * “new short-term job → persisted run → outbox populated”
  * “weekly run → per-user digest outbox populated”

---

## 13.7 Notes on Production Integration

Intern deliverables should assume the following will happen later in LOCVM’s backend:

* A “job published” event will call `ShortTermMatchService.runForJob(jobId)`
* A scheduler (cron) will call `WeeklyDigestService.runWeekly()`
* The comms module will read from `notification_outbox` and send emails/push notifications
* User actions (open/click/apply/accept) will be logged and later joined to match history for evaluation


# 14. Final Goal

The objective of this internship is to deliver a **production-ready matching subsystem** that includes:

1. A modular, rule-based matching engine
2. A clean and documented `searchPhysicians` interface
3. An orchestration layer for:

   * Short-term (real-time) matching runs
   * Weekly (or bi-weekly) digest runs
4. A persistence layer that:

   * Stores match runs
   * Stores ranked results with score breakdown
   * Queues notification payloads for downstream communication systems

By the end of this project, the repository should contain a Node.js module that:

* Can be embedded into the LOCVM backend
* Exposes a stable, well-documented search interface
* Automatically prepares:

  * Immediate alerts for short-term opportunities
  * Weekly digest-ready physician/job matches
* Persists all matching results in a structured way so that:

  * Notifications can be sent asynchronously
  * Matching performance can be evaluated over time
  * Future algorithm improvements can be benchmarked

This is not just about ranking physicians against jobs.

It is about designing a clean, extensible matching system that:

* Removes manual review from the current workflow
* Enables automated notifications
* Preserves explainability
* Supports future upgrades (e.g., vector similarity, behavioral signals, performance-based weighting)

You are building a foundational system that will directly impact how physicians discover opportunities on LOCVM.

Treat this as production-grade software.

# 15. Runtime & Compatibility Requirements

LOCVM runs on *Node.js v24* in a native ESM environment ("type": "module"). This repository must therefore use:

- ES module syntax (import / export)
- Plain .js files (no TypeScript)
- No CommonJS (require, module.exports)
- No framework coupling (this must remain a standalone library)

You may use modern JavaScript features supported in Node 24 (async/await, top-level await, optional chaining, nullish coalescing, native fetch, etc.). Keep dependencies minimal and ensure the module exports a clean public API that LOCVM can import directly.

All public interfaces must be documented using JSDoc types with // @ts-check enabled to preserve type safety within a JavaScript-only codebase.
---
