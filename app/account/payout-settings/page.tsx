import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyWiseRecipients } from "@/actions/wise-recipients";
import { RecipientManager } from "./RecipientManager";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

/**
 * Payout Settings — where authors and affiliates add the accounts they
 * want to be paid out to via Wise (M-Pesa, bank transfer, etc). Shared
 * between both roles, and also reachable by a Reader who's enabled
 * affiliate access from their own dashboard.
 */
export default async function PayoutSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AUTHOR" && role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const recipients = await listMyWiseRecipients();

  return (
    <DashboardShell role={role} activeKey="payout-settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payout Settings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Where your earnings are sent. All payouts are processed through Wise, so you can receive money via
            M-Pesa, bank transfer, and anything else Wise supports.
          </p>
        </div>
      </div>
      <RecipientManager initial={recipients} />
    </DashboardShell>
  );
}
