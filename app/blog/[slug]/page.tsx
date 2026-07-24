import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicBlogComments } from "@/actions/blog-comments";
import { BlogCommentSection } from "@/components/BlogCommentSection";

export const dynamic = "force-dynamic";

interface PublishedBlog {
  id: string;
  title: string;
  content: string;
  status: string;
  publishAt: Date | null;
  createdAt: Date;
  author: { user: { name: string } };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await prisma.blog.findUnique({ where: { slug }, select: { title: true, content: true, status: true } });
    if (!post || post.status !== "PUBLISHED") return { title: "Post not found | The Good Child Bookstore" };
    const title = `${post.title} | The Good Child Bookstore Journal`;
    const description = post.content.slice(0, 155);
    return {
      title,
      description,
      alternates: { canonical: `https://thegoodchildbookstore.com/blog/${slug}` },
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

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 60, maxWidth: 720, margin: "0 auto" }}>
      <div className="breadcrumb"><Link href="/blog">The Journal</Link> › {post.title}</div>
      <h1 style={{ marginTop: 12 }}>{post.title}</h1>
      <div className="blog-meta" style={{ marginBottom: 24 }}>
        by {post.author.user.name} · {(post.publishAt ?? post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{post.content}</div>
      <BlogCommentSection blogId={post.id} initial={comments} />
    </div>
  );
}
