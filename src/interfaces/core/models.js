// @ts-check

// LOCVM Matching Engine, Core Domain Models (JSDoc)
//
// All types come from the Mongoose schemas in reference/schema/.
// The normalization layer (src/normalization/) converts raw Mongo docs into these shapes.
//
// Only matching relevant fields are included. Everything else (auth, payment, UI stuff)
// is left out on purpose. See "Intentionally omitted" comments on each typedef.

/**
 * Lat/lng pair. Jobs store coords as [lng, lat] in the DB (GeoJSON style).
 *
 * @typedef {Object} GeoCoordinates
 * @property {number} lng
 * @property {number} lat
 */

/**
 * 2 letter codes for Canadian provinces and territories.
 *
 * All province data gets cleaned to one of these before scoring ever sees it.
 * The raw DB has all kinds of messy variants like "Ontario", "ontario", "Québec " (trailing space).
 * Cleanup logic is in src/normalization/normalizeProvince.js
 *
 * @typedef {"AB" | "BC" | "MB" | "NB" | "NL" | "NS" | "NT" | "NU" | "ON" | "PE" | "QC" | "SK" | "YT"} ProvinceCode
 */

/**
 * Clean address. Province is always a 2 letter code by the time it gets here.
 *
 * Schema: UserSchema.workAddress (AddressSchema), LocumJobSchema.fullAddress
 *
 * @typedef {Object} Address
 * @property {string} [streetNumber]
 * @property {string} [streetName]
 * @property {string} [city]
 * @property {ProvinceCode} [province] - cleaned to 2 letter code like "ON", "AB", "BC"
 * @property {string} [postalCode]
 * @property {string} [country]
 */

/**
 * A declared availability window.
 *
 * Schema: UserSchema.preferences.availabilityDateRanges
 * (stored as month/year strings like {fromMonth, fromYear, toMonth, toYear}).
 * Cleanup logic is in src/normalization/normalizeAvailabilityDateRange.js
 *
 * @typedef {Object} AvailabilityWindow
 * @property {Date} from
 * @property {Date} to
 * @property {GeoCoordinates} [location] - Optional location override for this window. v2 idea, parked for now.
 */

/**
 * A numeric day range for how long a doctor wants to do a locum.
 *
 * Comes from dropdown strings like "1-3 months" which becomes { minDays: 30, maxDays: 90 }.
 * Cleanup logic is in src/normalization/normalizeLocumDuration.js
 *
 * @typedef {Object} DurationRange
 * @property {number} minDays - minimum days (inclusive)
 * @property {number} maxDays - maximum days (inclusive)
 */

/**
 * Day of the week (3 letter abbreviation).
 *
 * "Weekdays" becomes ["Mon","Tue","Wed","Thu","Fri"] and "Weekends" becomes ["Sat","Sun"].
 * Cleanup logic is in src/normalization/normalizeAvailability.js
 *
 * @typedef {"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"} DayOfWeek
 */

/**
 * Commitment level for locum work.
 *
 * "Full-time" becomes "full-time", "Part-time" becomes "part-time", "On-call or short notice" becomes "on-call".
 * Cleanup logic is in src/normalization/normalizeAvailability.js
 *
 * @typedef {"full-time" | "part-time" | "on-call"} CommitmentType
 */

// Physician
//
// Schema: reference/schema/user.models.js (UserSchema)
//
// The User schema is used for both Physicians and Recruiters.
// This type only has the fields we need for matching.
//
// Some things we noticed from 410 physicians in production:
//   180 have isLookingForLocums missing (not true, not false, just gone). We default to true.
//   177 out of 410 have zero location info. Scoring gives them a middle score (0.5).
//   Only 42 out of 410 have emrSystems filled in. Optional, middle score when missing.
//   preferredProvinces has all kinds of messy variants. Cleaned to ProvinceCode[].

