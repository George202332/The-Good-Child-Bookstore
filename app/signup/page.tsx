import Link from "next/link";
import { Motif } from "@/components/Motif";

/** The account-type choice, split out from /login so that page can stay
 * a plain credentials form. Anyone without an account lands here first
 * to pick reader, author, or affiliate before the actual signup form. */
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
            <h4>Sign up as an author</h4>
            <p>Submit and track your titles</p>
          </Link>
          <Link href="/signup/affiliate" className="role-card" style={{ gridColumn: "1/-1" }}>
            <svg viewBox="0 0 100 100"><Motif kind="heart" color="#3F3350" /></svg>
            <h4>Sign up as an affiliate</h4>
            <p>Promote books and earn commission</p>
          </Link>
        </div>
        <div className="auth-switch" style={{ marginTop: 20, textAlign: "center" }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </section>
  );
}
