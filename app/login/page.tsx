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
  // <form>'s onSubmit event (see the form below), and — after three
  // separate rounds of "logs me in automatically on mobile" reports on
  // Author accounts specifically — deliberately NOT wired to any Enter
  // keypress either, not even one scoped to the password field. Two
  // earlier rounds treated a real Enter-in-password-field keydown as an
  // intentional submit, reasoning that a genuine Enter press is a
  // deliberate "submit" signal. That reasoning missed the actual mobile
  // mechanism: on-screen keyboards on Android/iOS expose a "Go"/"Done"/
  // "Next" action key on the LAST field of a form, and tapping it fires
  // a real `Enter` keydown event — indistinguishable from a desktop
  // Enter press — the moment someone finishes typing their password.
  // Someone who taps that keyboard button to dismiss the keyboard (a
  // completely ordinary way to finish typing on mobile) was, by design,
  // being logged in immediately, with no tap on "Sign in" at all — which
  // is exactly what kept getting reported as "it logs me in by itself".
  // Author accounts likely surfaced this more because author sign-in is
  // typically the LAST thing in a return-visit flow typed carefully on a
  // phone, where finishing the password field with the keyboard's action
  // key (rather than tapping away from the keyboard first) is the
  // natural way to end.
  //
  // The fix: performLogin() now runs from exactly ONE place — the
  // explicit "Sign in" button's onClick (type="button", not "submit", so
  // it is never itself part of any form submission). No keydown handler,
  // no onSubmit, and no other code path reaches it, so there is no way
  // for typing, autofill, or a virtual keyboard's action key to log
  // anyone in without a real tap on that button.
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
         * it never performs the actual sign-in, and nothing below ever
         * calls performLogin() from a keydown/Enter handler any more
         * either (see performLogin()'s comment for why that was the real
         * mobile "auto-login" mechanism). So no matter how a submit event
         * ends up firing on this <form> — a real Enter press, a mobile
         * keyboard's "Go"/"Done" action key, or a browser/autofill
         * synthesizing a submit when a saved credential is selected — it
         * can never, by itself, log anyone in. The real sign-in runs from
         * performLogin(), called from exactly one place: the Sign in
         * button's onClick (type="button", not "submit" — so it isn't
         * itself part of form submission).
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
          <PasswordField
            id="l-password"
            name="reader-password"
            placeholder="Your password"
            autoComplete="current-password"
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
