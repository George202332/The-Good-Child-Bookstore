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
  const rows = await listAuthorsDirectoryRows();
  return rows.map((r) => ({ authorId: r.authorId, name: r.name }));
}

/** The richer per-row shape behind the author-facing Authors table (see
 * app/account/authors/page.tsx) — same one-row-per-(accountId, name)
 * dedup as listPublishedAuthorNames, plus the extra columns that table
 * shows: how many published books carry this name, this name's primary
 * genre, and how many readers follow it. */
export interface AuthorsDirectoryRow extends PublishedAuthorNameRow {
  bookCount: number;
  primaryGenre: string | null;
  followerCount: number;
}

export async function listAuthorsDirectoryRows(): Promise<AuthorsDirectoryRow[]> {
  const [books, followerCounts] = await Promise.all([
    prisma.book.findMany({
      where: { status: "PUBLISHED" },
      select: {
        authorId: true,
        submissionMetadata: true,
        author: { select: { penName: true, primaryGenre: true, user: { select: { name: true } } } },
      },
    }),
    getAuthorNameFollowerCounts(),
  ]);

  const byKey = new Map<string, AuthorsDirectoryRow>();
  for (const b of books as {
    authorId: string;
    submissionMetadata: unknown;
    author: { penName: string | null; primaryGenre: string | null; user: { name: string } };
  }[]) {
    const name = bookAuthorDisplayName(b);
    const key = `${b.authorId}::${name}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.bookCount += 1;
    } else {
      byKey.set(key, {
        authorId: b.authorId,
        name,
        bookCount: 1,
        primaryGenre: b.author.primaryGenre,
        followerCount: followerCounts[name] ?? 0,
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.followerCount - a.followerCount || a.name.localeCompare(b.name));
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
