import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getLuluReport, getStagingLuluState } from "@/actions/admin-lulu";
import { StagingLuluSwitch } from "./StagingLuluSwitch";
import { LuluClient } from "./LuluClient";
import { listPrintBookIssues } from "@/lib/print-book-issues";
import { readQuoteStats } from "@/lib/site-health/quote-log";
import Link from "next/link";

/** Admin > Lulu. Admin only: the page redirects everyone else, and every action it calls
 * checks the role again on the server. */
export default async function LuluPage({ searchParams }: { searchParams?: Promise<{ range?: string; from?: string; to?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const sp = (await searchParams) ?? {};
  const report = await getLuluReport(sp.range, sp.from, sp.to);
  const stagingState = await getStagingLuluState();
  if (!report) redirect("/admin");
  const [issues, quoteStats] = await Promise.all([listPrintBookIssues().catch(() => ({})), readQuoteStats()]);
  const issueList = Object.values(issues as Record<string, import("@/lib/print-book-issues").PrintBookIssue>);

  return (
    <AdminShell role="ADMIN" activeKey="lulu" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Lulu Publishing</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Printed orders sent to Lulu: what customers paid, what Lulu charges, and how each order is progressing. Use the dates to match Lulu&apos;s invoices.
          </p>
        </div>
      </div>
      {issueList.length > 0 && (
        <div className="map-card" role="alert" style={{ padding: 14, marginBottom: 16, fontSize: 13, borderLeft: "4px solid #a1262a" }}>
          <strong>Printed books with incomplete print details ({issueList.length}).</strong> A customer may not get a shipping price for these. Fix them before customers meet them:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {issueList.map((i) => (
              <li key={i.bookId}>
                <Link href={`/admin/books/${i.bookId}/review`}>{i.title}</Link> - {[...i.problems, i.flagged?.message].filter(Boolean).join(" ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 12px" }}>
        Shipping-price requests at checkout, last 7 days: {quoteStats.summary.last7d.ok} fine, {quoteStats.summary.last7d.slow} slow, {quoteStats.summary.last7d.failed} failed. Details are in Site Health.
      </p>
      {stagingState.staging && <StagingLuluSwitch on={stagingState.on} changedAt={stagingState.changedAt} changedBy={stagingState.changedBy} />}
      <LuluClient report={report} range={sp.range ?? "this-month"} from={sp.from ?? ""} to={sp.to ?? ""} />
    </AdminShell>
  );
}
