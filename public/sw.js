// Minimal Service Worker. Deliberately does NOT intercept fetch requests
// or implement its own caching strategy — all media caching logic lives
// in player/LocalMediaStore.ts (Cache Storage API, called directly from
// page scripts) so it stays in one testable place instead of being split
// across a worker's fetch handler.
//
// This worker's job is just to exist: some browsers treat an active
// Service Worker as a signal to keep Cache Storage alive more
// aggressively across reloads/backgrounding. If registration fails or
// isn't supported (some Smart TV browsers lack Service Worker support
// entirely), LocalMediaStore and SyncManager must still work correctly —
// see lib/screen/register-sw.ts, which fails silently in that case.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
