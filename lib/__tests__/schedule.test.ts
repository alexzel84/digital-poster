import { describe, it, expect } from "vitest";
import {
  getLocalParts,
  isScheduleActive,
  selectPlayable,
  describeRule,
  type ScheduleRule,
} from "@/lib/schedule/schedule";
import { updateScheduleSchema } from "@/lib/validation/schedule";

const TZ = "America/Chicago";

// 2026-11-04 is a Wednesday. In November (CST, UTC-6) 18:30 local = 00:30 UTC next day.
const wed1830 = new Date("2026-11-05T00:30:00Z");
const wed1900 = new Date("2026-11-05T01:00:00Z");
const thu1830 = new Date("2026-11-06T00:30:00Z");

const wedFri6to7: ScheduleRule[] = [
  { kind: "weekly", days: [3, 5], start: "18:00", end: "19:00" },
];

describe("getLocalParts", () => {
  it("converts to the screen's zone (date + weekday roll back)", () => {
    const p = getLocalParts(wed1830, TZ);
    expect(p.date).toBe("2026-11-04");
    expect(p.weekday).toBe(3);
    expect(p.minutes).toBe(18 * 60 + 30);
  });

  it("handles midnight as 0 minutes, not 24h", () => {
    const p = getLocalParts(new Date("2026-11-04T06:00:00Z"), TZ); // 00:00 CST
    expect(p.minutes).toBe(0);
    expect(p.date).toBe("2026-11-04");
  });

  it("falls back to UTC for an invalid zone instead of throwing", () => {
    expect(() => getLocalParts(wed1830, "Not/AZone")).not.toThrow();
  });
});

describe("isScheduleActive", () => {
  it("matches inside the window on a listed day", () => {
    expect(isScheduleActive(wedFri6to7, wed1830, TZ)).toBe(true);
  });
  it("end time is exclusive", () => {
    expect(isScheduleActive(wedFri6to7, wed1900, TZ)).toBe(false);
  });
  it("does not match on an unlisted day", () => {
    expect(isScheduleActive(wedFri6to7, thu1830, TZ)).toBe(false);
  });
  it("evaluates in the screen zone, not UTC", () => {
    // Same instant, but a UTC screen sees Thursday 00:30 — no match.
    expect(isScheduleActive(wedFri6to7, wed1830, "UTC")).toBe(false);
  });
  it("one-off date rule matches only that date", () => {
    const rules: ScheduleRule[] = [
      { kind: "date", date: "2026-11-04", start: "18:00", end: "21:00" },
    ];
    expect(isScheduleActive(rules, wed1830, TZ)).toBe(true);
    expect(isScheduleActive(rules, new Date("2026-11-12T00:30:00Z"), TZ)).toBe(false);
  });
  it("respects from/until on weekly rules", () => {
    const rules: ScheduleRule[] = [
      { kind: "weekly", days: [3], start: "18:00", end: "19:00", from: "2026-11-10" },
    ];
    expect(isScheduleActive(rules, wed1830, TZ)).toBe(false); // 11-04 < from
    const rules2: ScheduleRule[] = [
      { kind: "weekly", days: [3], start: "18:00", end: "19:00", until: "2026-11-04" },
    ];
    expect(isScheduleActive(rules2, wed1830, TZ)).toBe(true); // until is inclusive
  });
  it("no rules means not 'active' (it is default content)", () => {
    expect(isScheduleActive(null, wed1830, TZ)).toBe(false);
    expect(isScheduleActive([], wed1830, TZ)).toBe(false);
  });
});

describe("selectPlayable", () => {
  const def = { id: "default", schedule: null };
  const sched = { id: "sched", schedule: wedFri6to7 };
  const sched2 = {
    id: "sched2",
    schedule: [{ kind: "weekly", days: [3], start: "19:00", end: "20:00" }] as ScheduleRule[],
  };

  it("active scheduled item takes over from defaults", () => {
    expect(selectPlayable([def, sched], wed1830, TZ).map((i) => i.id)).toEqual(["sched"]);
  });
  it("falls back to defaults outside every slot", () => {
    expect(selectPlayable([def, sched], thu1830, TZ).map((i) => i.id)).toEqual(["default"]);
  });
  it("is empty (dark screen) when only scheduled items exist and none is active", () => {
    expect(selectPlayable([sched, sched2], thu1830, TZ)).toEqual([]);
  });
  it("back-to-back slots hand over exactly at the boundary", () => {
    expect(selectPlayable([sched, sched2], wed1900, TZ).map((i) => i.id)).toEqual(["sched2"]);
  });
  it("treats items with no schedule field as defaults (old manifests)", () => {
    const legacy: { id: string; schedule?: ScheduleRule[] | null } = { id: "x" };
    expect(selectPlayable([legacy], wed1830, TZ).map((i) => i.id)).toEqual(["x"]);
  });
});

describe("updateScheduleSchema", () => {
  it("accepts a valid weekly rule", () => {
    expect(updateScheduleSchema.safeParse({ schedule: wedFri6to7 }).success).toBe(true);
  });
  it("accepts null / empty to clear", () => {
    expect(updateScheduleSchema.safeParse({ schedule: null }).success).toBe(true);
    expect(updateScheduleSchema.safeParse({ schedule: [] }).success).toBe(true);
  });
  it("rejects end <= start", () => {
    const r = updateScheduleSchema.safeParse({
      schedule: [{ kind: "weekly", days: [1], start: "19:00", end: "18:00" }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects a weekly rule with no days and bad times", () => {
    expect(
      updateScheduleSchema.safeParse({
        schedule: [{ kind: "weekly", days: [], start: "18:00", end: "19:00" }],
      }).success
    ).toBe(false);
    expect(
      updateScheduleSchema.safeParse({
        schedule: [{ kind: "date", date: "2026-11-04", start: "25:00", end: "26:00" }],
      }).success
    ).toBe(false);
  });
});

describe("describeRule", () => {
  it("summarises weekly and date rules", () => {
    expect(describeRule(wedFri6to7[0]!)).toBe("Wed, Fri · 6 PM–7 PM");
    expect(
      describeRule({ kind: "date", date: "2026-11-04", start: "10:00", end: "13:30" })
    ).toBe("2026-11-04 · 10 AM–1:30 PM");
  });
});
