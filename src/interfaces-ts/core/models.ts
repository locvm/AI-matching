// LOCVM Matching Engine - Core Domain Models
//
// The "clean" shapes of our data. The raw DB is messy (province shows up as "Ontario", "ON", "ontario"... 3 different things for the same place)
// Some fields were added months into the platform so half the doctors dont have them
//
// Everything gets cleaned up before it touches the matching engine
// These models = the clean shapes all modules work with

/**
 * Lat/lng pair. Jobs store coords as [lng, lat] in the DB (GeoJSON convention), so we keep that order here
 */
export type GeoCoordinates = {
  lng: number;
  lat: number;
};

/**
 * Clean address. Province is always a 2-letter code by the time it gets here (the cleanup layer handles the messy stuff)
 */
export type Address = {
  streetNumber?: string;
  streetName?: string;
  city?: string;
  /** always cleaned to 2-letter code like "ON", "AB", "BC" */
  province?: ProvinceCode;
  postalCode?: string;
  country?: string;
};

/**
 * Official 2-letter codes for Canadian provinces and territories
 *
 * All province data MUST be cleaned to one of these before it
 * reaches any scoring logic. The raw DB has all kinds of variants:
 *   "Ontario" -> "ON"
 *   "ontario" -> "ON"
 *   "Québec " -> "QC"  (yes, trailing whitespace... found that one the hard way LMAO)
 *   "British Columbia" -> "BC"
 *
 * The cleanup logic (fuzzy matching, trimming) lives in code
 * This type just defines what the clean output looks like
 */
export type ProvinceCode =
  | "AB" // Alberta
  | "BC" // British Columbia
  | "MB" // Manitoba
  | "NB" // New Brunswick
  | "NL" // Newfoundland and Labrador
  | "NS" // Nova Scotia
  | "NT" // Northwest Territories
  | "NU" // Nunavut
  | "ON" // Ontario
  | "PE" // Prince Edward Island
  | "QC" // Quebec
  | "SK" // Saskatchewan
  | "YT"; // Yukon

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
 */
export type Physician = {
  /** MongoDB ObjectId as string */
  id: string;

  firstName: string;
  lastName: string;

  /** "Physician", "Recruiter" - only Physicians get matched */
  medProfession: string;

  /** like "Family Medicine", "Emergency Medicine", "Radiologist" */
  medSpeciality: string;

  /**
   * Whether the doctor is actively looking for locums
   *
   * Missing values -> true during cleanup
   * Max decision: "physicians signing up to LOCVM are doing so because they are interested in locum opportunities"
   *
   * Eve confirmed the field wasnt required at first and some people just never filled it in. She made it required like 3-4 months in
   * So the missing ones are likely interested, just never got to that step
   */
  isLookingForLocums: boolean;

  /**
   * Doctors anchor location (from workAddress or geocoded from city/province)
   *
   * Null for 43% of physicians. When null, location scoring returns a middle score (0.5), doesnt penalize, doesnt boost
   * Eves current algo uses lat/lng distance scoring for those who have it
   */
  location: GeoCoordinates | null;

  /** Clean work address */
  workAddress: Address | null;

  /**
   * Province where the doctor is medically licensed
   * Currently almost everyone is "ON" (Ontario)
   */
  medicalProvince?: ProvinceCode;

  /** Provinces the doctor prefers to work in. Cleaned to codes */
  preferredProvinces: ProvinceCode[];

  /**
   * EMR systems the doctor knows
   * Only 42 out of 410 have this. When empty, EMR scoring = middle score (0.5)
   * Eve said its a nice feature but not a dealbreaker, shes not even calculating it in her current algo
   */
  emrSystems: string[];

  /** Languages spoken, like ["English", "French"] */
  languages: string[];

  /**
   * Availability windows the doctor declared
   * DB stores these as month/year strings ("november" / "2025"), the cleanup layer converts to proper Dates
   */
  availability: AvailabilityWindow[];

  /** Preferred locum duration categories like "1-3 months", "1 day to 2 weeks" */
  locumDurations: string[];

  /** Availability type preferences like "Weekdays", "Weekends", "Evenings" */
  availabilityTypes: string[];

  /** Whether the doctors profile is complete */
  isProfileComplete: boolean;

  /** Whether onboarding is done */
  isOnboardingCompleted: boolean;
};

/**
 * A declared availability window
 *
 * The DB stores these as month/year strings which is not great for date math haha. Cleanup layer converts them to real Dates
 */
export type AvailabilityWindow = {
  from: Date;
  to: Date;
  /**
   * Optional location override for this specific window
   *
   * v2 idea: a doctor says "im free July 1-31 AND im in Toronto during that time"
   * Eve thought it was cool, some doctors do go up north for 2-3 weeks to make money and come back
   * Max said park it for now, dont expand scope. But the shape is ready for when we get there
   */
  location?: GeoCoordinates;
};

/**
 * Clean locum job posting
 *
 * Jobs are way cleaner than users tbh, all 108 have coordinates, all have date ranges, all have specialty
 *
 * The big gap: EMR. The field literally doesnt exist on any job document right now. Eve added emrSystems to users ~8 months in but jobs never got it. When the platform adds it, this field will carry the value
 * Until then, EMR scoring treats missing job EMR as middle score (0.5)
 */
export type LocumJob = {
  /** MongoDB ObjectId as string */
  id: string;

  /** Human-readable short ID like "EuXagtm" */
  jobId: string;

  postTitle: string;

  medProfession: string;
  medSpeciality: string;

  /** Job location as coords, all current jobs have this */
  location: GeoCoordinates;

  /** Clean full address */
  fullAddress: Address;

  /** When the locum needs to be filled */
  dateRange: {
    from: Date;
    to: Date;
  };

  /** "FTE" or "PT" */
  jobType: string;

  /**
   * EMR system at this facility
   * Currently not on ANY job document. Future field
   */
  emr?: string;

  /** Experience level, free text, pretty messy. Needs future cleanup */
  experience?: string;

  /** Pay amount as string like "8000". Future: clean up to number */
  locumPay?: string;

  /** Work schedule description */
  schedule?: string;

  /** Who created this job posting */
  locumCreatorId: string;

  /** Associated reservation ID if any */
  reservationId?: string;

  /** Facility name */
  facilityName?: string;
};

/** All the states a reservation can be in */
export type ReservationStatus =
  | "Pending"
  | "In Progress"
  | "Ongoing"
  | "Completed"
  | "Cancelled"
  | "Expired";

/**
 * A reservation = a doctor booked for a locum job
 * We need this to check for scheduling conflicts, dont want to match someone whos already booked for overlapping dates
 */
export type Reservation = {
  id: string;
  locumJobId: string;
  createdBy: string;
  reservedBy?: string;
  status: ReservationStatus;
  reservationDate: {
    from: Date;
    to: Date;
  };
  createdAt: Date;
  dateModified: Date;
};
