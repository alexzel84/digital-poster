"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteScreenButton({
  screenId,
  screenName,
}: {
  screenId: string;
  screenName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${screenName}" permanently? This removes the screen, any media only used by it, and can't be undone.`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screens/${screenId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't delete screen");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-xs text-red-600 underline disabled:opacity-50"
      >
        {loading ? "Deleting…" : "Delete screen"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
