import { redirect, notFound } from "next/navigation";
import { canonicalCategory, categoryOfSubcategory } from "@/lib/taxonomy";
import Link from "next/link";
import { aiDisplayText, firstAiDeclaration } from "@/lib/ai-declaration";
import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { canModerateContent, canRatifyModeration } from "@/lib/roles";
import { ReviewActions } from "./ReviewActions";
import { RevisionReviewCard } from "../RevisionReviewCard";
import { ManuscriptReviewViewer } from "@/components/ManuscriptReviewViewer";
import { getBookReviewsForModeration } from "@/actions/book-management";
import { ReviewModerationList } from "../ReviewModerationList";
import { bookAuthorDisplayName } from "@/lib/book-author-name";

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
  const session = await authAdmin();
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

  // The other edition of the same title (eBook/Audiobook vs Print Book) is reviewed on this same page, in its own section,
  // each with its own preview and its own decision. They stay separate records.
  type Row = typeof book;
  const isPrintOnly = (b: { hasPrint: boolean; hasEbook: boolean; hasAudiobook: boolean }) => b.hasPrint && !b.hasEbook && !b.hasAudiobook;
  const isCombinedRow = book.hasPrint && (book.hasEbook || book.hasAudiobook);
  let sibling: Row | null = null;
  if (!isCombinedRow) {
    const candidates = await prisma.book.findMany({
      where: { authorId: book.authorId, id: { not: book.id }, deletedByAuthorAt: null, title: { equals: book.title, mode: "insensitive" } },
      include: { author: { include: { user: true } }, categories: { include: { category: true } }, genres: { include: { genre: true } }, files: true },
      orderBy: { createdAt: "desc" },
    });
    sibling = candidates.find((c) => !(c.hasPrint && (c.hasEbook || c.hasAudiobook)) && isPrintOnly(c) !== isPrintOnly(book)) ?? null;
  }
  const digitalRow: Row | null = isPrintOnly(book) ? sibling : book;
  const printRow: Row | null = isPrintOnly(book) ? book : sibling;
  const sections: { kind: "digital" | "print"; row: Row }[] = [];
  if (digitalRow) sections.push({ kind: "digital", row: digitalRow });
  if (printRow && printRow.id !== digitalRow?.id) sections.push({ kind: "print", row: printRow });
  const fileOf = (r: Row, kind: string) => (r.files as { kind: string; url: string }[]).find((f) => f.kind === kind);
  // Same submission-time-name → pen name → real name priority order used
  // everywhere else a book's author name is shown (see
  // lib/book-author-name.ts) — an admin reviewing a submission should
  // see whichever name the author actually typed into the Author field
  // for THIS book, not just their standing pen name or real name.
  const authorDisplayName = bookAuthorDisplayName(book);
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

      {/* One section per edition: its own previews and its own decision */}
      {sections.map(({ kind, row }) => {
        const manuscript = fileOf(row, "MANUSCRIPT");
        const audiobook = fileOf(row, "AUDIOBOOK");
        const meta = (row.submissionMetadata as Record<string, unknown> | null) ?? {};
        const preflight = meta.printPreflight as { status?: string } | undefined;
        const title = kind === "print" ? "Print Book" : "eBook / Audiobook";
        const waiting = row.status === "PENDING_REVIEW" || row.pendingRevisionData != null;
        return (
          <section key={row.id} id={`edition-${kind}`} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 17 }}>{title}</h3>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--admin-panel)", border: "1px solid var(--admin-border, #2A3244)" }}>
                {STATUS_LABEL[row.status] ?? row.status}
              </span>
              {waiting && <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#F5D98F", color: "#6B4503" }}>Needs review</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="map-card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, marginBottom: 4, textAlign: "center" }}>{kind === "print" ? "Print Interior Preview" : "Manuscript Preview"}</h3>
                  <p className="field-hint" style={{ margin: "0 0 12px", textAlign: "center" }}>
                    {kind === "print"
                      ? "Print books are PDF only. Read-only, no download."
                      : "Opens PDF, EPUB or MOBI files for review here. Read-only, no download."}
                  </p>
                  {manuscript ? (
                    <ManuscriptReviewViewer url={manuscript.url} title={row.title} spread />
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--admin-text-faint)", textAlign: "center" }}>{kind === "print" ? "No print interior PDF uploaded." : "No manuscript file uploaded."}</p>
                  )}
                </div>
                {kind === "digital" && (
                  <div className="map-card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 15, marginBottom: 4 }}>Audiobook</h3>
                    {audiobook ? (
                      <audio controls controlsList="nodownload" preload="none" src={audiobook.url} style={{ width: "100%" }} />
                    ) : (
                      <p className="field-hint" style={{ margin: 0 }}>No audiobook file was uploaded for this book.</p>
                    )}
                  </div>
                )}
                {kind === "print" && (
                  <div className="map-card" style={{ padding: 20, fontSize: 13.5 }}>
                    <h3 style={{ fontSize: 15, marginBottom: 10 }}>Print Details</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div><strong>Paperback</strong><div style={{ color: "var(--admin-text-faint)" }}>{meta.paperbackEnabled ? `$${Number(meta.paperbackRetailPrice ?? 0).toFixed(2)}` : "Not offered"}</div></div>
                      <div><strong>Hardcover</strong><div style={{ color: "var(--admin-text-faint)" }}>{meta.hardcoverEnabled ? `$${Number(meta.hardcoverRetailPrice ?? 0).toFixed(2)}` : "Not offered"}</div></div>
                      <div><strong>ISBN</strong><div style={{ color: "var(--admin-text-faint)" }}>{String(meta.printIsbn ?? row.isbn ?? "") || "—"}</div></div>
                      <div><strong>Pages</strong><div style={{ color: "var(--admin-text-faint)" }}>{meta.pages ? String(meta.pages) : "—"}</div></div>
                      <div><strong>Print file check</strong><div style={{ color: "var(--admin-text-faint)" }}>{preflight?.status === "PASSED" ? "Passed" : preflight?.status ? preflight.status : "Not recorded"}</div></div>
                    </div>
                  </div>
                )}
              </div>
              <ReviewActions bookId={row.id} canRatify={canRatifyModeration(role)} pendingAction={row.pendingAction} pendingActionBy={row.pendingActionBy} status={row.status} />
            </div>
          </section>
        );
      })}

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
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Submission Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13.5, marginBottom: 16 }}>
              <div><strong>Category</strong><div style={{ color: "var(--admin-text-faint)" }}>{canonicalCategory(book.category) ?? book.category ?? categoryOfSubcategory(book.genres[0]?.genre.name) ?? "—"}</div></div>
              <div><strong>Genre</strong><div style={{ color: "var(--admin-text-faint)" }}>{book.categories[0]?.category.name ?? "—"}</div></div>
              <div><strong>Subcategory</strong><div style={{ color: "var(--admin-text-faint)" }}>{book.subcategory ?? book.genres[0]?.genre.name ?? "—"}</div></div>
              <div><strong>AI Use Declaration</strong><div style={{ color: "var(--admin-text-faint)" }}>{aiDisplayText(firstAiDeclaration(...sections.map((x) => String(((x.row.submissionMetadata as Record<string, unknown> | null) ?? {}).aiDeclaration ?? "")))) || "Not declared"}</div></div>
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

          {sections.map(({ row }) => {
            const pending = row.pendingRevisionData as unknown as { kind?: string; manuscriptFileId?: string; coverImageUrl?: string; input?: { title?: string; description?: string; price?: number } } | null;
            if (!pending) return null;
            if (pending.kind === "files") {
              return (
                <RevisionReviewCard
                  key={row.id}
                  bookId={row.id}
                  files={{ manuscriptUrl: pending.manuscriptFileId ? `/api/files/${pending.manuscriptFileId}` : undefined, coverUrl: pending.coverImageUrl }}
                />
              );
            }
            if (!pending.input) return null;
            return (
              <RevisionReviewCard
                key={row.id}
                bookId={row.id}
                revision={{
                  title: pending.input.title ?? "",
                  description: pending.input.description ?? "",
                  price: pending.input.price ?? 0,
                }}
              />
            );
          })}

          {book.revisionNotes && (
            <div className="map-card" style={{ padding: 20, background: "#F5D98F" }}>
              <h3 style={{ fontSize: 15, marginBottom: 8, color: "#6B4503" }}>Existing Revision Notes</h3>
              <p style={{ fontSize: 13.5, color: "#6B4503", lineHeight: 1.6 }}>{book.revisionNotes}</p>
            </div>
          )}

          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>Customer Reviews ({reviews.length})</h3>
            <ReviewModerationList reviews={reviews} />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
