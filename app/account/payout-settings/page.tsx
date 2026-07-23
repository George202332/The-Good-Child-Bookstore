import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyWiseRecipients } from "@/actions/wise-recipients";
import { RecipientManager } from "./RecipientManager";

/**
 * Payout Settings — where authors and affiliates add the accounts they
 * want to be paid out to via Wise (M-Pesa, bank transfer, etc). Shared
 * between both roles since the underlying WiseRecipient model and flow
 * are identical either way.
 */
export default async function PayoutSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR" && session.user.role !== "AFFILIATE") redirect("/account");

  const recipients = await listMyWiseRecipients();

  return (
    <DashboardShell role={session.user.role} activeKey="payout-settings" displayName={session.user.name ?? ""}>
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
