import { describe, it, expect } from "vitest";
import { currentWeek, weekTargetWeight, walkCalories, WALK_KCAL_PER_MIN } from "@/lib/fitness-utils";

describe("currentWeek", () => {
  it("returns 1 on the start date", () => {
    const start = new Date("2026-06-01T08:00:00Z");
    const now = new Date("2026-06-01T20:00:00Z");
    expect(currentWeek(start, now, 8)).toBe(1);
  });
  it("returns 2 after 7 days", () => {
    const start = new Date("2026-06-01T00:00:00Z");
    const now = new Date("2026-06-08T00:00:00Z");
    expect(currentWeek(start, now, 8)).toBe(2);
  });
  it("caps at total weeks", () => {
    const start = new Date("2026-06-01T00:00:00Z");
    const now = new Date("2026-12-01T00:00:00Z");
    expect(currentWeek(start, now, 8)).toBe(8);
  });
  it("never returns less than 1", () => {
    const start = new Date("2026-06-10T00:00:00Z");
    const now = new Date("2026-06-01T00:00:00Z");
    expect(currentWeek(start, now, 8)).toBe(1);
  });
});

describe("weekTargetWeight", () => {
  it("returns start weight at week 0", () => { expect(weekTargetWeight(92, 85, 0, 8)).toBe(92); });
  it("returns goal weight at final week", () => { expect(weekTargetWeight(92, 85, 8, 8)).toBe(85); });
  it("interpolates linearly at the midpoint", () => { expect(weekTargetWeight(92, 85, 4, 8)).toBeCloseTo(88.5, 1); });
});

describe("walkCalories", () => {
  it("uses 8.5 kcal/min", () => { expect(WALK_KCAL_PER_MIN).toBe(8.5); expect(walkCalories(30)).toBe(255); });
  it("rounds to nearest integer", () => { expect(walkCalories(10.4)).toBe(88); });
});
