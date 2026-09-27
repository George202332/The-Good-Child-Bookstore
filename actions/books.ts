"use server";

import { prisma } from "@/lib/prisma";
import { bookAuthorDisplayName } from "@/lib/book-author-name";

/** Resolves the real AuthorProfile.id behind a catalog book — used
 * wherever an action needs the actual account (payouts, moderation),
 * as opposed to getBookAuthorName below, which resolves the display
 * NAME shown on the book's own author card. */
export async function getBookAuthorId(bookId: string): Promise<string | null> {
  try {
    const book = await prisma.book.findUnique({ where: { id: bookId }, select: { authorId: true } });
    return book?.authorId ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the exact author display name shown on a book's own author
 * card — the same name a reader's Follow click subscribes to (see
 * components/FollowAuthorButton.tsx and actions/following.ts). Uses the
 * same priority order as everywhere else this name is shown: the name
 * actually typed in at submission, then the account's standing pen
 * name, then its real name as a last resort.
 */
export async function getBookAuthorName(bookId: string): Promise<string | null> {
  try {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { submissionMetadata: true, author: { select: { penName: true, user: { select: { name: true } } } } },
    });
    if (!book) return null;
    return bookAuthorDisplayName(book);
  } catch {
    return null;
  }
}
