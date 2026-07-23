"use server";

import { prisma } from "@/lib/prisma";

/** Resolves the real AuthorProfile.id behind a catalog book, so the
 * client-side Follow button (a real feature now, unlike the original's
 * toast-only version) can target the actual seeded author row. */
export async function getBookAuthorId(bookId: string): Promise<string | null> {
  try {
    const book = await prisma.book.findUnique({ where: { id: bookId }, select: { authorId: true } });
    return book?.authorId ?? null;
  } catch {
    return null;
  }
}
