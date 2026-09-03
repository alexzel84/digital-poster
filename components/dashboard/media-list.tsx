"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface MediaListItem {
  id: string;
  filename: string;
  type: "image" | "video";
  durationSeconds: number | null;
  imageDurationSeconds: number | null;
  expiresAt: string | null; // ISO string
  sortOrder: number;
  thumbnailUrl: string | null;
  uploaderUserId: string;
  uploaderEmail: string;
}

function statusFor(expiresAt: string | null): { label: string; className: string } {
  if (!expiresAt) return { label: "Never expires", className: "text-muted-foreground" };
  const expired = new Date(expiresAt).getTime() <= Date.now();
  return expired
    ? { label: "Expired", className: "text-red-600" }
    : { label: `Expires ${new Date(expiresAt).toLocaleDateString()}`, className: "text-muted-foreground" };
}

export function MediaList({
  screenId,
  initialItems,
  isOwner,
  currentUserId,
}: {
  screenId: string;
  initialItems: MediaListItem[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(
    [...initialItems].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function persistOrder(next: MediaListItem[]) {
    const previous = items;
    setItems(next);
    try {
      const res = await fetch(`/api/screens/${screenId}/media/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: next.map((item, index) => ({ mediaId: item.id, sortOrder: index })),
        }),
      });
      if (!res.ok) {
        setItems(previous); // roll back the optimistic reorder
        return;
      }
      router.refresh();
    } catch {
      setItems(previous);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    persistOrder(next);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this media item? This can't be undone.")) return;
    setBusyId(id);
    setErrorId(null);
    try {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setErrorId(id);
        setBusyId(null);
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setBusyId(null);
      router.refresh();
    } catch {
      setErrorId(id);
      setBusyId(null);
    }
  }

  async function handleExpirationSave(id: string, dateValue: string) {
    setBusyId(id);
    setErrorId(null);
    const expiresAt = dateValue ? new Date(`${dateValue}T23:59:59Z`).toISOString() : null;
    try {
      const res = await fetch(`/api/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt }),
      });
      if (!res.ok) {
        setErrorId(id);
        setBusyId(null);
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, expiresAt } : item))
      );
      setBusyId(null);
      setEditingId(null);
      router.refresh();
    } catch {
      setErrorId(id);
      setBusyId(null);
    }
  }

  async function handleDurationSave(id: string, seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 300) {
      setErrorId(id);
      return;
    }
    setBusyId(id);
    setErrorId(null);
    try {
      const res = await fetch(`/api/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDurationSeconds: seconds }),
      });
      if (!res.ok) {
        setErrorId(id);
        setBusyId(null);
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, imageDurationSeconds: seconds } : item))
      );
      setBusyId(null);
      setEditingDurationId(null);
      router.refresh();
    } catch {
      setErrorId(id);
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No media yet — uploads will show up here and start playing automatically.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const status = statusFor(item.expiresAt);
        const canManage = isOwner || item.uploaderUserId === currentUserId;

        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {item.type === "image" && item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {item.type === "video" ? "▶" : "🖼"}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.filename}</p>
              {isOwner && item.uploaderUserId !== currentUserId && (
                <p className="text-xs text-muted-foreground/70">
                  Added by {item.uploaderEmail}
                </p>
              )}

              <div className="mt-1 space-y-2">
                {item.type === "image" ? (
                  editingDurationId === item.id ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">image ·</span>
                      <input
                        type="number"
                        min={1}
                        max={300}
                        defaultValue={item.imageDurationSeconds ?? 8}
                        className="w-16 rounded border border-border px-1.5 py-0.5"
                        id={`dur-${item.id}`}
                      />
                      <span className="text-muted-foreground">sec</span>
                      <button
                        className="font-medium underline"
                        onClick={() => {
                          const el = document.getElementById(
                            `dur-${item.id}`
                          ) as HTMLInputElement | null;
                          handleDurationSave(item.id, Number(el?.value));
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="text-muted-foreground"
                        onClick={() => setEditingDurationId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : canManage ? (
                    <button
                      className="block text-xs text-muted-foreground underline decoration-dotted"
                      onClick={() => setEditingDurationId(item.id)}
                    >
                      image · {item.imageDurationSeconds ?? 8}s
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      image · {item.imageDurationSeconds ?? 8}s
                    </p>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">
                    video {item.durationSeconds ? `· ${item.durationSeconds}s` : ""}
                  </p>
                )}

                {editingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      defaultValue={item.expiresAt ? item.expiresAt.slice(0, 10) : ""}
                      className="rounded border border-border px-2 py-1 text-xs"
                      onChange={(e) => (e.target.dataset.value = e.target.value)}
                      id={`exp-${item.id}`}
                    />
                    <button
                      className="text-xs font-medium underline"
                      onClick={() => {
                        const el = document.getElementById(
                          `exp-${item.id}`
                        ) as HTMLInputElement | null;
                        handleExpirationSave(item.id, el?.value ?? "");
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="text-xs text-muted-foreground underline"
                      onClick={() => handleExpirationSave(item.id, "")}
                    >
                      Never expires
                    </button>
                    <button
                      className="text-xs text-muted-foreground"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : canManage ? (
                  <button
                    className={`block text-xs underline ${status.className}`}
                    onClick={() => setEditingId(item.id)}
                  >
                    {status.label}
                  </button>
                ) : (
                  <p className={`text-xs ${status.className}`}>{status.label}</p>
                )}
              </div>

              {errorId === item.id && (
                <p className="mt-1 text-xs text-red-600">
                  That didn&apos;t work — please try again.
                </p>
              )}
            </div>

            {isOwner && (
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded border border-border px-1.5 text-xs disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  aria-label="Move down"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded border border-border px-1.5 text-xs disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            )}

            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === item.id}
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
