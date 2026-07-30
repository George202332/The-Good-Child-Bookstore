import Link from "next/link";
import { Motif } from "@/components/Motif";

/** The account-type choice, split out from /login so that page can stay
 * a plain credentials form. Anyone without an account lands here first
 * to pick reader or author before the actual signup form. Affiliate is
 * no longer a separate account type — every Author account already has
 * full affiliate capability (referral links, promotion links, Tier
 * commissions) built in. */
export default function SignupChoicePage() {
  return (
    <section className="auth-section">
      <div className="auth-card">
        <h1>Create an account</h1>
        <p>Choose the kind of account you&apos;d like to create.</p>
        <div className="role-pick">
          <Link href="/signup/reader" className="role-card">
            <svg viewBox="0 0 100 100"><Motif kind="owl" color="#3F3350" /></svg>
            <h4>Sign up as a reader</h4>
            <p>Shop, save favorites, subscribe</p>
          </Link>
          <Link href="/signup/author" className="role-card">
            <svg viewBox="0 0 100 100"><Motif kind="star" color="#3F3350" /></svg>
            <h4>Author / Affiliate Account</h4>
            <p>Submit and track your titles, refer authors, and promote books — all in one account</p>
          </Link>
        </div>
        <div className="auth-switch" style={{ marginTop: 20, textAlign: "center" }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </section>
  );
}
