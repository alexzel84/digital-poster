"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateScreenForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/screens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        address: address.trim() || undefined,
        businessType: businessType.trim() || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't create screen");
      return;
    }

    setName("");
    setAddress("");
    setBusinessType("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Connect a screen</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-end gap-2">
      <Input
        autoFocus
        placeholder="Screen name, e.g. MAINWOOD Lobby"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 w-64"
      />
      <Input
        placeholder="Address (optional)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="h-11 w-64"
      />
      <Input
        placeholder="Type of business (optional), e.g. Yoga studio"
        value={businessType}
        onChange={(e) => setBusinessType(e.target.value)}
        className="h-11 w-64"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={loading || !name.trim()}>
          {loading ? "Creating…" : "Create"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
