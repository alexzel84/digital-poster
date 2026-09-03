"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Collaborator {
  userId: string;
  email: string;
}

export function CollaboratorsList({
  screenId,
  collaborators,
}: {
  screenId: string;
  collaborators: Collaborator[];
}) {
  const router = useRouter();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function handleRemove(userId: string) {
    if (!confirm("Remove this person's access to the screen?")) return;
    setBusyUserId(userId);
    await fetch(`/api/screens/${screenId}/collaborators/${userId}`, {
      method: "DELETE",
    });
    setBusyUserId(null);
    router.refresh();
  }

  if (collaborators.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm font-medium">People with access</p>
      <ul className="mt-2 space-y-2">
        {collaborators.map((c) => (
          <li key={c.userId} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{c.email}</span>
            <button
              onClick={() => handleRemove(c.userId)}
              disabled={busyUserId === c.userId}
              className="text-xs text-red-600 underline disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
