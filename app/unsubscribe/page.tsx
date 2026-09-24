import { processUnsubscribe } from "@/lib/email/marketing";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ u?: string; sig?: string }> }) {
  const { u, sig } = await searchParams;

  const result = u && sig
    ? await processUnsubscribe(u, sig)
    : { ok: false, error: "This unsubscribe link is incomplete." };

  return (
    <div className="wrap" style={{ padding: "80px 0", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      {result.ok ? (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>You&apos;re unsubscribed</h1>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
            You won&apos;t receive marketing emails from us anymore. You&apos;ll still get order confirmations and
            other account-related emails.
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>Couldn&apos;t process this</h1>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>{result.error}</p>
        </>
      )}
      <Link href="/" className="btn btn-primary btn-small">Back to the bookshelf</Link>
    </div>
  );
}
