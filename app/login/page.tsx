"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Motif } from "@/components/Motif";

type LoginType = "reader" | "author" | "affiliate";

/**
 * Converted from loginHTML() (the-good-child-bookstore_54_1.html:6211-6256).
 * The reader/author/affiliate tabs are kept for the same UX, but sign-in
 * itself now goes through Auth.js's credentials provider (which checks the
 * real User row and its role) instead of the original's localStorage
 * account lookup keyed by a separately-chosen type.
 */
export default function LoginPage() {
  const router = useRouter();
  const [type, setType] = useState<LoginType>("reader");
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
    setSubmitting(false);
    if (result?.error) {
      setError("That email or password isn't right. Please try again.");
      return;
    }
    const session = await getSession();
    const role = session?.user?.role;
    router.push(role === "ADMIN" || role === "EDITOR" ? "/admin" : "/account");
  }

  return (
    <section className="auth-section">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Sign in as a reader, an author, or an affiliate: one login for whichever account you&apos;re using.</p>
        <div className="login-type-tabs">
          {(["reader", "author", "affiliate"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`affiliate-tab ${type === t ? "active" : ""}`}
              onClick={() => setType(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
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
          <input
            className="field"
            id="l-password"
            type="password"
            placeholder="Your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        <div className="auth-divider"><span /><small>New here</small><span /></div>
        <div className="role-pick">
          <Link href="/signup/reader" className="role-card">
            <svg viewBox="0 0 100 100"><Motif kind="owl" color="#3F3350" /></svg>
            <h4>Sign up as a reader</h4>
            <p>Shop, save favorites, subscribe</p>
          </Link>
          <Link href="/signup/author" className="role-card">
            <svg viewBox="0 0 100 100"><Motif kind="star" color="#3F3350" /></svg>
            <h4>Sign up as an author</h4>
            <p>Submit and track your titles</p>
          </Link>
          <Link href="/signup/affiliate" className="role-card" style={{ gridColumn: "1/-1" }}>
            <svg viewBox="0 0 100 100"><Motif kind="heart" color="#3F3350" /></svg>
            <h4>Sign up as an affiliate</h4>
            <p>Promote books and earn commission</p>
          </Link>
        </div>
      </div>
    </section>
  );
}
