// @ts-check

// Normalization barrel export.
//
// This is the entry point for converting raw Mongo docs into clean domain models.
// When we migrate to SQL, only this module changes.

export { toDomain as physicianToDomain, toPersistence as physicianToPersistence } from "./physicianMapper.js";
export { toDomain as locumJobToDomain, toPersistence as locumJobToPersistence } from "./locumJobMapper.js";
export { toDomain as reservationToDomain, toPersistence as reservationToPersistence } from "./reservationMapper.js";
export { normalizeProvince } from "./normalizeProvince.js";
export { normalizeLocumDuration } from "./normalizeLocumDuration.js";
export { normalizeAvailability } from "./normalizeAvailability.js";
export { normalizeAvailabilityDateRange, normalizeAvailabilityDateRanges } from "./normalizeAvailabilityDateRange.js";
export { normalizeAvailabilityYears } from "./normalizeAvailabilityYears.js";
export { coerceObjectId, ensureDate, trimString, ensureStringArray, normalizeAddress } from "./primitives.js";
