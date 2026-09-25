"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";
import { adminSignIn } from "@/actions/admin-auth";

/**
 * A dedicated backend login — separate from the public /login page
 * (which is the reader/author/affiliate storefront login and shows the
 * role tabs, "New here" signup cards, etc). This one shows only email
 * and password, styled with the same dark admin theme as the rest of
 * /admin (see ../admin.css), and nothing else — per explicit request.
 *
 * Signs in through the admin-only NextAuth instance (lib/auth-admin.ts)
 * via a server action, not the client-side next-auth/react hook — that
 * hook is hardcoded to the default /api/auth/* path and would silently
 * authenticate against the public instance instead, which is exactly
 * backwards for a backend login. Field names and autocomplete values
 * are deliberately distinct from the public login form's, so a
 * browser's saved reader/author credentials are never suggested here.
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await adminSignIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "That email or password isn't right.");
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <div className="admin-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 468, padding: "0 20px" }}>
        <form onSubmit={handleSubmit} className="form-section admin-login-form" autoComplete="off" style={{ marginTop: 28 }}>
          <label className="field-label" htmlFor="admin-portal-email">Email</label>
          <input
            className="field"
            id="admin-portal-email"
            name="admin-portal-email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="field-label" htmlFor="admin-portal-password">Password</label>
          <PasswordField
            id="admin-portal-password"
            name="admin-portal-password"
            required
            autoComplete="off"
            value={password}
            onChange={setPassword}
          />
          <div style={{ textAlign: "right", marginTop: -8, marginBottom: 16 }}>
            <Link href="/forgot-password" style={{ fontSize: 12.5 }}>Forgot password?</Link>
          </div>
          {error && <div className="field-hint" style={{ color: "var(--admin-danger)" }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: 8 }}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
