import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { scoreLocation, scoreLocationWithDetail } from "../scoreLocation.js";
import { normalizeProvince } from "../../../normalization/normalizeProvince.js";

// Load real fixture data
// These tests run the scorer against actual physician and job data
// to validate score distributions and catch regressions

/** @type {any[]} */
let rawUsers;
/** @type {any[]} */
let rawJobs;

/**
 * Converts a raw user fixture into a flat Physician shape.
 * Flattens preferences.* into top-level fields.
 */
function toPhysician(raw) {
  const prefs = raw.preferences ?? {};
  return {
    _id: raw._id?.$oid ?? raw._id ?? "unknown",
    medProfession: raw.medProfession ?? "",
    medSpeciality: raw.medSpeciality ?? "",
    isLookingForLocums: prefs.isLookingForLocums ?? true,
    location: null, // no users have GPS coords in fixtures
    workAddress: raw.workAddress ?? null,
    medicalProvince: raw.medicalProvince
      ? normalizeProvince(raw.medicalProvince)
      : undefined,
    preferredProvinces: (prefs.preferredProvinces ?? []).map(
      (p) => normalizeProvince(p) ?? p
    ),
    specificRegions: prefs.specificRegions ?? [],
    emrSystems: raw.emrSystems ?? [],
  };
}

/**
 * Converts a raw job fixture into the fields the scorer needs
 */
function toJobLocation(raw) {
  const coords = raw.location?.coordinates;
  return {
    jobLocation: coords
      ? { lng: coords[0], lat: coords[1] }
      : { lng: 0, lat: 0 },
    jobAddress: {
      city: raw.fullAddress?.city ?? "",
      province: normalizeProvince(raw.fullAddress?.province) ?? raw.fullAddress?.province,
    },
  };
}

beforeAll(() => {
  const fixtureDir = resolve(import.meta.dirname, "../../../../fixtures");
  rawUsers = JSON.parse(readFileSync(resolve(fixtureDir, "locum.users.formatted.json"), "utf-8"));
  rawJobs = JSON.parse(readFileSync(resolve(fixtureDir, "locum.locumjobs.formatted.json"), "utf-8"));
});

describe("Harness: score distribution", () => {
  it("all scores are in [0, 1] with no NaN", () => {
    const physicians = rawUsers.map(toPhysician);
    const { jobLocation, jobAddress } = toJobLocation(rawJobs[0]);

    for (const physician of physicians) {
      const score = scoreLocation(physician, jobLocation, jobAddress);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(Number.isNaN(score)).toBe(false);
    }
  });

  it("zero physicians use GPS path (none have coords)", () => {
    const physicians = rawUsers.map(toPhysician);
    const { jobLocation, jobAddress } = toJobLocation(rawJobs[0]);

    let gpsCount = 0;
    for (const physician of physicians) {
      const detail = scoreLocationWithDetail(physician, jobLocation, jobAddress);
      if (detail.method === "gps_distance") gpsCount++;
    }

    expect(gpsCount).toBe(0);
  });

  it("physicians with no data score 0.50", () => {
    const physicians = rawUsers.map(toPhysician);
    const { jobLocation, jobAddress } = toJobLocation(rawJobs[0]);

    const noDataPhysicians = physicians.filter(
      (p) =>
        !p.location &&
        p.specificRegions.length === 0 &&
        p.preferredProvinces.length === 0 &&
        !p.workAddress?.province &&
        !p.medicalProvince
    );

    expect(noDataPhysicians.length).toBeGreaterThan(0);

    for (const physician of noDataPhysicians) {
      const score = scoreLocation(physician, jobLocation, jobAddress);
      expect(score).toBe(0.5);
    }
  });
});

