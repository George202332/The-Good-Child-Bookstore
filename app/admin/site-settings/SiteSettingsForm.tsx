"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings, testPaystackConnection } from "@/actions/site-settings";
import type { SiteSettings } from "@/lib/site-settings";
import { ImageUploadField } from "@/components/ImageUploadField";

const BADGE_FIELDS: { key: keyof SiteSettings["paymentBadges"]; label: string }[] = [
  { key: "mpesa", label: "M-Pesa" },
  { key: "mastercard", label: "Mastercard" },
  { key: "visa", label: "Visa" },
  { key: "amex", label: "American Express" },
  { key: "verve", label: "Verve" },
];

export function SiteSettingsForm({ initial, apiKeysSet }: { initial: SiteSettings; apiKeysSet: Record<string, boolean> }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTestPaystack() {
    setTesting(true);
    setTestResult(null);
    const res = await testPaystackConnection();
    setTesting(false);
    setTestResult(res);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await updateSiteSettings(settings);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="form-section">
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Logo &amp; Favicon</h3>
      <div className="upload-cards-row">
        <ImageUploadField
          label="Logo image (leave empty to use the default owl mark)"
          recommendedSize="Any size works — transparent padding around the artwork is trimmed automatically"
          value={settings.logoImageUrl}
          onChange={(url) => setSettings((s) => ({ ...s, logoImageUrl: url }))}
          trim
        />
        <ImageUploadField
          label="Favicon (browser tab icon — leave empty to use the default)"
          recommendedSize="Recommended 64×64px, square"
          value={settings.faviconImageUrl}
          onChange={(url) => setSettings((s) => ({ ...s, faviconImageUrl: url }))}
          trim
        />
      </div>

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Footer</h3>
      <label className="field-label" htmlFor="footer-tagline">Footer tagline</label>
      <textarea
        className="field"
        id="footer-tagline"
        rows={3}
        value={settings.footerTagline}
        onChange={(e) => setSettings((s) => ({ ...s, footerTagline: e.target.value }))}
      />
      <label className="field-label" htmlFor="footer-copyright">Copyright line</label>
      <input
        className="field"
        id="footer-copyright"
        type="text"
        value={settings.footerCopyright}
        onChange={(e) => setSettings((s) => ({ ...s, footerCopyright: e.target.value }))}
      />

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Payment badge images (footer)</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        Each of these already shows a real card-style icon by default. Upload an image here to replace it — for
        example, if you have the rights to use the official logo for that brand.
      </p>
      <div className="upload-cards-row">
        {BADGE_FIELDS.map(({ key, label }) => (
          <ImageUploadField
            key={key}
            label={`${label} image`}
            recommendedSize="Recommended 120×40px"
            value={settings.paymentBadges[key]}
            onChange={(url) => setSettings((s) => ({ ...s, paymentBadges: { ...s.paymentBadges, [key]: url } }))}
          />
        ))}
      </div>

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>API credentials</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        Set these here instead of asking for help editing Vercel&apos;s environment variables. Leave any of these
        blank to keep using whatever&apos;s already configured there.
      </p>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Lulu (print-on-demand)</h4>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="api-lulu-key">Client Key</label>
          <input
            className="field"
            id="api-lulu-key"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.luluClientKey ? "•••• already set — leave blank to keep it" : "Not set"}
            value={settings.apiKeys.luluClientKey ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, luluClientKey: e.target.value } }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="api-lulu-secret">Client Secret</label>
          <input
            className="field"
            id="api-lulu-secret"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.luluClientSecret ? "•••• already set — leave blank to keep it" : "Not set"}
            value={settings.apiKeys.luluClientSecret ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, luluClientSecret: e.target.value } }))}
          />
        </div>
      </div>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Order confirmation emails</h4>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        Sent via Resend — set an API key here to start sending real order receipts (with download links) to buyers.
      </p>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="api-resend">Resend API key</label>
          <input
            className="field"
            id="api-resend"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.resendApiKey ? "•••• already set — leave blank to keep it" : "Not set"}
            value={settings.apiKeys.resendApiKey ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, resendApiKey: e.target.value } }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="api-fromemail">&quot;From&quot; email address</label>
          <input
            className="field"
            id="api-fromemail"
            type="email"
            placeholder="orders@yourdomain.com"
            value={settings.apiKeys.fromEmail ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, fromEmail: e.target.value } }))}
          />
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Payment Integrations</h3>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Paystack (checkout — card payments)</h4>
      <label className="field-label" htmlFor="api-mode">Key mode</label>
      <select
        className="field"
        id="api-mode"
        value={settings.apiKeys.paymentMode}
        onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paymentMode: e.target.value as "test" | "live" } }))}
      >
        <option value="test">Test — the keys below are sandbox keys, no real charges</option>
        <option value="live">Live — the keys below are real keys, real charges</option>
      </select>
      <p className="field-hint" style={{ margin: "-8px 0 12px" }}>
        Just a label for which kind of key you&apos;ve pasted below — Paystack test and live keys already look
        different (sk_test_ vs sk_live_), there&apos;s only one pair to manage now.
      </p>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="api-paystack-secret">Secret Key</label>
          <input
            className="field"
            id="api-paystack-secret"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paystackSecretKey ? "•••• already set — leave blank to keep it" : "Not set"}
            value={settings.apiKeys.paystackSecretKey ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paystackSecretKey: e.target.value } }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="api-paystack-public">Public Key</label>
          <input
            className="field"
            id="api-paystack-public"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paystackPublicKey ? "•••• already set — leave blank to keep it" : "Not set"}
            value={settings.apiKeys.paystackPublicKey ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paystackPublicKey: e.target.value } }))}
          />
        </div>
      </div>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Wise (author/affiliate payouts)</h4>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="api-wise-secret">Secret Key (API Token)</label>
          <input
            className="field"
            id="api-wise-secret"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.wiseApiToken ? "•••• already set — leave blank to keep it" : "Not set"}
            value={settings.apiKeys.wiseApiToken ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, wiseApiToken: e.target.value } }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="api-wise-public">Public Key (Profile ID)</label>
          <input
            className="field"
            id="api-wise-public"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.wiseProfileId ? "•••• already set — leave blank to keep it" : "Not set"}
            value={settings.apiKeys.wiseProfileId ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, wiseProfileId: e.target.value } }))}
          />
        </div>
      </div>

      <div style={{ marginTop: 8, marginBottom: 8 }}>
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

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the site now.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
