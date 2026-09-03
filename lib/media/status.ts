export type MediaStatus = "active" | "expired";

/** Whether a media item should currently play, evaluated against a given instant. */
export function isMediaActive(
  expiresAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return true; // no expiration = never expires
  return expiresAt.getTime() > now.getTime();
}

export function mediaStatus(
  expiresAt: Date | null,
  now: Date = new Date()
): MediaStatus {
  return isMediaActive(expiresAt, now) ? "active" : "expired";
}

/** Filters and sorts a screen's media down to what should actually be in the playback loop. */
export function activeMediaInOrder<T extends { expiresAt: Date | null; sortOrder: number }>(
  items: T[],
  now: Date = new Date()
): T[] {
  return items
    .filter((item) => isMediaActive(item.expiresAt, now))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
