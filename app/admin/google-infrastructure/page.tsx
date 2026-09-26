import { redirect } from "next/navigation";
import Link from "next/link";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import {
  getGoogleServicesStatus,
  getGoogleIndexingTable,
  getGoogleAnalyticsDiagnostics,
  getSearchConsoleDiagnostics,
  type GoogleServiceRow,
} from "@/actions/google-infrastructure";
import { GoogleIndexingTable } from "./GoogleIndexingTable";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<GoogleServiceRow["status"], string> = {
  healthy: "Healthy",
  connected: "Connected",
  configured: "Configured",
  needs_verification: "Needs verification",
  warning: "Warning",
  not_configured: "Not configured",
};
const STATUS_COLOR: Record<GoogleServiceRow["status"], { bg: string; fg: string }> = {
  healthy: { bg: "rgba(31,107,72,0.15)", fg: "#1F6B48" },
  connected: { bg: "rgba(31,107,72,0.15)", fg: "#1F6B48" },
  configured: { bg: "rgba(31,107,72,0.15)", fg: "#1F6B48" },
  needs_verification: { bg: "rgba(212,160,23,0.18)", fg: "#8A5A0B" },
  warning: { bg: "rgba(212,160,23,0.18)", fg: "#8A5A0B" },
  not_configured: { bg: "rgba(107,115,133,0.15)", fg: "#6B7385" },
};

function StatusPill({ status }: { status: GoogleServiceRow["status"] }) {
  const c = STATUS_COLOR[status];
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Google Infrastructure — the single top-level admin area consolidating
 * every Google-facing integration already built into this app: GA4/GTM
 * (app/layout.tsx), Search Console verification (same file), the
 * auto-generated sitemaps/robots.txt (app/sitemap*.ts, app/robots.ts),
 * and structured data (lib/seo/json-ld.ts). It does not create a second
 * GA4 property, a second Search Console property, or any parallel
 * config system — every status below is read from the exact same env
 * vars and generated feeds the rest of the app already uses.
 *
 * "SEO & Marketing" (a separate, pre-existing admin page) still owns
 * IndexNow, redirects, and per-page metadata overrides — none of that
 * is Google-specific (IndexNow pings Bing/Yandex, not Google), so it
 * intentionally stays where it is rather than being folded in here.
 * This page links out to it instead of duplicating it.
 */
export default async function GoogleInfrastructurePage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "CHIEF_EDITOR") redirect("/account");

  const [services, indexingRows, gaDiag, gscDiag] = await Promise.all([
    getGoogleServicesStatus(),
    getGoogleIndexingTable(),
    getGoogleAnalyticsDiagnostics(),
    getSearchConsoleDiagnostics(),
  ]);

  return (
    <AdminShell role={role} activeKey="google-infrastructure" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Google Infrastructure</h2>
          <p style={{ color: "var(--admin-text-faint, #6B7385)", fontSize: 13.5, marginTop: 2 }}>
            One place to see how this site connects to Google — Analytics, Search Console, indexing health, and
            overall status. Full reports still live inside Google&apos;s own platforms; this is the configuration
            and diagnostic view.
          </p>
        </div>
      </div>

      {/* Google Services Status — overview first */}
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Google Services Status</h3>
      <div className="map-card" style={{ padding: 0, marginBottom: 28, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {services.map((s) => (
              <tr key={s.key} style={{ borderBottom: "1px solid var(--admin-border, #2A3244)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</td>
                <td style={{ padding: "12px 16px" }}><StatusPill status={s.status} /></td>
                <td style={{ padding: "12px 16px", color: "var(--admin-text-faint, #6B7385)", fontSize: 12.5 }}>{s.detail}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                  {s.actionHref && (
                    <a href={s.actionHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-small">
                      {s.actionLabel ?? "Open"}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Google Analytics */}
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Google Analytics</h3>
      <div className="map-card" style={{ padding: "16px 20px", marginBottom: 28 }}>
        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className="stat-card">
            <div className="stat-label">GA4 Measurement ID</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{gaDiag.measurementId ?? "Not set"}</div>
            <div className="stat-sub">{gaDiag.configured ? "Tag renders on every page" : "gtag.js is not injected"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tag Manager container</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{gaDiag.gtmId ?? "Not set"}</div>
            <div className="stat-sub">{gaDiag.gtmConfigured ? "Optional — active" : "Optional — not in use"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Local ecommerce events logged</div>
            <div className="stat-value">{gaDiag.ecommerceEventCount}</div>
            <div className="stat-sub">Diagnostic count only</div>
          </div>
        </div>
        <p className="field-hint" style={{ margin: 0 }}>
          This connects to the existing GA4 property using its Measurement ID — nothing here creates a new
          property. Real-time and historical reports live in Google Analytics itself; use the link above under
          Services Status to open it. Order totals, royalties, commissions, and payouts are always computed from
          the Good Child transaction system (Order/SaleLine records) — GA4 only ever mirrors purchase events for
          marketing analysis and never determines or overrides a financial figure anywhere in this app.
        </p>
        {!gaDiag.configured && (
          <p className="field-hint" style={{ marginTop: 10, color: "#8A5A0B" }}>
            To connect: set <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code> to the existing property&apos;s Measurement
            ID (starts with &quot;G-&quot;) in your environment variables and redeploy.
          </p>
        )}
      </div>

      {/* Google Search Console */}
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Google Search Console</h3>
      <div className="map-card" style={{ padding: "16px 20px", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--admin-border, #2A3244)" }}>
          <span>Property</span>
          <span style={{ fontWeight: 700 }}>{gscDiag.propertyUrl}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--admin-border, #2A3244)" }}>
          <span>Verification status</span>
          <StatusPill status={gscDiag.verified ? "connected" : "needs_verification"} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--admin-border, #2A3244)" }}>
          <span>Verification method</span>
          <span>{gscDiag.verificationMethod}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
          <span>Sitemap to submit</span>
          <a href={gscDiag.sitemapUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--admin-accent, #5B8DEF)" }}>{gscDiag.sitemapUrl}</a>
        </div>
        <p className="field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
          This uses the existing Good Child property in Search Console — no new property is created here, and no
          Google password is ever requested or stored. If verification shows &quot;Needs verification&quot;, copy
          the HTML-tag verification code from Search Console&apos;s existing property (Settings → Ownership
          verification) into <code>GOOGLE_SITE_VERIFICATION</code> and redeploy; the tag is already wired to
          render automatically once that value is set (see the site&apos;s &lt;head&gt;).
        </p>
      </div>

      {/* Google SEO & Indexing */}
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Google SEO &amp; Indexing</h3>
      <p className="field-hint" style={{ marginTop: -6, marginBottom: 14 }}>
        Every public page Google is expected to index, plus the private/authenticated areas that are
        intentionally kept out — clearly separated so an expected exclusion never reads as a problem.
      </p>
      <div style={{ marginBottom: 28 }}>
        <GoogleIndexingTable rows={indexingRows} />
      </div>

      <p className="field-hint">
        Redirects, per-page metadata overrides, and IndexNow (instant indexing for Bing/Yandex) are managed on the{" "}
        <Link href="/admin/seo-marketing" style={{ color: "var(--admin-accent, #5B8DEF)" }}>SEO &amp; Marketing</Link> page.
      </p>
    </AdminShell>
  );
}
