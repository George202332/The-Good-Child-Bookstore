"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enableReaderAffiliateAccess } from "@/actions/reader-affiliate";

/** Converted from the "Become an affiliate" CTA in accountHTML()'s reader
 * branch (the-good-child-bookstore_54_1.html) — enables real affiliate
 * capability on the same account, no separate signup. */
export function EnableAffiliateBanner() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="form-section" style={{ background: "var(--cream)", marginBottom: 34 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Become an affiliate</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, margin: 0, maxWidth: 480 }}>
            Earn commission by sharing books and referring other readers and authors, no separate account needed.
          </p>
          {error && <p style={{ color: "var(--coral-deep)", fontSize: 12.5, marginTop: 6 }}>{error}</p>}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await enableReaderAffiliateAccess();
              if (!res.ok) setError(res.error ?? "Something went wrong.");
              else router.refresh();
            })
          }
        >
          {isPending ? "Enabling…" : "Enable affiliate access"}
        </button>
      </div>
    </div>
  );
}
