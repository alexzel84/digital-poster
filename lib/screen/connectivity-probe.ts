/**
 * `navigator.onLine` only says "a network interface is up" — it stays true
 * when the TV is on Wi-Fi but the router has no internet. For decisions
 * where a wrong "yes" is costly (a full page reload that would replace the
 * playing content with the browser's error page), ask the real question:
 * can we actually reach our own server right now?
 *
 * Probes `/screen` (the exact page a reload would fetch). It is excluded
 * from the auth middleware, so this is a cheap static HEAD request.
 */
export async function canReachServer(timeoutMs = 8000): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/screen", {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
