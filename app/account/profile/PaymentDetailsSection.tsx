"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addPayoutMethod,
  updatePayoutMethod,
  setActivePayoutMethod,
  type PayoutMethodRow,
} from "@/actions/payout-methods";
import { isPayoutMethodTypeAvailable, PAYOUT_METHOD_UNAVAILABLE_MESSAGE, type PayoutMethodToggles } from "@/lib/payout-method-availability";
import { isPayoutMethodLocked, payoutLockMessage } from "@/lib/payout-lock";
import { isPayoutRestrictedCountry, payoutRestrictionMessage } from "@/lib/payout-country-restriction";

/**
 * Payment Details — presents the 3 real payout methods (PayPal, Bank
 * transfer, M-Pesa) as toggle cards rather than an open-ended add/remove
 * list: at most one is active at a time, and whichever one is active is
 * the method an admin pays out to when they review and send that
 * month's payouts manually (see actions/admin.ts approvePayoutRequest
 * and actions/payouts.ts queueDuePayouts — there is no automatic
 * payment execution any more).
 *
 * Bank transfer uses a fixed, generic field set (bank name, account
 * number, SWIFT/routing code, country) rather than a live per-currency
 * lookup — this app no longer talks to any payment gateway to discover
 * what a given currency needs.
 */

type MethodType = "email" | "bank" | "mpesa";

function Toggle({ type, on, locked, unavailable, savingType, onActivate, onBlocked }: { type: MethodType; on: boolean; locked: boolean; unavailable: boolean; savingType: string | null; onActivate: (t: MethodType) => void; onBlocked: () => void }) {
  // An unavailable method (PayPal / M-Pesa while the admin toggle is off)
  // stays visible and clickable only to explain why it can't be chosen:
  // the checkbox never changes state, it shows the message instead.
  return (
    <label className="toggle-row" style={{ marginBottom: 0, opacity: unavailable ? 0.6 : locked && !on ? 0.8 : 1, cursor: unavailable ? "not-allowed" : undefined }} aria-disabled={unavailable}>
      <span className="toggle-switch">
        <input
          type="checkbox"
          checked={on}
          disabled={!unavailable && (savingType === type || (locked && !on))}
          onChange={() => {
            if (unavailable) { onBlocked(); return; }
            if (!on) onActivate(type);
          }}
        />
        <span className="toggle-slider" />
      </span>
      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{unavailable ? (on ? "Active (currently unavailable)" : "Unavailable") : on ? "Active for payouts" : "Use this method"}</span>
    </label>
  );
}

function UnavailableNote({ hasSaved }: { hasSaved: boolean }) {
  return (
    <div className="field-hint" style={{ marginBottom: 10, color: "var(--ink-soft)" }}>
      {PAYOUT_METHOD_UNAVAILABLE_MESSAGE}
      {hasSaved ? " Your saved details are kept as they are, but this method is currently unavailable." : ""}
    </div>
  );
}

