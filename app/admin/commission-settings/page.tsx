import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getCommissionRates } from "@/lib/commission-settings";
import { CommissionSettingsForm } from "./CommissionSettingsForm";

/**
 * Admin control over the two real commission percentages this platform
 * pays out — previously hardcoded constants in lib/revenue.ts, now
 * stored in the same generic Setting key-value table Site Settings
 * uses (no schema change needed). Referral commission's default moved
 * from 3% to 5% per explicit instruction.
 */
export default async function CommissionSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/login");

  const rates = await getCommissionRates();

  return (
    <AdminShell role="ADMIN" activeKey="commission-settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Commission Settings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Controls the two percentages affiliates are paid — takes effect on every sale from the moment you save.
          </p>
        </div>
      </div>
      <CommissionSettingsForm initial={rates} />
    </AdminShell>
  );
}
