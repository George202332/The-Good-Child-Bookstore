"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addWiseRecipient, deleteWiseRecipient, setDefaultWiseRecipient, type WiseRecipientRow, type AddRecipientInput } from "@/actions/wise-recipients";

const CURRENCY_PRESETS: Record<AddRecipientInput["type"], string> = { mpesa: "KES", bank: "USD", email: "USD" };

export function RecipientManager({ initial }: { initial: WiseRecipientRow[] }) {
  const router = useRouter();
  const [type, setType] = useState<AddRecipientInput["type"]>("mpesa");
  const [currency, setCurrency] = useState(CURRENCY_PRESETS.mpesa);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleTypeChange(next: AddRecipientInput["type"]) {
    setType(next);
    setCurrency(CURRENCY_PRESETS[next]);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const details: Record<string, string> =
      type === "mpesa" ? { phoneNumber } : type === "bank" ? { accountNumber, iban } : { email };

    const res = await addWiseRecipient({ type, currency, accountHolderName, details });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setAccountHolderName("");
    setPhoneNumber("");
    setAccountNumber("");
    setIban("");
    setEmail("");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleAdd} className="form-section" style={{ background: "var(--cream)" }}>
        <label className="field-label" htmlFor="recipient-type">Payout method</label>
        <select className="field" id="recipient-type" value={type} onChange={(e) => handleTypeChange(e.target.value as AddRecipientInput["type"])}>
          <option value="mpesa">M-Pesa (mobile money)</option>
          <option value="bank">Bank transfer</option>
          <option value="email">Email-based account</option>
        </select>

        <label className="field-label" htmlFor="recipient-name">Account holder name</label>
        <input className="field" id="recipient-name" type="text" required value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />

        <label className="field-label" htmlFor="recipient-currency">Currency</label>
        <input className="field" id="recipient-currency" type="text" required value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />

        {type === "mpesa" && (
          <>
            <label className="field-label" htmlFor="recipient-phone">M-Pesa phone number</label>
            <input className="field" id="recipient-phone" type="tel" required placeholder="+254 7XX XXX XXX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </>
        )}
        {type === "bank" && (
          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="recipient-account">Account number</label>
              <input className="field" id="recipient-account" type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="recipient-iban">IBAN / sort code</label>
              <input className="field" id="recipient-iban" type="text" value={iban} onChange={(e) => setIban(e.target.value)} />
            </div>
          </div>
        )}
        {type === "email" && (
          <>
            <label className="field-label" htmlFor="recipient-email">Wise account email</label>
            <input className="field" id="recipient-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </>
        )}

        {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? "Adding…" : "Add payout method"}
        </button>
      </form>

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Your payout methods</h3>
      {initial.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No payout methods added yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {initial.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {r.accountHolderName} {r.isDefault && <span className="age-pill" style={{ marginLeft: 6 }}>Default</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {r.type === "mpesa" ? `M-Pesa · ${r.details.phoneNumber}` : r.type === "bank" ? `Bank · ${r.details.accountNumber}` : `Email · ${r.details.email}`} ({r.currency})
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!r.isDefault && (
                  <button type="button" className="btn btn-ghost btn-small" onClick={async () => { await setDefaultWiseRecipient(r.id); router.refresh(); }}>
                    Make default
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-small" onClick={async () => { await deleteWiseRecipient(r.id); router.refresh(); }}>
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
