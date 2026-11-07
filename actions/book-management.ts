"use server";

import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { canModerateContent } from "@/lib/roles";
import { isAwaitingReview } from "@/lib/revision-state";
import { bookAuthorDisplayName } from "@/lib/book-author-name";
import { groupEditions } from "@/lib/book-groups";
import { formatTabsOf, formatPostedFlags, groupIdentifierColumns, type FormatTabView, type FormatViewRow } from "@/lib/book-format-views";
import { prepareReviewNotificationCleanup } from "@/lib/notification-cleanup";

/**
 * Book Management — a real summary (how many Approved/Under Review/
 * Draft/Under Revision) plus a full, filterable list of every book with
 * its reviews, not just the pending-review queue that existed before.
 * "Under Revision" is the REJECTED status — a book sent back to its
 * author isn't gone, it's waiting on changes before resubmission.
 */

export interface BookStats {
  published: number;
  pendingReview: number;
  draft: number;
  rejected: number;
}

export async function getBookStats(): Promise<BookStats> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { published: 0, pendingReview: 0, draft: 0, rejected: 0 };

  const counts = await prisma.book.groupBy({ by: ["status"], _count: { status: true } });
  // Edits of live books that an author has sent for review also wait on a reviewer.
  const edits = await prisma.book.findMany({ where: { status: "PUBLISHED", pendingRevisionData: { not: null as unknown as object } }, select: { pendingRevisionData: true } });
  const editsWaiting = edits.filter((e: { pendingRevisionData: unknown }) => isAwaitingReview(e.pendingRevisionData)).length;
  const get = (s: string) => counts.find((c: { status: string; _count: { status: number } }) => c.status === s)?._count.status ?? 0;
  return {
    published: get("PUBLISHED"),
    pendingReview: get("PENDING_REVIEW") + editsWaiting,
    draft: get("DRAFT"),
    rejected: get("REJECTED"),
  };
}

export interface BookManagementRow {
  id: string;
  /** "SN" column (eBook / Audiobook); null = show a dash. */
  snNumber: string | null;
  /** "ISBN" column (print); null = show a dash. */
  isbn: string | null;
  /** One book, one row: the records (editions) of this title, each openable/deletable. */
  editions: { id: string; label: string; status: string; hasPendingRevision: boolean }[];
  /** eBook / Print / Audiobook tabs shown when the row is expanded. */
  tabs: FormatTabView[];
  /** Which formats are posted (live): drives the eBook / Audiobook / Print tick columns. */
  posted: { ebook: boolean; audiobook: boolean; print: boolean };
  title: string;
  status: string;
  authorName: string;
  authorAccountNumber: string;
  createdAt: Date;
  reviewCount: number;
  averageRating: number | null;
  hasPendingRevision: boolean;
}

export async function listBooksForModeration(status: "ALL" | "PUBLISHED" | "PENDING_REVIEW" | "DRAFT" | "REJECTED"): Promise<BookManagementRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return [];

  const books = await prisma.book.findMany({
    where: status === "ALL" ? {} : status === "PENDING_REVIEW" ? { OR: [{ status }, { pendingRevisionData: { not: null as unknown as object } }] } : { status },
    include: { author: { include: { user: true } }, reviews: true, ratings: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  type Row = FormatViewRow & {
    authorId: string;
    title: string;
    createdAt: Date;
    pendingRevisionData: unknown;
    author: { penName: string | null; user: { name: string; accountNumber: string } };
    reviews: unknown[];
    ratings: { stars: number }[];
  };
  const rows = (books as unknown as Row[]).filter((r) => status !== "PENDING_REVIEW" || r.status === "PENDING_REVIEW" || isAwaitingReview(r.pendingRevisionData));

  // One row per book: editions of the same title by the same author are shown together.
  // Display only; no record is changed.
  return groupEditions(rows).map((group) => {
    const b = group[0];
    // The name a reader actually follows/sees on this book's own author card — a pen name
    // typed at submission, then the account's standing pen name, then its real name (see
    // lib/book-author-name.ts).
    const authorName = bookAuthorDisplayName(b);
    const ratings = group.flatMap((r) => r.ratings);
    const cols = groupIdentifierColumns(group);
    const tabs = formatTabsOf(group);
    const labelOf = (r: Row) => [r.hasEbook && "eBook", r.hasPrint && "Print", r.hasAudiobook && "Audiobook"].filter(Boolean).join(" + ") || "Book";
    return {
      id: b.id,
      snNumber: cols.sn,
      isbn: cols.isbn,
      editions: group.map((r) => ({ id: r.id, label: labelOf(r), status: r.status, hasPendingRevision: isAwaitingReview(r.pendingRevisionData) })),
      tabs,
      posted: formatPostedFlags(tabs),
      title: b.title,
      status: b.status,
      authorName,
      authorAccountNumber: b.author.user.accountNumber,
      createdAt: b.createdAt,
      reviewCount: group.reduce((n, r) => n + r.reviews.length, 0),
      averageRating: ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length : null,
      hasPendingRevision: group.some((r) => isAwaitingReview(r.pendingRevisionData)),
    };
  });
}

export interface BookReviewRow {
  id: string;
  content: string;
  reviewerName: string;
  createdAt: Date;
}

export async function getBookReviewsForModeration(bookId: string): Promise<BookReviewRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return [];

  const reviews = await prisma.review.findMany({
    where: { bookId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return reviews.map((r: { id: string; content: string; createdAt: Date; user: { name: string } }) => ({
    id: r.id,
    content: r.content,
    reviewerName: r.user.name,
    createdAt: r.createdAt,
  }));
}

export async function deleteReviewAsModerator(reviewId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { ok: false, error: "Not authorized." };
  const cleanupNotifications = await prepareReviewNotificationCleanup(reviewId);
  await prisma.review.delete({ where: { id: reviewId } });
  // The author's "you've got a review" notification for this review goes too.
  await cleanupNotifications();
  return { ok: true };
}

/* Books can no longer be deleted from the admin side. A book is deleted only by its own author, from the author's account
 * (actions/submissions.ts: deleteBook / deleteEdition, which refuse every other role). Sales and earnings are never removed. */
