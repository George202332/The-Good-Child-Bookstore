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

  // Previously fetched via `prisma.user.findUnique({ include: { blogs: … } })`
  // with no limit and no field selection at all — every post this
  // account has ever written, each with its full `content` (the
  // complete rich-text/HTML body of the post, easily tens of KB each),
  // pulled into memory on every single visit to this page. The
  // previous round bounded the OTHER writers' published-posts query
  // below (`take: 60` + an explicit `select`) but left this one — the
  // account's OWN posts — completely untouched, which is almost
  // certainly why the crash kept recurring "on every account tested":
  // this query runs for every signed-in visitor regardless of how many
  // posts anyone else has written, so it doesn't need a high-volume
  // outlier account to hit a real cost — it scales with how much any
  // individual account has written over time, and every account that
  // writes blogs accumulates more content here with no cap. Bounded
  // and narrowed the same way the other query already was.
  const myPosts = (await prisma.blog.findMany({
    where: { authorId: session.user.id },
    select: {
      id: true, slug: true, title: true, subtitle: true, content: true,
      shortSummary: true, coverImageUrl: true, imageAltText: true,
      authorFirstName: true, authorLastName: true, categories: true, tags: true,
      metaTitle: true, metaDescription: true, seoKeywords: true, canonicalUrl: true,
      featured: true, allowComments: true, status: true, createdAt: true, publishAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  })) as OwnBlog[];

  let othersPublished: {
    id: string; slug: string; title: string; subtitle: string | null; content: string;
    shortSummary: string | null; coverImageUrl: string | null; imageAltText: string | null;
    authorFirstName: string | null; authorLastName: string | null; categories: string[]; tags: string[];
    metaTitle: string | null; metaDescription: string | null; seoKeywords: string | null; canonicalUrl: string | null;
    featured: boolean; allowComments: boolean; createdAt: Date; publishAt: Date | null; status: string;
    author: { name: string };
  }[] = [];
  try {
    // Bounded to the 60 most recent posts, and selecting only the
    // fields this page actually uses (never `include: { author: true }`,
    // which pulled every other writer's *entire* User row — passwordHash
    // included — for every single published post site-wide). With no
    // limit at all, this grew without bound as more posts were
    // published: a full, unbounded table scan plus a full join on User
    // for every row, on every single visit to this page. Once there was
    // enough real data that query could blow the serverless function's
    // time/memory budget outright — a crash a try/catch around the
    // query can't catch, since the function is killed before the
    // promise has a chance to reject normally. That's almost certainly
    // why reloading never helped: the data that made the query too
    // heavy was still there on every retry.
    const result = await prisma.blog.findMany({
      where: { status: "PUBLISHED", authorId: { not: session.user.id } },
      select: {
        id: true, slug: true, title: true, subtitle: true, content: true,
        shortSummary: true, coverImageUrl: true, imageAltText: true,
        authorFirstName: true, authorLastName: true, categories: true, tags: true,
        metaTitle: true, metaDescription: true, seoKeywords: true, canonicalUrl: true,
        featured: true, allowComments: true, createdAt: true, publishAt: true, status: true,
        author: { select: { name: true } },
      },
      orderBy: { publishAt: "desc" },
      take: 60,
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
      <BlogPageTabs posts={posts} defaultAuthorName={session.user.name ?? ""} />
    </DashboardShell>
  );
}
