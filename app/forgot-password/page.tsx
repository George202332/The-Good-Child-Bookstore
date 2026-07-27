"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/password-reset";

/** Works for every account type, including backend roles — email-based
 * identity only, nothing role-specific. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await requestPasswordReset(email);
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <section className="auth-section">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <h1>Reset your password</h1>
        {submitted ? (
          <p style={{ color: "var(--ink-soft)", marginTop: 12 }}>
            If an account exists for that email, a password reset link has been sent — check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 16 }}>
              Enter the email on your account and we&apos;ll send you a link to set a new password.
            </p>
            <label className="field-label" htmlFor="fp-email">Email</label>
            <input className="field" id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <div className="auth-switch" style={{ marginTop: 16 }}>
          <Link href="/login">Back to sign in</Link>
        </div>
      </div>
    </section>
  );
}
