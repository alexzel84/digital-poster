"use client";

import { useEffect } from "react";

export default function ScreenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ScreenError] unexpected crash", error);
  }, [error]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black text-center text-white">
      <p className="text-lg font-light text-white/70">
        Something went wrong. Reconnecting shortly…
      </p>
      <button
        onClick={reset}
        className="rounded-xl border border-white/20 px-6 py-2 text-sm text-white/70"
      >
        Try again
      </button>
    </div>
  );
}
