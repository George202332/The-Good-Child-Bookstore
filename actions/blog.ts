"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canModerateContent } from "@/lib/roles";

/**
 * Real, persistent blog authoring — Draft → Pending Review → Published,
 * same workflow as books. Open to every account type (Reader, Author,
 * Affiliate), not just Author — blogging is part of the site's
 * marketing/SEO surface, not an author-only publishing format, so
 * authorship is by User directly rather than requiring an AuthorProfile.
 */

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "post"
  );
}

export interface SaveBlogInput {
  title: string;
  subtitle?: string;
  slug?: string;
  content: string;
  coverImageUrl?: string;
  imageAltText?: string;
  authorFirstName?: string;
  authorLastName?: string;
  shortSummary?: string;
  categories?: string[];
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  seoKeywords?: string;
  canonicalUrl?: string;
  featured?: boolean;
  allowComments?: boolean;
  /** Optional future publish date/time. When set, the post still goes
   * through the same review queue — it's the *going live* moment that's
   * deferred, not the review itself. Left blank, submitting for review
   * makes it eligible to go live as soon as it's approved. */
  scheduledAt?: string;
  submitForReview: boolean;
}

async function uniqueSlug(requested: string | undefined, title: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(requested?.trim() || title);
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const existing = await prisma.blog.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${baseSlug}-${++attempt}`;
  }
}

function scheduledPublishAt(input: SaveBlogInput): Date | null {
  if (!input.scheduledAt) return null;
  const d = new Date(input.scheduledAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveBlogPost(input: SaveBlogInput): Promise<{ ok: boolean; error?: string; blogId?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You need to be signed in to write a blog post." };
  }
  if (!input.title.trim() || !input.content.trim()) {
    return { ok: false, error: "Title and content are required." };
  }

  const slug = await uniqueSlug(input.slug, input.title);

  const blog = await prisma.blog.create({
    data: {
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      slug,
      content: input.content.trim(),
      coverImageUrl: input.coverImageUrl || null,
      imageAltText: input.imageAltText?.trim() || null,
      authorFirstName: input.authorFirstName?.trim() || null,
      authorLastName: input.authorLastName?.trim() || null,
      shortSummary: input.shortSummary?.trim() || null,
      categories: input.categories ?? [],
      tags: input.tags ?? [],
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
      seoKeywords: input.seoKeywords?.trim() || null,
      canonicalUrl: input.canonicalUrl?.trim() || null,
      featured: input.featured ?? false,
      allowComments: input.allowComments ?? true,
      authorId: session.user.id,
      status: input.submitForReview ? "PENDING_REVIEW" : "DRAFT",
      publishAt: scheduledPublishAt(input),
    },
  });

  revalidatePath("/account/blog");
  return { ok: true, blogId: blog.id };
}

/** Editing is only allowed for the writer's own posts that are still
 * DRAFT or REJECTED — once a post is PENDING_REVIEW or PUBLISHED it's
 * out of the writer's hands, same logic book submissions already use. */
export async function updateBlogPost(blogId: string, input: SaveBlogInput): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You need to be signed in to write a blog post." };
  }
  if (!input.title.trim() || !input.content.trim()) {
    return { ok: false, error: "Title and content are required." };
  }

  const blog = await prisma.blog.findUnique({ where: { id: blogId } });
  if (!blog || blog.authorId !== session.user.id) {
    return { ok: false, error: "Not found." };
  }
  if (blog.status !== "DRAFT" && blog.status !== "REJECTED") {
    return { ok: false, error: "This post can no longer be edited." };
  }

  const slug = await uniqueSlug(input.slug, input.title, blogId);

  await prisma.blog.update({
    where: { id: blogId },
    data: {
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      slug,
      content: input.content.trim(),
      coverImageUrl: input.coverImageUrl || null,
      imageAltText: input.imageAltText?.trim() || null,
      authorFirstName: input.authorFirstName?.trim() || null,
      authorLastName: input.authorLastName?.trim() || null,
      shortSummary: input.shortSummary?.trim() || null,
      categories: input.categories ?? [],
      tags: input.tags ?? [],
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
      seoKeywords: input.seoKeywords?.trim() || null,
      canonicalUrl: input.canonicalUrl?.trim() || null,
      featured: input.featured ?? false,
      allowComments: input.allowComments ?? true,
      status: input.submitForReview ? "PENDING_REVIEW" : "DRAFT",
      publishAt: scheduledPublishAt(input),
    },
  });

  revalidatePath("/account/blog");
  return { ok: true };
}

export async function submitBlogForReview(blogId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };

  const blog = await prisma.blog.findUnique({ where: { id: blogId } });
  if (!blog || blog.authorId !== session.user.id) {
    return { ok: false, error: "Not found." };
  }

  await prisma.blog.update({ where: { id: blogId }, data: { status: "PENDING_REVIEW" } });
  revalidatePath("/account/blog");
  return { ok: true };
}

export async function approveBlog(blogId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { ok: false, error: "Not authorized." };
  const existing = await prisma.blog.findUnique({ where: { id: blogId } });
  if (!existing) return { ok: false, error: "Not found." };
  // Preserve a future scheduled publish date if the author set one —
  // approval makes it eligible to go live, but doesn't move up an
  // intentionally scheduled date.
  const goLiveAt = existing.publishAt && existing.publishAt > new Date() ? existing.publishAt : new Date();
  const blog = await prisma.blog.update({
    where: { id: blogId },
    data: { status: "PUBLISHED", publishAt: goLiveAt },
    include: { author: true },
  });
  const { createNotification } = await import("@/actions/notifications");
  await createNotification(blog.author.id, "Blog post published", `"${blog.title}" is now live on the journal.`);
  const { submitUrlToIndexNow } = await import("@/lib/indexnow");
  const { getPublicSiteUrl } = await import("@/lib/seo/site-url");
  submitUrlToIndexNow(`${getPublicSiteUrl()}/blog/${blog.slug}`).catch(() => {});
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true };
}

export async function rejectBlog(blogId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { ok: false, error: "Not authorized." };
  const blog = await prisma.blog.update({
    where: { id: blogId },
    data: { status: "REJECTED" },
    include: { author: true },
  });
  const { createNotification } = await import("@/actions/notifications");
  await createNotification(blog.author.id, "Blog post needs changes", `"${blog.title}" was not approved this time.`);
  revalidatePath("/admin/blog");
  return { ok: true };
}
