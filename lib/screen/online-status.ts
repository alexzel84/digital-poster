// A screen polls its manifest every 60s while online (see player/ManifestManager.ts).
// One missed poll's worth of grace avoids flickering to "offline" on minor jitter.
const ONLINE_THRESHOLD_MS = 90 * 1000;

export function isScreenOnline(lastSeenAt: Date | null, now: Date = new Date()): boolean {
  if (!lastSeenAt) return false;
  return now.getTime() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;
}

export function formatLastSeen(lastSeenAt: Date | null, now: Date = new Date()): string {
  if (!lastSeenAt) return "Never";

  const diffMs = now.getTime() - lastSeenAt.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}
