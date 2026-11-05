import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { canModerateContent, canViewFinancials } from "@/lib/roles";
import { buildWebAnalyticsReport, monthChoices, parseMonth } from "@/lib/analytics/report";
import { analyticsEnabledFor } from "@/lib/analytics/policy";

export const dynamic = "force-dynamic";

function Table({ title, head, rows }: { title: string; head: [string, string]; rows: [string, string | number][] }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h3>
      {rows.length === 0 ? <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No data for this month.</p> : (
        <table className="table"><thead><tr><th>{head[0]}</th><th style={{ textAlign: "right" }}>{head[1]}</th></tr></thead>
          <tbody>{rows.map(([a, b], i) => <tr key={i}><td>{a}</td><td style={{ textAlign: "right" }}>{b}</td></tr>)}</tbody></table>
      )}
    </div>
  );
}

/** Website analytics: real visit counts only (accepted-analytics visitors, live site). Empty lists mean no data, never made-up numbers. */
export default async function WebAnalyticsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (!canModerateContent(role)) redirect("/admin");
  const { month } = await searchParams;
  const choice = parseMonth(month).key;
  const r = await buildWebAnalyticsReport(choice, { includeMoney: canViewFinancials(role) });
  const live = analyticsEnabledFor();
  return (
    <AdminShell role={role} activeKey="web-analytics" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Website Analytics</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Counts only visitors who accepted analytics cookies. No names, e-mails or payment details are ever recorded.</p>
        </div>
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select name="month" defaultValue={choice} aria-label="Month">{monthChoices().map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
          <button className="btn btn-ghost btn-small" type="submit">Show</button>
          <a className="btn btn-ghost btn-small" href={`/api/admin/web-analytics/csv?month=${choice}`}>Download CSV</a>
          <a className="btn btn-ghost btn-small" href={`/api/admin/web-analytics/pdf?month=${choice}`}>Download PDF</a>
        </form>
      </div>
      {!live && <div className="buybox-note" style={{ marginBottom: 14 }}>This is not the live site, so no visits are counted here. Open the live site&apos;s admin to see real numbers.</div>}
      {!r.hasData && live && <div className="buybox-note" style={{ marginBottom: 14 }}>Nothing has been recorded for {r.monthLabel} yet. Numbers appear after visitors accept the cookie notice.</div>}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {([["Page views", r.totals.pageViews], ["Visits", r.totals.visits], ["Book views", r.totals.bookViews], ["Added to cart", r.totals.addToCart], ["Checkout started", r.totals.checkoutStarted], ["Purchases", r.totals.purchases]] as [string, number][]).map(([l, v]) => (
          <div className="stat-card" key={l}><div className="stat-label">{l}</div><div className="stat-value">{v}</div><div className="stat-sub">{r.monthLabel}</div></div>
        ))}
        {r.totals.revenue !== null && <div className="stat-card"><div className="stat-label">Revenue (counted purchases)</div><div className="stat-value">${r.totals.revenue.toFixed(2)}</div><div className="stat-sub">{r.monthLabel}</div></div>}
      </div>
      <Table title="Top pages" head={["Page", "Views"]} rows={r.topPages.map((p) => [p.path, p.views])} />
      <Table title="Top blog posts" head={["Post", "Views"]} rows={r.topBlogPosts.map((p) => [p.title, p.views])} />
      <Table title="Top books" head={["Book", "Views"]} rows={r.topBooks.map((p) => [p.title, p.views])} />
      <Table title="Traffic sources" head={["Source", "Visits"]} rows={r.sources.map((p) => [p.source, p.visits])} />
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Blog to book to sale</h3>
        {r.blogConversion.length === 0 ? <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No data for this month.</p> : (
          <table className="table"><thead><tr><th>Post</th><th>Clicks to books</th><th>Book views</th><th>Added to cart</th><th>Checkout started</th><th>Purchases</th>{r.totals.revenue !== null && <th>Revenue</th>}</tr></thead>
            <tbody>{r.blogConversion.map((b) => <tr key={b.slug}><td>{b.title}</td><td>{b.clicksToBooks}</td><td>{b.bookViews}</td><td>{b.addToCart}</td><td>{b.checkouts}</td><td>{b.purchases}</td>{b.revenue !== null && <td>${b.revenue.toFixed(2)}</td>}</tr>)}</tbody></table>
        )}
      </div>
    </AdminShell>
  );
}
