"use client";

import { useState } from "react";

export function CopyLinkButton({ text, label = "Copy Link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can fail (permissions, non-secure context) — fail silently, nothing to recover from here.
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-small"
      onClick={handleCopy}
      style={{ whiteSpace: "nowrap", padding: "6px 14px" }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
