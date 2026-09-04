"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const AUTO_START_DELAY_MS = 2000;

export function StartScreen({ onStart }: { onStart: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // TV remotes navigate via D-pad + a select/OK button, which acts like
    // Enter on whatever's currently focused. Without an explicit focus on
    // load, many TV browsers show nothing as "selected," leaving the
    // viewer with no idea which direction to press first.
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    // Commercial signage displays (e.g. Samsung's QM series) are often
    // deployed with no remote or pointer device connected at all — they
    // run unattended, controlled over the network rather than by a
    // handheld remote. On that hardware there may be no way to ever
    // produce a genuine click/keypress, so requiring one would leave
    // playback stuck forever. Auto-start after a short delay so the
    // screen never gets stuck: Fullscreen/Wake Lock are still attempted
    // via onStart() either way (calling it manually just does it sooner),
    // and both already fail silently if a gesture genuinely wasn't
    // available — see player/WakeLockManager.ts and lib/screen/fullscreen.ts.
    const timer = setTimeout(onStart, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onStart]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-black px-6 text-center text-white">
      <div>
        <p className="text-2xl font-light">Your screen is ready.</p>
        <p className="mt-1 text-white/60">Starting automatically…</p>
      </div>
      <button
        ref={buttonRef}
        onClick={onStart}
        className="rounded-xl bg-white px-8 py-3 text-base font-medium text-black outline-none ring-4 ring-transparent focus-visible:ring-blue-400"
      >
        Start now
      </button>
      <Link
        href="/help/keep-tv-awake"
        className="text-xs text-white/40 underline outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        Keep your TV awake
      </Link>
    </div>
  );
}
