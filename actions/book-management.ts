"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canModerateContent } from "@/lib/roles";

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
  isbn: string | null;
  title: string;
  status: string;
  authorName: string;
  authorAccountNumber: string;
  createdAt: Date;
  reviewCount: number;
  averageRating: number | null;
}

export async function listBooksForModeration(status: "ALL" | "PUBLISHED" | "PENDING_REVIEW" | "DRAFT" | "REJECTED"): Promise<BookManagementRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return [];

  const books = await prisma.book.findMany({
    where: status === "ALL" ? {} : { status },
    include: { author: { include: { user: true } }, reviews: true, ratings: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return books.map((b: {
    id: string;
    isbn: string | null;
    title: string;
    status: string;
    createdAt: Date;
    author: { user: { name: string; accountNumber: string } };
    reviews: unknown[];
    ratings: { stars: number }[];
  }) => ({
    id: b.id,
    isbn: b.isbn,
    title: b.title,
    status: b.status,
    authorName: b.author.user.name,
    authorAccountNumber: b.author.user.accountNumber,
    createdAt: b.createdAt,
    reviewCount: b.reviews.length,
    averageRating: b.ratings.length > 0 ? b.ratings.reduce((sum, r) => sum + r.stars, 0) / b.ratings.length : null,
  }));
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
  await prisma.review.delete({ where: { id: reviewId } });
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
    await prisma.book.delete({ where: { id: bookId } });
    revalidatePath("/admin/books");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete this book." };
  }
}
