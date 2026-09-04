"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { loadGoogleMaps } from "@/lib/screen/load-google-maps";

export function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = "Address",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current || autocompleteRef.current) return;

        const autocomplete = new window.google!.maps.places.Autocomplete(
          inputRef.current,
          { types: ["address"] }
        );
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          onChange(place.formatted_address ?? inputRef.current?.value ?? "");
        });
        autocompleteRef.current = autocomplete;
      })
      .catch(() => {
        // No API key configured, or the script failed to load — the
        // plain <Input> below still works fine as a normal text field,
        // just without suggestions. Nothing else to do here.
      });

    return () => {
      cancelled = true;
    };
  }, [onChange]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="street-address"
      className={className}
    />
  );
}
