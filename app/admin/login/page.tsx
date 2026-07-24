"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

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
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          <div className="admin-brand-mark" style={{ width: 40, height: 40, fontSize: 15 }}>GC</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>The Good Child</div>
            <div style={{ fontSize: 12, color: "var(--admin-text-faint)" }}>Backend</div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="form-section">
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
          <input
            className="field"
            id="admin-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="field-hint" style={{ color: "var(--admin-danger)" }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: 8 }}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
