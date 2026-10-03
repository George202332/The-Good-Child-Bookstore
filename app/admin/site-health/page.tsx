import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getSiteHealthSnapshot } from "@/lib/site-health/checks";
import { HealthCategoryCard } from "./HealthCategoryCard";
import { RefreshButton } from "./RefreshButton";

/**
 * Site Health — a single-glance diagnostic overview across API/backend,
 * database, auth/security, payouts, file storage, and general frontend
 * health (see lib/site-health/checks.ts for what each category actually
 * checks and how). Admin-only, same pattern as API Management: nothing
 * here is reachable by Editor/Accountant/Chief_Editor.
 *
 * Deliberately NOT a cosmetic dashboard: every number on this page
 * comes from either a live query run on this exact page load, or a
 * count read back from the SystemErrorLog/AuditLog tables that this
 * round's code actually writes to — never a static/fake placeholder.
 * Each category's card says, in its own words, which of those two
 * kinds of check it is.
 */
export default async function SiteHealthPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const snapshot = await getSiteHealthSnapshot();
  const overall = snapshot.categories.some((c) => c.status === "error")
    ? "error"
    : snapshot.categories.some((c) => c.status === "warning")
      ? "warning"
      : "ok";
  const overallLabel = overall === "ok" ? "All systems healthy" : overall === "warning" ? "Needs attention" : "Action needed";

  return (
    <AdminShell role="ADMIN" activeKey="site-health" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Site Health</h2>
          <p style={{ color: "var(--admin-text-faint)", fontSize: 13.5, marginTop: 2 }}>
            A diagnostic overview of the whole site, computed live when this page loads — last checked{" "}
            {new Date(snapshot.generatedAt).toLocaleString()}.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`health-pill health-${overall}`}>{overallLabel}</span>
          <RefreshButton />
        </div>
      </div>

      <div className="map-card" style={{ padding: 16, marginBottom: 24, fontSize: 12.5, color: "var(--admin-text-soft)" }}>
        <strong style={{ color: "var(--admin-text)" }}>What this page is (and isn&apos;t):</strong> every check below either runs
        live, right now, against the real database — or reads a count from the <code>SystemErrorLog</code>/<code>AuditLog</code>{" "}
        tables that the checkout, payout, file-upload, and auth code paths write to. There&apos;s no historical
        request-logging/APM system in this app, so this page never claims to show a continuous error rate it doesn&apos;t
        have data for — each category says which kind of check it is. Any error detected in checkout, payouts, file
        uploads, or auth also sends an immediate email to support@thegoodchildbookstore.com (throttled to one email per
        15 minutes per distinct error) — see <code>lib/site-health/alert.ts</code>.
      </div>

      <div className="stat-grid" style={{ marginBottom: 0, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {snapshot.categories.map((category) => (
          <HealthCategoryCard key={category.key} category={category} />
        ))}
      </div>
    </AdminShell>
  );
}
