import { describe, it, expect } from "vitest";
import { isMediaActive, mediaStatus, activeMediaInOrder } from "@/lib/media/status";

describe("isMediaActive", () => {
  it("is active when there is no expiration", () => {
    expect(isMediaActive(null)).toBe(true);
  });

  it("is active for a future expiration", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isMediaActive(future)).toBe(true);
  });

  it("is inactive for a past expiration", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isMediaActive(past)).toBe(false);
  });

  it("treats the exact expiration instant as inactive (boundary)", () => {
    const now = new Date();
    expect(isMediaActive(now, now)).toBe(false);
  });
});

describe("mediaStatus", () => {
  it("returns 'active' when not expired", () => {
    expect(mediaStatus(null)).toBe("active");
  });

  it("returns 'expired' when expired", () => {
    expect(mediaStatus(new Date(Date.now() - 1000))).toBe("expired");
  });
});

describe("activeMediaInOrder", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("filters out expired items and sorts the rest by sortOrder", () => {
    const items = [
      { id: "b", sortOrder: 1, expiresAt: null },
      { id: "expired", sortOrder: 0, expiresAt: new Date("2025-01-01T00:00:00Z") },
      { id: "a", sortOrder: 0, expiresAt: null },
    ];
    const result = activeMediaInOrder(items, now);
    expect(result.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array when every item is expired", () => {
    const items = [
      { id: "a", sortOrder: 0, expiresAt: new Date("2025-01-01T00:00:00Z") },
    ];
    expect(activeMediaInOrder(items, now)).toEqual([]);
  });
});
