import { describe, it, expect } from "vitest";
import { haversineKm } from "../haversine.js";

// Known reference points
const TORONTO = { lat: 43.6532, lng: -79.3832 };
const HAMILTON = { lat: 43.2557, lng: -79.8711 };
const OTTAWA = { lat: 45.4215, lng: -75.6972 };
const BARRIE = { lat: 44.3894, lng: -79.6903 };
const MARKHAM = { lat: 43.8561, lng: -79.3370 };

describe("haversineKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineKm(TORONTO, TORONTO)).toBe(0);
  });

  it("computes Toronto to Hamilton (~59 km)", () => {
    const distance = haversineKm(TORONTO, HAMILTON);
    expect(distance).toBeGreaterThan(55);
    expect(distance).toBeLessThan(65);
  });

  it("computes Toronto to Ottawa (~352 km)", () => {
    const distance = haversineKm(TORONTO, OTTAWA);
    expect(distance).toBeGreaterThan(345);
    expect(distance).toBeLessThan(360);
  });

  it("computes Toronto to Barrie (~85 km)", () => {
    const distance = haversineKm(TORONTO, BARRIE);
    expect(distance).toBeGreaterThan(80);
    expect(distance).toBeLessThan(95);
  });

  it("computes Toronto to Markham (~23 km)", () => {
    const distance = haversineKm(TORONTO, MARKHAM);
    expect(distance).toBeGreaterThan(18);
    expect(distance).toBeLessThan(28);
  });

  it("is symmetric: haversine(A, B) === haversine(B, A)", () => {
    const ab = haversineKm(TORONTO, HAMILTON);
    const ba = haversineKm(HAMILTON, TORONTO);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it("handles [0, 0] coordinates without crashing", () => {
    const result = haversineKm({ lat: 0, lng: 0 }, TORONTO);
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });
});
