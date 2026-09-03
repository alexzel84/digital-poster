export async function enterFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    }
  } catch (err) {
    // Some embedded/TV browsers reject this even from a genuine user
    // gesture, or don't implement it at all — playback must work either
    // way, fullscreen is a nice-to-have, not a requirement.
    console.error("[Fullscreen] request failed", err);
  }
}
