import { describe, it, expect } from "vitest";
import { isScreenOnline, formatLastSeen } from "@/lib/screen/online-status";

describe("isScreenOnline", () => {
  it("is offline when never seen", () => {
    expect(isScreenOnline(null)).toBe(false);
  });

  it("is online just after a poll", () => {
    const now = new Date("2026-01-01T00:02:00Z");
    const lastSeen = new Date("2026-01-01T00:01:30Z"); // 30s ago
    expect(isScreenOnline(lastSeen, now)).toBe(true);
  });

  it("is offline well past the poll interval plus grace period", () => {
    const now = new Date("2026-01-01T00:05:00Z");
    const lastSeen = new Date("2026-01-01T00:00:00Z"); // 5 minutes ago
    expect(isScreenOnline(lastSeen, now)).toBe(false);
  });
});

describe("formatLastSeen", () => {
  it("returns 'Never' when never seen", () => {
    expect(formatLastSeen(null)).toBe("Never");
  });

  it("returns 'Just now' under a minute", () => {
    const now = new Date("2026-01-01T00:00:30Z");
    expect(formatLastSeen(new Date("2026-01-01T00:00:00Z"), now)).toBe("Just now");
  });

  it("formats minutes with correct singular/plural", () => {
    const now = new Date("2026-01-01T00:02:00Z");
    expect(formatLastSeen(new Date("2026-01-01T00:01:00Z"), now)).toBe("1 minute ago");
    expect(formatLastSeen(new Date("2026-01-01T00:00:00Z"), now)).toBe("2 minutes ago");
  });

  it("formats hours once past 60 minutes", () => {
    const now = new Date("2026-01-01T02:00:00Z");
    expect(formatLastSeen(new Date("2026-01-01T01:00:00Z"), now)).toBe("1 hour ago");
  });

  it("formats days once past 24 hours", () => {
    const now = new Date("2026-01-03T00:00:00Z");
    expect(formatLastSeen(new Date("2026-01-01T00:00:00Z"), now)).toBe("2 days ago");
  });
});
