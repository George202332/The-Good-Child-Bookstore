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
      setError("New passwords don't match.");
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
    <form onSubmit={handleSubmit} className="form-section" style={{ maxWidth: 480 }}>
      <label className="field-label" htmlFor="sec-current">Current password</label>
      <PasswordField id="sec-current" required value={currentPassword} onChange={setCurrentPassword} />
      <label className="field-label" htmlFor="sec-new">New password</label>
      <PasswordField id="sec-new" required minLength={6} value={newPassword} onChange={setNewPassword} />
      <label className="field-label" htmlFor="sec-confirm">Confirm new password</label>
      <PasswordField id="sec-confirm" required minLength={6} value={confirmPassword} onChange={setConfirmPassword} />
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Password changed.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
