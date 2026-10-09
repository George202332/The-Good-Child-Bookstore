import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import type { Role } from "@/lib/roles";
import { BlogPageTabs, type BlogListItem } from "./BlogPageTabs";

/**
 * My Blogs — a table of the signed-in writer's own posts at every
 * status (date, author, title, comments, status, actions), with
 * "Submit a new blog" as its own tab in the top-left (BlogPageTabs)
 * leading to the write/edit page. Open to Reader, Author, and
 * Affiliate accounts alike — blogging is part of the site's real
 * marketing/SEO surface (see app/blog/[slug]/page.tsx for the full SEO
 * wiring: sitemap, canonical/OG/Twitter metadata, JSON-LD), not an
 * author-only publishing format, so authorship is by User directly.
 */
export default async function BlogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as Role;

  // The writer's own posts only (every status), newest first. Bounded and
  // narrowed to the fields the table and the editor need; the comment
  // count comes from a Prisma _count (no N+1).
  const myPosts = await prisma.blog.findMany({
    where: { authorId: session.user.id },
    select: {
      id: true, slug: true, title: true, subtitle: true, content: true,
      shortSummary: true, coverImageUrl: true, imageAltText: true,
      authorFirstName: true, authorLastName: true, categories: true, tags: true,
      metaTitle: true, metaDescription: true, seoKeywords: true, canonicalUrl: true,
      featured: true, allowComments: true, status: true, revisionNotes: true,
      createdAt: true, publishAt: true,
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const posts: BlogListItem[] = myPosts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    content: p.content,
    shortSummary: p.shortSummary,
    coverImageUrl: p.coverImageUrl,
    imageAltText: p.imageAltText,
    authorFirstName: p.authorFirstName,
    authorLastName: p.authorLastName,
    categories: p.categories,
    tags: p.tags,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    seoKeywords: p.seoKeywords,
    canonicalUrl: p.canonicalUrl,
    featured: p.featured,
    allowComments: p.allowComments,
    status: p.status,
    revisionNotes: p.revisionNotes,
    createdAt: p.createdAt.toISOString(),
    publishAt: p.publishAt ? p.publishAt.toISOString() : null,
    authorName: (p.authorFirstName || p.authorLastName) ? `${p.authorFirstName ?? ""} ${p.authorLastName ?? ""}`.trim() : (session.user.name ?? ""),
    commentCount: p._count.comments,
  }));

  return (
    <DashboardShell role={role} activeKey="blog" displayName={session.user.name ?? ""}>
      <BlogPageTabs posts={posts} defaultAuthorName={session.user.name ?? ""} />
    </DashboardShell>
  );
}
