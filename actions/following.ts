"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Real "follow an author" — the original's az-follow-btn on the book
 * detail page (the-good-child-bookstore_54_1.html:4272) only ever showed
 * a toast ("Following X"); nothing was persisted. This actually is. */

async function getReaderProfileId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "READER") return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { readerProfile: true } });
  return user?.readerProfile?.id ?? null;
}

export async function isFollowingAuthor(authorId: string): Promise<boolean> {
  const readerId = await getReaderProfileId();
  if (!readerId) return false;
  const existing = await prisma.authorFollow.findUnique({ where: { readerId_authorId: { readerId, authorId } } });
  return !!existing;
}

export async function toggleFollowAuthor(authorId: string): Promise<{ ok: boolean; following?: boolean; error?: string }> {
  const readerId = await getReaderProfileId();
  if (!readerId) return { ok: false, error: "Only reader accounts can follow authors." };

  const existing = await prisma.authorFollow.findUnique({ where: { readerId_authorId: { readerId, authorId } } });
  if (existing) {
    await prisma.authorFollow.delete({ where: { id: existing.id } });
    revalidatePath("/account/following");
    return { ok: true, following: false };
  }
  await prisma.authorFollow.create({ data: { readerId, authorId } });
  revalidatePath("/account/following");
  return { ok: true, following: true };
}

export interface FollowedAuthor {
  authorId: string;
  name: string;
}

export async function listMyFollowing(): Promise<FollowedAuthor[]> {
  const readerId = await getReaderProfileId();
  if (!readerId) return [];
  const follows = await prisma.authorFollow.findMany({
    where: { readerId },
    include: { author: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
  return follows.map((f: { authorId: string; author: { user: { name: string } } }) => ({
    authorId: f.authorId,
    name: f.author.user.name,
  }));
}
