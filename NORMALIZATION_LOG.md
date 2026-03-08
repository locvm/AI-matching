# Normalization Layer, Decision Log

A running history of what was built, what decisions were made, and why. Useful for onboarding, design reviews, and explaining how the normalization layer helps the matching engine.

---

## Phase 1: Raw Data to Clean Domain Models

### What we started with

The raw MongoDB/Mongoose documents are messy:

- ObjectIds are wrapped in `{$oid: "..."}` (Extended JSON)
- Dates are `{$date: "..."}` strings
- Provinces are full names with inconsistent casing and whitespace: `"Ontario"`, `"ontario"`, `"Québec "` (trailing space)
- GeoJSON locations are nested: `{type: "Point", coordinates: [-79.31, 43.89]}`
- Preferences are nested under `raw.preferences.*` instead of flat
- 75+ fields per User document, but only ~20 matter for matching

### What we built

A **Data Mapper pattern**, three mappers that convert raw Mongoose documents into clean domain models:

| Mapper                 | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `physicianMapper.js`   | User document becomes `Physician` (20 fields)          |
| `locumJobMapper.js`    | LocumJob document becomes `LocumJob` (18 fields)       |
| `reservationMapper.js` | Reservation document becomes `Reservation` (15 fields) |

**Shared primitives** (`primitives.js`):

- `coerceObjectId()`, `{$oid: "abc"}` becomes `"abc"`
- `ensureDate()`, `{$date: "2024-01-15T00:00:00Z"}` becomes a `Date` object
- `trimString()`, whitespace cleanup, null safety
- `ensureStringArray()`, filters non strings, trims, removes empties
- `normalizeAddress()`, cleans address objects, normalizes province

**Province normalization** (`normalizeProvince.js`):

- 44 entry lookup map covering all variants
- `"Ontario"` becomes `"ON"`, `"Québec "` becomes `"QC"`, `"British Columbia"` becomes `"BC"`
- Case insensitive, accent aware, whitespace trimming
- Provinces are stored as 2 letter codes everywhere in the domain model

**Why this helps matching**: The scoring engine never has to deal with `{$oid}` objects, null checks on nested paths, or string variants like `"Ontario"` vs `"ontario"`. It just gets clean, typed objects ready for comparison.

---

## Phase 2: Schema Driven Interface Alignment

### The problem

The interfaces (`models.js`) were written first, then patched when gaps were found. We needed to flip it. **Mongoose schemas are the source of truth**, interfaces are derived from them.

### What we did

- Reorganized all typedefs in `models.js` grouped by schema section (Identity, Medical, Location, Preferences, Facility, Personal, Account)
- Every property annotated with its schema source
- Added "Intentionally omitted" comment blocks listing every non matching schema field with reasons
- Added complete field mapping tables to each mapper's file header

### Decision: Matching relevant fields only

The full schemas have 75+ fields per document. We chose to include only the ~20 fields relevant to the matching engine. Non matching fields (auth, payment, UI only) are documented as intentionally omitted. A full production system would need broader interfaces.

---

## Phase 3: Locum Duration, From Strings to Numbers

### The problem

`locumDurations` on a Physician was stored as raw strings from a frontend dropdown:

```json
"locumDurations": ["1-3 months", "3-6 months"]
```

This is awkward for the scoring engine. To compare a physicians preferred duration against a jobs actual `dateRange`, you'd need to parse strings every time.

### What the data looks like

5 distinct values from 410 physicians (frontend dropdown, no schema enum):

| Raw string            | Count |
| --------------------- | ----- |
| `"A few days"`        | 46    |
| `"Less than a month"` | 55    |
| `"1-3 months"`        | 62    |
| `"3-6 months"`        | 43    |
| `"6+ months"`         | 23    |

### Decision: Numeric day ranges

We chose **days** over months because:

