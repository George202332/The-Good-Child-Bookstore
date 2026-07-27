"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, getSession, signOut } from "next-auth/react";
import { PasswordField } from "@/components/PasswordField";

/**
 * Converted from loginHTML() (the-good-child-bookstore_54_1.html:6211-6256).
 * One login form for whichever account you're using — reader, author,
 * or affiliate credentials all work the same way here, so there's no
 * role picker on this page itself; someone without an account yet is
 * sent to /signup, which is where the reader/author/affiliate choice
 * actually lives.
 *
 * Backend accounts (Admin/Editor/Accountant) are refused here on purpose
 * — this page is the storefront's own login, and the backend has its own
 * dedicated, separately-themed login at /admin/login. Signing in here
 * with backend credentials used to work and quietly redirect to /admin,
 * which defeated the point of having a separate backend login at all.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setSubmitting(false);
      setError("That email or password isn't right. Please try again.");
      return;
    }
    const session = await getSession();
    const role = session?.user?.role;
    if (role === "ADMIN" || role === "EDITOR" || role === "ACCOUNTANT") {
      await signOut({ redirect: false });
      setSubmitting(false);
      setError("This is a backend account — please sign in at the admin login page instead.");
      return;
    }
    setSubmitting(false);
    router.push("/account");
  }

  return (
    <section className="auth-section">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Sign in as a reader, an author, or an affiliate: one login for whichever account you&apos;re using.</p>
        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="l-email">Email</label>
          <input
            className="field"
            id="l-email"
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="field-label" htmlFor="l-password">Password</label>
          <PasswordField
            id="l-password"
            placeholder="Your password"
            required
            value={password}
            onChange={setPassword}
          />
          {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "-8px 0 16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)", cursor: "pointer" }}>
              <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <Link href="/forgot-password" style={{ fontSize: 13 }}>Forgot password?</Link>
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="auth-switch" style={{ marginTop: 20, textAlign: "center" }}>
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </div>
      </div>
    </section>
  );
}
