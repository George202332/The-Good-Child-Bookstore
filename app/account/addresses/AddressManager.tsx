"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAddress, deleteAddress, setDefaultAddress, type AddressRow } from "@/actions/addresses";

export function AddressManager({ initial }: { initial: AddressRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [line, setLine] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await addAddress({ label, line, city, country });
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setLabel("");
    setLine("");
    setCity("");
    setCountry("");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleAdd} className="form-section" style={{ background: "var(--cream)" }}>
        <label className="field-label" htmlFor="addr-label">Label <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span></label>
        <input className="field" id="addr-label" type="text" placeholder="Home" value={label} onChange={(e) => setLabel(e.target.value)} />
        <label className="field-label" htmlFor="addr-line">Street address</label>
        <input className="field" id="addr-line" type="text" required value={line} onChange={(e) => setLine(e.target.value)} />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="addr-city">City</label>
            <input className="field" id="addr-city" type="text" required value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="addr-country">Country</label>
            <input className="field" id="addr-country" type="text" required value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
        {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
        <button type="submit" className="btn btn-primary btn-small">Add address</button>
      </form>

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Your addresses</h3>
      {initial.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No addresses saved yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {initial.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {a.label} {a.isDefault && <span className="age-pill" style={{ marginLeft: 6 }}>Default</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{a.line}, {a.city}, {a.country}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!a.isDefault && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={isPending}
                    onClick={() => startTransition(async () => { await setDefaultAddress(a.id); router.refresh(); })}
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await deleteAddress(a.id); router.refresh(); })}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
