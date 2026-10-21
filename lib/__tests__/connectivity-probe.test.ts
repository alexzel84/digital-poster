import { describe, it, expect, vi, afterEach } from "vitest";
import { canReachServer } from "@/lib/screen/connectivity-probe";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("canReachServer", () => {
  it("is true when the server answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    expect(await canReachServer()).toBe(true);
  });

  it("is false when the request fails (Wi-Fi up, no internet)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await canReachServer()).toBe(false);
  });

  it("is false on a non-OK response (captive portal / 5xx)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await canReachServer()).toBe(false);
  });

  it("is false when the request hangs past the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          })
      )
    );
    expect(await canReachServer(20)).toBe(false);
  });
});
