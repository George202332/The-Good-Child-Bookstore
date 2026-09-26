"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { requestMyLoginChallenge, verifyMyLoginChallenge } from "@/actions/two-factor";
import { SignOutButton } from "./SignOutButton";
import type { TwoFactorMethod } from "@/lib/two-factor";

/**
 * The post-login second-factor gate — rendered by app/account/layout.tsx
 * in place of `children` whenever the current session has 2FA enabled
 * but hasn't verified the second factor yet (session.user.twoFactorVerified
 * === false). Credentials were already correct to get here; this is the
 * one remaining step before any dashboard content is reachable.
 */
export function TwoFactorChallengeScreen() {
  const router = useRouter();
  const { update } = useSession();
  const [sent, setSent] = useState<{ method: TwoFactorMethod; maskedDestination: string } | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-send a code the first time this screen mounts, so the user
    // isn't left staring at an empty screen before doing anything.
    void handleSend();
  }, []);

  async function handleSend() {
    setStatus("sending");
    setError(null);
    const res = await requestMyLoginChallenge();
    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "Could not send a code.");
      return;
    }
    setSent({ method: res.method!, maskedDestination: res.maskedDestination! });
    setStatus("idle");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setError(null);
    const res = await verifyMyLoginChallenge(code);
    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "Incorrect code.");
      return;
    }
    // Marks THIS session as having satisfied 2FA — see the `jwt`
    // callback's trigger==="update" handling in lib/auth.ts.
    await update({ twoFactorVerified: true });
    router.refresh();
  }

  return (
    <section className="auth-section">
      <div className="auth-card">
        <h1>Verification code</h1>
        {sent ? (
          <p>
            We sent a 6-digit code to <strong>{sent.maskedDestination}</strong>{" "}
            {sent.method === "SMS" ? "via text message" : "by email"}.
          </p>
        ) : (
          <p>Sending your verification code…</p>
        )}
        <form onSubmit={handleVerify}>
          <label className="field-label" htmlFor="tfa-code">Enter code</label>
          <input
            className="field"
            id="tfa-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ textAlign: "center", fontSize: 20, letterSpacing: 4 }}
          />
          {status === "error" && error && (
            <p style={{ color: "var(--coral-deep)", fontSize: 13.5, margin: "0 0 12px" }}>{error}</p>
          )}
          <button type="submit" className="btn btn-primary" disabled={status === "verifying" || code.length !== 6}>
            {status === "verifying" ? "Verifying…" : "Verify"}
          </button>
        </form>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <button type="button" className="btn btn-ghost btn-small" disabled={status === "sending"} onClick={handleSend}>
            {status === "sending" ? "Sending…" : "Resend code"}
          </button>
          <SignOutButton className="btn btn-ghost btn-small" />
        </div>
      </div>
    </section>
  );
}
