import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPaymentSafety } from "@/lib/api-keys";
import { findOldVariableNames, variableGroups } from "@/lib/payment-env";
import { deploymentLabel, describeDatabase, STAGING_LULU_REFERENCE } from "@/lib/runtime-env";
import { ensureFreshServiceHealth, getAlertEmail, readCheckHistory, readIncidents, CHECK_EVERY_MINUTES } from "@/lib/site-health/service-health";
import { getStagingLuluSwitch } from "@/lib/staging-lulu";
import { SERVICE_ORDER } from "@/lib/service-checks";
import { ServiceStatusTable } from "@/components/ServiceStatusTable";
import { RunChecksButton, AlertEmailForm } from "@/app/admin/site-health/ServiceChecksControls";

const LABEL: Record<string, string> = {
  database: "Database", migrations: "Database updates", vercel: "Vercel", paystack: "Paystack", paypal: "PayPal", lulu_auth: "Lulu sign-in", lulu_quote: "Lulu quote",
  lulu_files: "Lulu file fetch", lulu_order: "Lulu order creation", email: "Email (Resend)", storage: "File storage", integrations: "Other integrations",
};
// A file download, not a page (kept in a constant so the page-link lint rule does not mistake it for a page).
const PDF_URL = "/api/admin/site-health/pdf";
const when = (d: Date | string) => new Date(d).toLocaleString();

