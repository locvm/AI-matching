import { describe, it, expect } from "vitest";
import { normalizeAvailability } from "../normalizeAvailability.js";

describe("normalizeAvailability", () => {
  it("splits Weekdays into Mon-Fri", () => {
    const result = normalizeAvailability(["Weekdays"]);
    expect(result.availableDays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(result.commitmentTypes).toEqual([]);
  });

  it("splits Weekends into Sat-Sun", () => {
    const result = normalizeAvailability(["Weekends"]);
    expect(result.availableDays).toEqual(["Sat", "Sun"]);
    expect(result.commitmentTypes).toEqual([]);
  });

  it("combines Weekdays + Weekends into all 7 days", () => {
    const result = normalizeAvailability(["Weekdays", "Weekends"]);
    expect(result.availableDays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("deduplicates days when Weekdays appears twice", () => {
    const result = normalizeAvailability(["Weekdays", "Weekdays"]);
    expect(result.availableDays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  });

  it("normalizes Full-time to commitment type", () => {
    const result = normalizeAvailability(["Full-time"]);
    expect(result.availableDays).toEqual([]);
    expect(result.commitmentTypes).toEqual(["full-time"]);
  });

  it("normalizes Part-time to commitment type", () => {
    const result = normalizeAvailability(["Part-time"]);
    expect(result.commitmentTypes).toEqual(["part-time"]);
  });

  it("normalizes On-call or short notice to commitment type", () => {
    const result = normalizeAvailability(["On-call or short notice"]);
    expect(result.commitmentTypes).toEqual(["on-call"]);
  });

  it("handles mixed days and commitment types", () => {
    const result = normalizeAvailability(["Weekdays", "Full-time", "On-call or short notice"]);
    expect(result.availableDays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(result.commitmentTypes).toEqual(["full-time", "on-call"]);
  });

  it("handles case insensitivity", () => {
    const result = normalizeAvailability(["weekdays", "FULL-TIME"]);
    expect(result.availableDays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(result.commitmentTypes).toEqual(["full-time"]);
  });

  it("handles whitespace", () => {
    const result = normalizeAvailability(["  Weekends  ", " Part-time "]);
    expect(result.availableDays).toEqual(["Sat", "Sun"]);
    expect(result.commitmentTypes).toEqual(["part-time"]);
  });

  it("ignores unrecognized values", () => {
    const result = normalizeAvailability(["Weekdays", "Evenings", "Midnight shift"]);
    expect(result.availableDays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(result.commitmentTypes).toEqual([]);
  });

  it("returns empty arrays for empty input", () => {
    const result = normalizeAvailability([]);
    expect(result.availableDays).toEqual([]);
    expect(result.commitmentTypes).toEqual([]);
  });

  it("returns empty arrays for non-array input", () => {
    const result = normalizeAvailability(/** @type {any} */ (null));
    expect(result.availableDays).toEqual([]);
    expect(result.commitmentTypes).toEqual([]);
  });
});
