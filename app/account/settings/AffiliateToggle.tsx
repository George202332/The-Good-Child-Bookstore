"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enableReaderAffiliateAccess, disableReaderAffiliateAccess } from "@/actions/reader-affiliate";

export function AffiliateToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const next = !enabled;
    startTransition(async () => {
      const res = next ? await enableReaderAffiliateAccess() : await disableReaderAffiliateAccess();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setEnabled(next);
        router.refresh();
      }
    });
  }

  return (
    <div className="form-section" style={{ background: "var(--cream)", marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Affiliate feature</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, margin: 0, maxWidth: 480 }}>
            {enabled
              ? "Active — referrals, promotions, and their analytics and payouts are available in your sidebar."
              : "Off — turn this on to start earning commission by referring authors and promoting books, no separate account needed."}
          </p>
          {error && <p style={{ color: "var(--coral-deep)", fontSize: 12.5, marginTop: 6 }}>{error}</p>}
        </div>
        <button type="button" className={`btn btn-small ${enabled ? "btn-ghost" : "btn-primary"}`} disabled={isPending} onClick={toggle}>
          {isPending ? "Working…" : enabled ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}
