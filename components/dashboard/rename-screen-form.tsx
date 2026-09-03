"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RenameScreenForm({
  screenId,
  initialName,
}: {
  screenId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screens/${screenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't rename screen");
        setLoading(false);
        return;
      }
      setLoading(false);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xl font-semibold tracking-tight underline decoration-transparent underline-offset-4 hover:decoration-current"
        title="Rename screen"
      >
        {initialName}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setName(initialName);
            setEditing(false);
          }
        }}
        className="rounded-lg border border-border px-2 py-1 text-xl font-semibold tracking-tight"
      />
      <button
        onClick={handleSave}
        disabled={loading}
        className="text-sm font-medium underline"
      >
        Save
      </button>
      <button
        onClick={() => {
          setName(initialName);
          setEditing(false);
          setError(null);
        }}
        className="text-sm text-muted-foreground"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
