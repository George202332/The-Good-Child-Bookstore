import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getSiteSettingsForEditing } from "@/actions/site-settings";
import { getPagesContent } from "@/actions/page-content";
import { SiteSettingsForm } from "./SiteSettingsForm";
import { PageContentForm } from "./PageContentForm";
import { ShippingLevelsForm } from "./ShippingLevelsForm";

/**
 * Site Management — branding (logo, favicon, footer, payment badge
 * images) plus the full content editor for every page on the site
 * (Home, Bookshelf, Authorship, Affiliate, Blog, Contact Us, Privacy
 * Policy, Terms of Service, Returns Policy, FAQs), each as its own tab
 * with one editing pane, plus the shipping methods offered for printed
 * copies. No keys live here: they are Vercel environment variables, and
 * their status is on Admin → Site Health.
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
          <h2 style={{ fontSize: 20 }}>Site Management</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Branding, footer, payment badges, shipping methods, and the content editor for every page on the site. For the
            status of outside services, see Admin → Site Health.
          </p>
        </div>
      </div>

      <SiteSettingsForm initial={settings} />

      <h2 style={{ fontSize: 18, margin: "32px 0 12px" }}>Shipping methods</h2>
      <ShippingLevelsForm initial={settings.apiKeys.luluShippingLevels ?? []} />

      <h2 style={{ fontSize: 18, margin: "32px 0 16px" }}>Page Content</h2>
      <PageContentForm initial={pagesContent} />
    </AdminShell>
  );
}
