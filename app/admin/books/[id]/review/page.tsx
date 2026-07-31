import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { canModerateContent } from "@/lib/roles";
import { ReviewActions } from "./ReviewActions";
import { ManuscriptReviewViewer } from "@/components/ManuscriptReviewViewer";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", PENDING_REVIEW: "Under Review", PUBLISHED: "Approved", REJECTED: "Under Revision", ARCHIVED: "Suspended",
};

/**
 * The real submission review screen — previously, Approve/Reject were
 * only one-click buttons sitting right on the list, with no way to
 * actually open and check what an author submitted first. This page
 * shows everything an editor or admin needs to judge a submission
 * against standard: full details, cover, sample pages, and a direct
 * link to the manuscript file — before deciding.
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

  const manuscript = (book.files as { kind: string; url: string }[]).find((f) => f.kind === "PDF" || f.kind === "EPUB");
  const authorDisplayName = book.author.penName || book.author.user.name;

  return (
    <AdminShell role={role} activeKey="books" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Reviewing: {book.title}</h2>
          <p style={{ color: "var(--ink-soft, var(--admin-text-faint))", fontSize: 13.5, marginTop: 2 }}>
            by {authorDisplayName} · Status: {STATUS_LABEL[book.status] ?? book.status}
          </p>
        </div>
        <Link href={`/admin/books/${book.id}`} className="btn btn-ghost btn-small">View customer reviews</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>
        <div>
          <div className="map-card" style={{ padding: 16 }}>
            {book.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- real uploaded book cover
              <img src={book.coverImageUrl} alt={`${book.title} cover`} style={{ width: "100%", aspectRatio: "2/3", objectFit: "contain", display: "block", marginBottom: 10 }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "2/3", background: "var(--cream, var(--admin-panel))", borderRadius: 8, marginBottom: 10 }} />
            )}
            <div style={{ fontSize: 12, color: "var(--ink-faint, var(--admin-text-faint))" }}>ISBN: {book.isbn || "—"}</div>
          </div>
        </div>

        <div>
          <div className="map-card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Submission details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13.5, marginBottom: 16 }}>
              <div><strong>Category</strong><div style={{ color: "var(--ink-soft, var(--admin-text-faint))" }}>{book.categories[0]?.category.name ?? "—"}</div></div>
              <div><strong>Genre</strong><div style={{ color: "var(--ink-soft, var(--admin-text-faint))" }}>{book.genres[0]?.genre.name ?? "—"}</div></div>
              <div><strong>Age group</strong><div style={{ color: "var(--ink-soft, var(--admin-text-faint))" }}>{book.ageGroup ?? "—"}</div></div>
              <div><strong>Language</strong><div style={{ color: "var(--ink-soft, var(--admin-text-faint))" }}>{book.language ?? "en"}</div></div>
              <div><strong>Price</strong><div style={{ color: "var(--ink-soft, var(--admin-text-faint))" }}>${Number(book.price).toFixed(2)}</div></div>
              <div><strong>Formats</strong><div style={{ color: "var(--ink-soft, var(--admin-text-faint))" }}>
                {[book.hasEbook && "eBook", book.hasPrint && "Print", book.hasAudiobook && "Audiobook"].filter(Boolean).join(", ") || "None selected"}
              </div></div>
            </div>
            <strong style={{ fontSize: 13.5 }}>Description</strong>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft, var(--admin-text-faint))", lineHeight: 1.7, marginTop: 4 }}>
              {book.description || "No description provided."}
            </p>
          </div>

          {manuscript && (
            <div className="map-card" style={{ padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>Manuscript review</h3>
              <p className="field-hint" style={{ margin: "0 0 12px" }}>
                Read-only — this opens the manuscript for review here, it doesn&apos;t offer a download.
              </p>
              {manuscript.kind === "PDF" ? (
                <ManuscriptReviewViewer url={manuscript.url} title={book.title} />
              ) : (
                <p className="field-hint">This manuscript was uploaded as an EPUB — inline preview isn&apos;t supported for that format yet.</p>
              )}
            </div>
          )}

          {book.samplePageUrls.length > 0 && (
            <div className="map-card" style={{ padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>Sample pages ({book.samplePageUrls.length})</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                {(book.samplePageUrls as string[]).map((url: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element -- real uploaded sample page
                  <img key={i} src={url} alt={`Sample page ${i + 1}`} style={{ width: "100%", aspectRatio: "2/3", objectFit: "contain", background: "var(--cream, var(--admin-panel))", borderRadius: 6 }} />
                ))}
              </div>
            </div>
          )}

          {book.revisionNotes && (
            <div className="map-card" style={{ padding: 20, marginBottom: 20, background: "#FBE6B8" }}>
              <h3 style={{ fontSize: 15, marginBottom: 8, color: "#8A5A0B" }}>Existing revision notes</h3>
              <p style={{ fontSize: 13.5, color: "#8A5A0B", lineHeight: 1.6 }}>{book.revisionNotes}</p>
            </div>
          )}

          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Decision</h3>
            <ReviewActions bookId={book.id} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
