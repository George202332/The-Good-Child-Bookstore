"use server";

import { prisma } from "@/lib/prisma";
import { bookAuthorDisplayName } from "@/lib/book-author-name";

/**
 * Every author NAME that has a published book on the platform right
 * now — computed live from real PUBLISHED books (never cached), so a
 * newly entered pen name shows up here the moment the book it's on
 * actually goes live. One row per distinct (accountId, name) pair: the
 * same account can legitimately show up more than once if it publishes
 * under more than one name, and each row still links to that same
 * account's one public profile page, since a pen name has no separate
 * profile of its own.
 */
export interface PublishedAuthorNameRow {
  authorId: string;
  name: string;
}

export async function listPublishedAuthorNames(): Promise<PublishedAuthorNameRow[]> {
  const books = await prisma.book.findMany({
    where: { status: "PUBLISHED" },
    select: {
      authorId: true,
      submissionMetadata: true,
      author: { select: { penName: true, user: { select: { name: true } } } },
    },
  });

  const seen = new Map<string, PublishedAuthorNameRow>();
  for (const b of books as { authorId: string; submissionMetadata: unknown; author: { penName: string | null; user: { name: string } } }[]) {
    const name = bookAuthorDisplayName(b);
    const key = `${b.authorId}::${name}`;
    if (!seen.has(key)) seen.set(key, { authorId: b.authorId, name });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Follower counts grouped by the exact author NAME readers followed —
 * used by the admin Book Management table so George can see how much
 * of a following each pen name has built up (see AuthorNameFollow). */
export async function getAuthorNameFollowerCounts(): Promise<Record<string, number>> {
  const grouped = await prisma.authorNameFollow.groupBy({
    by: ["authorName"],
    _count: { authorName: true },
  });
  const counts: Record<string, number> = {};
  for (const g of grouped as { authorName: string; _count: { authorName: number } }[]) {
    counts[g.authorName] = g._count.authorName;
  }
  return counts;
}
