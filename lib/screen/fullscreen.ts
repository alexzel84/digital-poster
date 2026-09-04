const FULLSCREEN_TIMEOUT_MS = 1500;

export async function enterFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (!el.requestFullscreen) return;

  try {
    // Some embedded/commercial-display browsers have incomplete
    // Fullscreen API implementations where the returned promise never
    // resolves OR rejects — it just hangs forever. Race it against a
    // timeout so a broken implementation can never block the rest of
    // startup (wake lock, playback) indefinitely. If it does resolve
    // late, that's harmless — fullscreen either ends up applied or not,
    // but playback was never held hostage waiting for it.
    await Promise.race([
      el.requestFullscreen(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Fullscreen request timed out")), FULLSCREEN_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    // Some embedded/TV browsers reject this even from a genuine user
    // gesture, or don't implement it at all, or (per above) hang — none
    // of that should be fatal. Fullscreen is a nice-to-have, not a
    // requirement for playback.
    console.error("[Fullscreen] request failed or timed out", err);
  }
}
