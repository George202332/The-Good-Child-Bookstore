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
        value={settings.logoImageUrl}
        onChange={(url) => setSettings((s) => ({ ...s, logoImageUrl: url }))}
      />
      <ImageUploadField
        label="Favicon (browser tab icon — leave empty to use the default)"
        value={settings.faviconImageUrl}
        onChange={(url) => setSettings((s) => ({ ...s, faviconImageUrl: url }))}
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
          value={settings.paymentBadges[key]}
          onChange={(url) => setSettings((s) => ({ ...s, paymentBadges: { ...s.paymentBadges, [key]: url } }))}
        />
      ))}

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>API credentials</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        Set these here instead of asking for help editing Vercel&apos;s environment variables. Leave any of these
        blank to keep using whatever&apos;s already configured there.
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
      <label className="field-label" htmlFor="api-paypal-id">PayPal Client ID</label>
      <input
        className="field"
        id="api-paypal-id"
        type="password"
        autoComplete="off"
        placeholder={apiKeysSet.paypalClientId ? "•••• already set — leave blank to keep it" : "Not set"}
        onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paypalClientId: e.target.value } }))}
      />
      <label className="field-label" htmlFor="api-paypal-secret">PayPal Client Secret</label>
      <input
        className="field"
        id="api-paypal-secret"
        type="password"
        autoComplete="off"
        placeholder={apiKeysSet.paypalClientSecret ? "•••• already set — leave blank to keep it" : "Not set"}
        onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paypalClientSecret: e.target.value } }))}
      />
      <label className="field-label" htmlFor="api-paystack">Paystack Secret Key</label>
      <input
        className="field"
        id="api-paystack"
        type="password"
        autoComplete="off"
        placeholder={apiKeysSet.paystackSecretKey ? "•••• already set — leave blank to keep it" : "Not set"}
        onChange={(e) => setSettings((s) => ({ ...s, apiKeys: { ...s.apiKeys, paystackSecretKey: e.target.value } }))}
      />

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the site now.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
