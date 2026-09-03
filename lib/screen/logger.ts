export type LogEvent =
  | "SCREEN_PAIRED"
  | "MANIFEST_UPDATED"
  | "MEDIA_DOWNLOAD_STARTED"
  | "MEDIA_DOWNLOAD_COMPLETED"
  | "MEDIA_PLAYBACK_STARTED"
  | "MEDIA_PLAYBACK_FAILED"
  | "MEDIA_EXPIRED"
  | "SYNC_FAILED"
  | "NETWORK_OFFLINE"
  | "NETWORK_ONLINE";

export function logEvent(event: LogEvent, data?: Record<string, unknown>): void {
  // Kept intentionally simple for MVP — structured enough to grep in
  // browser/TV logs, without pulling in a logging library or shipping
  // events to a backend (no analytics per the product philosophy).
  console.log(`[${event}]`, data ?? "");
}
