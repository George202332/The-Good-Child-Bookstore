"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings } from "@/actions/site-settings";
import type { SiteSettings } from "@/lib/site-settings";
import { ImageUploadField } from "@/components/ImageUploadField";

const BADGE_FIELDS: { key: keyof SiteSettings["paymentBadges"]; label: string }[] = [
  { key: "paypal", label: "PayPal" },
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
      {BADGE_FIELDS.map(({ key, label }) => (
        <ImageUploadField
          key={key}
          label={`${label} image`}
          recommendedSize="Recommended 120×40px"
          value={settings.paymentBadges[key]}
          onChange={(url) => setSettings((s) => ({ ...s, paymentBadges: { ...s.paymentBadges, [key]: url } }))}
        />
      ))}

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>API credentials</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        Set these here instead of asking for help editing Vercel&apos;s environment variables. Leave any of these
        blank to keep using whatever&apos;s already configured there. PayPal and Paystack each issue separate keys
        for testing and for real, live payments — enter both sets below, then use the toggle to decide which one
        checkout actually uses.
      </p>

      <label className="field-label" htmlFor="api-lulu">Lulu API key</label>
      <input
        className="field"
        id="api-lulu"
        type="password"
        autoComplete="off"
        placeholder={apiKeysSet.luluApiKey ? "•••• already set — leave blank to keep it" : "Not set"}
        onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, luluApiKey: e.target.value } }))}
      />

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

      <label className="field-label" htmlFor="api-mode">Payment mode</label>
      <select
        className="field"
        id="api-mode"
        value={settings.apiKeys.paymentMode}
        onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paymentMode: e.target.value as "test" | "live" } }))}
      >
        <option value="test">Test — use sandbox keys, no real charges</option>
        <option value="live">Live — use real keys, real charges</option>
      </select>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>PayPal — sandbox (test) keys</h4>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="api-paypal-sandbox-id">Sandbox Client ID</label>
          <input
            className="field"
            id="api-paypal-sandbox-id"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paypalSandboxClientId ? "•••• already set" : "Not set"}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paypalSandboxClientId: e.target.value } }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="api-paypal-sandbox-secret">Sandbox Client Secret</label>
          <input
            className="field"
            id="api-paypal-sandbox-secret"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paypalSandboxClientSecret ? "•••• already set" : "Not set"}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paypalSandboxClientSecret: e.target.value } }))}
          />
        </div>
      </div>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>PayPal — live keys</h4>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="api-paypal-live-id">Live Client ID</label>
          <input
            className="field"
            id="api-paypal-live-id"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paypalLiveClientId ? "•••• already set" : "Not set"}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paypalLiveClientId: e.target.value } }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="api-paypal-live-secret">Live Client Secret</label>
          <input
            className="field"
            id="api-paypal-live-secret"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paypalLiveClientSecret ? "•••• already set" : "Not set"}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paypalLiveClientSecret: e.target.value } }))}
          />
        </div>
      </div>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Paystack — test keys</h4>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="api-paystack-test-secret">Test Secret Key</label>
          <input
            className="field"
            id="api-paystack-test-secret"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paystackTestSecretKey ? "•••• already set" : "Not set"}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paystackTestSecretKey: e.target.value } }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="api-paystack-test-public">Test Public Key</label>
          <input
            className="field"
            id="api-paystack-test-public"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paystackTestPublicKey ? "•••• already set" : "Not set"}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paystackTestPublicKey: e.target.value } }))}
          />
        </div>
      </div>

      <h4 style={{ fontSize: 13.5, margin: "16px 0 8px" }}>Paystack — live keys</h4>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="api-paystack-live-secret">Live Secret Key</label>
          <input
            className="field"
            id="api-paystack-live-secret"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paystackLiveSecretKey ? "•••• already set" : "Not set"}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paystackLiveSecretKey: e.target.value } }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="api-paystack-live-public">Live Public Key</label>
          <input
            className="field"
            id="api-paystack-live-public"
            type="password"
            autoComplete="off"
            placeholder={apiKeysSet.paystackLivePublicKey ? "•••• already set" : "Not set"}
            onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paystackLivePublicKey: e.target.value } }))}
          />
        </div>
      </div>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the site now.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
