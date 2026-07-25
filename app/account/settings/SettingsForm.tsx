"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMySettings, type MySettings } from "@/actions/settings";

export function SettingsForm({ initial }: { initial: MySettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSaved(false);
    await updateMySettings(settings);
    setSubmitting(false);
    setSaved(true);
    router.refresh();
  }

  const toggles: { key: keyof MySettings; label: string }[] = [
    { key: "darkMode", label: "Dark mode" },
    { key: "reduceMotion", label: "Reduce motion" },
    { key: "notifyPayouts", label: "Notify me about payouts" },
    { key: "notifyReviews", label: "Notify me about new reviews" },
    { key: "notifyBlogComments", label: "Notify me about blog comments" },
  ];

  return (
    <form onSubmit={handleSave} className="form-section" style={{ maxWidth: 480 }}>
      {toggles.map((t) => (
        <div className="toggle-row" key={t.key}>
          <label className="toggle-switch">
            <input type="checkbox" checked={settings[t.key]} onChange={(e) => setSettings((s) => ({ ...s, [t.key]: e.target.checked }))} />
            <span className="toggle-slider" />
          </label>
          <span>{t.label}</span>
        </div>
      ))}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting} style={{ marginTop: 10 }}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
