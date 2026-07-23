import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyCampaigns } from "@/actions/campaigns";
import { CampaignManager } from "./CampaignManager";

/**
 * Campaigns — group referral links into a named marketing push and see
 * aggregate clicks/sales across all of them, rather than only per-link
 * stats (see /account/referrals). New functionality; the original had
 * no real campaign tracking (it was part of the simulated affiliate
 * dashboard content).
 */
export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AFFILIATE") redirect("/account");

  const campaigns = await listMyCampaigns();

  return (
    <DashboardShell role="AFFILIATE" activeKey="campaigns" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Campaigns</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Group your referral links into a marketing push and track combined performance.
          </p>
        </div>
      </div>
      <CampaignManager initial={campaigns} />
    </DashboardShell>
  );
}