/**
 * @typedef {Object} Physician
 *
 * Identity
 * @property {string} _id - MongoDB ObjectId as string
 *
 * Medical Info
 * @property {string} medProfession - "Physician" or "Recruiter". Only Physicians get matched.
 * @property {string} medSpeciality - Like "Family Medicine", "Emergency Medicine".
 * @property {ProvinceCode} [medicalProvince] - Province where licensed. Almost everyone is "ON".
 * @property {string[]} emrSystems - EMR systems the doctor knows. Only 42 out of 410 have this.
 *
 * Location
 * @property {GeoCoordinates | null} location - Always null. User schema has no coordinates.
 * @property {Address | null} workAddress - Work address.
 *
 * Preferences (flattened from UserSchema.preferences)
 * @property {boolean} isLookingForLocums - Actively looking. If missing we default to true.
 * @property {ProvinceCode[]} preferredProvinces - Provinces the doctor prefers (stored as full names in DB).
 * @property {string[]} specificRegions - Free text regions like "downtown toronto", "GTA".
 * @property {DurationRange[]} [locumDurations] - How long they want to work, as numeric day ranges.
 * @property {DayOfWeek[]} [availableDays] - Which days they can work. Comes from "Weekdays"/"Weekends".
 * @property {CommitmentType[]} [commitmentTypes] - Full time, part time, or on call.
 * @property {AvailabilityWindow[]} [availabilityWindows] - Specific date ranges when they can work. Like "Jan 2025 to Mar 2025".
 * @property {number[]} [availabilityYears] - Which years they are available. "Available in 2025" becomes 2025. Used to filter out jobs in years the doctor cant work.
 *
 * Facility
 * @property {string} [facilityName] - Name of the doctors facility.
 * @property {string} [facilityEMR] - EMR system at the doctors facility.
 *
 * Personal
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [role] - "Admin" or "User".
 * @property {string[]} [languages] - Languages spoken, like ["English", "French"].
 *
 * Account flags
 * @property {boolean} [isProfileComplete]
 * @property {boolean} [isOnboardingCompleted]
 * @property {string} _id - MongoDB ObjectId as string
 *
 * Medical Info
 * @property {string} medProfession - "Physician" or "Recruiter". Only Physicians get matched.
 * @property {string} medSpeciality - Like "Family Medicine", "Emergency Medicine".
 * @property {ProvinceCode} [medicalProvince] - Province where licensed. Almost everyone is "ON".
 * @property {string[]} emrSystems - EMR systems the doctor knows. Only 42 out of 410 have this.
 *
 * Location
 * @property {GeoCoordinates | null} location - Always null. User schema has no coordinates.
 * @property {Address | null} workAddress - Work address.
 *
 * Preferences (flattened from UserSchema.preferences)
 * @property {boolean} isLookingForLocums - Actively looking. If missing we default to true.
 * @property {ProvinceCode[]} preferredProvinces - Provinces the doctor prefers (stored as full names in DB).
 * @property {string[]} specificRegions - Free text regions like "downtown toronto", "GTA".
 * @property {DurationRange[]} [locumDurations] - How long they want to work, as numeric day ranges.
 * @property {DayOfWeek[]} [availableDays] - Which days they can work. Comes from "Weekdays"/"Weekends".
 * @property {CommitmentType[]} [commitmentTypes] - Full time, part time, or on call.
 * @property {AvailabilityWindow[]} [availabilityWindows] - Specific date ranges when they can work. Like "Jan 2025 to Mar 2025".
 *
 * Facility
 * @property {string} [facilityName] - Name of the doctors facility.
 * @property {string} [facilityEMR] - EMR system at the doctors facility.
 *
 * Personal
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [role]
 * @property {string[]} [languages] - Languages spoken, like ["English", "French"]
 * @property {string[]} [locumDurations] - Preferred locum duration categories like "1-3 months", "1 day to 2 weeks". Flattened from preferences.locumDurations
 * @property {string[]} [availabilityTypes] - Availability type preferences like "Weekdays", "Weekends", "Evenings". Flattened from preferences.availabilityTypes
 * @property {boolean} [isProfileComplete] - Whether the doctors profile is complete
 * @property {boolean} [isOnboardingCompleted] - Whether onboarding is done
 */

// Physician, intentionally omitted (not needed for matching):
//   Personal: email, dateOfBirth, gender, cellPhone, personalAddress, profileUrl, bio
//   Work: officeDetails, workPhone, faxNumber, primaryContact, contactTitle, contactEmail
//   Medical: medicalCertification, residentCheck, fellowCheck, medicalStudentCheck, yearOfResidency
//   Recruiter: linkedInUrl, recruiterStatus
//   Verification: CPSOProof (status, filePath, fileName, verifiedAt, verifiedBy)
//   Payment: paymentDataConfirmation, discoverySource
//   Reservations: reservationsList (createdLocums, reservedLocums, appliedLocums, completedLocums, savedLocums, matchedLocums)
//   Preferences: (none remaining, all wired up)
//   Account: onboardingStep, firebaseUid, privacyConsent, reviews, createdAt, modifiedAt

