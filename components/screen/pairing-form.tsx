"use client";

import { useState } from "react";
import { setScreenAuth, type ScreenAuth } from "@/lib/screen/local-auth";
import { normalizePairingCode } from "@/lib/screen/pairing-code";

export function PairingForm({
  onPaired,
}: {
  onPaired: (auth: ScreenAuth) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/screens/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingCode: normalizePairingCode(code) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      const auth: ScreenAuth = {
        screenId: data.screenId,
        screenName: data.screenName,
        screenToken: data.screenToken,
      };
      setScreenAuth(auth);
      onPaired(auth);
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-black px-6 text-white">
      <div className="text-center">
        <p className="text-sm font-medium tracking-[0.3em] text-white/50">
          POSTERDECK
        </p>
        <h1 className="mt-3 text-3xl font-light">Connect this screen</h1>
        <p className="mt-2 text-white/60">Enter the code shown in your dashboard</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col items-center gap-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="K7P4-X9"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={10}
          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-center text-2xl tracking-widest text-white placeholder:text-white/30 focus:border-white/50 focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.trim().length < 6}
          className="w-full rounded-xl bg-white px-4 py-3 text-base font-medium text-black transition-opacity disabled:opacity-40"
        >
          {loading ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
