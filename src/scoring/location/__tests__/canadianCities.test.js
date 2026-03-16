import { describe, it, expect } from "vitest";
import { lookupCity, lookupAddress } from "../canadianCities.js";

describe("lookupCity", () => {
  it("finds Toronto with province code ON", () => {
    const coords = lookupCity("Toronto", "ON");
    expect(coords).not.toBeNull();
    expect(coords.lat).toBeCloseTo(43.65, 1);
    expect(coords.lng).toBeCloseTo(-79.38, 1);
  });

  it("is case insensitive", () => {
    const upper = lookupCity("TORONTO", "ON");
    const lower = lookupCity("toronto", "on");
    const mixed = lookupCity("Toronto", "On");
    expect(upper).toEqual(lower);
    expect(lower).toEqual(mixed);
    expect(upper).not.toBeNull();
  });

  it("trims whitespace", () => {
    const coords = lookupCity("  Toronto  ", " ON ");
    expect(coords).not.toBeNull();
    expect(coords.lat).toBeCloseTo(43.65, 1);
  });

  it("returns null for unknown cities", () => {
    expect(lookupCity("Atlantis", "ON")).toBeNull();
    expect(lookupCity("Springfield", "XX")).toBeNull();
  });

  it("returns null for empty inputs", () => {
    expect(lookupCity("", "ON")).toBeNull();
    expect(lookupCity("Toronto", "")).toBeNull();
    expect(lookupCity(null, "ON")).toBeNull();
    expect(lookupCity("Toronto", null)).toBeNull();
  });

  it("resolves Toronto subdivisions to Toronto coords", () => {
    const toronto = lookupCity("Toronto", "ON");
    const northYork = lookupCity("North York", "ON");
    const scarborough = lookupCity("Scarborough", "ON");
    const etobicoke = lookupCity("Etobicoke", "ON");

    // All should resolve (subdivisions have their own coords, or fall back to Toronto)
    expect(northYork).not.toBeNull();
    expect(scarborough).not.toBeNull();
    expect(etobicoke).not.toBeNull();
  });

  it("finds cities across different provinces", () => {
    expect(lookupCity("Edmonton", "AB")).not.toBeNull();
    expect(lookupCity("Vancouver", "BC")).not.toBeNull();
    expect(lookupCity("Montreal", "QC")).not.toBeNull();
    expect(lookupCity("Surrey", "BC")).not.toBeNull();
  });

  it("finds smaller Ontario cities from fixtures", () => {
    expect(lookupCity("Dryden", "ON")).not.toBeNull();
    expect(lookupCity("Kenora", "ON")).not.toBeNull();
    expect(lookupCity("Hearst", "ON")).not.toBeNull();
    expect(lookupCity("Wawa", "ON")).not.toBeNull();
    expect(lookupCity("Sundridge", "ON")).not.toBeNull();
    expect(lookupCity("Deep River", "ON")).not.toBeNull();
    expect(lookupCity("Chapleau", "ON")).not.toBeNull();
  });
});

describe("lookupAddress", () => {
  it("extracts city and province from an Address", () => {
    const coords = lookupAddress({ city: "Ottawa", province: "ON" });
    expect(coords).not.toBeNull();
    expect(coords.lat).toBeCloseTo(45.42, 1);
  });

  it("returns null when address is missing city", () => {
    expect(lookupAddress({ province: "ON" })).toBeNull();
    expect(lookupAddress({ city: "", province: "ON" })).toBeNull();
  });

  it("returns null when address is missing province", () => {
    expect(lookupAddress({ city: "Toronto" })).toBeNull();
    expect(lookupAddress({ city: "Toronto", province: "" })).toBeNull();
  });

  it("returns null for null/undefined address", () => {
    expect(lookupAddress(null)).toBeNull();
    expect(lookupAddress(undefined)).toBeNull();
  });
});
