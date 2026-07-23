"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * A real review system — the original frontend had a "write a review"
 * toggleReviewForm()/submitReview() pair in its JS, but no button in
 * detailHTML ever called them, so it was unreachable dead code (see the
 * note on app/book/[id]/page.tsx). This is that feature, actually wired
 * up and backed by the database instead of localStorage: one star Rating
 * plus one text Review per (reader, book).
 */

export interface RealReview {
  id: string;
  name: string;
  content: string;
  stars: number;
  createdAt: string;
}

export async function getBookReviews(bookId: string): Promise<RealReview[]> {
  try {
    const reviews = await prisma.review.findMany({
      where: { bookId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    const ratings = await prisma.rating.findMany({ where: { bookId } });
    const ratingByUser = new Map(ratings.map((r: { userId: string; stars: number }) => [r.userId, r.stars]));

    return reviews.map((r: { id: string; content: string; createdAt: Date; userId: string; user: { name: string } }) => ({
      id: r.id,
      name: r.user.name,
      content: r.content,
      stars: ratingByUser.get(r.userId) ?? 5,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function submitReview(input: { bookId: string; content: string; stars: number }): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "READER") {
    return { ok: false, error: "Only reader accounts can write reviews." };
  }
  if (!input.content.trim()) {
    return { ok: false, error: "Please write something before submitting." };
  }
  const stars = Math.min(5, Math.max(1, Math.round(input.stars)));

  await prisma.rating.upsert({
    where: { bookId_userId: { bookId: input.bookId, userId: session.user.id } },
    update: { stars },
    create: { bookId: input.bookId, userId: session.user.id, stars },
  });
  await prisma.review.create({
    data: { bookId: input.bookId, userId: session.user.id, content: input.content.trim() },
  });

  revalidatePath(`/book/${input.bookId}`);
  revalidatePath("/account/reviews");
  return { ok: true };
}

export interface MyReview {
  id: string;
  bookId: string;
  bookTitle: string;
  content: string;
  stars: number;
  createdAt: string;
}

export async function getMyReviews(): Promise<MyReview[]> {
  const session = await auth();
  if (session?.user?.role !== "READER") return [];
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: session.user.id },
      include: { book: true },
      orderBy: { createdAt: "desc" },
    });
    const ratings = await prisma.rating.findMany({ where: { userId: session.user.id } });
    const ratingByBook = new Map(ratings.map((r: { bookId: string; stars: number }) => [r.bookId, r.stars]));

    return reviews.map((r: { id: string; bookId: string; content: string; createdAt: Date; book: { title: string } }) => ({
      id: r.id,
      bookId: r.bookId,
      bookTitle: r.book.title,
      content: r.content,
      stars: ratingByBook.get(r.bookId) ?? 5,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
