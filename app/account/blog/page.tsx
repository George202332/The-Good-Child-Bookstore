import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import type { Role } from "@/lib/roles";
import { BlogPageTabs, type BlogListItem } from "./BlogPageTabs";

/**
 * Blog — lands on the list of posts (the signed-in writer's own at
 * every status, plus every other writer's published posts), with
 * "Submit a new blog" as its own tab in the top-left (BlogPageTabs)
 * leading to the write/edit page. Open to Reader, Author, and
 * Affiliate accounts alike — blogging is part of the site's real
 * marketing/SEO surface (see app/blog/[slug]/page.tsx for the full SEO
 * wiring: sitemap, canonical/OG/Twitter metadata, JSON-LD), not an
 * author-only publishing format, so authorship is by User directly.
 */
interface OwnBlog {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content: string;
  shortSummary: string | null;
  coverImageUrl: string | null;
  imageAltText: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  categories: string[];
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  seoKeywords: string | null;
  canonicalUrl: string | null;
  featured: boolean;
  allowComments: boolean;
  status: string;
  createdAt: Date;
  publishAt: Date | null;
}

export default async function BlogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as Role;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { blogs: { orderBy: { createdAt: "desc" } } },
  });
  const myPosts = (user?.blogs ?? []) as OwnBlog[];

  let othersPublished: {
    id: string; slug: string; title: string; subtitle: string | null; content: string;
    shortSummary: string | null; coverImageUrl: string | null; imageAltText: string | null;
    authorFirstName: string | null; authorLastName: string | null; categories: string[]; tags: string[];
    metaTitle: string | null; metaDescription: string | null; seoKeywords: string | null; canonicalUrl: string | null;
    featured: boolean; allowComments: boolean; createdAt: Date; publishAt: Date | null; status: string;
    author: { name: string };
  }[] = [];
  try {
    const result = await prisma.blog.findMany({
      where: { status: "PUBLISHED", authorId: { not: session.user.id } },
      include: { author: true },
      orderBy: { publishAt: "desc" },
    });
    if (Array.isArray(result)) othersPublished = result;
  } catch {
    // An empty "others" list is fine — the page still shows the
    // writer's own posts.
  }

  const posts: BlogListItem[] = [
    ...myPosts.map((p) => ({
      id: p.id,
      slug: p.status === "PUBLISHED" ? p.slug : null,
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
      status: p.status as BlogListItem["status"],
      createdAt: p.createdAt.toISOString(),
      publishAt: p.publishAt ? p.publishAt.toISOString() : null,
      authorName: (p.authorFirstName || p.authorLastName) ? `${p.authorFirstName ?? ""} ${p.authorLastName ?? ""}`.trim() : (session.user.name ?? ""),
      isMine: true,
    })),
    ...othersPublished.map((p) => ({
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
      status: p.status as BlogListItem["status"],
      createdAt: p.createdAt.toISOString(),
      publishAt: p.publishAt ? p.publishAt.toISOString() : null,
      authorName: (p.authorFirstName || p.authorLastName) ? `${p.authorFirstName ?? ""} ${p.authorLastName ?? ""}`.trim() : p.author.name,
      isMine: false,
    })),
  ];

  return (
    <DashboardShell role={role} activeKey="blog" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Blog</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Write a new post, or manage your existing ones.</p>
        </div>
      </div>
      <BlogPageTabs posts={posts} defaultAuthorName={session.user.name ?? ""} />
    </DashboardShell>
  );
}
