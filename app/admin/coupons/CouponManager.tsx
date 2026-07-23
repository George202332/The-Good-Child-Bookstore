"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCoupon, deleteCoupon, type CouponRow } from "@/actions/coupons";

export function CouponManager({ initial }: { initial: CouponRow[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState(10);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await createCoupon({ code, percentOff, expiresAt: expiresAt || undefined });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setCode("");
    setPercentOff(10);
    setExpiresAt("");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleCreate} className="form-section" style={{ background: "var(--cream)" }}>
        <label className="field-label" htmlFor="coupon-code">Code</label>
        <input className="field" id="coupon-code" type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SUMMER20" />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="coupon-pct">Percent off</label>
            <input className="field" id="coupon-pct" type="number" min={1} max={100} required value={percentOff} onChange={(e) => setPercentOff(Number(e.target.value))} />
          </div>
          <div>
            <label className="field-label" htmlFor="coupon-expiry">Expires <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span></label>
            <input className="field" id="coupon-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? "Creating…" : "Create coupon"}
        </button>
      </form>

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Active coupons</h3>
      {initial.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No coupons yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {initial.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.code}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {c.percentOff}% off{c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={async () => {
                  await deleteCoupon(c.id);
                  router.refresh();
                }}
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
