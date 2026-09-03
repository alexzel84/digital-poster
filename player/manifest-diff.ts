export interface ManifestMediaMeta {
  id: string;
  type: "image" | "video";
  hash: string;
  duration: number | null;
  expiresAt: string | null;
  sortOrder: number;
}

export interface ManifestDiff {
  toDownload: ManifestMediaMeta[]; // new items, or existing items whose hash changed
  toDelete: string[]; // ids present locally but no longer in the new manifest
  unchanged: string[]; // ids present in both with a matching hash — skip re-download
}

/**
 * Pure diff between what's stored locally and what the latest manifest
 * says should exist. No I/O — SyncManager is what actually acts on this.
 */
export function computeManifestDiff(
  previous: ManifestMediaMeta[],
  next: ManifestMediaMeta[]
): ManifestDiff {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));

  const toDownload: ManifestMediaMeta[] = [];
  const unchanged: string[] = [];

  for (const item of next) {
    const prev = previousById.get(item.id);
    if (!prev || prev.hash !== item.hash) {
      toDownload.push(item);
    } else {
      unchanged.push(item.id);
    }
  }

  const toDelete = previous
    .filter((item) => !nextIds.has(item.id))
    .map((item) => item.id);

  return { toDownload, toDelete, unchanged };
}
