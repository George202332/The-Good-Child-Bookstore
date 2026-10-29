import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getLuluReport } from "@/actions/admin-lulu";
import { LuluClient } from "./LuluClient";

/** Admin > Lulu. Admin only: the page redirects everyone else, and every action it calls
 * checks the role again on the server. */
export default async function LuluPage({ searchParams }: { searchParams?: Promise<{ range?: string; from?: string; to?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const sp = (await searchParams) ?? {};
  const report = await getLuluReport(sp.range, sp.from, sp.to);
  if (!report) redirect("/admin");

  return (
    <AdminShell role="ADMIN" activeKey="lulu" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Lulu</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Printed orders sent to Lulu: what customers paid, what Lulu charges, and how each order is progressing. Use the dates to match Lulu&apos;s invoices.
          </p>
        </div>
      </div>
      <LuluClient report={report} range={sp.range ?? "this-month"} from={sp.from ?? ""} to={sp.to ?? ""} />
    </AdminShell>
  );
}
