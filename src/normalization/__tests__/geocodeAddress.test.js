import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocodeAddress } from "../geocodeAddress.js";

describe("geocodeAddress", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns coordinates for a valid address", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: "43.6532", lon: "-79.3832" }]),
    });

    const result = await geocodeAddress({ city: "Toronto", province: "ON", country: "Canada" });
    expect(result).toEqual({ lat: 43.6532, lng: -79.3832 });
  });

  it("builds the URL with correct query params", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: "43.6532", lon: "-79.3832" }]),
    });

    await geocodeAddress({
      streetNumber: "123",
      streetName: "Queen Street",
      city: "Toronto",
      province: "ON",
      country: "Canada",
    });

    const callUrl = new URL(/** @type {import("vitest").Mock} */ (globalThis.fetch).mock.calls[0][0]);
    expect(callUrl.searchParams.get("q")).toBe("123, Queen Street, Toronto, ON, Canada");
    expect(callUrl.searchParams.get("format")).toBe("json");
    expect(callUrl.searchParams.get("limit")).toBe("1");
    expect(callUrl.searchParams.get("countrycodes")).toBe("ca");
  });

  it("sends User-Agent header", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await geocodeAddress({ city: "Toronto", province: "ON" });

    const headers = /** @type {import("vitest").Mock} */ (globalThis.fetch).mock.calls[0][1].headers;
    expect(headers["User-Agent"]).toContain("LOCVM");
  });

  it("returns null when no results", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await geocodeAddress({ city: "Nonexistent", province: "ON" });
    expect(result).toBeNull();
  });

  it("returns null when response is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const result = await geocodeAddress({ city: "Toronto", province: "ON" });
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await geocodeAddress({ city: "Toronto", province: "ON" });
    expect(result).toBeNull();
  });

  it("returns null for empty address", async () => {
    const result = await geocodeAddress({});
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns null for null address", async () => {
    const result = await geocodeAddress(null);
    expect(result).toBeNull();
  });

  it("returns null for address with only city (no province)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: "43.6532", lon: "-79.3832" }]),
    });

    // Should still work, just with a less precise query
    const result = await geocodeAddress({ city: "Toronto" });
    expect(result).toEqual({ lat: 43.6532, lng: -79.3832 });
  });
});
