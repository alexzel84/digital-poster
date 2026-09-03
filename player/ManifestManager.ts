import type { PlaybackItem } from "./PlaybackEngine";

export interface Manifest {
  screenId: string;
  version: number;
  items: PlaybackItem[];
}

const POLL_INTERVAL_MS = 60_000;

export type ManifestFetchResult =
  | { ok: true; manifest: Manifest }
  | { ok: false; status: number };

export async function fetchManifest(
  screenId: string,
  screenToken: string
): Promise<ManifestFetchResult> {
  try {
    const res = await fetch(`/api/screens/${screenId}/manifest`, {
      headers: { Authorization: `Bearer ${screenToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const manifest = (await res.json()) as Manifest;
    return { ok: true, manifest };
  } catch {
    // Network failure — the caller keeps playing whatever it already has.
    return { ok: false, status: 0 };
  }
}

/**
 * Polls the manifest on an interval and calls back only when the version
 * actually changes, so the player never needlessly interrupts playback for
 * no-op syncs. Architecture allows swapping this poll loop for
 * WebSockets/SSE later without touching PlaybackEngine or the component.
 */
export class ManifestManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastVersion: number | null = null;

  constructor(
    private screenId: string,
    private screenToken: string,
    private onUpdate: (manifest: Manifest) => void,
    private onAuthError: () => void,
    private onNetworkStatus: (online: boolean) => void
  ) {}

  async syncOnce(): Promise<void> {
    const result = await fetchManifest(this.screenId, this.screenToken);

    if (!result.ok) {
      if (result.status === 401) {
        this.onAuthError();
        return;
      }
      // Any other failure (network down, 5xx) — never surface an error UI
      // over the currently playing content. Just note we're offline and
      // keep going with what's already loaded.
      this.onNetworkStatus(false);
      return;
    }

    this.onNetworkStatus(true);

    if (result.manifest.version !== this.lastVersion) {
      this.lastVersion = result.manifest.version;
      this.onUpdate(result.manifest);
    }
  }

  start(): void {
    this.syncOnce();
    this.timer = setInterval(() => this.syncOnce(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
