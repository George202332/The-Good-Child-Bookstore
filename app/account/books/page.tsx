import { FlashNotice } from "@/components/FlashNotice";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { ColHelp } from "@/components/ColHelp";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import { PAID_ONLY } from "@/lib/paid-sales";
import { groupEditions } from "@/lib/book-groups";
import { bookAuthorDisplayName } from "@/lib/book-author-name";

interface SaleLineShare {
  authorShare: unknown;
  format?: string | null;
}
interface AuthorBook {
  hasEbook: boolean;
  hasPrint: boolean;
  hasAudiobook: boolean;
  coverImageUrl: string | null;
  submissionMetadata: unknown;
  authorId: string;
  createdAt: Date;
  id: string;
  title: string;
  status: string;
  revisionNotes: string | null;
  pendingRevisionData?: unknown;
  saleLines: SaleLineShare[];
  categories: { category: { name: string } }[];
  category: string | null;
}

const PAGE_SIZE = 15;

/** The words shown under a format's figure for a book that is live: "Published". Anything else is "Unpublished" (the stage is shown small beneath). */
const STAGE_LABEL: Record<string, string> = {
  PENDING_REVIEW: "On Review", DRAFT: "Draft", REJECTED: "Attention", ARCHIVED: "Suspended by you", SUSPENDED: "Suspended", WITHDRAWN: "Withdrawn",
};

const TABLE_HEAD_STYLE: React.CSSProperties = { ...TH_STYLE, padding: "12px 16px", fontSize: 11, letterSpacing: undefined };
const TABLE_CELL_STYLE: React.CSSProperties = { ...TD_STYLE, padding: "10px 16px", fontSize: undefined, verticalAlign: undefined };

/**
 * "My Books": 15 books to a page. Columns: Title, Author, Category, Units Sold, Royalty, then one cell per format (eBook,
 * Audiobook, Paperback, Hardcover) holding that format's copies sold with its status beneath ("Unpublished" when it is not live).
 * One book is one row; hovering (or tapping) a row shows its actions at the right end: Edit eBook/Audiobook, and Edit Print or Add Print.
 */
const SAVED_NOTICES: Record<string, string> = {
  review: "Your book was sent for review. We will publish it as soon as it is approved.",
  live: "Your changes were saved and are live now.",
  "files-review-manuscript": "Your changes were saved. Your new manuscript is under review and will go live once approved.",
  "files-review-cover": "Your changes were saved. Your new cover is under review and will go live once approved.",
  "files-review-both": "Your changes were saved. Your new manuscript and cover are under review and will go live once approved.",
};

