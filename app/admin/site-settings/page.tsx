import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getSiteSettingsForEditing } from "@/actions/site-settings";
import { getPagesContent } from "@/actions/page-content";
import { SiteSettingsForm } from "./SiteSettingsForm";
import { PageContentForm } from "./PageContentForm";

/**
 * Site Settings — everything that used to live on a separate Homepage
 * page is merged in here, plus full control over branding (logo,
 * favicon, footer, payment badge images), API credentials, and the
 * intro content of every major page, all in one place, per explicit
 * request to "control the site from the backend."
 */
export default async function SiteSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const [{ settings, apiKeysSet }, pagesContent] = await Promise.all([
    getSiteSettingsForEditing(),
    getPagesContent(),
  ]);

  return (
    <AdminShell role="ADMIN" activeKey="site-settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Site Settings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Branding, footer, payment badges, API credentials, and page content — everything shown across the site.
          </p>
        </div>
      </div>

      <SiteSettingsForm initial={settings} apiKeysSet={apiKeysSet} />

      <h2 style={{ fontSize: 18, margin: "32px 0 16px" }}>Page Content</h2>
      <PageContentForm initial={pagesContent} />
    </AdminShell>
  );
}
