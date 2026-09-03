"use client";

import { useState } from "react";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked (permissions, non-HTTPS context) —
      // not worth surfacing an error for a nice-to-have convenience button.
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="font-mono text-sm font-medium text-foreground underline decoration-dotted"
      title="Copy code"
    >
      {code}
      {copied && <span className="ml-1.5 text-xs text-muted-foreground">Copied</span>}
    </button>
  );
}
