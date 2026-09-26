"use client";

import { useState } from "react";
import { resendMyVerificationEmail } from "@/actions/email-verification";
import { SignOutButton } from "./SignOutButton";

/**
 * The blocking screen shown in place of any dashboard content when a
 * signed-in Reader/Author hasn't verified their email yet. Rendered
 * by app/account/layout.tsx instead of `children` — no dashboard
 * chrome, no sidebar, no account features reachable from here at all,
 * per explicit requirement.
 */
export function EmailVerificationRequired({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setStatus("sending");
    setError(null);
    const res = await resendMyVerificationEmail();
    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setStatus("sent");
  }

  return (
    <section className="auth-section">
      <div className="auth-card">
        <h1>Verify your email</h1>
        <p>
          We sent a verification link to <strong>{email}</strong>. Please check your inbox and click{" "}
          <strong>Activate account</strong> before you can access your dashboard.
        </p>
        {status === "sent" && (
          <p style={{ color: "#1F6B48", fontSize: 13.5, textAlign: "center", marginBottom: 16 }}>
            Verification email sent — check your inbox (and spam folder).
          </p>
        )}
        {status === "error" && error && (
          <p style={{ color: "var(--coral-deep)", fontSize: 13.5, textAlign: "center", marginBottom: 16 }}>{error}</p>
        )}
        <button type="button" className="btn btn-primary" disabled={status === "sending"} onClick={handleResend}>
          {status === "sending" ? "Sending…" : "Resend verification email"}
        </button>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <SignOutButton className="btn btn-ghost btn-small" />
        </div>
      </div>
    </section>
  );
}
