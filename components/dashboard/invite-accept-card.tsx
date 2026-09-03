"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteAcceptCard({
  token,
  screenName,
}: {
  token: string;
  screenName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Couldn't accept this invite.");
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
    <>
      <p className="font-medium">You&apos;ve been invited to help manage</p>
      <p className="mt-1 text-lg font-semibold">{screenName}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        You&apos;ll be able to upload your own media to this screen and
        manage when it expires. The screen&apos;s owner keeps full control.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Joining…" : "Accept and join"}
      </button>
    </>
  );
}
