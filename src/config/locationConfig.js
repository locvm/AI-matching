// @ts-check

// Location Scoring Configuration
//
// All numeric parameters for the location scorer live here
// Change these to tune scoring behavior without touching the scorer logic

export const LOCATION_CONFIG = {
  // Reverse sigmoid parameters
  // score(d) = 1 / (1 + exp(STEEPNESS_K * (d - MIDPOINT_KM)))
  MIDPOINT_KM: 100, // distance in km where score = 0.5
  STEEPNESS_K: 0.035, // how sharp the drop-off is (higher = steeper)

  // Fallback scores when GPS coordinates are not available
  // Each tier has a match and mismatch score
  SCORES: {
    // Tier 2: specificRegions (free-text like "downtown toronto", "GTA")
    SPECIFIC_REGION_MATCH: 0.85,
    SPECIFIC_REGION_MISMATCH: 0.15,

    // Tier 3: preferredProvinces
    PREFERRED_PROVINCE_MATCH: 0.7,
    PREFERRED_PROVINCE_MISMATCH: 0.2,

    // Tier 4: workAddress.province
    WORK_PROVINCE_MATCH: 0.55,
    WORK_PROVINCE_MISMATCH: 0.4,

    // Tier 5: medicalProvince
    MEDICAL_PROVINCE_MATCH: 0.5,
    MEDICAL_PROVINCE_MISMATCH: 0.45,

    // Tier 6: no location data at all
    NO_DATA: 0.5,
  },

  // Province names that are too coarse to count as "specific region"
  // If specificRegions only contains these, fall through to province tier
  COARSE_REGION_NAMES: [
    "ontario",
    "quebec",
    "british columbia",
    "alberta",
    "manitoba",
    "saskatchewan",
    "nova scotia",
    "new brunswick",
    "newfoundland",
    "newfoundland and labrador",
    "prince edward island",
    "northwest territories",
    "nunavut",
    "yukon",
    "on",
    "qc",
    "bc",
    "ab",
    "mb",
    "sk",
    "ns",
    "nb",
    "nl",
    "pe",
    "nt",
    "nu",
    "yt",
  ],

  // Distance buckets for explainability
  DISTANCE_BUCKETS: {
    SAME_CITY: 25, // 0-25 km
    NEARBY: 75, // 25-75 km
    REGIONAL: 150, // 75-150 km
    FAR: 300, // 150-300 km
    // 300+ km = "very_far"
  },
};
