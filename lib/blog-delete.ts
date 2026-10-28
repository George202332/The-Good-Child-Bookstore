import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { prepareBlogNotificationCleanup } from "@/lib/notification-cleanup";

/**
 * Permanently deletes one blog post and everything tied to it, so nothing is
 * left behind:
 *  - its comments and read records (removed by the database with the post);
 *  - every notification that refers to it (published / revision / suspended /
 *    withdrawn notices, plus the older ones that carry no record id);
 *  - the images and files uploaded for it (cover + pictures inside the text),
 *    but only when no other post, book, profile, page or setting still uses
 *    the same file, so a shared picture is never pulled out from under
 *    something else;
 *  - its page-level SEO entry and any redirect for its address.
 * Then every page that could list it is refreshed, so it disappears from the
 * public blog, the author's My Blogs and the admin list straight away.
 *
 * Callers must already have checked the user is allowed to do this.
 */

/** Pulls uploaded image / file ids out of a blog's cover URL and its body HTML. */
export function extractBlogMediaIds(coverImageUrl: string | null | undefined, content: string | null | undefined): { imageIds: string[]; fileIds: string[] } {
  const text = `${coverImageUrl ?? ""}\n${content ?? ""}`;
  const grab = (prefix: string) => {
    const out = new Set<string>();
    const re = new RegExp(`${prefix}([A-Za-z0-9_-]+)`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.add(m[1]);
    return Array.from(out);
  };
  return { imageIds: grab("/api/images/"), fileIds: grab("/api/files/") };
}

async function isStillUsedElsewhere(token: string, excludeBlogId: string): Promise<boolean> {
  // `token` is e.g. "/api/images/<id>". Matches the plain URL and its ?w= variants.
  const [blogs, books, bookFiles, users, profiles, seo, settings, pendingBooks] = await Promise.all([
    prisma.blog.count({ where: { id: { not: excludeBlogId }, OR: [{ coverImageUrl: { contains: token } }, { content: { contains: token } }] } }),
    prisma.book.count({ where: { OR: [{ coverImageUrl: { contains: token } }, { pendingRevisionData: { string_contains: token } }] } }),
    prisma.bookFile.count({ where: { url: { contains: token } } }),
    prisma.user.count({ where: { avatarUrl: { contains: token } } }),
    prisma.authorProfile.count({ where: { pressKitUrl: { contains: token } } }),
    prisma.seoEntry.count({ where: { ogImageUrl: { contains: token } } }),
    prisma.setting.count({ where: { value: { string_contains: token } } }),
    prisma.book.count({ where: { submissionMetadata: { string_contains: token } } }),
  ]);
  return blogs + books + bookFiles + users + profiles + seo + settings + pendingBooks > 0;
}

export async function deleteBlogEverything(blogId: string): Promise<{ ok: boolean; error?: string; title?: string; slug?: string; authorId?: string; removedMedia?: number }> {
  const blog = await prisma.blog.findUnique({
    where: { id: blogId },
    select: { id: true, title: true, slug: true, authorId: true, coverImageUrl: true, content: true },
  });
  if (!blog) return { ok: false, error: "That post no longer exists." };

  const { imageIds, fileIds } = extractBlogMediaIds(blog.coverImageUrl, blog.content);
  const cleanupNotifications = await prepareBlogNotificationCleanup(blogId);

  // Comments and read records go with the post (onDelete: Cascade).
  const removed = await prisma.blog.deleteMany({ where: { id: blogId } });
  if (removed.count === 0) return { ok: false, error: "That post no longer exists." };

  await cleanupNotifications();

  // Page-level SEO entry and redirects that belong to this post's address.
  const path = `/blog/${blog.slug}`;
  await prisma.seoEntry.deleteMany({ where: { path } }).catch(() => undefined);
  await prisma.redirect.deleteMany({ where: { OR: [{ fromPath: path }, { toPath: path }] } }).catch(() => undefined);

  // Uploaded pictures / files that belonged to this post and nothing else.
  let removedMedia = 0;
  for (const id of imageIds) {
    try {
      if (await isStillUsedElsewhere(`/api/images/${id}`, blogId)) continue;
      const res = await prisma.uploadedImage.deleteMany({ where: { id } });
      removedMedia += res.count;
    } catch {
      // Best-effort: a media-cleanup hiccup never undoes the delete.
    }
  }
  for (const id of fileIds) {
    try {
      if (await isStillUsedElsewhere(`/api/files/${id}`, blogId)) continue;
      const res = await prisma.uploadedFile.deleteMany({ where: { id } });
      removedMedia += res.count;
    } catch {
      // Best-effort.
    }
  }

  for (const p of ["/blog", path, "/account/blog", "/admin/blog", "/", "/feed.xml", "/sitemap.xml", "/sitemap-blogs.xml"]) {
    try {
      revalidatePath(p);
    } catch {
      // Non-critical.
    }
  }

  return { ok: true, title: blog.title, slug: blog.slug, authorId: blog.authorId, removedMedia };
}
