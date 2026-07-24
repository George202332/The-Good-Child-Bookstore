import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { ModerationActions } from "./ModerationActions";
import { getBookStats, listBooksForModeration } from "@/actions/book-management";

const STATUS_TABS: { key: "ALL" | "PUBLISHED" | "PENDING_REVIEW" | "DRAFT" | "REJECTED"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING_REVIEW", label: "Under Review" },
  { key: "PUBLISHED", label: "Approved" },
  { key: "DRAFT", label: "Draft" },
  { key: "REJECTED", label: "Under Revision" },
];

/**
 * Book Management — a real summary (how many Approved / Under Review /
 * Draft / Under Revision) plus a full, filterable list of every book
 * with its review count and average rating, not just a bare
 * pending-review queue. "Editors approve, Admins override" — both roles
 * can approve/reject (see actions/admin.ts requireModerationRole()).
 */
export default async function BookManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const { status: statusParam } = await searchParams;
  const activeStatus = (STATUS_TABS.find((t) => t.key === statusParam)?.key ?? "ALL");

  const [stats, books] = await Promise.all([getBookStats(), listBooksForModeration(activeStatus)]);

  return (
    <AdminShell role={role} activeKey="books" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Book Management</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every book on the platform, at every stage.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value">{stats.published}</div>
          <div className="stat-sub">Published on the shelf</div>
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
            href={t.key === "ALL" ? "/admin/books" : `/admin/books?status=${t.key}`}
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

      <div className="map-card" style={{ padding: "6px 16px" }}>
        {books.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13, textAlign: "center" }}>
            Nothing here yet.
          </div>
        ) : (
          books.map((b) => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  by {b.authorName} · {b.status} · submitted {b.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  {b.reviewCount > 0 && ` · ${b.reviewCount} review${b.reviewCount === 1 ? "" : "s"}`}
                  {b.averageRating !== null && ` · ${b.averageRating.toFixed(1)}★`}
                </div>
              </div>
              {b.status === "PENDING_REVIEW" ? (
                <ModerationActions bookId={b.id} />
              ) : (
                <Link href={`/book/${b.id}`} className="btn btn-ghost btn-small">View</Link>
              )}
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