export function PaymentDetailsSection({ initial, country, toggles }: { initial: PayoutMethodRow[]; country: string | null; toggles: PayoutMethodToggles }) {
  const router = useRouter();
  const paypal = initial.find((r) => r.type === "email");
  const bank = initial.find((r) => r.type === "bank");
  const mpesa = initial.find((r) => r.type === "mpesa");
  const active = initial.find((r) => r.isDefault)?.type;
  const hasActiveMethod = !!active;
  const locked = hasActiveMethod && isPayoutMethodLocked();
  const restricted = isPayoutRestrictedCountry(country);
  const paypalUnavailable = !isPayoutMethodTypeAvailable("email", toggles);
  const mpesaUnavailable = !isPayoutMethodTypeAvailable("mpesa", toggles);
  const unavailableFor = (type: MethodType) => (type === "email" ? paypalUnavailable : type === "mpesa" ? mpesaUnavailable : false);

  const [savingType, setSavingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [paypalEmail, setPaypalEmail] = useState((paypal?.details.email as string) ?? "");
  const [paypalName, setPaypalName] = useState(paypal?.accountHolderName ?? "");

  const [bankName, setBankName] = useState(bank?.accountHolderName ?? "");
  const [bankCountry, setBankCountry] = useState((bank?.details.country as string) ?? "");
  const [bankInstitution, setBankInstitution] = useState((bank?.details.bankName as string) ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState((bank?.details.accountNumber as string) ?? "");
  const [bankSwiftCode, setBankSwiftCode] = useState((bank?.details.swiftOrRoutingCode as string) ?? "");
  const [bankIntermediary, setBankIntermediary] = useState((bank?.details.intermediaryBank as string) ?? "");
  const [bankCurrency, setBankCurrency] = useState(bank?.currency ?? "USD");

  const [mpesaName, setMpesaName] = useState(mpesa?.accountHolderName ?? "");
  const [mpesaPhone, setMpesaPhone] = useState((mpesa?.details.phoneNumber as string) ?? "");

  function editLockedFor(type: MethodType): boolean {
    return active === type && locked;
  }

  async function activate(type: MethodType) {
    setError(null);
    if (unavailableFor(type)) { setError(PAYOUT_METHOD_UNAVAILABLE_MESSAGE); return; }
    const existing = type === "email" ? paypal : type === "bank" ? bank : mpesa;

    if (existing) {
      if (hasActiveMethod && locked) { setError(payoutLockMessage()); return; }
      setSavingType(type);
      const res = await setActivePayoutMethod(existing.id);
      setSavingType(null);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      router.refresh();
      return;
    }

    // Not saved yet — validate and create it. Adding a brand-new method
    // is always allowed, regardless of date — it only becomes active
    // for payouts once created, which addPayoutMethod itself handles.
    if (type === "email") {
      if (!paypalEmail.trim() || !paypalName.trim()) { setError("Enter your name and PayPal email first."); return; }
      setSavingType(type);
      const res = await addPayoutMethod({ type: "email", currency: "USD", accountHolderName: paypalName, details: { email: paypalEmail } });
      setSavingType(null);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    } else if (type === "bank") {
      if (!bankName.trim() || !bankInstitution.trim() || !bankAccountNumber.trim() || !bankSwiftCode.trim() || !bankCountry.trim()) {
        setError("Fill in every bank transfer field first.");
        return;
      }
      setSavingType(type);
      const res = await addPayoutMethod({
        type: "bank",
        currency: bankCurrency || "USD",
        accountHolderName: bankName,
        details: { bankName: bankInstitution, accountNumber: bankAccountNumber, swiftOrRoutingCode: bankSwiftCode, country: bankCountry, ...(bankIntermediary.trim() ? { intermediaryBank: bankIntermediary.trim() } : {}) },
      });
      setSavingType(null);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    } else {
      if (!mpesaName.trim() || !mpesaPhone.trim()) { setError("Enter your name and M-Pesa phone number first."); return; }
      setSavingType(type);
      const res = await addPayoutMethod({ type: "mpesa", currency: "KES", accountHolderName: mpesaName, details: { phoneNumber: mpesaPhone } });
      setSavingType(null);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    }
    router.refresh();
  }

  async function saveDetails(type: MethodType) {
    setError(null);
    if (unavailableFor(type)) { setError(PAYOUT_METHOD_UNAVAILABLE_MESSAGE); return; }
    const existing = type === "email" ? paypal : type === "bank" ? bank : mpesa;
    if (!existing) return activate(type);

    if (editLockedFor(type)) { setError(payoutLockMessage()); return; }

    setSavingType(type);
    let res;
    if (type === "email") {
      res = await updatePayoutMethod(existing.id, { accountHolderName: paypalName, currency: "USD", details: { email: paypalEmail } });
    } else if (type === "bank") {
      res = await updatePayoutMethod(existing.id, {
        accountHolderName: bankName,
        currency: bankCurrency || "USD",
        details: { bankName: bankInstitution, accountNumber: bankAccountNumber, swiftOrRoutingCode: bankSwiftCode, country: bankCountry, ...(bankIntermediary.trim() ? { intermediaryBank: bankIntermediary.trim() } : {}) },
      });
    } else {
      res = await updatePayoutMethod(existing.id, { accountHolderName: mpesaName, currency: "KES", details: { phoneNumber: mpesaPhone } });
    }
    setSavingType(null);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    router.refresh();
  }

  return (
    <div className="form-section">
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>Payment Details</h3>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
        Fill in whichever method you want to use, then switch it on. Whichever one is on is the method your payout
        is sent to once it&apos;s reviewed and processed.
      </p>

      {restricted && (
        <div className="field-hint" style={{ background: "var(--cream)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "var(--ink-soft)" }}>
          {payoutRestrictionMessage()}
        </div>
      )}
      {!restricted && hasActiveMethod && locked && (
        <div className="field-hint" style={{ background: "var(--cream)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "var(--ink-soft)" }}>
          {payoutLockMessage()}
        </div>
      )}
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginBottom: 12 }}>{error}</div>}

      <div className="payout-methods-grid">
        {/* PayPal */}
        <div className="form-section" style={{ background: "var(--cream)", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>PayPal</strong>
            <Toggle type="email" on={active === "email"} locked={restricted ? !paypal : locked} unavailable={paypalUnavailable} savingType={savingType} onActivate={activate} onBlocked={() => setError(PAYOUT_METHOD_UNAVAILABLE_MESSAGE)} />
          </div>
          {paypalUnavailable && <UnavailableNote hasSaved={!!paypal} />}
          <label className="field-label">Account holder name</label>
          <input className="field" type="text" value={paypalName} disabled={editLockedFor("email") || paypalUnavailable} onChange={(e) => setPaypalName(e.target.value)} />
          <label className="field-label">PayPal email</label>
          <input className="field" type="email" value={paypalEmail} disabled={editLockedFor("email") || paypalUnavailable} onChange={(e) => setPaypalEmail(e.target.value)} />
          <button type="button" className="btn btn-ghost btn-small" style={{ marginTop: 10 }} disabled={savingType === "email" || paypalUnavailable || editLockedFor("email") || (restricted && !paypal)} onClick={() => saveDetails("email")}>
            {paypal ? "Save changes" : "Add method"}
          </button>
        </div>

        {/* Bank transfer */}
        <div className="form-section" style={{ background: "var(--cream)", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>Bank transfer</strong>
            <Toggle type="bank" on={active === "bank"} locked={restricted ? !bank : locked} unavailable={false} savingType={savingType} onActivate={activate} onBlocked={() => undefined} />
          </div>
          <label className="field-label">Account holder name</label>
          <input className="field" type="text" value={bankName} disabled={editLockedFor("bank")} onChange={(e) => setBankName(e.target.value)} />
          <label className="field-label">Bank name</label>
          <input className="field" type="text" value={bankInstitution} disabled={editLockedFor("bank")} onChange={(e) => setBankInstitution(e.target.value)} />
          <div className="form-grid-2">
            <div>
              <label className="field-label">Account number</label>
              <input className="field" type="text" value={bankAccountNumber} disabled={editLockedFor("bank")} onChange={(e) => setBankAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className="field-label">SWIFT / Routing code</label>
              <input className="field" type="text" value={bankSwiftCode} disabled={editLockedFor("bank")} onChange={(e) => setBankSwiftCode(e.target.value)} />
            </div>
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label">Country</label>
              <input className="field" type="text" placeholder="e.g. Kenya" value={bankCountry} disabled={editLockedFor("bank")} onChange={(e) => setBankCountry(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Currency</label>
              <input className="field" type="text" maxLength={3} value={bankCurrency} disabled={editLockedFor("bank")} onChange={(e) => setBankCurrency(e.target.value.toUpperCase())} />
            </div>
          </div>
          <label className="field-label">Intermediary bank (for international wires) — optional</label>
          <input className="field" type="text" value={bankIntermediary} disabled={editLockedFor("bank")} onChange={(e) => setBankIntermediary(e.target.value)} />
          <button type="button" className="btn btn-ghost btn-small" style={{ marginTop: 10 }} disabled={savingType === "bank" || editLockedFor("bank") || (restricted && !bank)} onClick={() => saveDetails("bank")}>
            {bank ? "Save changes" : "Add method"}
          </button>
        </div>

        {/* M-Pesa */}
        <div className="form-section" style={{ background: "var(--cream)", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>M-Pesa</strong>
            <Toggle type="mpesa" on={active === "mpesa"} locked={restricted ? !mpesa : locked} unavailable={mpesaUnavailable} savingType={savingType} onActivate={activate} onBlocked={() => setError(PAYOUT_METHOD_UNAVAILABLE_MESSAGE)} />
          </div>
          {mpesaUnavailable && <UnavailableNote hasSaved={!!mpesa} />}
          <label className="field-label">Account holder name</label>
          <input className="field" type="text" value={mpesaName} disabled={editLockedFor("mpesa") || mpesaUnavailable} onChange={(e) => setMpesaName(e.target.value)} />
          <label className="field-label">M-Pesa phone number</label>
          <input className="field" type="tel" placeholder="+254 7XX XXX XXX" value={mpesaPhone} disabled={editLockedFor("mpesa") || mpesaUnavailable} onChange={(e) => setMpesaPhone(e.target.value)} />
          <button type="button" className="btn btn-ghost btn-small" style={{ marginTop: 10 }} disabled={savingType === "mpesa" || mpesaUnavailable || editLockedFor("mpesa") || (restricted && !mpesa)} onClick={() => saveDetails("mpesa")}>
            {mpesa ? "Save changes" : "Add method"}
          </button>
        </div>
      </div>
    </div>
  );
}
