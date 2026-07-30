import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR") redirect("/admin");

  return (
    <DashboardShell role={role} activeKey="security" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Security</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Manage your password.</p>
        </div>
      </div>
      <ChangePasswordForm />
    </DashboardShell>
  );
}
