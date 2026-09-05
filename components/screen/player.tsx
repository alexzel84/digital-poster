"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PlaybackEngine, type PlaybackItem } from "@/player/PlaybackEngine";
import { ManifestManager, type Manifest } from "@/player/ManifestManager";
import { ConnectivityManager } from "@/player/ConnectivityManager";
import { WakeLockManager } from "@/player/WakeLockManager";
import { reconcileManifest } from "@/player/SyncManager";
import { clearScreenAuth } from "@/lib/screen/local-auth";
import { isMediaActive } from "@/lib/media/status";
import { enterFullscreen } from "@/lib/screen/fullscreen";
import { logEvent } from "@/lib/screen/logger";
import { StartScreen } from "@/components/screen/start-screen";

const LOCAL_EXPIRY_CHECK_MS = 30_000;

// Digital-signage best practice: a browser left running unattended for
// days can accumulate memory leaks or drift into odd states over very
// long uptimes. A periodic full reload is a cheap, standard way to
// self-heal from that. This is NOT a fix for a TV's own firmware-level
// auto-power-off (that only responds to real remote input and can't be
// influenced from a webpage at all — see /help/keep-tv-awake for the
// actual fix for that). This is purely a reliability safeguard.
const PERIODIC_RELOAD_MS = 6 * 60 * 60 * 1000; // 6 hours

export function Player({
  screenId,
  screenToken,
  onDisconnected,
}: {
  screenId: string;
  screenToken: string;
  onDisconnected: () => void;
}) {
  const engineRef = useRef<PlaybackEngine>(new PlaybackEngine());
  const wakeLockRef = useRef<WakeLockManager>(new WakeLockManager());
  const [started, setStarted] = useState(false);
  const [currentItem, setCurrentItem] = useState<PlaybackItem | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  const imageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    engineRef.current.advance();
    setCurrentItem(engineRef.current.currentItem);
  }, []);

  const handleError = useCallback((itemId: string) => {
    logEvent("MEDIA_PLAYBACK_FAILED", { itemId });
    engineRef.current.reportError(itemId);
    setCurrentItem(engineRef.current.currentItem);
  }, []);

  const handleManifestUpdate = useCallback(async (manifest: Manifest) => {
    logEvent("MANIFEST_UPDATED", { version: manifest.version, items: manifest.items.length });
    // Offline-first reconciliation: download what's new/changed into
    // LocalMediaStore, delete what's gone, and get back items resolved to
    // local blob URLs (falling back to network only if not cached yet).
    const resolvedItems = await reconcileManifest(manifest);
    engineRef.current.setItems(resolvedItems);
    setCurrentItem(engineRef.current.currentItem);
    setHasSynced(true);
  }, []);

  const handleStart = useCallback(async () => {
    // Both of these require a genuine user gesture to succeed in most
    // browsers — this button tap is that gesture. Neither is required for
    // playback to work; both fail silently if unsupported.
    await enterFullscreen();
    await wakeLockRef.current.request();
    setStarted(true);
  }, []);

  useEffect(() => {
    const wakeLock = wakeLockRef.current;
    wakeLock.start(); // sets up the visibilitychange re-request listener
    return () => {
      wakeLock.stop();
    };
  }, []);

  // Manifest sync + connectivity
  useEffect(() => {
    const manager = new ManifestManager(
      screenId,
      screenToken,
      handleManifestUpdate,
      () => {
        // Screen was disconnected server-side (dashboard "Disconnect").
        clearScreenAuth();
        onDisconnected();
      },
      (online) => {
        logEvent(online ? "NETWORK_ONLINE" : "NETWORK_OFFLINE");
      }
    );
    manager.start();

    const connectivity = new ConnectivityManager(
      () => {
        // Came back online — sync immediately rather than waiting up to
        // 60s for the next scheduled poll.
        logEvent("NETWORK_ONLINE");
        manager.syncOnce();
      },
      () => logEvent("NETWORK_OFFLINE")
    );
    connectivity.start();

    return () => {
      manager.stop();
      connectivity.stop();
    };
  }, [screenId, screenToken, onDisconnected, handleManifestUpdate]);

  // Local expiration check — independent of server reachability, per spec.
  useEffect(() => {
    const interval = setInterval(() => {
      const engine = engineRef.current;
      const now = new Date();
      for (const item of engine.getItems()) {
        if (!isMediaActive(item.expiresAt ? new Date(item.expiresAt) : null, now)) {
          logEvent("MEDIA_EXPIRED", { itemId: item.id });
          engine.removeItem(item.id);
        }
      }
      setCurrentItem(engine.currentItem);
    }, LOCAL_EXPIRY_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  // Periodic full reload — reliability safeguard, not a power-management
  // feature. See the constant's comment above for why this exists.
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.reload();
    }, PERIODIC_RELOAD_MS);
    return () => clearTimeout(timer);
  }, []);

  // Image auto-advance timer
  useEffect(() => {
    if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
    if (currentItem?.type === "image") {
      logEvent("MEDIA_PLAYBACK_STARTED", { itemId: currentItem.id, type: "image" });
      const seconds = currentItem.duration ?? 8;
      imageTimerRef.current = setTimeout(advance, seconds * 1000);
    }
    return () => {
      if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
    };
  }, [currentItem, advance]);

  if (!started) {
    return <StartScreen onStart={handleStart} />;
  }

  if (!hasSynced) {
    return <div className="h-full w-full bg-black" />;
  }

  if (!currentItem) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center text-white">
        <p className="text-2xl font-light">Your screen is ready.</p>
        <p className="text-lg text-white/60">Upload your first poster.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full cursor-none bg-black">
      {currentItem.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={currentItem.id}
          src={currentItem.url}
          alt=""
          className="h-full w-full object-contain"
          onError={() => handleError(currentItem.id)}
          onLoad={() =>
            logEvent("MEDIA_PLAYBACK_STARTED", { itemId: currentItem.id, type: "image" })
          }
        />
      ) : (
        <video
          key={currentItem.id}
          src={currentItem.url}
          className="h-full w-full object-contain"
          autoPlay
          muted
          playsInline
          onEnded={advance}
          onError={() => handleError(currentItem.id)}
          onPlay={() =>
            logEvent("MEDIA_PLAYBACK_STARTED", { itemId: currentItem.id, type: "video" })
          }
        />
      )}
    </div>
  );
}
