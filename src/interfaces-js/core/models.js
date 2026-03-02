// @ts-check

// LOCVM Matching Engine - Core Domain Models (JavaScript / JSDoc version)
//
// The "clean" shapes of our data. The raw DB is messy (province shows up as "Ontario", "ON", "ontario"... 3 different things for the same place)
// Some fields were added months into the platform so half the doctors dont have them
//
// Everything gets cleaned up before it touches the matching engine
// These models = the clean shapes all modules work with

/**
 * Lat/lng pair. Jobs store coords as [lng, lat] in the DB (GeoJSON convention), so we keep that order here
 *
 * @typedef {Object} GeoCoordinates
 * @property {number} lng
 * @property {number} lat
 */

/**
 * Official 2-letter codes for Canadian provinces and territories
 *
 * All province data MUST be cleaned to one of these before it reaches any scoring logic. The raw DB has all kinds of variants:
 *   "Ontario" -> "ON"
 *   "ontario" -> "ON"
 *   "Québec " -> "QC"  (yes, trailing whitespace... found that one the hard way LMAO)
 *   "British Columbia" -> "BC"
 *
 * The cleanup logic (fuzzy matching, trimming) lives in code. This type just defines what the clean output looks like
 *
 * @typedef {"AB" | "BC" | "MB" | "NB" | "NL" | "NS" | "NT" | "NU" | "ON" | "PE" | "QC" | "SK" | "YT"} ProvinceCode
 */

/**
 * Clean address. Province is always a 2-letter code by the time it gets here (the cleanup layer handles the messy stuff)
 *
 * @typedef {Object} Address
 * @property {string} [streetNumber]
 * @property {string} [streetName]
 * @property {string} [city]
 * @property {ProvinceCode} [province] - always cleaned to 2-letter code like "ON", "AB", "BC"
 * @property {string} [postalCode]
 * @property {string} [country]
 */

/**
 * A declared availability window
 *
 * The DB stores these as month/year strings which is not great for date math haha. Cleanup layer converts them to real Dates
 *
 * @typedef {Object} AvailabilityWindow
 * @property {Date} from
 * @property {Date} to
 * @property {GeoCoordinates} [location] - Optional location override for this specific window. v2 idea: a doctor says "im free July 1-31 AND im in Toronto during that time". Parked for now per Max
 */

/**
 * Clean physician for the matching engine
 *
 * NOT a 1:1 mirror of the users collection, we only pull whats relevant for matching. The raw collection has like 30+ fields, most of them irrelevant here
 *
 * Some context on the data (stuff I found digging through it):
 *   - 180 doctors have isLookingForLocums completely missing (not true, not false, just gone). We treat missing as true. Max call, signing up implies interest
 *   - 177 out of 410 doctors have 0 location info. So location is nullable and scoring gives them a middle score (0.5)
 *   - Only 42 out of 410 have emrSystems filled in. Optional, middle score when missing
 *   - preferredProvinces has all the messy variants. Cleaned to ProvinceCode[]
 *
 * @typedef {Object} Physician
 * @property {string} id - MongoDB ObjectId as string
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} medProfession - "Physician", "Recruiter" - only Physicians get matched
 * @property {string} medSpeciality - like "Family Medicine", "Emergency Medicine", "Radiologist"
 * @property {boolean} isLookingForLocums - Whether the doctor is actively looking. Missing values -> true during cleanup
 * @property {GeoCoordinates | null} location - Doctors anchor location. Null for 43% of physicians. When null, location scoring returns middle score (0.5)
 * @property {Address | null} workAddress - Clean work address
 * @property {ProvinceCode} [medicalProvince] - Province where the doctor is medically licensed. Currently almost everyone is "ON" (Ontario)
 * @property {ProvinceCode[]} preferredProvinces - Provinces the doctor prefers to work in
 * @property {string[]} emrSystems - EMR systems the doctor knows. Only 42/410 have this
 * @property {string[]} languages - Languages spoken, like ["English", "French"]
 * @property {AvailabilityWindow[]} availability - Availability windows the doctor declared
 * @property {string[]} locumDurations - Preferred locum duration categories like "1-3 months", "1 day to 2 weeks"
 * @property {string[]} availabilityTypes - Availability type preferences like "Weekdays", "Weekends", "Evenings"
 * @property {boolean} isProfileComplete - Whether the doctors profile is complete
 * @property {boolean} isOnboardingCompleted - Whether onboarding is done
 */

/**
 * Clean locum job posting
 *
 * Jobs are way cleaner than users tbh, all 108 have coordinates, all have date ranges, all have specialty
 *
 * The big gap: EMR. The field literally doesnt exist on any job document right now. Eve added emrSystems to users ~8 months in but jobs never got it. When the platform adds it, this field will carry the value
 * Until then, EMR scoring treats missing job EMR as middle score (0.5)
 *
 * @typedef {Object} LocumJob
 * @property {string} id - MongoDB ObjectId as string
 * @property {string} jobId - Human-readable short ID like "EuXagtm"
 * @property {string} postTitle
 * @property {string} medProfession
 * @property {string} medSpeciality
 * @property {GeoCoordinates} location - Job location as coords, all current jobs have this
 * @property {Address} fullAddress - Clean full address
 * @property {{ from: Date, to: Date }} dateRange - When the locum needs to be filled
 * @property {string} jobType - "FTE" or "PT"
 * @property {string} [emr] - EMR system at this facility. Currently not on ANY job document. Future field
 * @property {string} [experience] - Experience level, free text, pretty messy. Needs future cleanup
 * @property {string} [locumPay] - Pay amount as string like "8000". Future: clean up to number
 * @property {string} [schedule] - Work schedule description
 * @property {string} locumCreatorId - Who created this job posting
 * @property {string} [reservationId] - Associated reservation ID if any
 * @property {string} [facilityName] - Facility name
 */

/**
 * All the states a reservation can be in
 *
 * @typedef {"Pending" | "In Progress" | "Ongoing" | "Completed" | "Cancelled" | "Expired"} ReservationStatus
 */

/**
 * A reservation = a doctor booked for a locum job
 * We need this to check for scheduling conflicts, dont want to match someone whos already booked for overlapping dates
 *
 * @typedef {Object} Reservation
 * @property {string} id
 * @property {string} locumJobId
 * @property {string} createdBy
 * @property {string} [reservedBy]
 * @property {ReservationStatus} status
 * @property {{ from: Date, to: Date }} reservationDate
 * @property {Date} createdAt
 * @property {Date} dateModified
 */

export {};
