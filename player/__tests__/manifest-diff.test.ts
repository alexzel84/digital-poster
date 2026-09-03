import { describe, it, expect } from "vitest";
import { computeManifestDiff, type ManifestMediaMeta } from "@/player/manifest-diff";

function meta(overrides: Partial<ManifestMediaMeta> = {}): ManifestMediaMeta {
  return {
    id: "a",
    type: "image",
    hash: "hash-a",
    duration: 8,
    expiresAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe("computeManifestDiff", () => {
  it("an unchanged manifest produces no downloads or deletes", () => {
    const items = [meta({ id: "a" }), meta({ id: "b", hash: "hash-b" })];
    const diff = computeManifestDiff(items, items);
    expect(diff.toDownload).toEqual([]);
    expect(diff.toDelete).toEqual([]);
    expect(diff.unchanged.sort()).toEqual(["a", "b"]);
  });

  it("detects new media not present before", () => {
    const previous = [meta({ id: "a" })];
    const next = [meta({ id: "a" }), meta({ id: "b", hash: "hash-b" })];
    const diff = computeManifestDiff(previous, next);
    expect(diff.toDownload.map((i) => i.id)).toEqual(["b"]);
    expect(diff.toDelete).toEqual([]);
  });

  it("detects deleted media no longer in the manifest", () => {
    const previous = [meta({ id: "a" }), meta({ id: "b", hash: "hash-b" })];
    const next = [meta({ id: "a" })];
    const diff = computeManifestDiff(previous, next);
    expect(diff.toDownload).toEqual([]);
    expect(diff.toDelete).toEqual(["b"]);
  });

  it("detects changed media via a different hash for the same id", () => {
    const previous = [meta({ id: "a", hash: "old-hash" })];
    const next = [meta({ id: "a", hash: "new-hash" })];
    const diff = computeManifestDiff(previous, next);
    expect(diff.toDownload.map((i) => i.id)).toEqual(["a"]);
    expect(diff.toDelete).toEqual([]);
    expect(diff.unchanged).toEqual([]);
  });

  it("handles a mix of new, deleted, changed, and unchanged in one diff", () => {
    const previous = [
      meta({ id: "unchanged", hash: "h1" }),
      meta({ id: "changed", hash: "old" }),
      meta({ id: "deleted", hash: "h3" }),
    ];
    const next = [
      meta({ id: "unchanged", hash: "h1" }),
      meta({ id: "changed", hash: "new" }),
      meta({ id: "new-item", hash: "h4" }),
    ];
    const diff = computeManifestDiff(previous, next);
    expect(diff.toDownload.map((i) => i.id).sort()).toEqual(["changed", "new-item"]);
    expect(diff.toDelete).toEqual(["deleted"]);
    expect(diff.unchanged).toEqual(["unchanged"]);
  });

  it("treats an empty next manifest as deleting everything", () => {
    const previous = [meta({ id: "a" }), meta({ id: "b" })];
    const diff = computeManifestDiff(previous, []);
    expect(diff.toDelete.sort()).toEqual(["a", "b"]);
    expect(diff.toDownload).toEqual([]);
  });

  it("treats an empty previous store as downloading everything", () => {
    const next = [meta({ id: "a" }), meta({ id: "b" })];
    const diff = computeManifestDiff([], next);
    expect(diff.toDownload.map((i) => i.id).sort()).toEqual(["a", "b"]);
    expect(diff.toDelete).toEqual([]);
  });
});
