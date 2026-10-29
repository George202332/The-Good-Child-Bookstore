"use server";

import { removeBookPromotions } from "@/lib/promotion-cleanup";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { canModerateContent } from "@/lib/roles";
import { bookAuthorDisplayName } from "@/lib/book-author-name";
import { groupEditions } from "@/lib/book-groups";
import { formatTabsOf, groupIdentifierColumns, type FormatTabView, type FormatViewRow } from "@/lib/book-format-views";
import { prepareBookNotificationCleanup, prepareReviewNotificationCleanup } from "@/lib/notification-cleanup";

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
  const get = (s: string) => counts.find((c: { status: string; _count: { status: number } }) => c.status === s)?._count.status ?? 0;
  return {
    published: get("PUBLISHED"),
    pendingReview: get("PENDING_REVIEW"),
    draft: get("DRAFT"),
    rejected: get("REJECTED"),
  };
}

export interface BookManagementRow {
  id: string;
  /** "SN number" column (eBook / Audiobook); null = show a dash. */
  snNumber: string | null;
  /** "ISBN" column (print); null = show a dash. */
  isbn: string | null;
  /** One book, one row: the records (editions) of this title, each openable/deletable. */
  editions: { id: string; label: string; status: string; hasPendingRevision: boolean }[];
  /** eBook / Print / Audiobook tabs shown when the row is expanded. */
  tabs: FormatTabView[];
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
  const rows = books as unknown as Row[];

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
    const labelOf = (r: Row) => [r.hasEbook && "eBook", r.hasPrint && "Print", r.hasAudiobook && "Audiobook"].filter(Boolean).join(" + ") || "Book";
    return {
      id: b.id,
      snNumber: cols.sn,
      isbn: cols.isbn,
      editions: group.map((r) => ({ id: r.id, label: labelOf(r), status: r.status, hasPendingRevision: r.pendingRevisionData != null })),
      tabs: formatTabsOf(group),
      title: b.title,
      status: b.status,
      authorName,
      authorAccountNumber: b.author.user.accountNumber,
      createdAt: b.createdAt,
      reviewCount: group.reduce((n, r) => n + r.reviews.length, 0),
      averageRating: ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length : null,
      hasPendingRevision: group.some((r) => r.pendingRevisionData != null),
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

/** Permanently deletes a book from the catalog — Admin only. Only
 * actually possible when the book has no sales history: a real
 * financial record (SaleLine) referencing this book must never be
 * silently orphaned or lost, so a book that's ever sold a copy can't
 * be hard-deleted here — withdraw it instead (removes it from sale
 * while keeping the accounting trail intact). */
export async function deleteBookFromCatalog(bookId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can delete a book." };

  const saleCount = await prisma.saleLine.count({ where: { bookId } });
  if (saleCount > 0) {
    return { ok: false, error: "This book has real sales on record and can't be deleted — withdraw it instead to remove it from sale while keeping its accounting history intact." };
  }

  try {
    const cleanupNotifications = await prepareBookNotificationCleanup(bookId);
    await removeBookPromotions(bookId);
    await prisma.book.delete({ where: { id: bookId } });
    // Published / revision / suspended / new-book-by-followed-author and
    // review notifications for this book are removed with it.
    await cleanupNotifications();
    revalidatePath("/admin/books");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete this book." };
  }
}
