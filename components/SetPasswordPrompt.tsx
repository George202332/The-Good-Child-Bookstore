"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInitialPassword } from "@/actions/security";
import { PasswordField } from "@/components/PasswordField";

/**
 * Shown at the top of the dashboard to a guest-created account that has not yet
 * chosen its own password (they arrived with a one-time link, so none is set).
 */
export function SetPasswordPrompt({ highlight }: { highlight?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await setInitialPassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save your password.");
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="map-card"
      style={{ padding: "16px 18px", marginBottom: 16, background: "#F5D98F", border: highlight ? "2px solid #6B4503" : undefined, maxWidth: 520 }}
    >
      <p style={{ fontSize: 14, fontWeight: 700, color: "#6B4503", margin: "0 0 4px" }}>Choose your password</p>
      <p style={{ fontSize: 13, color: "#6B4503", margin: "0 0 10px" }}>
        Your account was created when you bought your book. Set a password so you can sign in any time.
      </p>
      <label className="field-label" htmlFor="sp-password">New password</label>
      <PasswordField id="sp-password" required minLength={6} value={password} onChange={setPassword} autoComplete="new-password" />
      <label className="field-label" htmlFor="sp-confirm">Confirm new password</label>
      <PasswordField id="sp-confirm" required minLength={6} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error && <p role="alert" style={{ fontSize: 12.5, color: "var(--coral-deep)", margin: "6px 0 0" }}>{error}</p>}
      <button type="submit" className="btn btn-primary btn-small" disabled={busy} style={{ marginTop: 10 }}>
        {busy ? "Saving…" : "Save my password"}
      </button>
    </form>
  );
}
