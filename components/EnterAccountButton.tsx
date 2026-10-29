"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { startOrderSignIn } from "@/actions/order-access";

/**
 * "Go to my new account" on the payment success page, for a customer whose
 * reader account was just created from a guest purchase. One click: the server
 * issues a single-use token, it is exchanged straight away for a sign-in, and
 * the customer lands in their account, where they are asked to choose a password.
 * Nothing secret is shown or placed in the address bar.
 */
export function EnterAccountButton({ orderId, accessKey }: { orderId: string; accessKey: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await startOrderSignIn(orderId, accessKey);
      if (!res.ok || !res.token) {
        setError(res.error ?? "We could not sign you in automatically.");
        setBusy(false);
        return;
      }
      const result = await signIn("order-link", { token: res.token, redirect: false });
      if (!result || result.error) {
        setError("We could not sign you in automatically. Please use the link in your email, or sign in with your email address.");
        setBusy(false);
        return;
      }
      // A full page load, so the whole site picks up the new session.
      window.location.assign("/account?welcome=1");
    } catch {
      setError("Something went wrong. Please try again, or use the link in your email.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-primary" style={{ width: "100%", textAlign: "center" }} disabled={busy} onClick={go}>
        {busy ? "Signing You In…" : "Go to My New Account"}
      </button>
      {error && <p role="alert" style={{ fontSize: 12.5, color: "var(--coral-deep)", margin: "8px 0 0", textAlign: "center" }}>{error}</p>}
    </div>
  );
}
