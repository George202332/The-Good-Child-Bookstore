"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/actions/password-reset";
import { PasswordField } from "@/components/PasswordField";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }
    setSubmitting(true);
    const res = await resetPassword(token, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return <p style={{ color: "#1F6B48", marginTop: 12 }}>Password changed — redirecting you to sign in…</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="field-label" htmlFor="rp-password">New password</label>
      <PasswordField id="rp-password" required minLength={6} value={password} onChange={setPassword} />
      <label className="field-label" htmlFor="rp-confirm">Confirm new password</label>
      <PasswordField id="rp-confirm" required minLength={6} value={confirm} onChange={setConfirm} />
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
        {submitting ? "Saving…" : "Set new password"}
      </button>
      <div className="auth-switch" style={{ marginTop: 16 }}>
        <Link href="/login">Back to sign in</Link>
      </div>
    </form>
  );
}
