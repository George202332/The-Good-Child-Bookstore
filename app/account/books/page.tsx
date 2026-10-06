import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { ColHelp } from "@/components/ColHelp";
import { SuspendButton } from "./SuspendButton";
import { WithdrawButton } from "./WithdrawButton";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";

interface SaleLineShare {
  authorShare: unknown;
}
interface AuthorBook {
  id: string;
  title: string;
  status: string;
  revisionNotes: string | null;
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
 * every format, total royalties, and two actions: Edit (which resubmits
 * the book for review once saved) and Suspend (pulls it off the store
 * shelf without deleting anything).
 */
export default async function MyBooksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { authorProfile: { include: { books: { include: { saleLines: true, categories: { include: { category: true } } } } } } },
  });
  const books = (user?.authorProfile?.books ?? []) as AuthorBook[];

  return (
    <DashboardShell role="AUTHOR" activeKey="mybooks" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>My Books</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Your titles and how each is performing.</p>
        </div>
        <Link href="/account/books/new" className="btn btn-primary btn-small">Submit a new title</Link>
      </div>
      {books.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          You haven&apos;t published any books yet — submit your first title above.
        </div>
      ) : (
        <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The book's title." /></th>
                <th style={TABLE_HEAD_STYLE}>Status<ColHelp text="Attention: sent back for revision. Published: live in the store. On Review: awaiting moderation. Draft: not yet submitted. Suspended: pulled off the shelf by you." /></th>
                <th style={TABLE_HEAD_STYLE}>Category<ColHelp text="The book's primary category." /></th>
                <th style={TABLE_HEAD_STYLE}>Units Sold<ColHelp text="Total copies sold across every format (eBook, print, audiobook) combined." /></th>
                <th style={TABLE_HEAD_STYLE}>Royalties<ColHelp text="Your total lifetime earnings from this book's sales." /></th>
                <th style={TABLE_HEAD_STYLE}>Edit<ColHelp text="Opens the submission form to update this book's details. Saving resubmits it for review." /></th>
                <th style={TABLE_HEAD_STYLE}>Suspend<ColHelp text="Removes this book from the store shelf without deleting it. You can restore it any time." /></th>
                <th style={TABLE_HEAD_STYLE}>Withdraw<ColHelp text="Removes this book from the catalog for good — its sales history stays on record, but it's no longer for sale." /></th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => {
                const units = b.saleLines.length;
                const royalties = b.saleLines.reduce((sum, l) => sum + Number(l.authorShare), 0);
                const pill = STATUS_PILL[b.status] ?? { label: b.status, className: "status-draft" };
                return (
                  <tr key={b.id}>
                    <td style={TABLE_CELL_STYLE}>
                      <strong>{b.title}</strong>
                      {b.status === "REJECTED" && b.revisionNotes && (
                        <div style={{ fontSize: 12, color: "#6F1A28", marginTop: 4, maxWidth: 260 }}>
                          &quot;{b.revisionNotes}&quot;
                        </div>
                      )}
                    </td>
                    <td style={TABLE_CELL_STYLE}><span className={`status-pill ${pill.className}`}>{pill.label}</span></td>
                    <td style={TABLE_CELL_STYLE}>{b.categories[0]?.category.name ?? "—"}</td>
                    <td style={TABLE_CELL_STYLE}>{units}</td>
                    <td style={TABLE_CELL_STYLE}>${royalties.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}><Link href={`/account/books/${b.id}/edit`} className="btn btn-ghost btn-small">Edit</Link></td>
                    <td style={TABLE_CELL_STYLE}>
                      {(b.status === "SUSPENDED" || b.status === "WITHDRAWN")
                        ? <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Contact support</span>
                        : <SuspendButton bookId={b.id} suspended={b.status === "ARCHIVED"} />}
                    </td>
                    <td style={TABLE_CELL_STYLE}>
                      <WithdrawButton bookId={b.id} alreadyWithdrawn={b.status === "WITHDRAWN"} />
                    </td>
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
