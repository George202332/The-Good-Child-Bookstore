import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getSiteSettingsForEditing } from "@/actions/site-settings";
import { getGoogleConnectionStatus, getGoogleRedirectUriForDisplay } from "@/actions/google-email";
import { ApiManagementForm } from "./ApiManagementForm";

/**
 * TASK 1.2 — Backend migration.
 *
 * API Management — every third-party API key, client secret, and
 * integration setting for the site, consolidated here per explicit
 * instruction (previously split across Site Settings). Strictly
 * protected: uses the same admin-only session check as every other
 * admin page (authAdmin() + role === "ADMIN"), not a new or looser
 * check — nothing here is reachable by Editor/Accountant/Chief_Editor
 * or any public account.
 */
export default async function ApiManagementPage({ searchParams }: { searchParams: Promise<{ googleError?: string; googleConnected?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { googleError } = await searchParams;

  const [{ settings, apiKeysSet }, googleConnection, googleRedirectUri] = await Promise.all([
    getSiteSettingsForEditing(),
    getGoogleConnectionStatus(),
    getGoogleRedirectUriForDisplay(),
  ]);

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

      <ApiManagementForm
        initial={settings}
        apiKeysSet={apiKeysSet}
        googleConnection={googleConnection}
        googleRedirectUri={googleRedirectUri}
        googleErrorFromUrl={googleError}
      />
    </AdminShell>
  );
}