describe("Harness: known physician/job regression anchors", () => {
  it("Levi Carter (preferredProvinces: [Ontario]) vs Ontario job → 0.70", () => {
    const raw = rawUsers.find((u) => u.firstName === "Levi" && u.lastName === "Carter");
    expect(raw).toBeDefined();

    const physician = toPhysician(raw);
    const { jobLocation, jobAddress } = toJobLocation(rawJobs[0]); // Markham, Ontario

    const score = scoreLocation(physician, jobLocation, jobAddress);
    expect(score).toBe(0.7);
  });

  it("Alice Ross (preferredProvinces: [PEI, NT, NU, YT]) vs Ontario job → 0.20", () => {
    const raw = rawUsers.find((u) => u.firstName === "Alice" && u.lastName === "Ross");
    expect(raw).toBeDefined();

    const physician = toPhysician(raw);
    const { jobLocation, jobAddress } = toJobLocation(rawJobs[0]);

    const score = scoreLocation(physician, jobLocation, jobAddress);
    expect(score).toBe(0.2);
  });

  it("Chloe Fisher (specificRegions: [toronto]) vs Toronto job → 0.85", () => {
    const raw = rawUsers.find((u) => u.firstName === "Chloe" && u.lastName === "Fisher");
    expect(raw).toBeDefined();

    const physician = toPhysician(raw);
    // Find a Toronto job
    const torontoJob = rawJobs.find((j) => j.fullAddress?.city === "Toronto");
    expect(torontoJob).toBeDefined();

    const { jobLocation, jobAddress } = toJobLocation(torontoJob);
    const score = scoreLocation(physician, jobLocation, jobAddress);
    expect(score).toBe(0.85);
  });

  it("Chloe Fisher (specificRegions: [toronto]) vs Markham job → 0.15", () => {
    const raw = rawUsers.find((u) => u.firstName === "Chloe" && u.lastName === "Fisher");
    expect(raw).toBeDefined();

    const physician = toPhysician(raw);
    const markhamJob = rawJobs.find((j) => j.fullAddress?.city === "Markham");
    expect(markhamJob).toBeDefined();

    const { jobLocation, jobAddress } = toJobLocation(markhamJob);
    const score = scoreLocation(physician, jobLocation, jobAddress);
    // "toronto" does not match "Markham" city
    expect(score).toBe(0.15);
  });

  it("James Chandler (no location data) vs any job → 0.50", () => {
    const raw = rawUsers.find((u) => u.firstName === "James" && u.lastName === "Chandler");
    expect(raw).toBeDefined();

    const physician = toPhysician(raw);
    const { jobLocation, jobAddress } = toJobLocation(rawJobs[0]);

    const score = scoreLocation(physician, jobLocation, jobAddress);
    expect(score).toBe(0.5);
  });
});

describe("Harness: Ontario province bias check", () => {
  it("physicians with ON preferred province score higher than non-ON on average", () => {
    const physicians = rawUsers.map(toPhysician);
    const { jobLocation, jobAddress } = toJobLocation(rawJobs[0]); // Ontario job

    const onPhysicians = physicians.filter((p) =>
      p.preferredProvinces.includes("ON")
    );
    const nonOnPhysicians = physicians.filter(
      (p) =>
        p.preferredProvinces.length > 0 && !p.preferredProvinces.includes("ON")
    );

    if (onPhysicians.length === 0 || nonOnPhysicians.length === 0) return;

    const avgOn =
      onPhysicians.reduce(
        (sum, p) => sum + scoreLocation(p, jobLocation, jobAddress),
        0
      ) / onPhysicians.length;

    const avgNonOn =
      nonOnPhysicians.reduce(
        (sum, p) => sum + scoreLocation(p, jobLocation, jobAddress),
        0
      ) / nonOnPhysicians.length;

    expect(avgOn).toBeGreaterThan(avgNonOn);
  });
});

describe("Harness: explainability fields", () => {
  it("detail has all expected fields for Levi Carter", () => {
    const raw = rawUsers.find((u) => u.firstName === "Levi" && u.lastName === "Carter");
    const physician = toPhysician(raw);
    const { jobLocation, jobAddress } = toJobLocation(rawJobs[0]);

    const detail = scoreLocationWithDetail(physician, jobLocation, jobAddress);

    expect(detail.method).toBe("preferred_province");
    expect(detail.provinceMatch).toBe(true);
    expect(detail.resolvedJobProvince).toBe("ON");
    expect(detail.distanceKm).toBe(null);
    expect(detail.distanceBucket).toBe("unknown");
    expect(detail.matchedRegion).toBe(null);
  });
});
