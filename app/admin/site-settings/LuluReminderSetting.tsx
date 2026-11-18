"use client";

import { useState } from "react";
import { updateLuluReminderDays } from "@/actions/site-settings";

/** How often an author is reminded while a rejected print file is still not fixed. */
export function LuluReminderSetting({ initialDays }: { initialDays: number }) {
  const [days, setDays] = useState(initialDays);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true); setMsg(null);
    const r = await updateLuluReminderDays(days);
    setSaving(false);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error ?? "Something went wrong." });
  }
  return (
    <div>
      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Print File Reminders</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        When Lulu rejects a book&apos;s print file, the author is reminded this often (in days) until the file is fixed. The reader&apos;s order stays on hold meanwhile, and nothing is refunded or charged automatically.
      </p>
      <div style={{ maxWidth: 260 }}>
        <label className="field-label" htmlFor="lulu-days">Days Between Reminders</label>
        <input id="lulu-days" className="field" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
      </div>
      {msg && <div className="field-hint" style={{ color: msg.ok ? "#165236" : "var(--coral-deep)" }}>{msg.text}</div>}
      <button type="button" className="btn btn-primary btn-small" style={{ marginTop: 10 }} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Reminder Days"}</button>
    </div>
  );
}
