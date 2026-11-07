import { FlashNotice } from "@/components/FlashNotice";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { MyBooksTable, type MyBookRow, type MyBookCell } from "./MyBooksTable";
import { PAID_ONLY } from "@/lib/paid-sales";
import { groupEditions } from "@/lib/book-groups";
import { bookAuthorDisplayName } from "@/lib/book-author-name";
import { authorRevisionStatus, type HeldFullRevision } from "@/lib/revision-state";

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
  ebookPrice?: unknown;
  paperbackPrice?: unknown;
  hardcoverPrice?: unknown;
  audiobookPrice?: unknown;
  categories: { category: { name: string } }[];
  category: string | null;
}

/** The words shown under a format's figure for a book that is live: "Published". Anything else is "Unpublished" (the stage is shown small beneath). */
const STAGE_LABEL: Record<string, string> = {
  PENDING_REVIEW: "On Review", DRAFT: "Draft", REJECTED: "Attention", ARCHIVED: "Suspended by you", SUSPENDED: "Suspended", WITHDRAWN: "Withdrawn",
};

/**
 * "My Books": 10 books at first, then Load More adds 10 each press. Columns: Title, Author, Category, Units Sold, Royalty, then one cell per format (eBook,
 * Audiobook, Paperback, Hardcover) holding that format's copies sold with its status beneath ("Unpublished" when it is not live).
 * One book is one row; hovering (or tapping) a row shows its actions at the right end: Edit eBook/Audiobook, and Edit Print or Add Print.
 */
const SAVED_NOTICES: Record<string, string> = {
  review: "Your book was sent for review. We will publish it as soon as it is approved.",
  republished: "Your changes were sent for review. Your approved version stays on sale until the new one is approved.",
};

export default async function MyBooksPage({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
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

  const rows: MyBookRow[] = groups.map((group) => {
    const b = group[0];
    const units = group.reduce((n, r) => n + r.saleLines.length, 0);
    const royalty = group.reduce((sum, r) => sum + r.saleLines.reduce((s2, l) => s2 + Number(l.authorShare), 0), 0);
    const authorName = bookAuthorDisplayName({ submissionMetadata: b.submissionMetadata, author: { penName: authorPenName, user: { name: accountName } } });
    const cover = group.map((r) => r.coverImageUrl).find(Boolean) ?? null;
    const category = group.map((r) => r.category).find(Boolean) ?? group.map((r) => r.categories[0]?.category.name).find(Boolean) ?? "—";
    const digitalRow = group.find((r) => r.hasEbook || r.hasAudiobook);
    const printRow = group.find((r) => r.hasPrint);
    const soldOf = (fmt: string) => group.reduce((n, r) => n + r.saleLines.filter((l) => String(l.format ?? "").toLowerCase() === fmt).length, 0);
    const printOn = (key: "paperbackEnabled" | "hardcoverEnabled", r: AuthorBook | undefined) => {
      if (!r) return false;
      const flag = (r.submissionMetadata as Record<string, unknown> | null)?.[key];
      return flag === undefined ? true : !!flag;
    };
    const priceOf = (v: unknown): number | null => (v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
    const cell = (fmt: string, row: AuthorBook | undefined, offered: boolean, price: unknown): MyBookCell => {
      const exists = !!row && offered;
      const status: MyBookCell["status"] = exists && row!.status === "PUBLISHED" ? "published" : exists && row!.status === "PENDING_REVIEW" ? "review" : "unpublished";
      return {
        sold: soldOf(fmt),
        price: exists ? priceOf(price) : null,
        exists,
        status,
        stage: exists && status === "unpublished" ? STAGE_LABEL[row!.status] : undefined,
      };
    };
    const ebookRow = group.find((r) => r.hasEbook);
    const audioRow = group.find((r) => r.hasAudiobook);
    const notes: MyBookRow["notes"] = [];
    for (const r of group) {
      const meta = (r as { submissionMetadata?: { lastRevisionOutcome?: { state?: string } } | null }).submissionMetadata ?? {};
      const st = r.status === "PUBLISHED" ? authorRevisionStatus(r.pendingRevisionData, meta.lastRevisionOutcome) : null;
      if (!st) continue;
      const edition = r.hasPrint && !r.hasEbook && !r.hasAudiobook ? "Print Book" : "eBook/Audiobook";
      const note = st === "Needs Attention" ? (r.pendingRevisionData as unknown as HeldFullRevision | null)?.note : undefined;
      notes.push({ text: `${edition} edit: ${st}${note ? ` \u2014 "${note}"` : ""}`, alert: st === "Needs Attention" });
    }
    for (const r of group.filter((x) => x.status === "REJECTED" && x.revisionNotes)) notes.push({ text: `"${r.revisionNotes}"`, alert: true });
    const actions: MyBookRow["actions"] = [];
    if (digitalRow) actions.push({ href: `/account/books/${digitalRow.id}/edit?edition=ebook`, label: "Edit eBook/Audiobook" });
    if (printRow) actions.push({ href: `/account/books/${printRow.id}/edit?edition=print`, label: "Edit Print" });
    else if (digitalRow) actions.push({ href: `/account/books/${digitalRow.id}/edit?edition=print`, label: "Add Print" });
    if (!digitalRow && printRow) actions.push({ href: `/account/books/${printRow.id}/edit?edition=ebook`, label: "Add eBook/Audiobook" });
    return {
      id: b.id, title: b.title, cover, authorName, category, units, royalty, notes, actions,
      cells: {
        ebook: cell("ebook", ebookRow, true, ebookRow?.ebookPrice),
        audiobook: cell("audiobook", audioRow, true, audioRow?.audiobookPrice),
        paperback: cell("paperback", printRow, printOn("paperbackEnabled", printRow), printRow?.paperbackPrice),
        hardcover: cell("hardcover", printRow, printOn("hardcoverEnabled", printRow), printRow?.hardcoverPrice),
      },
    };
  });

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
        <MyBooksTable rows={rows} />
      )}
    </DashboardShell>
  );
}
