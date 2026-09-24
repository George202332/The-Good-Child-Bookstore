import { confirmEmailVerification } from "@/lib/email/verification";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  const result = token
    ? await confirmEmailVerification(token)
    : { ok: false, error: "No verification token was provided." };

  return (
    <div className="wrap" style={{ padding: "80px 0", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      {result.ok ? (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>
            {result.purpose === "AUTHOR" ? "Author identity verified" : "Email verified"}
          </h1>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
            {result.purpose === "AUTHOR"
              ? "Thanks — your author identity is now confirmed."
              : "Thanks — your email address is now confirmed."}
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>Couldn&apos;t verify</h1>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>{result.error}</p>
        </>
      )}
      <Link href="/account" className="btn btn-primary btn-small">Go to your account</Link>
    </div>
  );
}
