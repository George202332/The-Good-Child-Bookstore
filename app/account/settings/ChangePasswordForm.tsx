"use client";

import { useState } from "react";
import { changeMyPassword } from "@/actions/security";
import { PasswordField } from "@/components/PasswordField";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
    const res = await changeMyPassword(currentPassword, newPassword);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSaved(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="map-card" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Change password</h3>
      <p className="field-hint" style={{ margin: "0 0 16px" }}>
        If you checked out as a guest, use the temporary password from your confirmation email as your current
        password here, then set a real one.
      </p>
      <label className="field-label" htmlFor="cp-current">Current password</label>
      <PasswordField id="cp-current" name="current-password" required value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
      <label className="field-label" htmlFor="cp-new">New password</label>
      <PasswordField id="cp-new" name="new-password" required minLength={6} value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
      <label className="field-label" htmlFor="cp-confirm">Confirm new password</label>
      <PasswordField id="cp-confirm" name="confirm-password" required minLength={6} value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
      {error && <p className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</p>}
      {saved && <p className="field-hint" style={{ color: "#1F6B48" }}>Password changed.</p>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting} style={{ marginTop: 8 }}>
        {submitting ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
