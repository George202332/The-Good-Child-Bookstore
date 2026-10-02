"use client";

import { useState } from "react";
import Link from "next/link";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The actual credential submission. Deliberately NOT wired to the
  // <form>'s onSubmit event (see the form below) — only two things call
  // this: an explicit tap/click of the "Sign in" button, and an explicit
  // Enter keypress while focus is in the password field. On mobile,
  // selecting a saved credential from the browser/OS autofill strip can
  // fill both fields *and* synthesize a submit (or an Enter-equivalent)
  // in one action — that's a mobile browser/autofill behavior, not
  // something this page's code was doing wrong, but routing the actual
  // signIn() call only through these two explicit paths means merely
  // filling in the fields (by typing or by autofill) can never log
  // anyone in on its own, regardless of what triggered it.
  async function performLogin() {
    setSubmitting(true);
    setError(null);
    // Trimmed here too (not just server-side in authorize()) so a space
    // accidentally included by autofill or a pasted email never even
    // makes it into the request.
    const result = await signIn("credentials", { email: email.trim(), password, redirect: false });
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
    window.location.href = "/account";
  }

  return (
    <section className="auth-section">
      <div className="auth-card">
        <h1>Welcome</h1>
        {/*
         * This form's onSubmit deliberately only calls preventDefault() —
         * it never performs the actual sign-in. That's so that no matter
         * how a submit event ends up firing on this <form> (a genuine
         * Enter keypress is handled separately below, but mobile browsers
         * can also synthesize a submit when autofill fills in a saved
         * credential), it can never, by itself, log anyone in. The real
         * sign-in only ever runs from performLogin(), called from exactly
         * two places: the Sign in button's onClick (type="button", not
         * "submit" — so it isn't itself part of form submission), and the
         * password field's onKeyDown when the key is actually Enter.
         */}
        <form onSubmit={(e) => e.preventDefault()} autoComplete="on">
          <label className="field-label" htmlFor="l-email">Email</label>
          <input
            className="field"
            id="l-email"
            name="reader-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="field-label" htmlFor="l-password">Password</label>
          <div
            onKeyDown={(e) => {
              // Scoped to the actual <input> (not the eye-icon show/hide
              // button PasswordField also renders in this wrapper) so
              // tabbing to that button and pressing Enter/Space to toggle
              // visibility can't also trigger a sign-in attempt.
              if (e.key === "Enter" && !submitting && (e.target as HTMLElement).tagName === "INPUT") {
                e.preventDefault();
                void performLogin();
              }
            }}
          >
            <PasswordField
              id="l-password"
              name="reader-password"
              placeholder="Your password"
              autoComplete="current-password"
              required
              value={password}
              onChange={setPassword}
            />
          </div>
          {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "-8px 0 16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)", cursor: "pointer" }}>
              <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <Link href="/forgot-password" style={{ fontSize: 13 }}>Forgot password?</Link>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={submitting}
            onClick={() => {
              if (!email.trim() || !password) {
                setError("Please enter both your email and password.");
                return;
              }
              void performLogin();
            }}
          >
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
