import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ManifestManager } from "@/player/ManifestManager";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("ManifestManager.syncOnce", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls onUpdate on the first successful sync", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ screenId: "s1", version: 1, items: [] })
    );
    const onUpdate = vi.fn();
    const manager = new ManifestManager("s1", "token", onUpdate, vi.fn(), vi.fn());
    await manager.syncOnce();
    expect(onUpdate).toHaveBeenCalledWith({ screenId: "s1", version: 1, items: [] });
  });

  it("does NOT call onUpdate again when the version hasn't changed", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ screenId: "s1", version: 1, items: [] })
    );
    const onUpdate = vi.fn();
    const manager = new ManifestManager("s1", "token", onUpdate, vi.fn(), vi.fn());
    await manager.syncOnce();
    await manager.syncOnce();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("calls onUpdate again when the version increments", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ screenId: "s1", version: 1, items: [] })
    );
    const onUpdate = vi.fn();
    const manager = new ManifestManager("s1", "token", onUpdate, vi.fn(), vi.fn());
    await manager.syncOnce();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ screenId: "s1", version: 2, items: [] })
    );
    await manager.syncOnce();
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("calls onAuthError on a 401 (disconnected screen) rather than onNetworkStatus", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Invalid screen token" }, 401)
    );
    const onAuthError = vi.fn();
    const onNetworkStatus = vi.fn();
    const manager = new ManifestManager("s1", "token", vi.fn(), onAuthError, onNetworkStatus);
    await manager.syncOnce();
    expect(onAuthError).toHaveBeenCalledOnce();
    expect(onNetworkStatus).not.toHaveBeenCalled();
  });

  it("reports offline on network failure without throwing, so playback isn't interrupted", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));
    const onNetworkStatus = vi.fn();
    const manager = new ManifestManager("s1", "token", vi.fn(), vi.fn(), onNetworkStatus);
    await expect(manager.syncOnce()).resolves.not.toThrow();
    expect(onNetworkStatus).toHaveBeenCalledWith(false);
  });
});
