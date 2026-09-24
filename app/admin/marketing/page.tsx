import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getMarketingOptInCount } from "@/actions/marketing";
import { MarketingComposeForm } from "./MarketingComposeForm";

export default async function AdminMarketingPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const optInCount = await getMarketingOptInCount();

  return (
    <AdminShell role="ADMIN" activeKey="marketing" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Marketing Email</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Opt-in only — sends to the {optInCount} reader{optInCount === 1 ? "" : "s"} currently opted in from
            Settings. A working unsubscribe link is added to every send automatically.
          </p>
        </div>
      </div>

      <MarketingComposeForm optInCount={optInCount} />
    </AdminShell>
  );
}
