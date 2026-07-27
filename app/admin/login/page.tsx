"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { PasswordField } from "@/components/PasswordField";

/**
 * A dedicated backend login — separate from the public /login page
 * (which is the reader/author/affiliate storefront login and shows the
 * role tabs, "New here" signup cards, etc). This one shows only email
 * and password, styled with the same dark admin theme as the rest of
 * /admin (see ../admin.css), and nothing else — per explicit request.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);
    if (result?.error) {
      setError("That email or password isn't right.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="admin-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 360, padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>The Good Child Bookstore</div>
        </div>
        <form onSubmit={handleSubmit} className="form-section admin-login-form">
          <label className="field-label" htmlFor="admin-email">Email</label>
          <input
            className="field"
            id="admin-email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="field-label" htmlFor="admin-password">Password</label>
          <PasswordField
            id="admin-password"
            required
            autoComplete="current-password"
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
