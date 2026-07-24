"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings } from "@/actions/site-settings";
import type { SiteSettings } from "@/lib/site-settings";
import { ImageUploadField } from "@/components/ImageUploadField";

const BADGE_FIELDS: { key: keyof SiteSettings["paymentBadges"]; label: string }[] = [
  { key: "paypal", label: "PayPal" },
  { key: "mastercard", label: "Mastercard" },
  { key: "visa", label: "Visa" },
  { key: "amex", label: "American Express" },
  { key: "verve", label: "Verve" },
];

export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
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
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Logo</h3>
      <ImageUploadField
        label="Logo image (leave empty to use the default owl mark)"
        value={settings.logoImageUrl}
        onChange={(url) => setSettings((s) => ({ ...s, logoImageUrl: url }))}
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

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Payment badge images</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        Leave any of these blank to keep the plain-text badge for that one.
      </p>
      {BADGE_FIELDS.map(({ key, label }) => (
        <ImageUploadField
          key={key}
          label={`${label} image`}
          value={settings.paymentBadges[key]}
          onChange={(url) => setSettings((s) => ({ ...s, paymentBadges: { ...s.paymentBadges, [key]: url } }))}
        />
      ))}

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the site now.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
