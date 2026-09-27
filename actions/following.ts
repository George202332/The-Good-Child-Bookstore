"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Real "follow an author" — the original's az-follow-btn on the book
 * detail page (the-good-child-bookstore_54_1.html:4272) only ever showed
 * a toast ("Following X"); nothing was persisted. This actually is.
 *
 * Per explicit instruction, following is keyed by the author NAME shown
 * on the book's own author card — not the underlying AuthorProfile/
 * account — since the same account can publish under a different pen
 * name for a different book (see lib/book-author-name.ts). Following
 * "J. Okoro" only ever notifies about new books published under that
 * exact name, pen name included, never about a different name the same
 * account might also publish under.
 */

async function getReaderProfileId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "READER") return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { readerProfile: true } });
  return user?.readerProfile?.id ?? null;
}

export async function isFollowingAuthorName(authorName: string): Promise<boolean> {
  const readerId = await getReaderProfileId();
  if (!readerId) return false;
  const existing = await prisma.authorNameFollow.findUnique({ where: { readerId_authorName: { readerId, authorName } } });
  return !!existing;
}

export async function toggleFollowAuthorName(authorName: string): Promise<{ ok: boolean; following?: boolean; error?: string }> {
  const readerId = await getReaderProfileId();
  if (!readerId) return { ok: false, error: "Only reader accounts can follow authors." };
  if (!authorName.trim()) return { ok: false, error: "No author name to follow." };

  const existing = await prisma.authorNameFollow.findUnique({ where: { readerId_authorName: { readerId, authorName } } });
  if (existing) {
    await prisma.authorNameFollow.delete({ where: { id: existing.id } });
    revalidatePath("/account/following");
    return { ok: true, following: false };
  }
  await prisma.authorNameFollow.create({ data: { readerId, authorName } });
  revalidatePath("/account/following");
  return { ok: true, following: true };
}

export interface FollowedAuthorName {
  authorName: string;
}

export async function listMyFollowing(): Promise<FollowedAuthorName[]> {
  const readerId = await getReaderProfileId();
  if (!readerId) return [];
  const follows = await prisma.authorNameFollow.findMany({
    where: { readerId },
    orderBy: { createdAt: "desc" },
  });
  return follows.map((f: { authorName: string }) => ({ authorName: f.authorName }));
}
