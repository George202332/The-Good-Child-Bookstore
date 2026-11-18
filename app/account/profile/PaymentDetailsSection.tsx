"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addPayoutMethod, updatePayoutMethod, checkBankCountry, type PayoutMethodRow, type BankCountryCheck } from "@/actions/payout-methods";
import { COUNTRIES } from "@/lib/countries";

/**
 * Payout Settings: Bank Transfer is the only option, paid through Verto. The fields shown depend on the country the
 * user picks. If the country cannot be paid, or the bank fields cannot be loaded, a calm message is shown instead of a
 * form. The lock window (lock day to release day) comes from the admin setting; `lockMessage` is set only inside it
 * and already holds the real unlock date.
 */
export function PaymentDetailsSection({
  initial, country, lockMessage, needsBankChoice,
}: { initial: PayoutMethodRow[]; country: string | null; lockMessage: string | null; needsBankChoice: boolean }) {
  const router = useRouter();
  const bank = initial.find((r) => r.type === "bank");
  const locked = !!lockMessage;

  const [holder, setHolder] = useState(bank?.accountHolderName ?? "");
  const [bankCountry, setBankCountry] = useState(((bank?.details.country as string) || country || "").toUpperCase());
  const [currency, setCurrency] = useState(bank?.currency ?? "USD");
  const [values, setValues] = useState<Record<string, string>>({
    bankName: (bank?.details.bankName as string) ?? "",
    accountNumber: (bank?.details.accountNumber as string) ?? "",
    swiftOrRoutingCode: (bank?.details.swiftOrRoutingCode as string) ?? "",
  });
  const [result, setResult] = useState<{ country: string; data: BankCountryCheck } | null>(null);
  // The answer only counts while it is for the country currently chosen; otherwise the details are still loading.
  const check = result && result.country === bankCountry ? result.data : null;
  const checking = !!bankCountry && !check;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!bankCountry) return;
    let cancelled = false;
    checkBankCountry(bankCountry)
      .then((r) => { if (!cancelled) setResult({ country: bankCountry, data: r }); })
      .catch(() => { if (!cancelled) setResult({ country: bankCountry, data: { state: "unreachable", message: "Bank Transfer details cannot be loaded right now. Please try again later.", fields: [] } }); });
    return () => { cancelled = true; };
  }, [bankCountry]);

  async function save() {
    setError(null); setSaved(false);
    if (!holder.trim()) { setError("Enter the account holder name."); return; }
    const details: Record<string, string> = { country: bankCountry };
    for (const f of check?.fields ?? []) details[f.key] = (values[f.key] ?? "").trim();
    setSaving(true);
    const res = bank
      ? await updatePayoutMethod(bank.id, { accountHolderName: holder, currency: currency || "USD", details })
      : await addPayoutMethod({ type: "bank", currency: currency || "USD", accountHolderName: holder, details });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    setSaved(true);
    router.refresh();
  }

  const noForm = !check || check.state !== "supported";

  return (
    <div className="form-section">
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>Payout Settings</h3>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
        Your earnings are paid by Bank Transfer through Verto. Choose the country of your bank, then fill in the details shown.
      </p>

      {needsBankChoice && (
        <div className="field-hint" style={{ background: "var(--cream)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "var(--ink)" }}>
          Bank Transfer is now the only way to receive payouts. Your earlier payout details are kept safely, but please add your bank details below so your next payout can be sent.
        </div>
      )}
      {locked && (
        <div className="field-hint" style={{ background: "var(--cream)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "var(--ink-soft)" }}>
          {lockMessage}
        </div>
      )}
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginBottom: 12 }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#165236", marginBottom: 12 }}>Saved. Your bank details are updated.</div>}

      <div className="form-section" style={{ background: "var(--cream)", marginBottom: 0 }}>
        <strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>Bank Transfer</strong>
        <label className="field-label">Country Of Your Bank</label>
        <select className="field" value={bankCountry} disabled={locked} onChange={(e) => setBankCountry(e.target.value)}>
          <option value="">Choose a country</option>
          {COUNTRIES.map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
        </select>

        {checking && <div className="field-hint" style={{ marginTop: 8 }}>Loading the bank details for this country…</div>}
        {!checking && check && check.state !== "supported" && (
          <div className="field-hint" style={{ marginTop: 8, color: check.state === "unsupported" ? "var(--coral-deep)" : "var(--ink-soft)" }}>{check.message}</div>
        )}

        {!checking && !noForm && (
          <>
            <label className="field-label">Account Holder Name</label>
            <input className="field" type="text" value={holder} disabled={locked} onChange={(e) => setHolder(e.target.value)} />
            {check!.fields.map((f) => (
              <div key={f.key}>
                <label className="field-label">{f.label}</label>
                <input className="field" type="text" placeholder={f.placeholder} value={values[f.key] ?? ""} disabled={locked} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              </div>
            ))}
            <label className="field-label">Currency</label>
            <input className="field" type="text" maxLength={3} value={currency} disabled={locked} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            <button type="button" className="btn btn-primary btn-small" style={{ marginTop: 12 }} disabled={saving || locked} onClick={save}>
              {saving ? "Saving…" : bank ? "Save Changes" : "Save Bank Details"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
