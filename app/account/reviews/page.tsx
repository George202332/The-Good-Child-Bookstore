import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyReviews } from "@/actions/reviews";

/** My Reviews — every review the reader has written, real data. */
export default async function MyReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "READER") redirect("/account");

  const reviews = await getMyReviews();

  return (
    <DashboardShell role="READER" activeKey="reviews" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Reviews</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every review you&apos;ve written.</p>
        </div>
      </div>
      {reviews.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          You haven&apos;t written any reviews yet — find a book you&apos;ve read on its page to leave one.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Link href={`/book/${r.bookId}`} style={{ fontWeight: 700, fontSize: 13.5 }}>{r.bookTitle}</Link>
                <span>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
