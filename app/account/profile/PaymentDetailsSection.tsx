"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addWiseRecipient, deleteWiseRecipient, setDefaultWiseRecipient, type WiseRecipientRow } from "@/actions/wise-recipients";

/**
 * Payment Details — moved here from Payout Settings per explicit
 * instruction. Presents the 3 real payout methods (PayPal, Bank
 * transfer, M-Pesa) as toggle cards rather than an open-ended add/remove
 * list: exactly one is active at a time, and whichever one is toggled
 * on is the method actually used when the automatic monthly payout runs
 * (same underlying WiseRecipient.isDefault this app already used, just
 * a simpler 3-option interface on top of it instead of an unlimited
 * recipient manager).
 */
function Toggle({ type, on, savingType, onActivate }: { type: "email" | "bank" | "mpesa"; on: boolean; savingType: string | null; onActivate: (t: "email" | "bank" | "mpesa") => void }) {
  return (
    <label className="toggle-row" style={{ marginBottom: 0 }}>
      <span className="toggle-switch">
        <input type="checkbox" checked={on} disabled={savingType === type} onChange={() => { if (!on) onActivate(type); }} />
        <span className="toggle-slider" />
      </span>
      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{on ? "Active for payouts" : "Use this method"}</span>
    </label>
  );
}

export function PaymentDetailsSection({ initial }: { initial: WiseRecipientRow[] }) {
  const router = useRouter();
  const paypal = initial.find((r) => r.type === "email");
  const bank = initial.find((r) => r.type === "bank");
  const mpesa = initial.find((r) => r.type === "mpesa");
  const active = initial.find((r) => r.isDefault)?.type;

  const [savingType, setSavingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [paypalEmail, setPaypalEmail] = useState((paypal?.details.email as string) ?? "");
  const [paypalName, setPaypalName] = useState(paypal?.accountHolderName ?? "");

  const [bankName, setBankName] = useState(bank?.accountHolderName ?? "");
  const [bankAccount, setBankAccount] = useState((bank?.details.accountNumber as string) ?? "");
  const [bankIban, setBankIban] = useState((bank?.details.iban as string) ?? "");
  const [bankCurrency, setBankCurrency] = useState(bank?.currency ?? "USD");

  const [mpesaName, setMpesaName] = useState(mpesa?.accountHolderName ?? "");
  const [mpesaPhone, setMpesaPhone] = useState((mpesa?.details.phoneNumber as string) ?? "");

  async function activate(type: "email" | "bank" | "mpesa") {
    setError(null);
    const existing = type === "email" ? paypal : type === "bank" ? bank : mpesa;

    // Already saved with these exact details and just needs to become
    // the active one.
    if (existing) {
      setSavingType(type);
      await setDefaultWiseRecipient(existing.id);
      setSavingType(null);
      router.refresh();
      return;
    }

    // Not saved yet — validate and create it as the active method.
    if (type === "email") {
      if (!paypalEmail.trim() || !paypalName.trim()) { setError("Enter your name and PayPal email first."); return; }
      setSavingType(type);
      const res = await addWiseRecipient({ type: "email", currency: "USD", accountHolderName: paypalName, details: { email: paypalEmail } });
      setSavingType(null);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    } else if (type === "bank") {
      if (!bankName.trim() || !bankAccount.trim()) { setError("Enter your account holder name and account number first."); return; }
      setSavingType(type);
      const res = await addWiseRecipient({ type: "bank", currency: bankCurrency, accountHolderName: bankName, details: { accountNumber: bankAccount, iban: bankIban } });
      setSavingType(null);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    } else {
      if (!mpesaName.trim() || !mpesaPhone.trim()) { setError("Enter your name and M-Pesa phone number first."); return; }
      setSavingType(type);
      const res = await addWiseRecipient({ type: "mpesa", currency: "KES", accountHolderName: mpesaName, details: { phoneNumber: mpesaPhone } });
      setSavingType(null);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    }
    router.refresh();
  }

  async function updateDetails(type: "email" | "bank" | "mpesa") {
    const existing = type === "email" ? paypal : type === "bank" ? bank : mpesa;
    if (!existing) return activate(type);
    setSavingType(type);
    await deleteWiseRecipient(existing.id);
    if (type === "email") {
      await addWiseRecipient({ type: "email", currency: "USD", accountHolderName: paypalName, details: { email: paypalEmail } });
    } else if (type === "bank") {
      await addWiseRecipient({ type: "bank", currency: bankCurrency, accountHolderName: bankName, details: { accountNumber: bankAccount, iban: bankIban } });
    } else {
      await addWiseRecipient({ type: "mpesa", currency: "KES", accountHolderName: mpesaName, details: { phoneNumber: mpesaPhone } });
    }
    if (active === type) {
      const refreshed = await import("@/actions/wise-recipients").then((m) => m.listMyWiseRecipients());
      const justSaved = refreshed.find((r) => r.type === type);
      if (justSaved) await setDefaultWiseRecipient(justSaved.id);
    }
    setSavingType(null);
    router.refresh();
  }

  return (
    <div className="form-section">
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>Payment Details</h3>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 18 }}>
        Fill in whichever method you want to use, then switch it on. Whichever one is on is the method used when
        the automatic monthly payout runs on the 15th.
      </p>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* PayPal */}
        <div className="form-section" style={{ background: "var(--cream)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>PayPal</strong>
            <Toggle type="email" on={active === "email"} savingType={savingType} onActivate={activate} />
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label">Account holder name</label>
              <input className="field" type="text" value={paypalName} onChange={(e) => setPaypalName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">PayPal email</label>
              <input className="field" type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} />
            </div>
          </div>
          {paypal && (
            <button type="button" className="btn btn-ghost btn-small" style={{ marginTop: 10 }} disabled={savingType === "email"} onClick={() => updateDetails("email")}>
              Save changes
            </button>
          )}
        </div>

        {/* Bank transfer */}
        <div className="form-section" style={{ background: "var(--cream)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>Bank transfer</strong>
            <Toggle type="bank" on={active === "bank"} savingType={savingType} onActivate={activate} />
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label">Account holder name</label>
              <input className="field" type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Currency</label>
              <input className="field" type="text" maxLength={3} value={bankCurrency} onChange={(e) => setBankCurrency(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="field-label">Account number</label>
              <input className="field" type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </div>
            <div>
              <label className="field-label">IBAN / sort code</label>
              <input className="field" type="text" value={bankIban} onChange={(e) => setBankIban(e.target.value)} />
            </div>
          </div>
          {bank && (
            <button type="button" className="btn btn-ghost btn-small" style={{ marginTop: 10 }} disabled={savingType === "bank"} onClick={() => updateDetails("bank")}>
              Save changes
            </button>
          )}
        </div>

        {/* M-Pesa */}
        <div className="form-section" style={{ background: "var(--cream)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>M-Pesa</strong>
            <Toggle type="mpesa" on={active === "mpesa"} savingType={savingType} onActivate={activate} />
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label">Account holder name</label>
              <input className="field" type="text" value={mpesaName} onChange={(e) => setMpesaName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">M-Pesa phone number</label>
              <input className="field" type="tel" placeholder="+254 7XX XXX XXX" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} />
            </div>
          </div>
          {mpesa && (
            <button type="button" className="btn btn-ghost btn-small" style={{ marginTop: 10 }} disabled={savingType === "mpesa"} onClick={() => updateDetails("mpesa")}>
              Save changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
