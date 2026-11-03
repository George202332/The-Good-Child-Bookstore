import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { getLuluReport } from "@/actions/admin-lulu";
import { LuluClient } from "@/app/admin/lulu/LuluClient";

export const dynamic = "force-dynamic";

/** Investor > Lulu Publishing: the same Lulu tab the Admin has, read only (no refreshing from Lulu, no connecting notifications). */
export default async function InvestorLuluPage({ searchParams }: { searchParams?: Promise<{ range?: string; from?: string; to?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");

  const sp = (await searchParams) ?? {};
  const report = await getLuluReport(sp.range, sp.from, sp.to);
  if (!report) redirect("/admin");

  return (
    <InvestorShell activeKey="lulu" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Lulu Publishing</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Printed orders sent to Lulu: what customers paid, what Lulu charges, and how each order is progressing. View only.
          </p>
        </div>
      </div>
      <LuluClient report={report} range={sp.range ?? "this-month"} from={sp.from ?? ""} to={sp.to ?? ""} readOnly basePath="/investor/lulu" />
    </InvestorShell>
  );
}
