"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerUser } from "@/actions/auth";
import { AuthorReferralTracker } from "@/components/AuthorReferralTracker";

const GENRES = ["Picture books", "Bedtime stories", "Early readers", "Middle grade", "Activity books"];

/** Converted from signupAuthorHTML()/handleAuthorSignup() (the-good-child-bookstore_54_1.html:6375-6417).
 * Also tracks arrival via an affiliate's author-referral link (?ref=<code>)
 * so a real 5%-for-life referral commission can be attributed if this
 * visitor actually signs up — see actions/affiliate-referral.ts. */
export default function SignupAuthorPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [penName, setPenName] = useState("");
  const [email, setEmail] = useState("");
  const [genre, setGenre] = useState(GENRES[0]);
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
    const result = await registerUser({ role: "AUTHOR", name, penName, email, genre, password });
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
      <Suspense fallback={null}>
        <AuthorReferralTracker />
      </Suspense>
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h1>Create an author account</h1>
        <p>Submit titles, track earnings, and message readers from your author dashboard.</p>
        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="a-name">Full name</label>
          <input className="field" id="a-name" type="text" placeholder="Your legal name" required value={name} onChange={(e) => setName(e.target.value)} />
          <label className="field-label" htmlFor="a-pen">
            Pen name <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span>
          </label>
          <input className="field" id="a-pen" type="text" placeholder="How readers will see your name" value={penName} onChange={(e) => setPenName(e.target.value)} />
          <label className="field-label" htmlFor="a-email">Email</label>
          <input className="field" id="a-email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="field-label" htmlFor="a-genre">What do you write?</label>
          <select className="field" id="a-genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => <option key={g}>{g}</option>)}
          </select>
          <label className="field-label" htmlFor="a-password">Password</label>
          <input className="field" id="a-password" type="password" placeholder="At least 6 characters" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="field-label" htmlFor="a-confirm">Confirm password</label>
          <input className="field" id="a-confirm" type="password" placeholder="Type it again" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create author account"}
          </button>
        </form>
        <div className="auth-switch">Here to shop instead? <Link href="/signup/reader">Sign up as a reader</Link></div>
        <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
      </div>
    </section>
  );
}
