"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign, deleteCampaign, type CampaignRow } from "@/actions/campaigns";

export function CampaignManager({ initial }: { initial: CampaignRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await createCampaign(name);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleCreate} className="form-section" style={{ background: "var(--cream)" }}>
        <label className="field-label" htmlFor="campaign-name">New campaign name</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="field" id="campaign-name" type="text" style={{ marginBottom: 0 }} placeholder="e.g. Back to school 2026" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
        {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      </form>

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Your campaigns</h3>
      {initial.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          No campaigns yet — create one above, then assign it to a referral link at Referral Links.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {initial.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {c.linkCount} link{c.linkCount === 1 ? "" : "s"} · {c.clicks} clicks · {c.conversions} sales
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={async () => { await deleteCampaign(c.id); router.refresh(); }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
