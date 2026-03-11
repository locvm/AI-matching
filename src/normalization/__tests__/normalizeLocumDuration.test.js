import { describe, it, expect } from "vitest";
import { normalizeLocumDuration } from "../normalizeLocumDuration.js";

describe("normalizeLocumDuration", () => {
  it("normalizes all 5 known duration strings", () => {
    expect(normalizeLocumDuration("A few days")).toEqual({ minDays: 1, maxDays: 7 });
    expect(normalizeLocumDuration("Less than a month")).toEqual({ minDays: 1, maxDays: 30 });
    expect(normalizeLocumDuration("1–3 months")).toEqual({ minDays: 30, maxDays: 90 });
    expect(normalizeLocumDuration("3–6 months")).toEqual({ minDays: 90, maxDays: 180 });
    expect(normalizeLocumDuration("6+ months")).toEqual({ minDays: 180, maxDays: 365 });
  });

  it("handles case insensitivity", () => {
    expect(normalizeLocumDuration("a few days")).toEqual({ minDays: 1, maxDays: 7 });
    expect(normalizeLocumDuration("LESS THAN A MONTH")).toEqual({ minDays: 1, maxDays: 30 });
    expect(normalizeLocumDuration("A FEW DAYS")).toEqual({ minDays: 1, maxDays: 7 });
  });

  it("handles en-dash and em-dash variants", () => {
    // en-dash (–) — what the frontend stores
    expect(normalizeLocumDuration("1–3 months")).toEqual({ minDays: 30, maxDays: 90 });
    expect(normalizeLocumDuration("3–6 months")).toEqual({ minDays: 90, maxDays: 180 });
    // regular hyphen (-)
    expect(normalizeLocumDuration("1-3 months")).toEqual({ minDays: 30, maxDays: 90 });
    expect(normalizeLocumDuration("3-6 months")).toEqual({ minDays: 90, maxDays: 180 });
    // em-dash (—)
    expect(normalizeLocumDuration("1—3 months")).toEqual({ minDays: 30, maxDays: 90 });
  });

  it("handles leading/trailing whitespace", () => {
    expect(normalizeLocumDuration("  A few days  ")).toEqual({ minDays: 1, maxDays: 7 });
    expect(normalizeLocumDuration(" 6+ months ")).toEqual({ minDays: 180, maxDays: 365 });
  });

  it("returns null for unrecognized strings", () => {
    expect(normalizeLocumDuration("forever")).toBeNull();
    expect(normalizeLocumDuration("2 weeks")).toBeNull();
    expect(normalizeLocumDuration("")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(normalizeLocumDuration(null)).toBeNull();
    expect(normalizeLocumDuration(undefined)).toBeNull();
    expect(normalizeLocumDuration(42)).toBeNull();
    expect(normalizeLocumDuration({})).toBeNull();
  });
});