// LocumJob
//
// Schema: reference/schema/locumJob.model.js (LocumJobSchema)
//
// Jobs are way cleaner than users. All 108 have coordinates, date ranges, and specialty.
// The big gap is EMR. No job document has it yet. When the platform adds it,
// facilityInfo.emr will carry the value. Until then, EMR scoring treats missing as 0.5.

/**
 * @typedef {Object} LocumJob
 *
 * Identity
 * @property {string} _id - MongoDB ObjectId as string.
 * @property {string} [jobId] - Short readable ID like "EuXagtm".
 *
 * Medical
 * @property {string} medProfession
 * @property {string} medSpeciality
 *
 * Location
 * @property {GeoCoordinates | null} location - Flattened from GeoJSON {type:"Point", coordinates:[lng,lat]}.
 * @property {Address} fullAddress - Province normalized to 2 letter code.
 *
 * Schedule
 * @property {{ from: Date, to: Date }} dateRange - When the locum needs to be filled.
 * @property {string} [schedule] - Work schedule description.
 * @property {string} [jobType] - "FTE" or "PT". Commented out in the schema right now, might come back.
 *
 * Facility
 * @property {string} [facilityName]
 * @property {{ emr?: string }} [facilityInfo] - Facility EMR system.
 *
 * Details
 * @property {string} [experience] - Experience level, free text.
 * @property {string} [locumPay] - Pay amount as a string like "8000". Should clean to a number later.
 * @property {string[]} [practiceType]
 * @property {string[]} [patientType]
 *
 * Display
 * @property {string} [postTitle]
 *
 * Refs
 * @property {string} [locumCreatorId] - Who created this job. Renamed from locumCreator in the schema.
 * @property {string} [reservationId] - Associated reservation.
 */

// LocumJob, intentionally omitted (not needed for matching):
//   slug, cityImage, additionalPayInfo, instructions, notes,
//   isUsingJetpay, isDepositRequested, isReviewed, isPostedByRecruiter,
//   createdAt, modifiedAt

// Reservation
//
// Schema: reference/schema/reservation.model.js (reservationSchema)

/**
 * All the states a reservation can be in. Only these 8 values exist in production.
 *
 * @typedef {"Pending" | "Requested" | "Awaiting Payment" | "Confirmed" | "In Progress" | "Completed" | "Cancelled" | "Expired"} ReservationStatus
 */

/**
 * Application stage for a reservation applicant. 5 possible values.
 *
 * @typedef {"Applied" | "Selected" | "Archived" | "Withdrawn" | "Cancelled"} ApplicationStage
 */

/**
 * A single entry in an applicants application log.
 * Tracks state changes. Mongoose has a pre save hook that syncs currentApplicationStage
 * to the last log entry automatically.
 *
 * @typedef {Object} ApplicationLogEntry
 * @property {string} event - the stage transition event (matches ApplicationStage values)
 * @property {Date} [at] - when it happened
 * @property {string} [note] - optional note (like a rejection reason)
 */

/**
 * An applicant on a reservation.
 *
 * @typedef {Object} ReservationApplicant
 * @property {string} _id
 * @property {string} [userId]
 * @property {ApplicationStage} [currentApplicationStage] - Synced from the last applicationLog entry.
 * @property {ApplicationLogEntry[]} [applicationLog]
 */

/**
 * @typedef {Object} Reservation
 *
 * Core
 * @property {string} _id
 * @property {string} locumJobId - Which job this reservation is for.
 * @property {ReservationStatus} status
 *
 * Applicants
 * @property {ReservationApplicant[]} [applicants]
 *
 * Dates
 * @property {{ from: Date, to: Date }} [reservationDate]
 *
 * Refs
 * @property {string} [createdBy]
 * @property {string} [reservedBy]
 *
 * Timestamps
 * @property {Date} [createdAt]
 * @property {Date} [dateModified]
 */

// Reservation, intentionally omitted (not needed for matching):
//   reservationDetails (snapshot of job data at booking time),
//   simpleJobIdForUser, reviewId, transactionId, reviewsCompleted, smartMatching

export {}
