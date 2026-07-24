"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Real reader comments on published blog posts — new functionality
 * (the original had no persistent comment system for blog posts). */

export interface PublicBlogComment {
  id: string;
  content: string;
  commenterName: string;
  createdAt: string;
}

export async function getPublicBlogComments(blogId: string): Promise<PublicBlogComment[]> {
  try {
    const comments = await prisma.blogComment.findMany({
      where: { blogId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    return comments.map((c: { id: string; content: string; createdAt: Date; user: { name: string } }) => ({
      id: c.id,
      content: c.content,
      commenterName: c.user.name,
      createdAt: c.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function submitBlogComment(blogId: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in to comment." };
  if (!content.trim()) return { ok: false, error: "Comment can't be empty." };

  const blog = await prisma.blog.findUnique({ where: { id: blogId } });
  if (!blog || blog.status !== "PUBLISHED") return { ok: false, error: "This post isn't available for comments." };

  await prisma.blogComment.create({
    data: { blogId, userId: session.user.id, content: content.trim() },
  });
  revalidatePath(`/blog`);
  return { ok: true };
}
