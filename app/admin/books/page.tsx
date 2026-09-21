import { redirect } from "next/navigation";
import Link from "next/link";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getBookStats, listBooksForModeration } from "@/actions/book-management";
import { getSiteSettings } from "@/actions/site-settings";
import { PublishingFormatToggles } from "./PublishingFormatToggles";
import { DeleteBookButton } from "./DeleteBookButton";

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
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const { status: statusParam } = await searchParams;
  const activeStatus = (STATUS_TABS.find((t) => t.key === statusParam)?.key ?? "ALL");

  const [stats, books, siteSettings] = await Promise.all([getBookStats(), listBooksForModeration(activeStatus), getSiteSettings()]);

  return (
    <AdminShell role={role} activeKey="books" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Book Management</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every book on the platform, at every stage.</p>
        </div>
      </div>

      {role === "ADMIN" && <PublishingFormatToggles initial={siteSettings.publishingFormatsEnabled} />}

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

      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        {books.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13, textAlign: "center" }}>
            Nothing here yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>SN / ISBN</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Title</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Author</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Account</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Status</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Open</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{b.isbn || "N/A"}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}><strong>{b.title}</strong></td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{b.authorName}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{b.authorAccountNumber}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{b.status}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                    <Link href={`/admin/books/${b.id}/review`} className="btn btn-primary btn-small">Open</Link>
                  </td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                    <DeleteBookButton bookId={b.id} bookTitle={b.title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
