import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";

/** Works for every account type, including backend roles. */
export default function ResetPasswordPage() {
  return (
    <section className="auth-section">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <h1>Set a new password</h1>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </section>
  );
}
