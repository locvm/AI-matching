import { describe, it, expect } from "vitest";
import { toDomain, toPersistence } from "../physicianMapper.js";

/** Realistic raw User document from MongoDB */
const RAW_USER = {
  _id: { $oid: "507f1f77bcf86cd799439011" },
  firstName: " Jane ",
  lastName: " Smith ",
  email: "jane@example.com",
  medProfession: "Physician",
  medSpeciality: " Family Medicine ",
  medicalProvince: "Ontario",
  emrSystems: ["OSCAR McMaster - Professional Edition (OSCAR Pro)", "Juno EMR"],
  facilityName: " General Hospital ",
  facilityEMR: " Accuro EMR ",
  languages: ["English", "French"],
  role: "User",
  isProfileComplete: true,
  isOnboardingCompleted: true,
  workAddress: {
    streetNumber: "100",
    streetName: "King St W",
    city: "Toronto",
    province: "Ontario",
    postalCode: "M5X 1A9",
    country: "Canada",
  },
  preferences: {
    isLookingForLocums: true,
    preferredProvinces: ["Ontario", "British Columbia", "Quebec"],
    specificRegions: ["downtown toronto", "GTA"],
    locumDurations: ["1–3 months", "3–6 months"],
    availabilityTypes: ["Weekdays", "Full-time"],
  },
};

describe("physicianMapper.toDomain", () => {
  it("transforms a realistic raw User document", () => {
    const physician = toDomain(RAW_USER);

    expect(physician._id).toBe("507f1f77bcf86cd799439011");
    expect(physician.firstName).toBe("Jane");
    expect(physician.lastName).toBe("Smith");
    expect(physician.medProfession).toBe("Physician");
    expect(physician.medSpeciality).toBe("Family Medicine");
    expect(physician.isLookingForLocums).toBe(true);
    expect(physician.location).toBe(null);
    expect(physician.medicalProvince).toBe("ON");
    expect(physician.preferredProvinces).toEqual(["ON", "BC", "QC"]);
    expect(physician.specificRegions).toEqual(["downtown toronto", "GTA"]);
    expect(physician.emrSystems).toEqual([
      "OSCAR McMaster - Professional Edition (OSCAR Pro)",
      "Juno EMR",
    ]);
    expect(physician.facilityName).toBe("General Hospital");
    expect(physician.facilityEMR).toBe("Accuro EMR");
    expect(physician.languages).toEqual(["English", "French"]);
    expect(physician.locumDurations).toEqual([
      { minDays: 30, maxDays: 90 },
      { minDays: 90, maxDays: 180 },
    ]);
    expect(physician.availableDays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(physician.commitmentTypes).toEqual(["full-time"]);
    expect(physician.isProfileComplete).toBe(true);
    expect(physician.isOnboardingCompleted).toBe(true);
    expect(physician.role).toBe("User");
  });

  it("normalizes provinces in workAddress", () => {
    const physician = toDomain(RAW_USER);
    expect(physician.workAddress?.province).toBe("ON");
  });

  it("normalizes preferredProvinces from full names to codes", () => {
    const raw = {
      _id: "abc",
      preferences: {
        preferredProvinces: ["British Columbia", "Alberta", "Québec "],
      },
    };
    const physician = toDomain(raw);
    expect(physician.preferredProvinces).toEqual(["BC", "AB", "QC"]);
  });

  it("defaults isLookingForLocums to true when missing", () => {
    const raw = { _id: "abc", preferences: {} };
    expect(toDomain(raw).isLookingForLocums).toBe(true);
  });

  it("defaults isLookingForLocums to true when preferences missing entirely", () => {
    const raw = { _id: "abc" };
    expect(toDomain(raw).isLookingForLocums).toBe(true);
  });

  it("preserves explicit false for isLookingForLocums", () => {
    const raw = { _id: "abc", preferences: { isLookingForLocums: false } };
    expect(toDomain(raw).isLookingForLocums).toBe(false);
  });

  it("defaults arrays to empty when missing", () => {
    const raw = { _id: "abc" };
    const physician = toDomain(raw);
    expect(physician.emrSystems).toEqual([]);
    expect(physician.languages).toEqual([]);
    expect(physician.preferredProvinces).toEqual([]);
    expect(physician.specificRegions).toEqual([]);
    expect(physician.locumDurations).toEqual([]);
    expect(physician.availableDays).toBeUndefined();
    expect(physician.commitmentTypes).toBeUndefined();
  });

  it("defaults strings to empty when missing", () => {
    const raw = { _id: "abc" };
    const physician = toDomain(raw);
    expect(physician.medProfession).toBe("");
    expect(physician.medSpeciality).toBe("");
  });

  it("location is always null (User schema has no GeoJSON)", () => {
    const raw = { _id: "abc", location: { type: "Point", coordinates: [-79, 43] } };
    expect(toDomain(raw).location).toBe(null);
  });

  it("coerces Mongoose ObjectId-like _id", () => {
    const raw = { _id: { toString: () => "objectid123" } };
    expect(toDomain(raw)._id).toBe("objectid123");
  });

  it("filters unrecognized provinces from preferredProvinces", () => {
    const raw = {
      _id: "abc",
      preferences: { preferredProvinces: ["Ontario", "Blorbistan", "BC"] },
    };
    expect(toDomain(raw).preferredProvinces).toEqual(["ON", "BC"]);
  });

  it("sets medicalProvince to undefined when unrecognized", () => {
    const raw = { _id: "abc", medicalProvince: "USA" };
    expect(toDomain(raw).medicalProvince).toBe(undefined);
  });

  it("returns null workAddress when missing", () => {
    const raw = { _id: "abc" };
    expect(toDomain(raw).workAddress).toBe(null);
  });

  it("throws for null/undefined input", () => {
    expect(() => toDomain(null)).toThrow("raw document is required");
    expect(() => toDomain(undefined)).toThrow("raw document is required");
  });
});

describe("physicianMapper.toPersistence", () => {
  it("throws not implemented", () => {
    expect(() => toPersistence(/** @type {any} */ ({}))).toThrow("not implemented");
  });
});
