"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings, testPaystackConnection, sendTestEmail } from "@/actions/site-settings";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * TASK 1.1 — API Management view.
 *
 * A single reusable secret input with a Show/Hide toggle (per explicit
 * instruction) — every credential field below uses this instead of a
 * bare `type="password"` input, so an admin can actually verify what
 * they pasted before saving.
 */
function SecretField({
  id, label, value, onChange, isSet, type = "password",
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; isSet: boolean; type?: "password" | "text";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="field"
          id={id}
          type={visible ? "text" : type}
          autoComplete="off"
          placeholder={isSet ? "•••• already set — leave blank to keep it" : "Not set"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function ApiManagementForm({ initial, apiKeysSet }: { initial: SiteSettings; apiKeysSet: Record<string, boolean> }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("support@thegoodchildbookstore.com");
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleTestPaystack() {
    setTesting(true);
    setTestResult(null);
    const res = await testPaystackConnection();
    setTesting(false);
    setTestResult(res);
  }

  async function handleTestEmail() {
    setTestingEmail(true);
    setEmailTestResult(null);
    const res = await sendTestEmail(testEmailAddress);
    setTestingEmail(false);
    setEmailTestResult(res);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    setWarning(null);
    const res = await updateSiteSettings(settings);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    if (res.error) setWarning(res.error);
    setSaved(true);
    router.refresh();
  }

  const update = (patch: Partial<SiteSettings["apiKeys"]>) =>
    setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, ...patch } }));

  return (
    <form onSubmit={handleSave} className="form-section">
      {/* ---------------------------------------------------------- */}
      {/* Email                                                       */}
      {/* ---------------------------------------------------------- */}
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Email</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 16 }}>
        All outbound email — order receipts, password resets, contact form replies, account verification, and
        marketing — goes through a single send-only service (Resend), configured below. No inbox access, no OAuth
        consent flow, and no client secret is ever stored in the database for this.
      </p>

      {/* ---------------------------------------------------------- */}
      {/* Payment Gateways                                            */}
      {/* ---------------------------------------------------------- */}
      <h3 style={{ fontSize: 15, margin: "24px 0 10px" }}>Payment Gateways</h3>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Paystack (checkout — card payments)</h4>
      <label className="field-label" htmlFor="api-mode">Key mode</label>
      <select
        className="field"
        id="api-mode"
        value={settings.apiKeys.paymentMode}
        onChange={(e) => update({ paymentMode: e.target.value as "test" | "live" })}
      >
        <option value="test">Test — the keys below are sandbox keys, no real charges</option>
        <option value="live">Live — the keys below are real keys, real charges</option>
      </select>
      <p className="field-hint" style={{ margin: "-8px 0 12px" }}>
        Just a label for which kind of key you&apos;ve pasted below — Paystack test and live keys already look
        different (sk_test_ vs sk_live_), there&apos;s only one pair to manage now.
      </p>
      <div className="form-grid-2">
        <SecretField id="api-paystack-secret" label="Secret Key" isSet={apiKeysSet.paystackSecretKey} value={settings.apiKeys.paystackSecretKey ?? ""} onChange={(v) => update({ paystackSecretKey: v })} />
        <SecretField id="api-paystack-public" label="Public Key" isSet={apiKeysSet.paystackPublicKey} value={settings.apiKeys.paystackPublicKey ?? ""} onChange={(v) => update({ paystackPublicKey: v })} />
      </div>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <p className="field-hint" style={{ margin: "0 0 8px" }}>
          Save your changes first, then test — this checks the key that&apos;s actually saved, not whatever&apos;s
          currently typed above, so it tells you for certain whether it stuck.
        </p>
        <button type="button" className="btn btn-ghost btn-small" disabled={testing} onClick={handleTestPaystack}>
          {testing ? "Testing…" : "Test Paystack connection"}
        </button>
        {testResult && (
          <div className="field-hint" style={{ color: testResult.ok ? "#1F6B48" : "var(--coral-deep)", marginTop: 8 }}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Payouts (Wise / Payoneer)                                   */}
      {/* ---------------------------------------------------------- */}
      <h3 style={{ fontSize: 15, margin: "24px 0 10px" }}>Payouts (author/affiliate)</h3>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Active payout provider</h4>
      <p className="field-hint" style={{ margin: "0 0 10px" }}>
        Only one provider is ever active at a time — switching to one automatically switches the other off.
      </p>
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="radio"
            name="active-payout-provider"
            checked={(settings.apiKeys.wiseEnabled ?? true) && !settings.apiKeys.payoneerEnabled}
            onChange={() => update({ wiseEnabled: true, payoneerEnabled: false })}
          />
          Wise
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="radio"
            name="active-payout-provider"
            checked={!!settings.apiKeys.payoneerEnabled && !settings.apiKeys.wiseEnabled}
            onChange={() => update({ wiseEnabled: false, payoneerEnabled: true })}
          />
          Payoneer
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="radio"
            name="active-payout-provider"
            checked={!settings.apiKeys.wiseEnabled && !settings.apiKeys.payoneerEnabled}
            onChange={() => update({ wiseEnabled: false, payoneerEnabled: false })}
          />
          Neither (pause all payouts)
        </label>
      </div>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Wise</h4>
      <SecretField id="api-wise-token" label="API Token" isSet={apiKeysSet.wiseApiToken} value={settings.apiKeys.wiseApiToken ?? ""} onChange={(v) => update({ wiseApiToken: v })} />
      <p className="field-hint" style={{ margin: "4px 0 12px" }}>
        Just the one token — Wise doesn&apos;t use a separate public/secret pair. Your Wise profile is looked up
        automatically from this token when you save.{" "}
        {apiKeysSet.wiseProfileId && "A profile is currently connected."}
      </p>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Payoneer</h4>
      <div className="form-grid-2">
        <SecretField id="api-payoneer-secret" label="Client Secret" isSet={apiKeysSet.payoneerClientSecret} value={settings.apiKeys.payoneerClientSecret ?? ""} onChange={(v) => update({ payoneerClientSecret: v })} />
        <SecretField id="api-payoneer-public" label="Client ID" isSet={apiKeysSet.payoneerClientId} value={settings.apiKeys.payoneerClientId ?? ""} onChange={(v) => update({ payoneerClientId: v })} />
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Print-on-demand + Email                                     */}
      {/* ---------------------------------------------------------- */}
      <h3 style={{ fontSize: 15, margin: "24px 0 10px" }}>Print-on-Demand (Lulu)</h3>
      <div className="form-grid-2">
        <SecretField id="api-lulu-key" label="Client Key" isSet={apiKeysSet.luluClientKey} value={settings.apiKeys.luluClientKey ?? ""} onChange={(v) => update({ luluClientKey: v })} />
        <SecretField id="api-lulu-secret" label="Client Secret" isSet={apiKeysSet.luluClientSecret} value={settings.apiKeys.luluClientSecret ?? ""} onChange={(v) => update({ luluClientSecret: v })} />
      </div>

      <h3 style={{ fontSize: 15, margin: "24px 0 10px" }}>Email (Resend)</h3>
      <p className="field-hint" style={{ margin: "0 0 10px" }}>
        Powers every email the site sends: order receipts, password resets, the contact form, account/author
        verification, in-app message notifications, and marketing sends.
      </p>
      <div className="form-grid-2">
        <SecretField id="api-resend" label="Resend API key" isSet={apiKeysSet.resendApiKey} value={settings.apiKeys.resendApiKey ?? ""} onChange={(v) => update({ resendApiKey: v })} />
        <div>
          <label className="field-label" htmlFor="api-fromemail">&quot;From&quot; email address</label>
          <input
            className="field"
            id="api-fromemail"
            type="email"
            placeholder="orders@yourdomain.com"
            value={settings.apiKeys.fromEmail ?? ""}
            onChange={(e) => update({ fromEmail: e.target.value })}
          />
          <p className="field-hint" style={{ margin: "4px 0 0" }}>
            Must be on a domain verified in your Resend account (Domains tab) — a Gmail/Yahoo/Outlook address will
            always fail here, since you can&apos;t verify a domain you don&apos;t own.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 10, marginBottom: 8 }}>
        <p className="field-hint" style={{ margin: "0 0 8px" }}>
          Save your changes first, then test — this sends a real email through whatever&apos;s actually saved right
          now (not what&apos;s typed above), so it tells you for certain whether delivery works, with Resend&apos;s
          exact error if it doesn&apos;t.
        </p>
        <div style={{ background: "var(--cream)", borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 12.5 }}>
          <strong>If a test to support@ (or any address other than your own) fails:</strong> Resend restricts
          accounts with no verified domain to sending only to the email address you signed up to Resend with —
          this is a real Resend limit, not a bug here. First try sending the test to your own Resend account email
          to confirm the key works, then verify <code>thegoodchildbookstore.com</code> under Domains in Resend to
          unlock sending to any address, including support@.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="field field-compact"
            type="email"
            placeholder="support@thegoodchildbookstore.com"
            value={testEmailAddress}
            onChange={(e) => setTestEmailAddress(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <button type="button" className="btn btn-ghost btn-small" disabled={testingEmail} onClick={handleTestEmail}>
            {testingEmail ? "Sending…" : "Send test email"}
          </button>
        </div>
        {emailTestResult && (
          <div
            role="status"
            style={{
              marginTop: 12, padding: "14px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: emailTestResult.ok ? "#E4F5EC" : "#FBEAEA",
              color: emailTestResult.ok ? "#0F4B2E" : "#7A1F1F",
              border: `2px solid ${emailTestResult.ok ? "#1F6B48" : "var(--coral-deep)"}`,
            }}
          >
            {emailTestResult.ok ? "✅ " : "❌ "}{emailTestResult.message}
          </div>
        )}
      </div>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the site now.</div>}
      {warning && <div className="field-hint" style={{ color: "#8A5A0B" }}>{warning}</div>}
      <button type="submit" className="btn btn-primary btn-small" style={{ marginTop: 10 }} disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
