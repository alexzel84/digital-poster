import type { Manifest } from "./ManifestManager";
import type { PlaybackItem } from "./PlaybackEngine";
import { computeManifestDiff, type ManifestMediaMeta } from "./manifest-diff";
import { LocalMediaStore } from "./LocalMediaStore";
import { loadStoredManifest, saveStoredManifest } from "./ManifestStore";
import { logEvent } from "@/lib/screen/logger";

function toMeta(item: PlaybackItem): ManifestMediaMeta {
  return {
    id: item.id,
    type: item.type,
    hash: item.hash,
    duration: item.duration,
    expiresAt: item.expiresAt,
    sortOrder: item.sortOrder,
  };
}

// Object URLs are expensive to keep recreating and must be explicitly
// revoked to avoid leaking memory. Cache them per media id, keyed by hash,
// so an unchanged item reuses the same URL across every 60s poll instead
// of flickering to a new blob URL each time.
const objectUrlCache = new Map<string, { hash: string; url: string }>();

async function resolveLocalUrl(item: {
  id: string;
  hash: string;
  url: string;
}): Promise<string> {
  const cached = objectUrlCache.get(item.id);
  if (cached && cached.hash === item.hash) {
    return cached.url;
  }
  if (cached) {
    URL.revokeObjectURL(cached.url);
    objectUrlCache.delete(item.id);
  }

  const blob = await LocalMediaStore.getMedia(item.id);
  if (!blob) {
    // Not cached locally (yet, or the download failed) — fall back to the
    // signed network URL rather than showing nothing.
    return item.url;
  }

  const url = URL.createObjectURL(blob);
  objectUrlCache.set(item.id, { hash: item.hash, url });
  return url;
}

function revokeAndForget(id: string): void {
  const cached = objectUrlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached.url);
    objectUrlCache.delete(id);
  }
}

/**
 * Reconciles a freshly-fetched manifest against what's actually sitting in
 * LocalMediaStore: downloads what's missing or changed, deletes what's no
 * longer needed, and returns playback items pointing at local blob URLs
 * wherever possible.
 *
 * MVP trade-off, documented honestly: if a brand-new item hasn't finished
 * downloading yet (or its download failed), this falls back to the
 * original signed network URL rather than omitting it entirely, so
 * playback isn't unnecessarily delayed. A stricter "local-only, always"
 * policy is possible but adds meaningful complexity for an MVP; failed
 * downloads are retried automatically on the next sync regardless.
 */
export async function reconcileManifest(manifest: Manifest): Promise<PlaybackItem[]> {
  const previous = await loadStoredManifest();
  const nextMeta = manifest.items.map(toMeta);
  const diff = computeManifestDiff(previous, nextMeta);

  await Promise.all(
    diff.toDelete.map(async (id) => {
      await LocalMediaStore.deleteMedia(id);
      revokeAndForget(id);
    })
  );

  const downloadResults = await Promise.all(
    diff.toDownload.map(async (meta) => {
      const original = manifest.items.find((i) => i.id === meta.id);
      if (!original) return { id: meta.id, ok: false };
      try {
        logEvent("MEDIA_DOWNLOAD_STARTED", { itemId: meta.id });
        const res = await fetch(original.url);
        if (!res.ok) throw new Error(`download failed with status ${res.status}`);
        const blob = await res.blob();
        const saved = await LocalMediaStore.saveMedia(meta.id, blob);
        if (saved) logEvent("MEDIA_DOWNLOAD_COMPLETED", { itemId: meta.id });
        return { id: meta.id, ok: saved };
      } catch (err) {
        // Never let one failed download break the sync — it's simply
        // retried on the next poll.
        logEvent("SYNC_FAILED", { itemId: meta.id, error: String(err) });
        return { id: meta.id, ok: false };
      }
    })
  );

  const failedIds = new Set(downloadResults.filter((r) => !r.ok).map((r) => r.id));
  const successfulMeta = nextMeta.filter((item) => !failedIds.has(item.id));
  await saveStoredManifest(successfulMeta);

  const resolved: PlaybackItem[] = await Promise.all(
    manifest.items.map(async (item) => ({
      ...item,
      url: await resolveLocalUrl(item),
    }))
  );

  return resolved.sort((a, b) => a.sortOrder - b.sortOrder);
}
