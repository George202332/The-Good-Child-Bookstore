import Link from "next/link";
import { listNeedsAction } from "@/lib/review-notify";

/**
 * "Needs action": every new book posted and every edited book waiting for a reviewer, each with a button that opens its review.
 * It lives at the top of Book Management (never on the dashboard). Dark text on the amber for strong contrast.
 */
export async function NeedsActionBanner() {
  const items = await listNeedsAction().catch(() => []);
  if (items.length === 0) return null;
  return (
    <section role="status" aria-label="Needs action" style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 12, background: "#FFD66B", color: "#1F1300", border: "1px solid #C89300" }}>
      <strong style={{ fontSize: 15 }}>Needs action: {items.length}</strong>
      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.slice(0, 8).map((n) => (
          <li key={n.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <span style={{ overflowWrap: "anywhere" }}>{n.kind === "posted" ? "A new book has been posted" : "A book has been edited"}: {n.title}</span>
            <Link href={`/admin/books/${n.id}/review`} style={{ background: "#1F1300", color: "#FFFFFF", padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Open Review</Link>
          </li>
        ))}
      </ul>
      {items.length > 8 && <Link href="/admin/books?status=PENDING_REVIEW" style={{ display: "inline-block", marginTop: 10, color: "#1F1300", fontSize: 13.5, fontWeight: 700, textDecoration: "underline" }}>See all {items.length}</Link>}
    </section>
  );
}
