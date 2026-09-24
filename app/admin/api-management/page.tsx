import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getSiteSettingsForEditing } from "@/actions/site-settings";
import { ApiManagementForm } from "./ApiManagementForm";

/**
 * API Management — every third-party API key and credential for the
 * site, consolidated here (moved out of Site Settings). Strictly
 * protected: same admin-only session check as every other admin page
 * (authAdmin() + role === "ADMIN") — nothing here is reachable by
 * Editor/Accountant/Chief_Editor or any public account.
 *
 * No Google OAuth credentials live here — email sending is handled by
 * a send-only service configured via environment variables (see
 * lib/email/), not a database-stored client id/secret pair.
 */
export default async function ApiManagementPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { settings, apiKeysSet } = await getSiteSettingsForEditing();

  return (
    <AdminShell role="ADMIN" activeKey="api-management" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>API Management</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every API key, client secret, and third-party integration setting for the site, in one place.
          </p>
        </div>
      </div>

      <ApiManagementForm initial={settings} apiKeysSet={apiKeysSet} />
    </AdminShell>
  );
}
