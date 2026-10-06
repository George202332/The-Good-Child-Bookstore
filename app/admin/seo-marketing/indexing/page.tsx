import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getIndexingReport } from "@/actions/seo-marketing";
import { ColHelp } from "@/components/ColHelp";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";

export const dynamic = "force-dynamic";

const TABLE_HEAD_STYLE: React.CSSProperties = { ...TH_STYLE, padding: "10px 14px", borderBottom: "1px solid var(--admin-border, #2A3244)", color: "var(--admin-text-faint, #6B7385)", fontSize: 11, letterSpacing: undefined, whiteSpace: undefined };
const TABLE_CELL_STYLE: React.CSSProperties = { ...TD_STYLE, padding: "10px 14px", borderBottom: "1px solid var(--admin-border, #2A3244)", fontSize: undefined, verticalAlign: undefined };

/**
 * Indexing — every book, blog post, author profile, and static page
 * currently eligible for indexing, and whether it's actually been
 * submitted via IndexNow. "Submitted successfully" here means IndexNow
 * itself accepted the ping; it is not the same as Google or Bing
 * confirming they crawled the page, which only Search Console/Bing
 * Webmaster Tools can show — this is the most complete, honest picture
 * available without that separate integration.
 */
export default async function IndexingPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const rows = await getIndexingReport();
  const submittedCount = rows.filter((r) => r.status === "SUBMITTED").length;
  const failedCount = rows.filter((r) => r.status === "FAILED").length;
  const notYetCount = rows.filter((r) => r.status === "NOT_YET_SUBMITTED").length;

  return (
    <AdminShell role={role} activeKey="seo-marketing" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Indexing</h2>
          <p style={{ color: "var(--admin-text-faint, #6B7385)", fontSize: 13.5, marginTop: 2 }}>
            Every book, blog post, author profile, and static page eligible for indexing, and its real IndexNow
            submission status. This reflects what IndexNow itself accepted — confirming an actual Google or Bing
            crawl requires checking Search Console or Bing Webmaster Tools directly.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Submitted</div><div className="stat-value">{submittedCount}</div><div className="stat-sub">Accepted by IndexNow</div></div>
        <div className="stat-card"><div className="stat-label">Failed</div><div className="stat-value">{failedCount}</div><div className="stat-sub">Submission rejected or errored</div></div>
        <div className="stat-card"><div className="stat-label">Not yet submitted</div><div className="stat-value">{notYetCount}</div><div className="stat-sub">No IndexNow ping on record</div></div>
      </div>

      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TABLE_HEAD_STYLE}>Type<ColHelp text="What kind of page this is (book, blog post, author profile, or static page)." /></th>
              <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The page's title." /></th>
              <th style={TABLE_HEAD_STYLE}>URL<ColHelp text="The page's live URL." /></th>
              <th style={TABLE_HEAD_STYLE}>Status<ColHelp text="Submitted means IndexNow accepted the ping. Failed means it was rejected or errored. Not yet submitted means no ping has been sent for this page." /></th>
              <th style={TABLE_HEAD_STYLE}>Last submitted<ColHelp text="When this page was last pinged to IndexNow." /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "24px 14px", textAlign: "center", color: "var(--admin-text-faint, #6B7385)" }}>Nothing to show yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.url}>
                  <td style={TABLE_CELL_STYLE}>{r.type}</td>
                  <td style={TABLE_CELL_STYLE}><strong>{r.title}</strong></td>
                  <td style={TABLE_CELL_STYLE}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--admin-accent, #5B8DEF)", fontSize: 12 }}>{r.url}</a>
                  </td>
                  <td style={TABLE_CELL_STYLE}>
                    <span
                      style={{
                        fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                        background: r.status === "SUBMITTED" ? "rgba(31,107,72,0.15)" : r.status === "FAILED" ? "rgba(183,71,42,0.15)" : "rgba(107,115,133,0.15)",
                        color: r.status === "SUBMITTED" ? "#165236" : r.status === "FAILED" ? "#8C2F16" : "#A6AEC2",
                      }}
                    >
                      {r.status === "SUBMITTED" ? "Submitted" : r.status === "FAILED" ? "Failed" : "Not yet submitted"}
                    </span>
                  </td>
                  <td style={TABLE_CELL_STYLE}>{r.lastSubmittedAt ? r.lastSubmittedAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
