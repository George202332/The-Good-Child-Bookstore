import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { getBookReviewsForModeration } from "@/actions/book-management";
import { ReviewModerationList } from "./ReviewModerationList";

/**
 * Book detail (admin) — the backend counterpart to reader-submitted
 * reviews, which previously had no moderation path at all once a book
 * was published.
 */
export default async function BookModerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const { id } = await params;
  const book = await prisma.book.findUnique({ where: { id }, include: { author: { include: { user: true } } } });
  if (!book) notFound();

  const reviews = await getBookReviewsForModeration(id);

  return (
    <AdminShell role={role} activeKey="books" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{book.title}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            by {book.author.user.name} · {book.status}
          </p>
        </div>
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Reviews ({reviews.length})</h3>
      <ReviewModerationList reviews={reviews} />
    </AdminShell>
  );
}
