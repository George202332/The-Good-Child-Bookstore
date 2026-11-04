import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { SiteHealthServices } from "@/components/SiteHealthServices";

export const dynamic = "force-dynamic";

/** Investor > Site Health: the same status as the Admin page, VIEW ONLY (no Check now, no alert address, no switches). */
export default async function InvestorSiteHealthPage({ searchParams }: { searchParams?: Promise<{ page?: string; service?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");
  const sp = (await searchParams) ?? {};
  return (
    <InvestorShell activeKey="site-health" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Site Health</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Whether the site and its outside services are working. View only.</p>
        </div>
      </div>
      <SiteHealthServices readOnly basePath="/investor/site-health" page={Math.max(1, Number(sp.page) || 1)} service={sp.service} />
    </InvestorShell>
  );
}
