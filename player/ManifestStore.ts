import type { ManifestMediaMeta } from "./manifest-diff";

const DB_NAME = "digital-poster";
const DB_VERSION = 1;
const STORE_NAME = "manifest";
const KEY = "items";

function isSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remembers which media items (by id + hash) were successfully synced
 * last time, so a reload doesn't force a full re-download of everything
 * already sitting in LocalMediaStore.
 */
export async function loadStoredManifest(): Promise<ManifestMediaMeta[]> {
  if (!isSupported()) return [];
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(KEY);
      req.onsuccess = () => resolve((req.result as ManifestMediaMeta[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[ManifestStore] loadStoredManifest failed", err);
    return [];
  }
}

export async function saveStoredManifest(items: ManifestMediaMeta[]): Promise<void> {
  if (!isSupported()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(items, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[ManifestStore] saveStoredManifest failed", err);
  }
}
