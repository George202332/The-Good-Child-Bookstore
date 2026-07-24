import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getSiteSettings } from "@/actions/site-settings";
import { SiteSettingsForm } from "./SiteSettingsForm";

/**
 * Site Settings — logo, footer text, and payment badge images, all
 * editable without touching code, per the explicit request to control
 * "the entire website front... logo... texts... including the footer...
 * PayPal, Mastercard, Visa, American Express, and Verve" badge images.
 */
export default async function SiteSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const settings = await getSiteSettings();

  return (
    <AdminShell role="ADMIN" activeKey="site-settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Site Settings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Logo, footer text, and payment badge images shown across the whole site.
          </p>
        </div>
      </div>
      <SiteSettingsForm initial={settings} />
    </AdminShell>
  );
}
