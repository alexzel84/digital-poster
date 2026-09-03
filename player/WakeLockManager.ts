/**
 * Wraps the Screen Wake Lock API. Not every browser supports it (many
 * embedded Smart TV browsers don't), so every method fails soft — a
 * missing wake lock should never be treated as an error that blocks
 * playback, just a best-effort feature.
 */
export class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;

  private isSupported(): boolean {
    return typeof navigator !== "undefined" && "wakeLock" in navigator;
  }

  async request(): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      this.sentinel = sentinel;
      sentinel.addEventListener("release", () => {
        this.sentinel = null;
      });
    } catch (err) {
      // e.g. the document isn't visible yet, or the platform refused it —
      // not fatal, just means the screen might sleep on its own schedule.
      console.error("[WakeLockManager] request failed", err);
    }
  }

  async release(): Promise<void> {
    try {
      await this.sentinel?.release();
    } catch {
      // ignore — we're tearing down anyway
    }
    this.sentinel = null;
  }

  private handleVisibilityChange = () => {
    // Wake locks are automatically released when a tab is backgrounded;
    // re-acquire as soon as it's visible again.
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      this.request();
    }
  };

  start(): void {
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  stop(): void {
    if (typeof document === "undefined") return;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.release();
  }
}
