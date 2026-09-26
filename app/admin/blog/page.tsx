import { redirect } from "next/navigation";
import Link from "next/link";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { ModerationActions } from "./ModerationActions";
import { getBlogStats, listBlogsForModeration } from "@/actions/blog-management";
import { ColHelp } from "@/components/ColHelp";

const STATUS_TABS: { key: "ALL" | "PUBLISHED" | "PENDING_REVIEW" | "DRAFT" | "REJECTED"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING_REVIEW", label: "Under Review" },
  { key: "PUBLISHED", label: "Approved" },
  { key: "DRAFT", label: "Draft" },
  { key: "REJECTED", label: "Under Revision" },
];

/**
 * Blog Moderation — a real summary (how many Approved / Under Review /
 * Draft / Under Revision) plus a full, filterable list of every post
 * with its comment count, not just a bare pending-review queue.
 */
export default async function BlogModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const { status: statusParam } = await searchParams;
  const activeStatus = (STATUS_TABS.find((t) => t.key === statusParam)?.key ?? "ALL");

  const [stats, posts] = await Promise.all([getBlogStats(), listBlogsForModeration(activeStatus)]);

  return (
    <AdminShell role={role} activeKey="blog" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Blog Moderation</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every post on the platform, at every stage.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value">{stats.published}</div>
          <div className="stat-sub">Live on the journal</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Under review</div>
          <div className="stat-value">{stats.pendingReview}</div>
          <div className="stat-sub">Waiting on a decision</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Draft</div>
          <div className="stat-value">{stats.draft}</div>
          <div className="stat-sub">Not yet submitted</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Under revision</div>
          <div className="stat-value">{stats.rejected}</div>
          <div className="stat-sub">Sent back to the author</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "ALL" ? "/admin/blog" : `/admin/blog?status=${t.key}`}
            className="admin-nav-link"
            style={{
              display: "inline-flex",
              padding: "6px 14px",
              background: activeStatus === t.key ? "var(--admin-accent-soft)" : "var(--admin-panel)",
              color: activeStatus === t.key ? "var(--admin-accent)" : undefined,
              fontWeight: activeStatus === t.key ? 700 : 500,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* A table, matching how Book Management is structured — but unlike
          that page, the header row and column template always render,
          even with zero posts: the empty state is a single row inside
          tbody rather than something that replaces the table outright,
          so the structure is never blank or missing. */}
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Title<ColHelp text="The blog post's title." /></th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Author<ColHelp text="Which author account wrote this post." /></th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Status<ColHelp text="Where this post is in the moderation pipeline: Draft (not submitted), Pending Review, Published (live on the journal), or Rejected (sent back for revision)." /></th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Submitted<ColHelp text="The date this post was created or last submitted for review." /></th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Comments<ColHelp text="How many comments this post has received." /></th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Action<ColHelp text="Approve or reject a post awaiting review, or view its comments once it's already published." /></th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "24px 14px", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13, textAlign: "center" }}>
                  Nothing here yet.
                </td>
              </tr>
            ) : (
              posts.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}><strong>{p.title}</strong></td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{p.authorName}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{p.status}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                    {p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{p.commentCount}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                    {p.status === "PENDING_REVIEW" ? (
                      <ModerationActions blogId={p.id} />
                    ) : (
                      <Link href={`/admin/blog/${p.id}`} className="btn btn-ghost btn-small">View comments</Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
