# Location Scorer

Scores how geographically close a job is for a physician. Returns a number from 0 (far away) to 1 (very close or exact match).

## How It Works: 6 Tier Fallback

The scorer tries the best data first and falls through to less precise methods if that data is missing.

| Tier | What It Uses                                   | Match Score           | Mismatch Score | When It Fires                                             |
| ---- | ---------------------------------------------- | --------------------- | -------------- | --------------------------------------------------------- |
| 1    | GPS coordinates (Haversine distance)           | Reverse sigmoid curve | same           | Both physician AND job have lat/lng                       |
| 2    | physician.specificRegions vs job city          | 0.85                  | 0.15           | Physician listed specific regions like "downtown toronto" |
| 3    | physician.preferredProvinces vs job province   | 0.70                  | 0.20           | Physician listed preferred provinces                      |
| 4    | physician.workAddress.province vs job province | 0.55                  | 0.40           | Physician has a work address                              |
| 5    | physician.medicalProvince vs job province      | 0.50                  | 0.45           | Last resort, where they are licensed                      |
| 6    | nothing                                        | 0.50                  | n/a            | Zero usable location data                                 |

### Tier 1: GPS Distance (The Good One)

When both sides have coordinates, we compute the Haversine distance in km and apply a reverse sigmoid:

```
score(d) = 1 / (1 + exp(0.035 * (d - 100)))
```

What that looks like:

- 0 km (same location): ~0.97
- 25 km (same city): ~0.93
- 59 km (Toronto to Hamilton): ~0.81
- 100 km (midpoint): 0.50
- 150 km: ~0.15
- 350 km (Toronto to Ottawa): ~0.00

The midpoint (100 km) and steepness (0.035) are configurable in `src/config/locationConfig.js`.

## The Physician GPS Gap

**The problem:** Physicians have NO GPS coordinates in the database. The User schema has no GeoJSON field. So `physician.location` is always `null`. Meanwhile, ALL 108 jobs have GPS coordinates.

This means Tier 1 never fires without enrichment. Most physicians fall into Tiers 3 through 6, which only compare provinces (match or mismatch, no distance granularity).

**The fix:** We built two geocoding approaches to enrich physician addresses with lat/lng coordinates.

## Two Geocoding Approaches

### 1. Local Lookup Table (canadianCities.js)

A hardcoded Map of ~75 Canadian cities to GPS coordinates. Covers every city that appears in the physician and job fixture data, plus common cities in Ontario, Quebec, Alberta, and BC.

- **Speed:** Instant. Zero network calls.
- **Coverage:** ~95%+ of fixture data. Only misses physicians with empty or very unusual addresses.
- **How to use:** Already wired into the fixture loader. Call `loadFixtures({ enrichGps: "local" })`.
- **How to add cities:** Just add a line to the `CITIES` Map in `canadianCities.js`.

Toronto subdivisions (North York, Scarborough, Etobicoke, East York, York) are handled as aliases that resolve to their own coordinates or fall back to Toronto coords.

### 2. Nominatim API (geocodeAddress.js)

Calls OpenStreetMap's free Nominatim API. Can resolve any address worldwide, not just the cities in our table.

- **Speed:** SLOW. 1 request per second rate limit on the public API.
- **For 410 physicians that is about 7 minutes.**
- **Coverage:** Can resolve anything Nominatim has, which is basically every populated place on Earth.
- **How to use:** `loadFixtures({ enrichGps: "nominatim" })`. Local lookup runs first, Nominatim only fires for misses.

**Rate limit warning:** The Nominatim public API is free but requires max 1 request per second and a User-Agent header. Do NOT call it in a tight loop. The batch geocoder in `geocodeBatch.js` handles the delay automatically.

For production, consider:

- Self-hosting Nominatim (Docker image available)
- Caching results (physician addresses rarely change)
- Running geocoding as a one-time batch job, not on every match run

## Enrichment Pipeline

The geocoding does NOT modify the scorer or the physician model. It enriches the `location` field before scoring runs:

```
Raw Mongo doc
  → physicianMapper.toDomain()  (location: null)
  → geocodeBatch()              (location: { lat, lng } from lookup or API)
  → scoreLocation()             (Tier 1 fires because location is now filled)
```

The `enrichWithCoordinates()` function in physicianMapper.js lets you pass any geocode function:

```js
import { lookupAddress } from '../scoring/location/canadianCities.js'
import { geocodeAddress } from '../normalization/geocodeAddress.js'

// Local only (instant)
const enriched = await enrichWithCoordinates(physician, lookupAddress)

// Nominatim (slow)
const enriched = await enrichWithCoordinates(physician, geocodeAddress)
```

## Config

All scoring parameters live in `src/config/locationConfig.js`:

- `MIDPOINT_KM`: Distance where score = 0.5 (default: 100 km)
- `STEEPNESS_K`: How sharp the sigmoid drops off (default: 0.035)
- `SCORES.*`: Match/mismatch scores for each fallback tier
- `COARSE_REGION_NAMES`: Province names that are too vague to count as "specific regions"
- `DISTANCE_BUCKETS`: Human readable distance labels (same_city, nearby, regional, far, very_far)

## Files

| File                                     | What It Does                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `scoreLocation.js`                       | The scorer. 6 tier fallback. Exports `scoreLocation()` and `scoreLocationWithDetail()` |
| `haversine.js`                           | Haversine great circle distance formula                                                |
| `canadianCities.js`                      | Local city to GPS lookup table                                                         |
| `../../config/locationConfig.js`         | All configurable parameters                                                            |
| `../../normalization/geocodeAddress.js`  | Nominatim API wrapper                                                                  |
| `../../normalization/geocodeBatch.js`    | Batch geocoding with rate limiting                                                     |
| `../../normalization/physicianMapper.js` | `enrichWithCoordinates()` function                                                     |

## Tests

```bash
# Location scorer tests (44 tests)
npx vitest run src/scoring/location/

# Canadian cities lookup tests (12 tests)
npx vitest run src/scoring/location/__tests__/canadianCities.test.js

# Geocode address tests (9 tests, mocked fetch)
npx vitest run src/normalization/__tests__/geocodeAddress.test.js

# Full harness with real location scores (22 tests)
npx vitest run tests/harness/harness.test.js
```
