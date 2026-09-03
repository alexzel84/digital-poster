"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const AUTO_START_DELAY_MS = 2000;

export function StartScreen({ onStart }: { onStart: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    // Commercial signage displays (e.g. Samsung's QM series) are often
    // deployed with no remote or pointer device connected at all — they
    // run unattended, controlled over the network rather than by a
    // handheld remote. Auto-start after a short delay so the screen never
    // gets stuck waiting for a click that can never happen. Fullscreen/
    // Wake Lock are still attempted via onStart() either way, and both
    // already fail silently if a gesture genuinely wasn't available.
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