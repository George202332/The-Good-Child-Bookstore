"use client";

import { useState } from "react";
import { changeMyPassword } from "@/actions/security";

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
      <input className="field" id="sec-current" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <label className="field-label" htmlFor="sec-new">New password</label>
      <input className="field" id="sec-new" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <label className="field-label" htmlFor="sec-confirm">Confirm new password</label>
      <input className="field" id="sec-confirm" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Password changed.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