/** The whole "outside services" part of Site Health. Used by the Admin page (with controls) and the Investor page (readOnly: no buttons, no forms). */
export async function SiteHealthServices({ readOnly, basePath, page, service }: { readOnly: boolean; basePath: string; page: number; service?: string }) {
  const [snap, safety, alertEmail, history, incidents] = await Promise.all([
    ensureFreshServiceHealth(), getPaymentSafety(), getAlertEmail(), readCheckHistory({ page, pageSize: 50, service }), readIncidents(100),
  ]);
  const deployment = safety.deployment;
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  const warnings = [safety.paystack, safety.paypal].filter((s) => s.safeguard && s.reason).map((s) => s.reason as string);
  const old = findOldVariableNames(process.env);
  const groups = variableGroups(deployment).map((g) => ({ ...g, rows: g.names.map((n) => ({ name: n, present: !!process.env[n]?.trim() })) }));
  const isStaging = deployment !== "production";
  let stagingCount = 0;
  let stagingSwitch = false;
  if (isStaging) {
    stagingCount = await prisma.order.count({ where: { stagingLuluOrder: true } }).catch(() => 0);
    stagingSwitch = (await getStagingLuluSwitch().catch(() => ({ on: false }))).on;
  }
  const pages = Math.max(1, Math.ceil(history.total / history.pageSize));
  const link = (p: number, svc?: string) => `${basePath}?page=${p}${svc ? `&service=${svc}` : ""}`;

  return (
    <>
      <div className="map-card" style={{ padding: 14, marginBottom: 16, fontSize: 13 }}>
        <strong>This copy of the site:</strong> {deploymentLabel(deployment)} · <strong>Active key set:</strong> {safety.set === "live" ? "LIVE (real money)" : "TEST / sandbox (no real money)"}
        {db ? ` · Database: ${db.label ? `${db.label} - ` : ""}${db.endpoint}${db.database ? ` / ${db.database}` : ""}` : " · Database: not set"}
        {snap.lastRunAt && <> · Last automatic check: {when(snap.lastRunAt)} (every {CHECK_EVERY_MINUTES} minutes)</>}
        <div style={{ color: "var(--admin-text-faint)", marginTop: 4 }}>Test or live is decided only by the environment Vercel reports; there is no switch.</div>
      </div>

      {warnings.length > 0 && (
        <div role="alert" style={{ background: "#a1262a", color: "#fff", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13.5 }}>
          <strong>Payment safeguard is ON (customers see a friendly &quot;payments unavailable&quot; message):</strong> {warnings.join(" ")}
        </div>
      )}

      {isStaging && (
        <div className="map-card" style={{ padding: 14, marginBottom: 16, fontSize: 13, borderLeft: `4px solid ${stagingSwitch ? "#a1262a" : "#8a5a00"}` }}>
          <strong>Staging Lulu orders:</strong> the switch &quot;Allow real Lulu orders from staging&quot; is <strong>{stagingSwitch ? "ON - real print orders will be created for confirmed test payments" : "OFF"}</strong>.
          Orders sent to Lulu from staging so far: <strong>{stagingCount}</strong>. They carry the reference &quot;{STAGING_LULU_REFERENCE}&quot; and are left out of Accounting; cancel them in the Lulu dashboard.
          {" "}See <Link href="/admin/lulu">Lulu Publishing</Link>.
        </div>
      )}

      {old.length > 0 && !readOnly && (
        <div role="note" style={{ background: "#fff3cd", color: "#4a3500", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13.5 }}>
          Old Vercel variables still present (the site no longer reads them): <span style={{ fontFamily: "monospace" }}>{old.join(", ")}</span>. Do not delete them until the new code has been tested on staging and merged.
        </div>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Outside services</h3>
      <p style={{ color: "var(--admin-text-faint)", fontSize: 13, margin: "0 0 10px" }}>
        Checked automatically every {CHECK_EVERY_MINUTES} minutes. The checks only read: they never create a charge, a payout or a print order.
        {!readOnly && " You get one email when a service first fails, one when it works again, and a reminder every 6 hours while it stays down."}
      </p>
      {!readOnly && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 12 }}>
            <RunChecksButton />
            <AlertEmailForm initial={alertEmail ?? ""} />
            <a className="btn btn-small" href={PDF_URL} download>Download PDF</a>
          </div>
          {!alertEmail && (
            <p role="note" style={{ background: "#fff3cd", color: "#4a3500", padding: "8px 12px", borderRadius: 8, fontSize: 13, margin: "0 0 12px" }}>
              No alert address is set yet, so no alert emails will be sent. Enter one above and press Save.
            </p>
          )}
        </>
      )}
      {readOnly && (
        <p style={{ margin: "0 0 12px" }}><a className="btn btn-small" href={PDF_URL} download>Download PDF</a>{alertEmail ? <span style={{ fontSize: 13, marginLeft: 10 }}>Alerts go to {alertEmail}.</span> : null}</p>
      )}
      <div style={{ marginBottom: 24 }}><ServiceStatusTable results={snap.results} states={snap.states} /></div>

      <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Variables in this environment (names only, never values)</h3>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", marginBottom: 8 }}>
        {groups.map((g) => (
          <div key={g.group} className="map-card" style={{ padding: 12, fontSize: 13 }}>
            <strong>{g.group}</strong>
            <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, fontFamily: "monospace", fontSize: 12 }}>
              {g.rows.map((r) => (
                <li key={r.name}><span style={{ color: r.present ? "#2e8b57" : "#d64545" }}>{r.present ? "present" : "MISSING"}</span> {r.name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-text-faint)", margin: "0 0 24px" }}>
        The site can only see the variables of the environment it is running in. To see the other environment, open Site Health on that site (staging shows Preview, the live site shows Production).
      </p>

      <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Incidents</h3>
      {incidents.length === 0 ? <p style={{ fontSize: 13 }}>No incidents recorded.</p> : (
        <div style={{ overflowX: "auto", marginBottom: 24 }}>
          <table className="admin-table" style={{ width: "100%", fontSize: 12.5 }}>
            <thead><tr><th>Service</th><th>Started</th><th>Resolved</th><th>Failed checks</th><th>Last error</th></tr></thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td>{LABEL[i.service] ?? i.service}</td><td>{when(i.startedAt)}</td><td>{i.resolvedAt ? when(i.resolvedAt) : "still down"}</td><td>{i.checksFailed}</td><td>{i.lastError ?? i.firstError ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>History of checks ({history.total})</h3>
      <p style={{ fontSize: 13, margin: "0 0 8px" }}>
        Show: <Link href={link(1)}>all</Link>{SERVICE_ORDER.map((k) => <span key={k}> · <Link href={link(1, k)}>{LABEL[k]}</Link></span>)}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table" style={{ width: "100%", fontSize: 12.5 }}>
          <thead><tr><th>When</th><th>Service</th><th>Status</th><th>Response</th><th>Error</th></tr></thead>
          <tbody>
            {history.rows.map((r) => (
              <tr key={r.id}><td>{when(r.checkedAt)}</td><td>{LABEL[r.service] ?? r.service}</td><td style={{ color: r.ok ? "#2e8b57" : "#d64545" }}>{r.ok ? "OK" : "FAILED"}</td><td>{r.responseMs != null ? `${r.responseMs} ms` : "-"}</td><td>{r.error ?? ""}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 13, margin: "8px 0 24px" }}>
        Page {history.page} of {pages}
        {history.page > 1 && <> · <Link href={link(history.page - 1, service)}>Newer</Link></>}
        {history.page < pages && <> · <Link href={link(history.page + 1, service)}>Older</Link></>}
      </p>
    </>
  );
}
