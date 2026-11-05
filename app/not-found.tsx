import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap" style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <h1 style={{ fontSize: 26, marginBottom: 10 }}>We could not find that page</h1>
        <p style={{ color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 22 }}>The book or page may have moved. Try the bookshelf or head back home.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/bookshelf" className="btn btn-primary">Browse the bookshelf</Link>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );
}
