import Link from "next/link";
import { peekOrderLoginToken } from "@/lib/order-login";
import { WelcomeButton } from "./WelcomeButton";

export const dynamic = "force-dynamic";

/**
 * Landing page for the one-time "Go to my account" link in the purchase email.
 * Opening this page does NOT use the link up (mail scanners and link previews
 * open links too); only pressing the button does, so the link works exactly once
 * for the person who actually clicks it.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const t = typeof token === "string" ? token : "";
  const state = await peekOrderLoginToken(t);

  return (
    <section className="auth-section">
      <div className="auth-card" style={{ maxWidth: 440, textAlign: "center" }}>
        {state === "valid" ? (
          <>
            <h1>Welcome to The Good Child Bookstore</h1>
            <p style={{ color: "var(--ink-soft)", margin: "10px 0 20px" }}>
              Your payment is confirmed and your account is ready. Press the button to go straight in. You will then be asked to choose your own password.
            </p>
            <WelcomeButton token={t} />
          </>
        ) : (
          <>
            <h1>This link can&apos;t be used</h1>
            <p style={{ color: "var(--ink-soft)", margin: "10px 0 20px" }}>
              {state === "used"
                ? "This one-time link has already been used."
                : state === "expired"
                ? "This one-time link has expired."
                : "This link isn't valid."}{" "}
              You can set your password from the link in your email, or ask for a new one.
            </p>
            <Link href="/forgot-password" className="btn btn-primary" style={{ display: "block", textAlign: "center", marginBottom: 10 }}>Forgot password</Link>
            <Link href="/login" className="see-all" style={{ display: "block", textAlign: "center" }}>Go to sign in</Link>
          </>
        )}
      </div>
    </section>
  );
}
