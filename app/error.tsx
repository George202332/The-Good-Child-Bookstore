"use client";

import Link from "next/link";

/** Shown on any public page that hits an unexpected error. Friendly, no technical detail, with a retry. */
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap" style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <h1 style={{ fontSize: 26, marginBottom: 10 }}>This page took a short nap</h1>
        <p style={{ color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 22 }}>
          Something did not load properly. This is usually brief. Please try again, and if it keeps happening, come back in a few minutes.
          Your cart and your account are safe.
        </p>
        {error.digest && <p style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 18 }}>Reference: {error.digest}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>Try again</button>
          <Link href="/bookshelf" className="btn btn-ghost">Browse the bookshelf</Link>
        </div>
      </div>
    </div>
  );
}
