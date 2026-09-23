"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings, testPaystackConnection } from "@/actions/site-settings";
import { disconnectGoogleAccount } from "@/actions/google-email";
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

export function ApiManagementForm({
  initial, apiKeysSet, googleConnection, googleRedirectUri, googleErrorFromUrl,
}: {
  initial: SiteSettings;
  apiKeysSet: Record<string, boolean>;
  googleConnection: { connected: boolean; email?: string };
  googleRedirectUri: string;
  googleErrorFromUrl?: string;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(googleErrorFromUrl ?? null);
  const [saved, setSaved] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleTestPaystack() {
    setTesting(true);
    setTestResult(null);
    const res = await testPaystackConnection();
    setTesting(false);
    setTestResult(res);
  }

  async function handleDisconnectGoogle() {
    setDisconnecting(true);
    await disconnectGoogleAccount();
    setDisconnecting(false);
    router.refresh();
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
      {/* Google Workspace Configuration                              */}
      {/* ---------------------------------------------------------- */}
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Google Workspace Configuration</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 12 }}>
        Powers the admin email client (Admin → Email). See Task 3 setup notes for creating the OAuth client in
        Google Cloud Console — the exact redirect URI to register there is shown below.
      </p>

      <div className="form-grid-2">
        <SecretField
          id="api-google-client-id"
          label="Google Client ID"
          type="text"
          isSet={apiKeysSet.googleClientId}
          value={settings.apiKeys.googleClientId ?? ""}
          onChange={(v) => update({ googleClientId: v })}
        />
        <SecretField
          id="api-google-client-secret"
          label="Google Client Secret"
          isSet={apiKeysSet.googleClientSecret}
          value={settings.apiKeys.googleClientSecret ?? ""}
          onChange={(v) => update({ googleClientSecret: v })}
        />
      </div>
      <label className="field-label" htmlFor="api-google-scopes" style={{ marginTop: 10 }}>OAuth Scopes</label>
      <input
        className="field"
        id="api-google-scopes"
        type="text"
        placeholder="https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send"
        value={settings.apiKeys.googleOAuthScopes ?? ""}
        onChange={(e) => update({ googleOAuthScopes: e.target.value })}
      />
      <p className="field-hint" style={{ margin: "4px 0 12px" }}>
        Space-separated. Leave blank to use the default (gmail.readonly + gmail.send + userinfo.email) — widen this
        to include gmail.modify if you also want to mark messages read/archive them from here.
      </p>

      <div style={{ background: "var(--cream)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
        <p className="field-hint" style={{ margin: "0 0 6px", fontWeight: 700 }}>Authorized redirect URI</p>
        <code style={{ fontSize: 12, wordBreak: "break-all" }}>{googleRedirectUri}</code>
        <p className="field-hint" style={{ margin: "6px 0 0" }}>
          Register this exact URL in Google Cloud Console → Credentials → your OAuth client → Authorized redirect
          URIs.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        {googleConnection.connected ? (
          <>
            <p className="field-hint" style={{ color: "#1F6B48", marginBottom: 8 }}>
              Connected as {googleConnection.email}
            </p>
            <button type="button" className="btn btn-ghost btn-small" disabled={disconnecting} onClick={handleDisconnectGoogle}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- real API route + external redirect to Google, not a Next.js page
          <a href="/api/integrations/google/auth" className="btn btn-primary btn-small">
            Connect Gmail account
          </a>
        )}
      </div>

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

      <h3 style={{ fontSize: 15, margin: "24px 0 10px" }}>Order Confirmation Emails (Resend)</h3>
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
        </div>
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
