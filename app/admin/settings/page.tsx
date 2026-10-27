import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { FontSettingsForm } from "@/components/FontSettingsForm";
import { getAppearanceForUser } from "@/actions/appearance";

/** Backend Settings: every backend role (Admin, Editor, Chief Editor,
 * Accountant) can choose their own font and text size here. */
export default async function AdminSettingsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const appearance = await getAppearanceForUser(session.user.id);

  return (
    <AdminShell role={session.user.role} activeKey="settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Settings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Display preferences for your own backend account.</p>
        </div>
      </div>
      <FontSettingsForm area="admin" initial={appearance} />
    </AdminShell>
  );
}
