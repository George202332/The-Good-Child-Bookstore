import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicBlogComments } from "@/actions/blog-comments";
import { BlogCommentSection } from "@/components/BlogCommentSection";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export const dynamic = "force-dynamic";

interface PublishedBlog {
  id: string;
  title: string;
  content: string;
  status: string;
  publishAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  author: { user: { name: string }; bio: string | null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = getPublicSiteUrl();
  try {
    const post = await prisma.blog.findUnique({ where: { slug }, select: { title: true, content: true, status: true } });
    if (!post || post.status !== "PUBLISHED") return { title: "Post not found | The Good Child Bookstore" };
    const title = `${post.title} | The Good Child Bookstore Journal`;
    const description = post.content.slice(0, 155);
    return {
      title,
      description,
      alternates: { canonical: `${siteUrl}/blog/${slug}` },
      openGraph: { title, description, type: "article" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return { title: "The Good Child Bookstore Journal" };
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = (await prisma.blog.findUnique({
    where: { slug },
    include: { author: { include: { user: true } } },
  })) as PublishedBlog | null;

  if (!post || post.status !== "PUBLISHED") notFound();
  const comments = await getPublicBlogComments(post.id);
  const siteUrl = getPublicSiteUrl();

  const jsonLd = blogPostingJsonLd({
    title: post.title,
    slug,
    excerpt: post.content.slice(0, 200),
    authorName: post.author.user.name,
    authorId: post.authorId,
    authorBio: post.author.bio ?? undefined,
    datePublished: (post.publishAt ?? post.createdAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
  });
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${siteUrl}/` },
    { name: "The Journal", url: `${siteUrl}/blog` },
    { name: post.title, url: `${siteUrl}/blog/${slug}` },
  ]);

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 60, maxWidth: 720, margin: "0 auto" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div className="breadcrumb"><Link href="/blog">The Journal</Link> › {post.title}</div>
      <h1 style={{ marginTop: 12 }}>{post.title}</h1>
      <div className="blog-meta" style={{ marginBottom: 24 }}>
        by <Link href={`/authors/profile/${post.authorId}`}>{post.author.user.name}</Link> ·{" "}
        {(post.publishAt ?? post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{post.content}</div>
      <BlogCommentSection blogId={post.id} initial={comments} />
    </div>
  );
}
