import { describe, it, expect } from "vitest";
import { buildDailySeries } from "@/lib/build-daily-series";

describe("buildDailySeries", () => {
  it("returns the requested number of days", () => {
    const series = buildDailySeries([], 7, new Date("2026-01-10T00:00:00Z"));
    expect(series).toHaveLength(7);
  });

  it("fills days with no data as zero", () => {
    const series = buildDailySeries([], 3, new Date("2026-01-10T00:00:00Z"));
    expect(series.every((s) => s.value === 0)).toBe(true);
  });

  it("places counts on the correct day", () => {
    const series = buildDailySeries(
      [{ day: "2026-01-10", count: 5 }],
      3,
      new Date("2026-01-10T00:00:00Z")
    );
    // Last entry in the series should be "today" (2026-01-10)
    expect(series[series.length - 1]!.value).toBe(5);
    expect(series[0]!.value).toBe(0);
  });

  it("ends with the most recent day", () => {
    const series = buildDailySeries([], 5, new Date("2026-01-10T00:00:00Z"));
    expect(series[series.length - 1]!.label).toContain("10");
  });
});
