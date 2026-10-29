import { ResetPasswordForm } from "./ResetPasswordForm";

/** Works for every account type, including backend roles.
 * The link's token is read here on the server and handed to the form, so the
 * form is part of the very first page sent (no empty box that fills in later). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return (
    <section className="auth-section">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <h1>Set a new password</h1>
        <ResetPasswordForm token={typeof token === "string" ? token : ""} />
      </div>
    </section>
  );
}
