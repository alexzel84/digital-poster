const CACHE_NAME = "digital-poster-media-v1";

function isSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

/** A stable synthetic key, independent of R2's ever-changing signed URLs. */
function keyFor(id: string): string {
  return `https://local-media.digitalposter.internal/${id}`;
}

/**
 * Explicit local cache for downloaded media files, backed by the Cache
 * Storage API. This is the ONLY place in the app that touches `caches.*`
 * directly — the playback engine and sync logic ask this module for media
 * by id and never care how/where it's actually stored. Every method fails
 * soft: a storage error here should never take down playback.
 */
export const LocalMediaStore = {
  async saveMedia(id: string, blob: Blob): Promise<boolean> {
    if (!isSupported()) return false;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(keyFor(id), new Response(blob));
      return true;
    } catch (err) {
      // Covers quota exceeded and any other storage failure — log and
      // move on. The item will be retried on the next sync.
      console.error("[LocalMediaStore] saveMedia failed", id, err);
      return false;
    }
  },

  async getMedia(id: string): Promise<Blob | null> {
    if (!isSupported()) return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(keyFor(id));
      return res ? await res.blob() : null;
    } catch (err) {
      console.error("[LocalMediaStore] getMedia failed", id, err);
      return null;
    }
  },

  async hasMedia(id: string): Promise<boolean> {
    if (!isSupported()) return false;
    try {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(keyFor(id))) !== undefined;
    } catch {
      return false;
    }
  },

  async deleteMedia(id: string): Promise<void> {
    if (!isSupported()) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(keyFor(id));
    } catch (err) {
      console.error("[LocalMediaStore] deleteMedia failed", id, err);
    }
  },

  async clearMedia(): Promise<void> {
    if (!isSupported()) return;
    try {
      await caches.delete(CACHE_NAME);
    } catch (err) {
      console.error("[LocalMediaStore] clearMedia failed", err);
    }
  },

  async listMedia(): Promise<string[]> {
    if (!isSupported()) return [];
    try {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();
      return requests
        .map((req) => req.url.split("/").pop())
        .filter((id): id is string => Boolean(id));
    } catch {
      return [];
    }
  },
};
