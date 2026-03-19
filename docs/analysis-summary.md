# Test Data Analysis – Summary

This page answers the questions from the test-data-analysis task using the data in [test-data-analysis.md](./test-data-analysis.md). Run `npm run analyze-data` to regenerate the full report.

---

## 1. Field availability & missingness

**Users (410):** workAddress is always present (100%). medProfession ~80%, medSpeciality ~57%, isLookingForLocums ~56%. Preference and EMR fields are sparse: preferredProvinces 24%, specificRegions 6%, availabilityDateRanges 7%, emrSystems 10%, facilityEMR 7%.

**Jobs (108):** Core fields are complete: medProfession, medSpeciality, location.coordinates, dateRange 100%. fullAddress 99%. facilityInfo.emr 44%, practiceType and patientType 37%.

**Reservations (110):** status 100%; applicants 17%.

---

## 2. What physicians tend to write (possible values)

- **Specialty:** Family Medicine dominates (users 203, jobs 70); then Other, Radiologist, Pediatrician, etc. One user has "Musician" (edge case).
- **Location:** Provinces mostly full names (e.g. Ontario 96). Regions are free text with mixed case (Toronto vs toronto, Gta, vaughn, northyork) — normalise for matching.
- **EMR:** PS Suite, Accuro, OSCAR Pro common; "Other" and variants (e.g. Avaros vs Avaros Inc.) — consider aliasing.
- **Durations:** "1–3 months" and "Less than a month" most common; use as enum-like buckets.
- **Jobs:** Ontario 105/108; cities Toronto-heavy; practiceType "Clinic only", patientType "All Ages" dominant.

---

## 3. Data quality & edge cases

- **Wrong/weird:** No wrong types (e.g. number where string expected). Only empty string (e.g. facilityEMR 26 users) and empty arrays (e.g. job practiceType 7, patientType 5; reservation applicants 9).
- **Takeaway:** Validation is generally good the main issue is emptiness. Plan fallbacks when fields are missing or empty.

---

## 4. Distribution highlights

| Metric                              | Result                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| Top specialties (users)             | Family Medicine 203, Other 11, Cardiologist 7, Pediatrician 4, … |
| Top specialties (jobs)              | Family Medicine 70, Radiologist 11, Pediatrician 6, …            |
| EMR distribution                    | PS Suite, Accuro, OSCAR Pro, Other + variants (see report)       |
| % users with availabilityDateRanges | 6.8% (28/410)                                                    |
| % jobs with coordinates             | 100% (108/108)                                                   |
| % users with no location preference | preferredProvinces 75.9% missing; specificRegions 94.4% missing  |

---

## 5. Risks & assumptions

- **High missingness (users):** Preference and EMR fields often empty, so it's important to not over weight them. Use workAddress when preferences are missing.
- **Fallback logic:** Needed for missing preferredProvinces/specificRegions, missing EMR, empty practiceType/patientType, and availabilityDateRanges (only 6.8% present).
- **Normalisation:** Location fields such as specificRegions (case, abbreviations) and EMR (aliases) need normalisation for scoring.
- **v1 suitability:** Job coords and dates are reliable, with 100% present on jobs. User preference fields are sparse but still usable with fallbacks. Applicants on reservations is only 17% present, so use it for "already applied" only when it is populated.

---

## 6. Recommendations for algorithm design

**Hard filters:** Use medProfession and medSpeciality. They are present on all jobs and on about 57 to 80% of users. Use isLookingForLocums as a hard filter only if you want to exclude users who are not looking (about 56% have it present).

**Scoring/weighting:** For location use province and region with normalisation. Many users have no preference, so use medium weight and no penalty when missing. For EMR use medium weight and a fallback when missing. For duration use buckets such as 1–3 months and less than a month. For specialty match on a small enum plus Other.

**Assumptions:** Rely on workAddress when preferences are empty. Treat "Other" and EMR variants explicitly. Assume job coordinates and dates are reliable.

---

_Full field-by-field tables, value counts, and wrong/weird details are in [test-data-analysis.md](./test-data-analysis.md)._