export default async function MyBooksPage({ searchParams }: { searchParams?: Promise<{ saved?: string; page?: string }> }) {
  const sp = (await searchParams) ?? {};
  const savedKey = sp.saved;
  const savedNotice = savedKey ? SAVED_NOTICES[savedKey] : undefined;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { authorProfile: { include: { books: { where: { deletedByAuthorAt: null }, include: { saleLines: PAID_ONLY, categories: { include: { category: true } } } } } } },
  });
  const records = (user?.authorProfile?.books ?? []) as unknown as AuthorBook[];
  // One entry per book: the editions of a title (eBook / print / audiobook records) are
  // shown together. Display only; no record is changed.
  const authorPenName = user?.authorProfile?.penName ?? null;
  const accountName = user?.name ?? "";
  const groups = groupEditions(records.map((r) => ({ ...r, authorId: r.authorId ?? "me" })));
  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const pageGroups = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DashboardShell role="AUTHOR" activeKey="mybooks" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>My Books</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Your titles and how each is performing.</p>
        </div>
        <Link href="/account/books/new" className="btn btn-primary btn-small">Submit a New Title</Link>
      </div>
      {savedNotice && (
        <FlashNotice text={savedNotice} />
      )}
      {groups.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          You haven&apos;t published any books yet — submit your first title above.
        </div>
      ) : (
        <>
        <style>{`
          .mybooks-row .row-actions{display:flex;flex-direction:column;gap:6px;align-items:stretch;opacity:0;pointer-events:none;transition:opacity .12s}
          .mybooks-row:hover .row-actions,.mybooks-row:focus .row-actions,.mybooks-row:focus-within .row-actions{opacity:1;pointer-events:auto}
          .mybooks-row:hover{background:var(--cream)}
          .mybooks-row{outline:none}
          .mybooks-row .row-actions a{white-space:nowrap;text-align:center}
        `}</style>
        <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The book's title. One book is one row, even when it has several formats. Hover over a row to edit its eBook / Audiobook or its Print Book." /></th>
                <th style={TABLE_HEAD_STYLE}>Author<ColHelp text="The author name entered on this book. It can differ from your account name." /></th>
                <th style={TABLE_HEAD_STYLE}>Category<ColHelp text="The book's category." /></th>
                <th style={TABLE_HEAD_STYLE}>Units Sold<ColHelp text="Total copies sold across every format combined." /></th>
                <th style={TABLE_HEAD_STYLE}>Royalty<ColHelp text="Your total lifetime earnings from this book's sales." /></th>
                <th style={TABLE_HEAD_STYLE}>eBook<ColHelp text="Copies sold of the eBook. Unpublished means it is not live in the store." /></th>
                <th style={TABLE_HEAD_STYLE}>Audiobook<ColHelp text="Copies sold of the audiobook. Unpublished means it is not live in the store." /></th>
                <th style={TABLE_HEAD_STYLE}>Paperback<ColHelp text="Copies sold of the paperback. Unpublished means it is not live in the store." /></th>
                <th style={TABLE_HEAD_STYLE}>Hardcover<ColHelp text="Copies sold of the hardcover. Unpublished means it is not live in the store." /></th>
                <th style={{ ...TABLE_HEAD_STYLE, width: 150 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {pageGroups.map((group) => {
                const b = group[0];
                const units = group.reduce((n, r) => n + r.saleLines.length, 0);
                const royalties = group.reduce((sum, r) => sum + r.saleLines.reduce((s2, l) => s2 + Number(l.authorShare), 0), 0);
                const authorName = bookAuthorDisplayName({ submissionMetadata: b.submissionMetadata, author: { penName: authorPenName, user: { name: accountName } } });
                const cover = group.map((r) => r.coverImageUrl).find(Boolean);
                const category = group.map((r) => r.category).find(Boolean) ?? group.map((r) => r.categories[0]?.category.name).find(Boolean) ?? "—";
                const digitalRow = group.find((r) => r.hasEbook || r.hasAudiobook);
                const printRow = group.find((r) => r.hasPrint);
                // One cell per format: the copies sold of that format, with where the format stands beneath.
                const soldOf = (fmt: string) => group.reduce((n, r) => n + r.saleLines.filter((l) => String(l.format ?? "").toLowerCase() === fmt).length, 0);
                const printOn = (key: "paperbackEnabled" | "hardcoverEnabled", r: AuthorBook | undefined) => {
                  if (!r) return false;
                  const flag = (r.submissionMetadata as Record<string, unknown> | null)?.[key];
                  return flag === undefined ? true : !!flag;
                };
                const cells: { fmt: string; row: AuthorBook | undefined; offered: boolean }[] = [
                  { fmt: "ebook", row: group.find((r) => r.hasEbook), offered: true },
                  { fmt: "audiobook", row: group.find((r) => r.hasAudiobook), offered: true },
                  { fmt: "paperback", row: printRow, offered: printOn("paperbackEnabled", printRow) },
                  { fmt: "hardcover", row: printRow, offered: printOn("hardcoverEnabled", printRow) },
                ];
                return (
                  <tr key={b.id} className="mybooks-row" tabIndex={0}>
                    <td style={TABLE_CELL_STYLE}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- author-uploaded cover served from our own file route
                          <img src={cover} alt="" width={36} height={48} style={{ objectFit: "cover", borderRadius: 3, flex: "none", background: "var(--cream)" }} />
                        ) : (
                          <span aria-hidden style={{ width: 36, height: 48, borderRadius: 3, background: "var(--cream)", flex: "none" }} />
                        )}
                        <div>
                          <strong>{b.title}</strong>
                          {group.some((r) => r.status === "PUBLISHED" && r.pendingRevisionData != null) && (
                            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>New manuscript or cover under review</div>
                          )}
                          {group.filter((r) => r.status === "REJECTED" && r.revisionNotes).map((r) => (
                            <div key={r.id} style={{ fontSize: 12, color: "#6F1A28", marginTop: 4, maxWidth: 260 }}>
                              &quot;{r.revisionNotes}&quot;
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td style={TABLE_CELL_STYLE}>{authorName}</td>
                    <td style={TABLE_CELL_STYLE}>{category}</td>
                    <td style={TABLE_CELL_STYLE}>{units}</td>
                    <td style={TABLE_CELL_STYLE}>${royalties.toFixed(2)}</td>
                    {cells.map(({ fmt, row, offered }) => {
                      const live = !!row && offered && row.status === "PUBLISHED";
                      return (
                        <td key={fmt} style={TABLE_CELL_STYLE}>
                          {live ? (
                            <>
                              <div style={{ fontWeight: 700 }}>{soldOf(fmt)}</div>
                              <div style={{ fontSize: 11, color: "#165236" }}>Published</div>
                            </>
                          ) : (
                            <>
                              <div style={{ color: "var(--ink-faint)" }}>Unpublished</div>
                              {row && offered && STAGE_LABEL[row.status] && <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{STAGE_LABEL[row.status]}</div>}
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...TABLE_CELL_STYLE, width: 150 }}>
                      <div className="row-actions">
                        {digitalRow && <Link href={`/account/books/${digitalRow.id}/edit?edition=ebook`} className="btn btn-ghost btn-small">Edit eBook/Audiobook</Link>}
                        {printRow ? (
                          <Link href={`/account/books/${printRow.id}/edit?edition=print`} className="btn btn-ghost btn-small">Edit Print</Link>
                        ) : digitalRow ? (
                          <Link href={`/account/books/${digitalRow.id}/edit?edition=print`} className="btn btn-ghost btn-small">Add Print</Link>
                        ) : null}
                        {!digitalRow && printRow && <Link href={`/account/books/${printRow.id}/edit?edition=ebook`} className="btn btn-ghost btn-small">Add eBook/Audiobook</Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <nav aria-label="Pages of books" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 14 }}>
            {page > 1 ? <Link href={`/account/books?page=${page - 1}`} className="btn btn-ghost btn-small" aria-label="Previous 15 books">←</Link> : <span className="btn btn-ghost btn-small" style={{ opacity: 0.35 }} aria-hidden>←</span>}
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Page {page} of {totalPages}</span>
            {page < totalPages ? <Link href={`/account/books?page=${page + 1}`} className="btn btn-ghost btn-small" aria-label="Next 15 books">→</Link> : <span className="btn btn-ghost btn-small" style={{ opacity: 0.35 }} aria-hidden>→</span>}
          </nav>
        )}
        </>
      )}
    </DashboardShell>
  );
}
