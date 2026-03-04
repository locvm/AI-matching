// @ts-check

export {}

/**
 * Sampling controls for deterministic job/user selection.
 *
 * @typedef {object} SamplerConfig
 * @property {number} [maxJobs] - cap on sampled jobs
 * @property {number} [maxUsers] - cap on sampled users
 * @property {number} [seed] - PRNG seed for reproducibility
 * @property {string} [jobFilter] - e.g. "short-term", "long-term"
 */

/**
 * Per-job score distribution and data-quality summary.
 *
 * @typedef {object} JobSummaryStats
 * @property {string} jobId
 * @property {number} eligibleCandidates - users passing hard filters
 * @property {number} totalResults - same as eligibleCandidates (pre-topK)
 * @property {number} minScore
 * @property {number} medianScore
 * @property {number} maxScore
 * @property {string[]} missingDataFlags - e.g. "missing_physician_location (3)"
 */

/**
 * Single job's top matches + stats, written as one CSV group.
 *
 * @typedef {object} HarnessJobResult
 * @property {LocumJob} job - the job being matched against
 * @property {SearchResult[]} topResults - top-K ranked physicians
 * @property {JobSummaryStats} stats - aggregate stats for all eligible candidates
 */

/**
 * Options passed to MatchingTestHarness constructor.
 *
 * @typedef {object} HarnessConfig
 * @property {number} [topK] - physicians per job in output
 * @property {string} [outputDir] - where CSVs are written
 * @property {SamplerConfig} [sampling]
 */

/**
 * Return value of MatchingTestHarness.run().
 *
 * @typedef {object} HarnessRunResult
 * @property {string} outputPath - path to the generated CSV
 * @property {number} jobsProcessed
 * @property {number} totalMatches - sum of all eligible candidates across jobs
 * @property {number} seed - the PRNG seed that was used
 * @property {HarnessJobResult[]} results
 */

/**
 * Validated CLI options after Zod parsing.
 *
 * @typedef {object} HarnessCliOptions
 * @property {number} maxJobs
 * @property {number} maxUsers
 * @property {number} topK
 * @property {number} [seed]
 * @property {string} [jobFilter]
 * @property {string} outputDir
 * @property {string} [jobs] - custom fixture path
 * @property {string} [users] - custom fixture path
 * @property {string} [reservations] - custom fixture path
 */

/**
 * Interface for the matching engine (stub or real).
 *
 * @typedef {{ searchPhysicians(criteria: SearchCriteria, users: User[]): Promise<SearchResult[]> }} MatchingEngine
 */

/**
 * Combined fixtures loaded from disk for the harness.
 *
 * @typedef {object} FixtureData
 * @property {LocumJob[]} jobs
 * @property {User[]} users
 * @property {Reservation[]} reservations
 */

// TODO: Remove this once the domain types are moved to the src/interfaces/core/index.js file
/**
 * @typedef {object} LocumJob
 * @property {string} _id
 * @property {string} medSpeciality
 * @property {string} medProfession
 * @property {{ city: string, province: string, country: string, postalCode?: string, streetName?: string, streetNumber?: string }} fullAddress
 * @property {{ type: string, coordinates: [number, number] }} [location]
 * @property {{ from: Date, to: Date }} dateRange
 * @property {{ emr?: string }} [facilityInfo]
 * @property {string} [facilityName]
 * @property {string} [jobType]
 * @property {string} [schedule]
 * @property {string} [postTitle]
 * @property {string} [reservationId]
 * @property {string} [jobId]
 * @property {string[]} [practiceType]
 * @property {string[]} [patientType]
 */

/**
 * @typedef {object} UserPreferences
 * @property {boolean} [isLookingForLocums]
 * @property {string[]} [preferredProvinces]
 * @property {string[]} [specificRegions]
 * @property {string[]} [locumDurations]
 * @property {Array<{ from: Date, to: Date }>} [availabilityDateRanges]
 * @property {string[]} [availabilityTypes]
 * @property {string[]} [availabilityYears]
 */

/**
 * @typedef {object} User
 * @property {string} _id
 * @property {string} medSpeciality
 * @property {string} medProfession
 * @property {UserPreferences} [preferences]
 * @property {{ city?: string, province?: string, country?: string, postalCode?: string }} [workAddress]
 * @property {string[]} [emrSystems]
 * @property {string} [facilityEMR]
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [role]
 */

/**
 * @typedef {object} ReservationApplicant
 * @property {string} _id
 * @property {string} [userId]
 * @property {Array<{ status?: string, at?: Date }>} [applicationLog]
 */

/**
 * @typedef {object} Reservation
 * @property {string} _id
 * @property {string} locumJobId
 * @property {string} status
 * @property {ReservationApplicant[]} [applicants]
 * @property {{ from: Date, to: Date }} [reservationDate]
 */

/**
 * @typedef {object} SearchCriteria
 * @property {LocumJob} job
 * @property {Reservation} [reservation]
 * @property {{ onlyLookingForLocums?: boolean }} [options]
 */

/**
 * @typedef {object} ScoreBreakdown
 * @property {number} location
 * @property {number} duration
 * @property {number} emr
 */

/**
 * @typedef {object} SearchResult
 * @property {string} physicianId
 * @property {number} score
 * @property {ScoreBreakdown} breakdown
 * @property {string[]} [flags]
 */
