"use server";

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
  title: string;
  status: string;
  authorName: string;
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
    title: string;
    status: string;
    createdAt: Date;
    author: { user: { name: string } };
    reviews: unknown[];
    ratings: { stars: number }[];
  }) => ({
    id: b.id,
    title: b.title,
    status: b.status,
    authorName: b.author.user.name,
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
