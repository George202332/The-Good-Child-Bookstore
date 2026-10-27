"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveMyAppearance } from "@/actions/appearance";
import { ACCOUNT_FONTS, ACCOUNT_FONT_SIZES, fontStack, sizeOption, type AccountAppearance } from "@/lib/account-fonts";

/**
 * Font + size picker for the Settings page (readers, authors and backend).
 * The preview box shows the choice immediately; nothing is saved (and the rest
 * of the page does not change) until "Save display settings" is pressed.
 */
export function FontSettingsForm({ area, initial }: { area: "account" | "admin"; initial: AccountAppearance }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = draft.fontFamily !== saved.fontFamily || draft.fontSize !== saved.fontSize;
  const stack = fontStack(draft.fontFamily);
  // The preview applies the size by scaling its own text (the page itself keeps
  // its saved size until you save), relative to the current saved size.
  const rel = sizeOption(draft.fontSize).zoom / sizeOption(saved.fontSize).zoom;

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await saveMyAppearance(area, draft);
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error ?? "Could not save." });
      return;
    }
    setSaved(draft);
    setMsg({ ok: true, text: "Saved. This now applies whenever you sign in, on any device." });
    router.refresh();
  }

  return (
    <section className="form-section" style={{ maxWidth: 560, marginTop: 20 }} aria-labelledby="font-settings-title">
      <h3 id="font-settings-title" style={{ fontSize: 15, marginBottom: 4 }}>Font and text size</h3>
      <p className="field-hint" style={{ marginBottom: 12 }}>
        Applies only inside your account pages. The public website stays the same.
      </p>

      <label className="field-label" htmlFor="acct-font-select">Font style</label>
      <select
        id="acct-font-select"
        value={draft.fontFamily}
        onChange={(e) => setDraft((d) => ({ ...d, fontFamily: e.target.value }))}
        style={{ width: "100%", padding: "9px 10px", marginBottom: 12 }}
      >
        {ACCOUNT_FONTS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label} — {f.note}
          </option>
        ))}
      </select>

      <label className="field-label" htmlFor="acct-size-select">Text size</label>
      <div id="acct-size-select" role="radiogroup" aria-label="Text size" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {ACCOUNT_FONT_SIZES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={draft.fontSize === s.key}
            className={`btn btn-small ${draft.fontSize === s.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setDraft((d) => ({ ...d, fontSize: s.key }))}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        aria-label="Preview"
        style={{
          border: "1px solid currentColor",
          borderRadius: 10,
          padding: 14,
          marginBottom: 12,
          overflow: "hidden",
          opacity: 0.98,
        }}
      >
        <div className="field-hint" style={{ marginBottom: 6 }}>Preview</div>
        <div style={{ zoom: rel, ...(stack ? { fontFamily: stack } : {}) }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>The Good Child Bookstore</div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            Storybooks chosen for bedtime, read-aloud, and every shelf. The quick brown fox jumps over the lazy dog. 0123456789
          </div>
        </div>
      </div>

      {msg && (
        <div className="field-hint" role="status" style={{ color: msg.ok ? "#165236" : "#a12b2b", marginBottom: 8 }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-small" onClick={save} disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save display settings"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          disabled={busy || (draft.fontFamily === "default" && draft.fontSize === "default")}
          onClick={() => setDraft({ fontFamily: "default", fontSize: "default" })}
        >
          Reset to default
        </button>
      </div>
    </section>
  );
}
