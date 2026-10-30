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
}

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  REJECTED: { label: "Attention", className: "status-attention" },
  PUBLISHED: { label: "Published", className: "status-published" },
  PENDING_REVIEW: { label: "On Review", className: "status-on-review" },
  DRAFT: { label: "Draft", className: "status-draft-purple" },
  ARCHIVED: { label: "Suspended by you", className: "status-suspended" },
  SUSPENDED: { label: "Suspended", className: "status-attention" },
  WITHDRAWN: { label: "Withdrawn", className: "status-suspended" },
};

const TABLE_HEAD_STYLE: React.CSSProperties = { ...TH_STYLE, padding: "12px 16px", fontSize: 11, letterSpacing: undefined };
const TABLE_CELL_STYLE: React.CSSProperties = { ...TD_STYLE, padding: "10px 16px", fontSize: undefined, verticalAlign: undefined };

/**
 * "My Books" — a real table: status (color-coded tab matching where the
 * book actually is in the review pipeline), category, units sold across
 * every format, total royalties, and one action: Edit. One book is one row, even when
 * it has several formats; Edit opens it with an "eBook and Audiobook" tab and a "Print"
 * tab, each with its own Delete book button.
 */
const SAVED_NOTICES: Record<string, string> = {
  live: "Your changes were saved and are live now.",
  "files-review-manuscript": "Your changes were saved. Your new manuscript is under review and will go live once approved.",
  "files-review-cover": "Your changes were saved. Your new cover is under review and will go live once approved.",
  "files-review-both": "Your changes were saved. Your new manuscript and cover are under review and will go live once approved.",
};

export default async function MyBooksPage({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
  const savedKey = (await searchParams)?.saved;
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
        <div role="status" className="field-hint" style={{ marginBottom: 14 }}>{savedNotice}</div>
      )}
      {groups.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          You haven&apos;t published any books yet — submit your first title above.
        </div>
      ) : (
        <div className="map-card" style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The book's title. One book is one row, even when it has several formats." /></th>
                <th style={TABLE_HEAD_STYLE}>Author<ColHelp text="The author name entered on this book. It can differ from your account name." /></th>
                <th style={TABLE_HEAD_STYLE}>Status<ColHelp text="Attention: sent back for revision. Published: live in the store. On Review: awaiting moderation. Draft: not yet submitted. Suspended: pulled off the shelf." /></th>
                <th style={TABLE_HEAD_STYLE}>Category<ColHelp text="The book's primary category." /></th>
                <th style={TABLE_HEAD_STYLE}>Units Sold<ColHelp text="Total copies sold across every format (eBook, print, audiobook) combined." /></th>
                <th style={TABLE_HEAD_STYLE}>Royalties<ColHelp text="Your total lifetime earnings from this book's sales." /></th>
                <th style={TABLE_HEAD_STYLE}>Edit<ColHelp text="Opens the book. The eBook and Audiobook tab and the Print tab each show that edition's details, price, files and status, and each has its own Delete book button." /></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const b = group[0];
                const units = group.reduce((n, r) => n + r.saleLines.length, 0);
                const royalties = group.reduce((sum, r) => sum + r.saleLines.reduce((s2, l) => s2 + Number(l.authorShare), 0), 0);
                const statuses = [...new Set(group.map((r) => r.status))];
                const authorName = bookAuthorDisplayName({ submissionMetadata: b.submissionMetadata, author: { penName: authorPenName, user: { name: accountName } } });
                const cover = group.map((r) => r.coverImageUrl).find(Boolean);
                const labelOf = (r: AuthorBook) => [r.hasEbook && "eBook", r.hasAudiobook && "Audiobook", r.hasPrint && "Print"].filter(Boolean).join(" + ");
                // One status per book: Published as soon as one edition is, with the live editions named.
                const anyPublished = group.some((r) => r.status === "PUBLISHED");
                const liveLabel = [...new Set(group.filter((r) => r.status === "PUBLISHED").flatMap((r) => [r.hasEbook && "eBook", r.hasAudiobook && "Audiobook", r.hasPrint && "Print"].filter(Boolean) as string[]))].join(", ");
                return (
                  <tr key={b.id}>
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
                    <td style={TABLE_CELL_STYLE}>
                      {anyPublished ? (
                        <>
                          <span className={`status-pill ${STATUS_PILL.PUBLISHED.className}`}>{STATUS_PILL.PUBLISHED.label}</span>
                          <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>Live: {liveLabel}</div>
                        </>
                      ) : statuses.length === 1 ? (
                        (() => { const pill = STATUS_PILL[statuses[0]] ?? { label: statuses[0], className: "status-draft" }; return <span className={`status-pill ${pill.className}`}>{pill.label}</span>; })()
                      ) : (
                        group.map((r) => {
                          const pill = STATUS_PILL[r.status] ?? { label: r.status, className: "status-draft" };
                          return (
                            <div key={r.id} style={{ marginBottom: 4 }}>
                              <span className={`status-pill ${pill.className}`}>{pill.label}</span>
                              <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 6 }}>{labelOf(r)}</span>
                            </div>
                          );
                        })
                      )}
                    </td>
                    <td style={TABLE_CELL_STYLE}>{group.map((r) => r.categories[0]?.category.name).find(Boolean) ?? "—"}</td>
                    <td style={TABLE_CELL_STYLE}>{units}</td>
                    <td style={TABLE_CELL_STYLE}>${royalties.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}><Link href={`/account/books/${b.id}/edit`} className="btn btn-ghost btn-small">Edit</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
