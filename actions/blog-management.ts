"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canModerateContent } from "@/lib/roles";

/**
 * Blog Moderation — a real summary (Approved/Under Review/Draft/Under
 * Revision) plus a full, filterable list of every post with its comment
 * count, not just the pending-review queue that existed before.
 */

export interface BlogStats {
  published: number;
  pendingReview: number;
  draft: number;
  rejected: number;
}

export async function getBlogStats(): Promise<BlogStats> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { published: 0, pendingReview: 0, draft: 0, rejected: 0 };

  const counts = await prisma.blog.groupBy({ by: ["status"], _count: { status: true } });
  const get = (s: string) => counts.find((c: { status: string; _count: { status: number } }) => c.status === s)?._count.status ?? 0;
  return {
    published: get("PUBLISHED"),
    pendingReview: get("PENDING_REVIEW"),
    draft: get("DRAFT"),
    rejected: get("REJECTED"),
  };
}

export interface BlogManagementRow {
  id: string;
  title: string;
  status: string;
  authorName: string;
  createdAt: Date;
  commentCount: number;
}

export async function listBlogsForModeration(status: "ALL" | "PUBLISHED" | "PENDING_REVIEW" | "DRAFT" | "REJECTED"): Promise<BlogManagementRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return [];

  const posts = await prisma.blog.findMany({
    where: status === "ALL" ? {} : { status },
    include: { author: { include: { user: true } }, comments: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return posts.map((p: {
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    author: { user: { name: string } };
    comments: unknown[];
  }) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    authorName: p.author.user.name,
    createdAt: p.createdAt,
    commentCount: p.comments.length,
  }));
}

export interface BlogCommentRow {
  id: string;
  content: string;
  commenterName: string;
  createdAt: Date;
}

export async function getBlogCommentsForModeration(blogId: string): Promise<BlogCommentRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return [];

  const comments = await prisma.blogComment.findMany({
    where: { blogId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return comments.map((c: { id: string; content: string; createdAt: Date; user: { name: string } }) => ({
    id: c.id,
    content: c.content,
    commenterName: c.user.name,
    createdAt: c.createdAt,
  }));
}

export async function deleteCommentAsModerator(commentId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { ok: false, error: "Not authorized." };
  await prisma.blogComment.delete({ where: { id: commentId } });
  return { ok: true };
}
