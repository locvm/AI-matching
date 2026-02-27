# LOCVM Matching Engine — Interface Architecture

## What Is This

These files define the **data shapes** for the matching engine. Nothing here computes anything. Just "this is what a Physician looks like", "this is what a search result looks like", "this is what a match run record looks like in the DB."

All logic — scoring, matching, normalization, repositories, orchestration — is code we write later.

```
src/interfaces/
├── core/              # domain models and shared types
│   ├── models.ts      # Physician, LocumJob, Reservation, GeoCoordinates, Address, etc.
│   └── index.ts
├── matching/          # search input/output shapes
│   ├── matching.ts    # SearchCriteria, SearchResult
│   └── index.ts
├── persistence/       # DB record shapes
│   ├── records.ts     # MatchRun, MatchRunResult, OutboxItem
│   └── index.ts
└── index.ts           # barrel export
```

---

## The 3 Modules

### Core (`/core`)

All the domain types. Everything else depends on these.

| Type | What it is |
|------|-----------|
| `Physician` | Normalized doctor profile — only fields relevant to matching |
| `LocumJob` | Normalized job posting with location, dates, specialty, optional EMR |
| `Reservation` | Booking record linking doctor to job |
| `GeoCoordinates` | `{ lng, lat }` pair |
| `Address` | Normalized address, province always as 2-letter code |
| `ProvinceCode` | Union type — all 13 Canadian province/territory codes |
| `AvailabilityWindow` | Date range when a doctor is free (with optional location for v2) |
| `ReservationStatus` | Union type — "Pending", "In Progress", "Completed", etc. |

### Matching (`/matching`)

The input shape and output shape for a search. Thats it.

| Type | What it is |
|------|-----------|
| `SearchCriteria` | "What are we looking for" — specialty, location, dates, EMR, thresholds |
| `SearchResult` | "What came back" — physician ID + total score + per-dimension breakdown |

### Persistence (`/persistence`)

Shapes of records that live in the database.

| Type | What it is |
|------|-----------|
| `MatchRun` | One execution of the matching engine (status, timing, errors) |
| `MatchRunResult` | One score result from a run (physician + job + score + breakdown) |
| `OutboxItem` | A notification waiting to be sent |

---

## Decisions Baked Into the Shapes (from Max + Eve)

| # | What | Decision | Where it shows up |
|---|------|----------|-------------------|
| 1 | Province normalization | All normalized to 2-letter codes | `ProvinceCode` type (normalization logic lives in code) |
| 2 | Missing `isLookingForLocums` | Treated as `true` during normalization | `Physician.isLookingForLocums` is always a boolean |
| 3 | Optional EMR | Missing = neutral score (0.5), not 0 | handled in scoring code, not in shapes |
| 4 | Missing physician location | Nullable, scoring handles it as neutral | `Physician.location: GeoCoordinates | null` |
| 5 | No hard travel radius | No radius field in v1, distance is continuous decay | handled in code, not in shapes |
| 6 | Vacation location override | Parked for v2, interface ready | `AvailabilityWindow.location?: GeoCoordinates` |

---

## How to Import

**Single import:**
```typescript
import {
  Physician, LocumJob, Reservation,
  SearchCriteria, SearchResult,
  MatchRun, MatchRunResult, OutboxItem,
  ProvinceCode
} from "./interfaces";
```

**Module-specific:**
```typescript
import { Physician, LocumJob } from "./interfaces/core";
import { SearchCriteria, SearchResult } from "./interfaces/matching";
import { MatchRun, MatchRunResult } from "./interfaces/persistence";
```

---

## Whats Next

These are just shapes. The actual code comes next:

1. **Data Normalization** — code that reads raw JSON/Mongo and produces clean `Physician` and `LocumJob` objects (province fuzzy matching, isLookingForLocums defaults, etc.)
2. **Scoring Components** — code that scores each dimension (location, EMR, availability, province)
3. **Score Aggregator** — code that combines dimension scores into a final number
4. **Matching Engine** — code that ties it all together (filter, score, sort, return)
5. **Orchestration** — code that coordinates runs end-to-end
6. **Repositories** — code that reads/writes the persistence records to storage
