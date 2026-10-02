import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { canModerateContent } from "@/lib/roles";
import { BlogReviewActions } from "./BlogReviewActions";
import { CommentModerationList } from "../CommentModerationList";
import { getBlogCommentsForModeration } from "@/actions/blog-management";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", PENDING_REVIEW: "Under Review", PUBLISHED: "Approved", REJECTED: "Under Revision",
  ARCHIVED: "Archived", SUSPENDED: "Suspended", WITHDRAWN: "Withdrawn",
};

/**
 * Blog Moderation's review popup — the same design and interaction
 * pattern as Book Management's review screen (see
 * app/admin/books/[id]/review/page.tsx): a full-viewport overlay with a
 * close button, a content preview at the top next to the decision
 * actions, and every other submission detail below it. Brought up to
 * parity per explicit instruction — this didn't exist before; Blog
 * Moderation only had inline Approve/Reject buttons with no preview.
 */
export default async function BlogReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (!canModerateContent(role)) redirect("/account");

  const post = await prisma.blog.findUnique({ where: { id }, include: { author: true } });
  if (!post) notFound();

  const byline = (post.authorFirstName || post.authorLastName)
    ? `${post.authorFirstName ?? ""} ${post.authorLastName ?? ""}`.trim()
    : post.author.name;

  const comments = await getBlogCommentsForModeration(post.id);

  return (
    <div className="admin-shell" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--admin-bg, #0F1420)", overflowY: "auto" }}>
      <Link
        href="/admin/blog"
        aria-label="Close"
        style={{
          position: "fixed", top: 20, right: 24, zIndex: 1001, width: 40, height: 40, borderRadius: "50%",
          background: "var(--admin-panel, #171D2B)", border: "1px solid var(--admin-border, #2A3244)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text, #E8EBF2)", fontSize: 20, textDecoration: "none",
        }}
      >
        ×
      </Link>
      <div className="wrap" style={{ padding: "40px 0 60px" }}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>Reviewing: {post.title}</h2>
            <p style={{ color: "var(--admin-text-faint)", fontSize: 13.5, marginTop: 2 }}>
              by {byline} · Status: {STATUS_LABEL[post.status] ?? post.status}
            </p>
          </div>
        </div>

        {/* Top row: content preview (left) — decision (right) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, marginBottom: 24, alignItems: "start" }}>
          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 4, textAlign: "center" }}>Content preview</h3>
            <p className="field-hint" style={{ margin: "0 0 12px", textAlign: "center" }}>
              Read-only — exactly what readers will see once this post is published.
            </p>
            <div
              style={{
                maxHeight: "60vh", overflowY: "auto", padding: 20, borderRadius: 10,
                background: "var(--admin-panel)", color: "var(--admin-text)", fontSize: 14, lineHeight: 1.7,
              }}
            >
              {post.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- real uploaded post cover
                <img src={post.coverImageUrl} alt={post.imageAltText || `${post.title} cover`} style={{ width: "100%", borderRadius: 8, marginBottom: 14, display: "block" }} />
              )}
              <h2 style={{ fontSize: 20, marginBottom: 4, color: "var(--admin-text)" }}>{post.title}</h2>
              {post.subtitle && <p style={{ fontSize: 14, color: "var(--admin-text-faint)", marginBottom: 14 }}>{post.subtitle}</p>}
              <div dangerouslySetInnerHTML={{ __html: post.content }} />
            </div>
          </div>

          <BlogReviewActions blogId={post.id} />
        </div>

        {/* Beneath: every other submission detail */}
        <div className="map-card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Submission details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13.5, marginBottom: 16 }}>
            <div><strong>Categories</strong><div style={{ color: "var(--admin-text-faint)" }}>{post.categories.length > 0 ? post.categories.join(", ") : "—"}</div></div>
            <div><strong>Tags</strong><div style={{ color: "var(--admin-text-faint)" }}>{post.tags.length > 0 ? post.tags.join(", ") : "—"}</div></div>
            <div><strong>Featured</strong><div style={{ color: "var(--admin-text-faint)" }}>{post.featured ? "Yes" : "No"}</div></div>
            <div><strong>Comments allowed</strong><div style={{ color: "var(--admin-text-faint)" }}>{post.allowComments ? "Yes" : "No"}</div></div>
            <div><strong>Submitted</strong><div style={{ color: "var(--admin-text-faint)" }}>{post.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div></div>
            <div><strong>Scheduled publish</strong><div style={{ color: "var(--admin-text-faint)" }}>{post.publishAt ? post.publishAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</div></div>
          </div>
          <strong style={{ fontSize: 13.5 }}>Short summary</strong>
          <p style={{ fontSize: 13.5, color: "var(--admin-text-faint)", lineHeight: 1.7, marginTop: 4, whiteSpace: "pre-wrap" }}>
            {post.shortSummary || "No short summary provided."}
          </p>
        </div>

        {post.revisionNotes && (
          <div className="map-card" style={{ padding: 20, marginBottom: 20, background: "#FBE6B8" }}>
            <h3 style={{ fontSize: 15, marginBottom: 8, color: "#8A5A0B" }}>Existing revision notes</h3>
            <p style={{ fontSize: 13.5, color: "#8A5A0B", lineHeight: 1.6 }}>{post.revisionNotes}</p>
          </div>
        )}

        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 14 }}>Comments ({comments.length})</h3>
          <CommentModerationList comments={comments} />
        </div>
      </div>
    </div>
  );
}
