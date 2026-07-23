"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerUser } from "@/actions/auth";

/** Converted from signupAffiliateHTML()/handleAffiliateSignup() (the-good-child-bookstore_54_1.html:6420-6451). */
export default function SignupAffiliatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await registerUser({ role: "AFFILIATE", name, email, password });
    if (!result.ok) {
      setSubmitting(false);
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    router.push("/account");
  }

  return (
    <section className="auth-section">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h1>Create an affiliate account</h1>
        <p>Promote any book on the shelf, refer new authors, and track your commission from your affiliate dashboard.</p>
        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="af-name">Full name</label>
          <input className="field" id="af-name" type="text" placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
          <label className="field-label" htmlFor="af-email">Email</label>
          <input className="field" id="af-email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="field-label" htmlFor="af-password">Password</label>
          <input className="field" id="af-password" type="password" placeholder="At least 6 characters" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="field-label" htmlFor="af-confirm">Confirm password</label>
          <input className="field" id="af-confirm" type="password" placeholder="Type it again" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create affiliate account"}
          </button>
        </form>
        <div className="auth-switch">Writing books instead? <Link href="/signup/author">Sign up as an author</Link></div>
        <div className="auth-switch">Here to shop instead? <Link href="/signup/reader">Sign up as a reader</Link></div>
        <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
      </div>
    </section>
  );
}
