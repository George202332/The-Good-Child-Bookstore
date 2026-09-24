import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMySettings, getMarketingOptIn } from "@/actions/settings";
import { getReaderAffiliateStatus } from "@/actions/reader-affiliate";
import { SettingsForm } from "./SettingsForm";
import { AffiliateToggle } from "./AffiliateToggle";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { MarketingOptInToggle } from "./MarketingOptInToggle";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR") redirect("/admin");

  const settings = await getMySettings();
  const affiliateStatus = role === "READER" ? await getReaderAffiliateStatus() : null;
  const marketingOptIn = role === "READER" ? await getMarketingOptIn() : false;

  return (
    <DashboardShell role={role} activeKey="settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Settings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Display and notification preferences.</p>
        </div>
      </div>
      <SettingsForm initial={settings} />
      <div style={{ marginTop: 20 }}>
        <ChangePasswordForm />
      </div>
      {role === "READER" && <AffiliateToggle initialEnabled={affiliateStatus?.enabled ?? false} />}
      {role === "READER" && <MarketingOptInToggle initialOptIn={marketingOptIn} />}
    </DashboardShell>
  );
}
