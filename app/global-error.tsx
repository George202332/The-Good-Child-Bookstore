"use client";

/** Last-resort page when even the main layout fails. Plain styles only, because the site's stylesheet may not have loaded. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf7ff", color: "#2E2442", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 440 }}>
            <h1 style={{ fontSize: 24 }}>The Good Child Bookstore will be right back</h1>
            <p style={{ lineHeight: 1.6 }}>Something went wrong on our side. Please try again in a moment. Your cart and account are safe.</p>
            <button type="button" onClick={() => reset()} style={{ marginTop: 12, padding: "12px 24px", borderRadius: 999, border: 0, background: "#F4936F", color: "#2E2442", fontWeight: 700, cursor: "pointer" }}>Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
