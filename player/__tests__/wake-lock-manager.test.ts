import { describe, it, expect } from "vitest";
import { WakeLockManager } from "@/player/WakeLockManager";

// These tests run in Node (no DOM, no navigator.wakeLock), which is
// exactly the "unsupported browser" case the spec requires graceful
// handling for — e.g. many embedded Smart TV browsers.
describe("WakeLockManager (unsupported environment)", () => {
  it("request() resolves without throwing when the API is unavailable", async () => {
    const manager = new WakeLockManager();
    await expect(manager.request()).resolves.toBeUndefined();
  });

  it("release() resolves without throwing when nothing was ever requested", async () => {
    const manager = new WakeLockManager();
    await expect(manager.release()).resolves.toBeUndefined();
  });

  it("start() and stop() never throw even without a document global", () => {
    const manager = new WakeLockManager();
    expect(() => manager.start()).not.toThrow();
    expect(() => manager.stop()).not.toThrow();
  });
});
