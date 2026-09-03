"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareScreenButton({ screenId }: { screenId: string }) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screens/${screenId}/invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create an invite link");
        setLoading(false);
        return;
      }
      setInviteUrl(data.inviteUrl);
      setLoading(false);
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — the link is still visible to copy manually
    }
  }

  if (!inviteUrl) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
          {loading ? "Creating link…" : "Share screen"}
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-muted p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Send this link to someone — they can create an account (or log in) and
        start adding their own media to this screen. Expires in 7 days.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          readOnly
          value={inviteUrl}
          className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1 text-xs"
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={handleCopy}
          className="shrink-0 rounded border border-border px-2 py-1 text-xs font-medium"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
