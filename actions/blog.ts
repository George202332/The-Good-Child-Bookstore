"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES } from "@/lib/roles";

/**
 * New functionality — the original frontend had no real blog *writing*
 * flow backed by persistent state (its "Author Blog" pages worked off
 * localStorage). This is a genuine CMS: Draft → Pending Review →
 * Published, same workflow as books.
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
  content: string;
  submitForReview: boolean;
}

export async function saveBlogPost(input: SaveBlogInput): Promise<{ ok: boolean; error?: string; blogId?: string }> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") {
    return { ok: false, error: "Only author accounts can write blog posts." };
  }
  if (!input.title.trim() || !input.content.trim()) {
    return { ok: false, error: "Title and content are required." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  if (!user?.authorProfile) {
    return { ok: false, error: "Author profile not found." };
  }

  const baseSlug = slugify(input.title);
  let slug = baseSlug;
  let attempt = 1;
  while (await prisma.blog.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++attempt}`;
  }

  const blog = await prisma.blog.create({
    data: {
      title: input.title.trim(),
      slug,
      content: input.content.trim(),
      authorId: user.authorProfile.id,
      status: input.submitForReview ? "PENDING_REVIEW" : "DRAFT",
    },
  });

  revalidatePath("/account/blog");
  return { ok: true, blogId: blog.id };
}

export async function submitBlogForReview(blogId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return { ok: false, error: "Not authorized." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  const blog = await prisma.blog.findUnique({ where: { id: blogId } });
  if (!blog || !user?.authorProfile || blog.authorId !== user.authorProfile.id) {
    return { ok: false, error: "Not found." };
  }

  await prisma.blog.update({ where: { id: blogId }, data: { status: "PENDING_REVIEW" } });
  revalidatePath("/account/blog");
  return { ok: true };
}

export async function approveBlog(blogId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role)) return { ok: false, error: "Not authorized." };
  await prisma.blog.update({ where: { id: blogId }, data: { status: "PUBLISHED", publishAt: new Date() } });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true };
}

export async function rejectBlog(blogId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role)) return { ok: false, error: "Not authorized." };
  await prisma.blog.update({ where: { id: blogId }, data: { status: "REJECTED" } });
  revalidatePath("/admin/blog");
  return { ok: true };
}
