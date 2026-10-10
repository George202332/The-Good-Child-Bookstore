"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { logSelfServiceEvent } from "@/lib/audit-log";
import { canWithdraw } from "@/lib/blog-status";
import { prepareBlogNotificationCleanup } from "@/lib/notification-cleanup";

/**
 * Writer-side row actions for the My Blogs table (app/account/blog).
 * Open to every account type that can blog (Reader, Author, Affiliate);
 * the real gate is that the signed-in user must be the post's own
 * author. Moderation actions (approve / reject / suspend / moderator
 * withdraw) stay in actions/blog.ts.
 */

function revalidateBlogPaths(slug: string) {
  revalidatePath("/account/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/");
  revalidatePath("/admin/blog");
}

/** Takes the writer's own Published or Pending Review post off the
 * public site / review queue and returns it to Draft (so it can be
 * edited and resubmitted). Not the moderator's permanent WITHDRAWN state. */
export async function withdrawMyBlog(blogId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };

  const blog = await prisma.blog.findUnique({
    where: { id: blogId },
    select: { id: true, slug: true, status: true, authorId: true },
  });
  if (!blog || blog.authorId !== session.user.id) return { ok: false, error: "Not found." };
  if (!canWithdraw(blog.status)) return { ok: false, error: "Only a published or pending review blog can be withdrawn." };

  // Conditional on the status we validated so a concurrent moderation
  // change is never overwritten.
  const res = await prisma.blog.updateMany({
    where: { id: blogId, authorId: session.user.id, status: blog.status },
    data: { status: "DRAFT" },
  });
  if (res.count === 0) return { ok: false, error: "This blog changed in the meantime. Please refresh and try again." };

  await logSelfServiceEvent(session.user.id, "BLOG_WITHDRAWN", { blogId, from: blog.status });
  revalidateBlogPaths(blog.slug);
  return { ok: true };
}

/** Permanently deletes the writer's own post, in any status. Its
 * comments and read records go with it (onDelete: Cascade). */
export async function deleteMyBlog(blogId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };

  const blog = await prisma.blog.findUnique({
    where: { id: blogId },
    select: { id: true, slug: true, status: true, authorId: true },
  });
  if (!blog || blog.authorId !== session.user.id) return { ok: false, error: "Not found." };

  const cleanupNotifications = await prepareBlogNotificationCleanup(blogId);
  const removed = await prisma.blog.deleteMany({ where: { id: blogId, authorId: session.user.id } });
  // Its published / revision / suspended / withdrawn notifications go too.
  if (removed.count > 0) await cleanupNotifications();

  await logSelfServiceEvent(session.user.id, "BLOG_DELETED", { blogId, status: blog.status });
  revalidateBlogPaths(blog.slug);
  return { ok: true };
}
