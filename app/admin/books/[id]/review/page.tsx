import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canModerateContent, canRatifyModeration } from "@/lib/roles";
import { ReviewActions } from "./ReviewActions";
import { ManuscriptReviewViewer } from "@/components/ManuscriptReviewViewer";
import { getBookReviewsForModeration } from "@/actions/book-management";
import { ReviewModerationList } from "../ReviewModerationList";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", PENDING_REVIEW: "Under Review", PUBLISHED: "Approved", REJECTED: "Under Revision",
  ARCHIVED: "Suspended by author", SUSPENDED: "Suspended", WITHDRAWN: "Withdrawn",
};

/**
 * The real submission review screen — a professional layout: the
 * manuscript preview (two pages at a time, centered) sits at the top,
 * flanked by the review checklist on the left and the decision actions
 * on the right; the cover and every other submission detail sits below
 * it. Approve and Attention (revision) can be finalized by either an
 * Editor or an Admin; Suspend and Withdraw can only be *proposed* by an
 * Editor — an Admin has to ratify them before they actually take
 * effect (see ReviewActions).
 */
export default async function BookReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (!canModerateContent(role)) redirect("/account");

  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      author: { include: { user: true } },
      categories: { include: { category: true } },
      genres: { include: { genre: true } },
      files: true,
    },
  });
  if (!book) notFound();

  const manuscript = (book.files as { kind: string; url: string }[]).find((f) => f.kind === "MANUSCRIPT");
  const authorDisplayName = book.author.penName || book.author.user.name;
  const reviews = await getBookReviewsForModeration(book.id);

  return (
    <div className="admin-shell" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--admin-bg, #0F1420)", overflowY: "auto" }}>
      <Link
        href="/admin/books"
        aria-label="Close"
        style={{
          position: "fixed", top: 20, right: 24, zIndex: 1001, width: 40, height: 40, borderRadius: "50%",
          background: "var(--admin-panel, #171D2B)", border: "1px solid var(--admin-border, #2A3244)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text, #E8EBF2)", fontSize: 20, textDecoration: "none",
        }}
      >
        ×
      </Link>
      <div className="wrap" style={{ padding: "40px 0 60px" }}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Reviewing: {book.title}</h2>
          <p style={{ color: "var(--admin-text-faint)", fontSize: 13.5, marginTop: 2 }}>
            by {authorDisplayName} · Status: {STATUS_LABEL[book.status] ?? book.status}
          </p>
        </div>
      </div>

      {/* Top row: 2-page preview (left) — decision (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, marginBottom: 24, alignItems: "start" }}>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 4, textAlign: "center" }}>Manuscript preview</h3>
          <p className="field-hint" style={{ margin: "0 0 12px", textAlign: "center" }}>
            Read-only — this opens the manuscript for review here, it doesn&apos;t offer a download.
          </p>
          {manuscript ? (
            <ManuscriptReviewViewer url={manuscript.url} title={book.title} spread />
          ) : (
            <p style={{ fontSize: 13, color: "var(--admin-text-faint)", textAlign: "center" }}>No manuscript file uploaded.</p>
          )}
        </div>

        <ReviewActions bookId={book.id} canRatify={canRatifyModeration(role)} pendingAction={book.pendingAction} pendingActionBy={book.pendingActionBy} />
      </div>

      {/* Beneath: cover + every other submission detail */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>
        <div className="map-card" style={{ padding: 16 }}>
          {book.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- real uploaded book cover
            <img src={book.coverImageUrl} alt={`${book.title} cover`} style={{ width: "100%", aspectRatio: "2/3", objectFit: "contain", display: "block", marginBottom: 10 }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "2/3", background: "var(--admin-panel)", borderRadius: 8, marginBottom: 10 }} />
          )}
          <div style={{ fontSize: 12, color: "var(--admin-text-faint)" }}>ISBN: {book.isbn || "—"}</div>
        </div>

        <div>
          <div className="map-card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Submission details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13.5, marginBottom: 16 }}>
              <div><strong>Category</strong><div style={{ color: "var(--admin-text-faint)" }}>{book.categories[0]?.category.name ?? "—"}</div></div>
              <div><strong>Genre</strong><div style={{ color: "var(--admin-text-faint)" }}>{book.genres[0]?.genre.name ?? "—"}</div></div>
              <div><strong>Age group</strong><div style={{ color: "var(--admin-text-faint)" }}>{book.ageGroup ?? "—"}</div></div>
              <div><strong>Language</strong><div style={{ color: "var(--admin-text-faint)" }}>{book.language ?? "en"}</div></div>
              <div><strong>Price</strong><div style={{ color: "var(--admin-text-faint)" }}>${Number(book.price).toFixed(2)}</div></div>
              <div><strong>Formats</strong><div style={{ color: "var(--admin-text-faint)" }}>
                {[book.hasEbook && "eBook", book.hasPrint && "Print", book.hasAudiobook && "Audiobook"].filter(Boolean).join(", ") || "None selected"}
              </div></div>
            </div>
            <strong style={{ fontSize: 13.5 }}>Description</strong>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint)", lineHeight: 1.7, marginTop: 4, whiteSpace: "pre-wrap" }}>
              {book.description || "No description provided."}
            </p>
          </div>

          {book.revisionNotes && (
            <div className="map-card" style={{ padding: 20, background: "#FBE6B8" }}>
              <h3 style={{ fontSize: 15, marginBottom: 8, color: "#8A5A0B" }}>Existing revision notes</h3>
              <p style={{ fontSize: 13.5, color: "#8A5A0B", lineHeight: 1.6 }}>{book.revisionNotes}</p>
            </div>
          )}

          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>Customer reviews ({reviews.length})</h3>
            <ReviewModerationList reviews={reviews} />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
