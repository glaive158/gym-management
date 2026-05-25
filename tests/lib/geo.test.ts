import { describe, it, expect } from "vitest";
import { haversineMeters } from "@/lib/geo";

describe("haversineMeters", () => {
  it("returns 0 for identical coords", () => {
    expect(haversineMeters(14.6928, -17.4467, 14.6928, -17.4467)).toBe(0);
  });
  it("returns ~111000m for 1° lat diff at equator", () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
  it("returns ~95m for small Dakar offset", () => {
    const d = haversineMeters(14.6928, -17.4467, 14.6937, -17.4467);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(120);
  });
  it("symmetric A→B === B→A", () => {
    expect(haversineMeters(14.7, -17.4, 14.8, -17.5))
      .toBe(haversineMeters(14.8, -17.5, 14.7, -17.4));
  });
});
