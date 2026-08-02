"use client";

import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin backend error:", error);
  }, [error]);

  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, marginBottom: 10, color: "var(--admin-text, #E8EBF2)" }}>Something went wrong</h2>
        <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 20, lineHeight: 1.6 }}>
          This page hit an unexpected error while loading. It&apos;s usually temporary — try again, and if it keeps
          happening, note what you were doing right before it appeared.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: "var(--admin-text-faint, #6B7385)", marginBottom: 20, fontFamily: "monospace" }}>
            Reference: {error.digest}
          </p>
        )}
        <button type="button" className="btn btn-primary btn-small" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
