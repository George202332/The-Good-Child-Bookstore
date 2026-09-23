import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getSiteSettingsForEditing } from "@/actions/site-settings";
import { getPagesContent } from "@/actions/page-content";
import { SiteSettingsForm } from "./SiteSettingsForm";
import { PageContentForm } from "./PageContentForm";

/**
 * Site Settings — branding (logo, favicon, footer, payment badge
 * images) and the intro content of every major page. API credentials
 * and third-party integration settings moved to their own dedicated
 * page — see Admin → API Management — per explicit instruction to
 * consolidate all API keys/secrets there instead of mixing them in
 * with branding/content.
 */
export default async function SiteSettingsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const [{ settings }, pagesContent] = await Promise.all([
    getSiteSettingsForEditing(),
    getPagesContent(),
  ]);

  return (
    <AdminShell role="ADMIN" activeKey="site-settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Site Settings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Branding, footer, payment badges, and page content — everything shown across the site. For API
            credentials, see Admin → API Management.
          </p>
        </div>
      </div>

      <SiteSettingsForm initial={settings} />

      <h2 style={{ fontSize: 18, margin: "32px 0 16px" }}>Page Content</h2>
      <PageContentForm initial={pagesContent} />
    </AdminShell>
  );
}