- "A few days" and "Less than a month" dont map cleanly to months (you'd get fractions like 0.25)
- Jobs have a `dateRange` with specific dates, converting to days is just `(to - from) / 86400000`
- Days are the most precise unit that covers all 5 categories without fractions

**Mapping:**

| Raw string            | Normalized                       |
| --------------------- | -------------------------------- |
| `"A few days"`        | `{ minDays: 1, maxDays: 7 }`     |
| `"Less than a month"` | `{ minDays: 1, maxDays: 30 }`    |
| `"1-3 months"`        | `{ minDays: 30, maxDays: 90 }`   |
| `"3-6 months"`        | `{ minDays: 90, maxDays: 180 }`  |
| `"6+ months"`         | `{ minDays: 180, maxDays: 365 }` |

**How this helps matching**: The scorer converts a jobs `dateRange` to days and checks, does it fall within any of the physicians preferred ranges? Pure number comparison, no string parsing.

```
jobDays = (job.dateRange.to - job.dateRange.from) / 86400000
isMatch = physician.locumDurations.some(d => jobDays >= d.minDays && jobDays <= d.maxDays)
```

---

## Phase 4: Availability Types, Splitting What from How Much

### The problem

`availabilityTypes` mixes two different concepts in one array:

| Value                       | Count | What it really means              |
| --------------------------- | ----- | --------------------------------- |
| `"Weekdays"`                | 81    | **When**, which days (Mon to Fri) |
| `"Weekends"`                | 50    | **When**, which days (Sat to Sun) |
| `"Full-time"`               | 46    | **How much**, commitment level    |
| `"Part-time"`               | 73    | **How much**, commitment level    |
| `"On-call or short notice"` | 35    | **How much**, commitment level    |

Keeping these mixed together makes scoring awkward. You cant just compare arrays. "Weekdays" and "Full-time" are answering completely different questions.

### Decision: Split into two fields

**`availableDays`**, flattened to actual days of the week:

- `"Weekdays"` becomes `["Mon", "Tue", "Wed", "Thu", "Fri"]`
- `"Weekends"` becomes `["Sat", "Sun"]`
- Both selected becomes all 7 days, deduplicated

**`commitmentType`**, normalized categories:

- `"Full-time"` becomes `"full-time"`
- `"Part-time"` becomes `"part-time"`
- `"On-call or short notice"` becomes `"on-call"`

**How this helps matching**: The scorer can independently check:

1. **Day overlap**: Do the physicians available days match the jobs schedule days?
2. **Commitment fit**: Is the physician open to the jobs type (full time, part time, on call)?

These are two separate scoring signals that would be muddled if kept in one array.

---

## Resolved Questions (answered by Eve, March 2026)

These came up while building the normalization layer. Eve answered most of them. Decisions are recorded here so we know what to do and what to come back to later.

---

### Eligibility and verification filters

**1. CPSOProof.status: OFF for now, turn on later with subscriptions**

Eve said leave it off so all doctors can see matches right now. When the subscription model launches, we should require verified CPSO proof before matching. For now, CPSOProof stays in the "intentionally omitted" list in models.js. A TODO comment is in filters.js marking where the check would go inside `IsEligiblePhysicianFn`.

**2. isProfileComplete / isOnboardingCompleted: OFF for now, add notes**

Eve said leave these empty for now. She is also adding email verification as another layer, so there will be three possible gates eventually: profile complete, onboarding complete, and email verified. None of them block matching right now. TODO comments are in filters.js for when we turn these on. Onboarding completion is the most likely first candidate to become a real filter.

**3. completedLocums count: Future feature, not now**

Eve agreed this makes sense as a reliability signal (more completed locums = more reliable physician) but said the platform doesnt have enough users going through the full flow yet. They are still figuring out how to get people to complete locums through the platform instead of going offsite. This is parked as an upcoming improvement. When the user base grows, add completedLocums as a scoring boost signal (not a hard filter).

**4. recruiterStatus: Recruiter jobs stay in matching, flag for future monetization**

Eve said recruiter jobs should show up in matches. But recruiters are an important business flag because they get government funding and currently use the platform for free, then take users offsite to pay there. When monetization starts, recruiterStatus will be one of the first things to gate. For now, leave it as is. No code change needed, just keeping this note for when the business model tightens up.

---

### Data structure decisions

**6. schedule on LocumJob: Leave out of matching for now**

Eve said schedule is a mess because people write anything in there and it doesnt always talk about schedule. She said this part will be better matched by an actual language model than an algorithm. She also said most people just put a date and then in the notes they put the schedule. The date picker idea is complicated because some doctors can only work one day but be flexible, some work mornings, some work a few times a month.

George suggested structuring it on the frontend into available days and time pickers. Eve said to ask the UI team about this since they are good at thinking about flow and how that looks. For now, schedule stays out of the matching engine. If the UI team structures it, we can add it back.

**8. facilityInfo.emr: NOW MANDATORY for new jobs, old data wont have it**

Good news. Eve confirmed EMR is now mandatory in the job description form. The first 108 jobs wont have it, but all new ones should. This means EMR scoring will start working as new jobs come in. For now, keep the EMR scorer but deprioritize it (it will score 0.5 for old jobs, which is fine). Check with Zeeshan if he can provide updated data or if his analysis PR has EMR info. Talk with Max about this at the next meeting.

**9. locumDurations and availabilityTypes: Values CAN change, add warning logs**

Eve confirmed everything can change if the user edits their profile. She also mentioned that physicians love to write paragraphs and she had to put frontend guardrails to stop them from writing their entire life story. So there ARE guardrails on some fields, but the dropdown values themselves could change if the frontend adds new options.

Decision: Add a warning log in the normalizer for unrecognized values. If someone selects a new option we havent mapped (like "Evenings" or "2 weeks"), the normalizer should log a warning instead of silently ignoring it. This way we catch it quickly instead of finding out months later that scores are wrong.

---

### Still open (need follow up)

**5. What are the valid values for `practiceType` and `patientType` on LocumJob?**

Eve skipped this question entirely (went from Q4 to Q6 in her response). Still need to know: are these free text or fixed dropdowns? What are the distinct values in production? This matters for future matching against physician preferences.

**7. What happened to `jobType` (FTE/PT) on LocumJob?**

Eve's answer got cut off. She started saying "We started with Job type because a doctor told us originally this was super important" but the message ended there. Need to re-ask. Also, Zeeshan has a data analysis PR that might have insights on this. George said he would check.

---
