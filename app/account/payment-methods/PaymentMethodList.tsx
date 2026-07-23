"use client";

import { useRouter } from "next/navigation";
import { deleteSavedPaymentMethod, setDefaultPaymentMethod, type SavedPaymentMethodRow } from "@/actions/payment-methods";

export function PaymentMethodList({ initial }: { initial: SavedPaymentMethodRow[] }) {
  const router = useRouter();

  return (
    <div className="map-card" style={{ padding: "6px 16px" }}>
      {initial.map((m) => (
        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
              {m.cardType ?? "Card"} •••• {m.last4} {m.isDefault && <span className="age-pill" style={{ marginLeft: 6 }}>Default</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{m.bank}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!m.isDefault && (
              <button type="button" className="btn btn-ghost btn-small" onClick={async () => { await setDefaultPaymentMethod(m.id); router.refresh(); }}>
                Make default
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-small" onClick={async () => { await deleteSavedPaymentMethod(m.id); router.refresh(); }}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
