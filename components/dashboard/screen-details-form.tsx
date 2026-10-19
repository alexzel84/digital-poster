"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocompleteInput } from "@/components/dashboard/address-autocomplete-input";

function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
      "timeZone"
    ) ?? [];
  } catch {
    zones = [];
  }
  const set = new Set(["UTC", ...zones, current]);
  return [...set].sort();
}

export function ScreenDetailsForm({
  screenId,
  initialAddress,
  initialBusinessType,
  initialTimezone,
}: {
  screenId: string;
  initialAddress: string | null;
  initialBusinessType: string | null;
  initialTimezone: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(initialAddress ?? "");
  const [businessType, setBusinessType] = useState(initialBusinessType ?? "");
  const [timezone, setTimezone] = useState(initialTimezone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screens/${screenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim() || null,
          businessType: businessType.trim() || null,
          timezone,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't save");
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
    const hasDetails = initialAddress || initialBusinessType;
    return (
      <div className="mt-1">
        <button
          onClick={() => setEditing(true)}
          className="block text-sm text-muted-foreground underline decoration-dotted"
        >
          {hasDetails
            ? [initialBusinessType, initialAddress].filter(Boolean).join(" · ")
            : "Add address / business type"}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="mt-0.5 block text-xs text-muted-foreground/70 underline decoration-dotted"
        >
          Time zone: {initialTimezone}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-col items-start gap-2 text-sm">
      <input
        value={businessType}
        onChange={(e) => setBusinessType(e.target.value)}
        placeholder="Type of business, e.g. Yoga studio"
        className="w-64 rounded border border-border px-2 py-1 text-sm"
      />
      <AddressAutocompleteInput
        value={address}
        onChange={setAddress}
        placeholder="Address"
        className="w-64 rounded border border-border px-2 py-1 text-sm"
      />
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Time zone (schedules use this)
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-64 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
        >
          {timeZoneOptions(initialTimezone).map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button onClick={handleSave} disabled={loading} className="font-medium underline">
          Save
        </button>
        <button
          onClick={() => {
            setAddress(initialAddress ?? "");
            setBusinessType(initialBusinessType ?? "");
            setTimezone(initialTimezone);
            setEditing(false);
            setError(null);
          }}
          className="text-muted-foreground"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
