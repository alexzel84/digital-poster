"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DuplicateScreenButton({
  screenId,
  screenName,
}: {
  screenId: string;
  screenName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDuplicate() {
    const name = prompt(
      "Name for the new screen:",
      `${screenName} (Copy)`
    );
    if (name === null) return; // cancelled

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screens/${screenId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't duplicate screen");
        setLoading(false);
        return;
      }
      router.push(`/dashboard/screens/${data.screenId}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDuplicate}
        disabled={loading}
        className="text-xs text-muted-foreground underline disabled:opacity-50"
      >
        {loading ? "Duplicating…" : "Duplicate to a new screen"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
