"use client";

import { useState, useTransition } from "react";
import { getOrCreateAffiliateLink } from "@/actions/affiliate";

export function GetLinkButton({ bookId }: { bookId: string }) {
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (code) {
    const url = typeof window !== "undefined" ? `${window.location.origin}/book/${bookId}?ref=${code}` : `/book/${bookId}?ref=${code}`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <code style={{ fontSize: 11.5 }}>{url}</code>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => navigator.clipboard.writeText(url)}>Copy</button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary btn-small"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await getOrCreateAffiliateLink(bookId);
            if (!res.ok) setError(res.error ?? "Failed");
            else setCode(res.code ?? null);
          })
        }
      >
        {isPending ? "Generating…" : "Get link"}
      </button>
      {error && <div style={{ fontSize: 11.5, color: "var(--coral-deep)" }}>{error}</div>}
    </div>
  );
}
