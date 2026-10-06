import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getBlogAnalytics } from "@/actions/blog-analytics";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { ColHelp } from "@/components/ColHelp";

const REGION_COLORS = ["#1B3C8F", "#8C2F16", "#165236", "#6B4503", "#7A5FB5", "#C6437E", "#3F8F8A", "#7C7490"];

/**
 * Blogs — pure-numbers analytics for this account's own blog posts:
 * reads, comments, and real geotagged regions (see lib/geo.ts). Open to
 * every account type since blogging itself is (see app/account/blog).
 */
export default async function BlogAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR") redirect("/account");

  const data = await getBlogAnalytics();

  return (
    <DashboardShell role={role} activeKey="blog-analytics" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Blogs</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            How your blog posts are performing — pure numbers, not revenue.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Total Reads</div>
          <div className="stat-value">{data.totalReads}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Comments</div>
          <div className="stat-value">{data.totalComments}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Published Posts</div>
          <div className="stat-value">{data.publishedPosts}</div>
          <div className="stat-sub">Currently live</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Regions Reached</div>
          <div className="stat-value">{data.regionBreakdown.length}</div>
          <div className="stat-sub">Distinct read locations</div>
        </div>
      </div>

      <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Reads by month</h3>
        <BarChart data={data.monthlyReads.map((m) => ({ label: m.month, value: m.reads }))} color="#1B3C8F" />
      </div>

      <div className="dash-grid-2" style={{ marginBottom: 24 }}>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Reads by region</h3>
          <PieChart data={data.regionBreakdown.map((c, i) => ({ label: c.country, value: c.reads, color: REGION_COLORS[i % REGION_COLORS.length] }))} />
        </div>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Top posts by reads</h3>
          <BarChart data={data.topPosts.map((p) => ({ label: p.title, value: p.reads }))} color="#8C2F16" />
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Post performance</h3>
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {[
                { label: "Post", help: "The blog post's title." },
                { label: "Reads", help: "How many times this post has been read." },
                { label: "Comments", help: "How many comments this post has received." },
              ].map((c) => (
                <th key={c.label} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase" }}>{c.label}<ColHelp text={c.help} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.topPosts.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No posts published yet.</td></tr>
            ) : (
              data.topPosts.map((p) => (
                <tr key={p.title}>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{p.title}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{p.reads}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{p.comments}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
