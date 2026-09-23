"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSiteSettings } from "@/actions/site-settings";
import type { SiteSettings } from "@/lib/site-settings";
import { ImageUploadField } from "@/components/ImageUploadField";

const BADGE_FIELDS: { key: keyof SiteSettings["paymentBadges"]; label: string }[] = [
  { key: "mpesa", label: "M-Pesa" },
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
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>API credentials moved</h3>
      <p className="field-hint" style={{ margin: "0 0 12px" }}>
        All third-party API keys and credentials (Paystack, Wise, Payoneer, Lulu, Resend, Google Workspace) now live
        in their own dedicated page — see <Link href="/admin/api-management">Admin → API Management</Link>.
      </p>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the site now.</div>}
      {warning && <div className="field-hint" style={{ color: "#8A5A0B" }}>{warning}</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
