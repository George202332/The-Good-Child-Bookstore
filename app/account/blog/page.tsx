import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { BlogPageTabs, type BlogListItem } from "./BlogPageTabs";

/**
 * Author's Blog — lands on the list of posts (their own at every status,
 * plus every other author's published posts, matching the original's
 * authorBlogHTML filter), with "Submit a new blog" as its own tab in the
 * top-left (BlogPageTabs) leading to the write/edit page — a real,
 * persistent Draft → Pending Review → Published workflow (the original's
 * author blog pages were localStorage-only).
 *
 * SEO/marketing: published posts are already wired into the site's real
 * structure — sitemap-blogs.xml lists every published slug, the public
 * detail page (app/blog/[slug]/page.tsx) sets canonical/OG/Twitter
 * metadata and JSON-LD, and the homepage's "From the Journal" section
 * pulls the latest published posts — writing and submitting a post here
 * is what feeds all of that.
 */
interface OwnBlog {
  id: string;
  slug: string;
  title: string;
  content: string;
  coverImageUrl: string | null;
  status: string;
  createdAt: Date;
}

export default async function AuthorBlogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { authorProfile: { include: { blogs: { orderBy: { createdAt: "desc" } } } } },
  });
  const myAuthorId = user?.authorProfile?.id;
  const myPosts = (user?.authorProfile?.blogs ?? []) as OwnBlog[];

  let othersPublished: {
    id: string; slug: string; title: string; content: string; coverImageUrl: string | null;
    createdAt: Date; status: string; author: { user: { name: string } };
  }[] = [];
  try {
    const result = await prisma.blog.findMany({
      where: { status: "PUBLISHED", ...(myAuthorId ? { authorId: { not: myAuthorId } } : {}) },
      include: { author: { include: { user: true } } },
      orderBy: { publishAt: "desc" },
    });
    if (Array.isArray(result)) othersPublished = result;
  } catch {
    // An empty "others" list is fine — the page still shows the
    // author's own posts.
  }

  const posts: BlogListItem[] = [
    ...myPosts.map((p) => ({
      id: p.id,
      slug: p.status === "PUBLISHED" ? p.slug : null,
      title: p.title,
      content: p.content,
      coverImageUrl: p.coverImageUrl,
      status: p.status as BlogListItem["status"],
      createdAt: p.createdAt.toISOString(),
      authorName: session.user.name ?? "",
      isMine: true,
    })),
    ...othersPublished.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content,
      coverImageUrl: p.coverImageUrl,
      status: p.status as BlogListItem["status"],
      createdAt: p.createdAt.toISOString(),
      authorName: p.author.user.name,
      isMine: false,
    })),
  ];

  return (
    <DashboardShell role="AUTHOR" activeKey="blog" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Blog</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Write a new post, or manage your existing ones.</p>
        </div>
      </div>
      <BlogPageTabs posts={posts} />
    </DashboardShell>
  );
}
