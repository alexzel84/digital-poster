"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface LinkedScreen {
  id: string;
  name: string;
}

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
  linkedScreens: LinkedScreen[]; // every screen this item is attached to, including the current one
  duplicateSiblingScreens: LinkedScreen[]; // other screens with an independent duplicate of this same content
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
  otherScreens,
}: {
  screenId: string;
  initialItems: MediaListItem[];
  isOwner: boolean;
  currentUserId: string;
  otherScreens: LinkedScreen[];
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

  async function handleDelete(id: string, linkedScreens: LinkedScreen[]) {
    const isOnlyScreen = linkedScreens.length <= 1;
    const confirmMessage = isOnlyScreen
      ? "Delete this media item? This can't be undone."
      : `Remove this item from this screen? It's also on ${linkedScreens.length - 1} other screen(s), where it will stay — this only removes it here.`;
    if (!confirm(confirmMessage)) return;

    setBusyId(id);
    setErrorId(null);
    try {
      const res = await fetch(`/api/media/${id}/screens/${screenId}`, {
        method: "DELETE",
      });
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
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 120) {
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

  async function handleLinkScreen(mediaId: string, targetScreenId: string) {
    if (!targetScreenId) return;
    setBusyId(mediaId);
    setErrorId(null);
    try {
      const res = await fetch(`/api/media/${mediaId}/screens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenId: targetScreenId }),
      });
      if (!res.ok) {
        setErrorId(mediaId);
        setBusyId(null);
        return;
      }
      const target = otherScreens.find((s) => s.id === targetScreenId);
      setItems((prev) =>
        prev.map((item) =>
          item.id === mediaId && target
            ? { ...item, linkedScreens: [...item.linkedScreens, target] }
            : item
        )
      );
      setBusyId(null);
      router.refresh();
    } catch {
      setErrorId(mediaId);
      setBusyId(null);
    }
  }

  async function handleUnlinkScreen(mediaId: string, targetScreenId: string) {
    setBusyId(mediaId);
    setErrorId(null);
    try {
      const res = await fetch(`/api/media/${mediaId}/screens/${targetScreenId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setErrorId(mediaId);
        setBusyId(null);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === mediaId
            ? {
                ...item,
                linkedScreens: item.linkedScreens.filter((s) => s.id !== targetScreenId),
              }
            : item
        )
      );
      setBusyId(null);
      router.refresh();
    } catch {
      setErrorId(mediaId);
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
        const otherLinkedScreens = item.linkedScreens.filter((s) => s.id !== screenId);
        const linkableScreens = otherScreens.filter(
          (s) =>
            !item.linkedScreens.some((linked) => linked.id === s.id) &&
            !item.duplicateSiblingScreens.some((sibling) => sibling.id === s.id)
        );

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
                        max={120}
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

                {isOwner && (
                  <div className="space-y-1">
                    {otherLinkedScreens.length > 0 && (
                      <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                        <span>Also on:</span>
                        {otherLinkedScreens.map((s, i) => (
                          <span key={s.id}>
                            {s.name}
                            <button
                              onClick={() => handleUnlinkScreen(item.id, s.id)}
                              disabled={busyId === item.id}
                              className="ml-1 text-red-600 underline disabled:opacity-50"
                              title={`Remove from ${s.name}`}
                            >
                              remove
                            </button>
                            {i < otherLinkedScreens.length - 1 ? "," : ""}
                          </span>
                        ))}
                      </p>
                    )}
                    {item.duplicateSiblingScreens.length > 0 && (
                      <p className="text-xs text-muted-foreground/70">
                        Also duplicated to:{" "}
                        {item.duplicateSiblingScreens.map((s) => s.name).join(", ")}
                      </p>
                    )}
                    {linkableScreens.length > 0 && (
                      <select
                        defaultValue=""
                        disabled={busyId === item.id}
                        onChange={(e) => {
                          handleLinkScreen(item.id, e.target.value);
                          e.target.value = "";
                        }}
                        className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        <option value="" disabled>
                          + Also show on…
                        </option>
                        {linkableScreens.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
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
                onClick={() => handleDelete(item.id, item.linkedScreens)}
              >
                {item.linkedScreens.length > 1 ? "Remove" : "Delete"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
