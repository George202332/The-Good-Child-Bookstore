import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { getBlogCommentsForModeration } from "@/actions/blog-management";
import { CommentModerationList } from "./CommentModerationList";

/**
 * Blog post detail (admin) — the backend counterpart to reader-submitted
 * comments, which previously had no moderation path at all.
 */
export default async function BlogModerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const { id } = await params;
  const post = await prisma.blog.findUnique({ where: { id }, include: { author: true } });
  if (!post) notFound();
  const byline = (post.authorFirstName || post.authorLastName)
    ? `${post.authorFirstName ?? ""} ${post.authorLastName ?? ""}`.trim()
    : post.author.name;

  const comments = await getBlogCommentsForModeration(id);

  return (
    <AdminShell role={role} activeKey="blog" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{post.title}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            by {byline} · {post.status}
          </p>
        </div>
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Comments ({comments.length})</h3>
      <CommentModerationList comments={comments} />
    </AdminShell>
  );
}
