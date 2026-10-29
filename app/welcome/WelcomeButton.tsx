"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function WelcomeButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const result = await signIn("order-link", { token, redirect: false });
      if (!result || result.error) {
        setError("This link has expired or was already used. Please use Forgot password to get back in.");
        setBusy(false);
        return;
      }
      window.location.assign("/account?welcome=1");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={go}>
        {busy ? "Signing You In…" : "Go to My Account"}
      </button>
      {error && <p role="alert" style={{ fontSize: 12.5, color: "var(--coral-deep)", margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
